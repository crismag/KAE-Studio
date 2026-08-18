"""Connections and sources, as far as they can honestly go.

The application service for STI-1. It can verify a connection, confirm a source
is readable, and pin it to an immutable commit. It cannot analyze anything, and
`analyze()` says so rather than returning an empty result.

## Held in memory, on purpose

Studio owns no durable project state (ADR-0006). Connections and sources are
configuration rather than knowledge, so they will eventually belong in a Studio
store or in Memory — that decision is open, and inventing a schema for it here
would settle it by accident. Until then this holds them for the process
lifetime, and says so at the API rather than implying persistence it does not
have.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

from .github_source import GitHubSourceClient, SourceReadError, snapshot_digest
from .local_source import LocalSourceClient
from .model import (
    Connection,
    ConnectionState,
    ConnectivityCheck,
    ReadableFiles,
    Source,
    SourceKind,
    SourceScope,
    SourceSnapshot,
    SourceState,
)


class UnknownResource(LookupError):
    """A connection or source that does not exist."""


#: The fallback, for a deployment that configured nothing at all. Installing
#: the App comes first because it is the remedy somebody without shell access on
#: the host can actually carry out (`D-58`).
NO_CREDENTIAL = (
    "No GitHub credential is configured for this deployment, so no repository "
    "can be listed. Install the KAE GitHub App against the repositories it may "
    "read, or set STUDIO_GITHUB_SOURCE_TOKEN on the host and restart Studio."
)


class AcquisitionService:
    """Configure sources, verify them, pin them. Analysis is not here."""

    def __init__(
        self,
        github: GitHubSourceClient | None = None,
        unavailable_reason: str = "",
        local: LocalSourceClient | None = None,
    ) -> None:
        self._github = github
        #: A directory already on this machine (`ADR-0006`, `D-67`). `None`
        #: where no roots are configured, which means the provider does not
        #: exist rather than that it may read anywhere.
        self._local = local
        # Carried, not computed. There are four ways to have no client and they
        # have four different remedies (`D-58`); working out which from here
        # would put credential logic in the object whose contract is that it
        # holds no credentials.
        self._unavailable = unavailable_reason
        self._connections: dict[str, Connection] = {}
        self._sources: dict[str, Source] = {}

    # -- selection ---------------------------------------------------------

    def repositories(self, query: str = "") -> tuple[list[dict[str, object]], bool, str]:
        """What this deployment's credential can actually reach.

        Returns `(repositories, truncated, unavailable_reason)`. The third is
        empty when the listing worked, and **a sentence rather than an
        exception** when it did not: a picker with no options and no explanation
        is the state a person cannot act on, and the two reasons — no credential
        configured, or a credential that GitHub refused — have opposite
        remedies.
        """

        found: list[dict[str, object]] = []
        truncated = False

        # Local first. It needs no credential, so where both are configured the
        # answers that cost nothing come before the ones that can fail.
        if self._local is not None:
            local_found, local_truncated = self._local.repositories(query)
            found += [{**entry, "kind": SourceKind.LOCAL.value} for entry in local_found]
            truncated = truncated or local_truncated

        if self._github is not None:
            try:
                remote, remote_truncated = self._github.repositories(query)
            except SourceReadError as error:
                # Not fatal where local answers exist: a refused credential must
                # not hide the directories this deployment can plainly read.
                return found, truncated, str(error)
            found += [{**entry, "kind": SourceKind.GITHUB.value} for entry in remote]
            truncated = truncated or remote_truncated
        elif not found:
            return [], False, self._unavailable or NO_CREDENTIAL

        return found, truncated, ""


    # -- dispatch ----------------------------------------------------------

    def _client_for(self, source: Source) -> GitHubSourceClient | LocalSourceClient:
        """The client that can read this source, by its kind (`D-68`).

        A source knows where it came from, so the service does not have to be
        told twice by a mode. A kind whose provider this deployment did not
        configure says **that** — the `D-58` lesson applied before a second
        provider made it possible to get wrong again.
        """

        return self.client_for_kind(source.kind)

    def client_for_kind(self, kind: SourceKind) -> GitHubSourceClient | LocalSourceClient:
        """The same dispatch, before a `Source` exists to carry the kind.

        Configuring a source asks the same question reading one does — can this
        deployment reach that provider at all — and `add_source` needs the
        answer before it has built anything (`D-285`). Extracted rather than
        restated, so the three refusal sentences keep one definition.
        """

        if kind is SourceKind.LOCAL:
            if self._local is None:
                raise SourceReadError(
                    501,
                    "this deployment reads no local directories. Set "
                    "KAE_LOCAL_SOURCE_ROOTS to the directories KAE may read.",
                    remedy="Set KAE_LOCAL_SOURCE_ROOTS and restart the backend.",
                )
            return self._local
        if kind is SourceKind.GITHUB:
            if self._github is None:
                raise SourceReadError(
                    501,
                    self._unavailable or "no GitHub credential is configured",
                    remedy="Configure a GitHub credential in Settings.",
                )
            return self._github
        raise SourceReadError(
            501,
            f"a {kind.value} source cannot be read yet",
            remedy=f"Nothing to retry: this deployment cannot read a {kind.value} source.",
        )

    # -- connections -------------------------------------------------------

    def add_connection(self, provider: str, label: str, connection_ref: str) -> Connection:
        connection = Connection(
            connection_id=f"con_{uuid.uuid4().hex[:12]}",
            provider=provider,
            label=label,
            connection_ref=connection_ref,
        )
        self._connections[connection.connection_id] = connection
        return connection

    def connections(self) -> list[Connection]:
        return list(self._connections.values())

    def connection(self, connection_id: str) -> Connection:
        found = self._connections.get(connection_id)
        if found is None:
            raise UnknownResource(f"unknown connection {connection_id}")
        return found

    def check(self, connection_id: str, repo: str) -> ConnectivityCheck:
        """Ask the provider what this credential can do. Writes nothing.

        Read and write capability are recorded separately, because they are
        separate grants — and a check that reported one boolean would assert
        both on the evidence of whichever it happened to test.
        """

        connection = self.connection(connection_id)
        if self._github is None:
            self._connections[connection_id] = _with(
                connection, state=ConnectionState.UNREACHABLE,
                detail="no GitHub connection is configured for this deployment",
            )
            return ConnectivityCheck(
                ok=False,
                provider=connection.provider,
                detail="no GitHub connection is configured for this deployment",
            )

        try:
            capability = self._github.check(repo)
        except SourceReadError as error:
            state = (
                ConnectionState.REFUSED
                if error.kind in {"not_authorized", "not_found"}
                else ConnectionState.UNREACHABLE
            )
            self._connections[connection_id] = _with(
                connection, state=state, detail=str(error)
            )
            return ConnectivityCheck(
                ok=False, provider=connection.provider, detail=str(error)
            )

        self._connections[connection_id] = _with(
            connection,
            state=ConnectionState.VERIFIED,
            can_read=capability["can_read"],
            can_write=capability["can_write"],
            account=capability["account"],
            verified_at=datetime.now(UTC),
            detail="",
        )
        return ConnectivityCheck(
            ok=True,
            provider=connection.provider,
            account=capability["account"],
            can_read=capability["can_read"],
            can_write=capability["can_write"],
        )

    # -- sources -----------------------------------------------------------

    def authorize(self, kind: SourceKind, connection_id: str) -> None:
        """What has to be true before this source may be configured.

        A local directory needs no authorisation to reach it, so demanding a
        connection would be a grant with nothing behind it — `§19`, and the
        reason Settings has no revoke control (`D-68`).

        A remote kind that **names** a grant is checked against the working set.
        That is what stops a source being configured against a credential nobody
        issued (`D-22`), and it is unchanged.

        A remote kind that names none is configured against the deployment's own
        credential, so the question is whether there is one — asked of the same
        dispatch that would read the source, so an unreachable provider is
        refused in `D-58`'s words rather than in a sentence about a missing
        identifier. Since `GH-APP` the ordinary GitHub credential is an App
        installation, which issues no per-project connection for the Sources
        room to name; requiring one refused every repository somebody picked
        from a list of repositories KAE could already read (`D-285`).

        Called by the route before it writes anything durable, and again by
        `add_source`, so a caller reaching the service directly is held to the
        same rule as one arriving over HTTP.
        """

        if kind is SourceKind.LOCAL:
            return
        if connection_id:
            self.connection(connection_id)
            return
        self.client_for_kind(kind)

    def add_source(
        self,
        project_id: str,
        kind: SourceKind,
        connection_id: str,
        location: str,
        reference: str,
        scope: SourceScope | None = None,
        source_id: str | None = None,
    ) -> Source:
        """Configure a source.

        `source_id` is supplied by the caller when KAE-Memory has already
        assigned one (`D-21`). Studio minting its own would give one source two
        identities — one durable, one not — and every later call would have to
        know which it was holding.
        """

        self.authorize(kind, connection_id)
        source = Source(
            source_id=source_id or f"src_{uuid.uuid4().hex[:12]}",
            project_id=project_id,
            kind=kind,
            connection_id=connection_id,
            location=location,
            reference=reference,
            scope=scope or SourceScope(),
        )
        self._sources[source.source_id] = source
        return source

    def adopt_connection(self, connection: Connection) -> Connection:
        """Take a connection read back from KAE-Memory into this process.

        `D-22`: a connection belongs to the project and its record is Memory's.
        This dictionary is a working copy, and after a restart it is empty while
        every grant a person made is still real.

        Locally-held state wins, as it does for sources: a connection verified
        against the provider a moment ago carries a `can_read` this process
        established and Memory has not been told about.
        """

        return self._connections.setdefault(connection.connection_id, connection)

    def adopt(self, source: Source) -> Source:
        """Take a source read back from KAE-Memory into this process.

        `AUD-005`: this store is a working set, not a record. After a restart it
        is empty, and every source a person configured is still real — it is
        held in Memory, which is what `ADR-0004` ruled. Adoption is how the two
        meet, and it is deliberately not a write: nothing here re-registers what
        was just read.

        Locally-held state wins. A source pinned in this process a moment ago
        has a snapshot Memory has not been told about yet, and overwriting it
        with the durable record would undo work that succeeded.
        """

        return self._sources.setdefault(source.source_id, source)

    def sources(self, project_id: str) -> list[Source]:
        return [s for s in self._sources.values() if s.project_id == project_id]

    def source(self, source_id: str) -> Source:
        found = self._sources.get(source_id)
        if found is None:
            raise UnknownResource(f"unknown source {source_id}")
        return found

    def record_disposition(self, source_id: str, disposition: str) -> Source:
        """Take a classification KAE-Memory has already accepted (`ADR-0004`).

        **Not the decision, and it validates nothing.** Memory owns both the
        record and the five words, and refuses a sixth; this applies whatever
        came back so the working set cannot disagree with the record it was
        just told about. Without it, `adopt`'s `setdefault` would keep the old
        value until a restart — the page saying one thing and the record
        another, which is what rehydration exists to close.
        """

        updated = _with_source(self.source(source_id), disposition=disposition)
        self._sources[source_id] = updated
        return updated

    def record_retirement(self, source_id: str, retired_at: str) -> Source:
        """Take a retirement KAE-Memory has already recorded (`D-254`).

        **Not the decision.** Memory owns the timestamp and keeps the first one,
        so the value applied here is whatever came back rather than one this
        process computed — which is also why resuming passes `""`. Without it
        `adopt`'s `setdefault` would keep the old value until a restart, the
        page saying a source is read and the record saying it is not.
        """

        updated = _with_source(self.source(source_id), retired_at=retired_at)
        self._sources[source_id] = updated
        return updated

    def pin(self, source_id: str) -> Source:
        """Resolve the reference to an immutable commit and describe the scope.

        This is the most a source can currently become. The state it reaches is
        `PINNED`, **not** `ANALYZED`, and the difference is everything a product
        would like to claim at this point: a pinned source means we know exactly
        which bytes we *would* read, not that we have read or understood any.
        """

        source = self.source(source_id)
        if source.kind not in {SourceKind.GITHUB, SourceKind.LOCAL}:
            raise NotImplementedError(
                f"pinning a {source.kind.value} source is not implemented. Only "
                f"repositories can be resolved to an immutable revision."
            )
        try:
            client = self._client_for(source)
            revision = client.resolve(source.location, source.reference or "HEAD")
            entries, truncated = client.tree(source.location, revision)
        except SourceReadError as error:
            updated = _with_source(source, state=SourceState.CONFIGURED, last_error=str(error))
            self._sources[source_id] = updated
            return updated

        in_scope = [e for e in entries if not source.scope.excludes(e["path"])]
        snapshot = SourceSnapshot(
            revision=revision,
            resolved_at=datetime.now(UTC),
            file_count=len(in_scope),
            total_bytes=sum(e["size"] for e in in_scope),
            excluded_count=len(entries) - len(in_scope),
            content_digest=snapshot_digest(in_scope),
        )
        updated = _with_source(
            source,
            state=SourceState.PINNED,
            snapshot=snapshot,
            # Truncation is surfaced rather than swallowed. A partial listing
            # described as a total is a snapshot digest that means nothing.
            last_error=(
                "this repository is larger than one listing; the counts above are "
                "partial" if truncated else ""
            ),
        )
        self._sources[source_id] = updated
        return updated

    def sample(self, source_id: str, path: str) -> str:
        """Read one harmless file, proving the source is genuinely readable.

        A capability check proves a credential reaches a repository. This proves
        content comes back — a distinction worth keeping, because a token with
        metadata-only scope passes the first and fails the second.
        """

        source = self.source(source_id)
        client = self._client_for(source)
        if source.scope.excludes(path):
            raise SourceReadError(
                403, f"{path} is outside the configured scope for this source"
            )
        revision = source.snapshot.revision if source.snapshot else (source.reference or "HEAD")
        content = client.read_file(source.location, path, revision)

        readable = _with_source(
            source,
            state=SourceState.READABLE if source.state is SourceState.CONFIGURED else source.state,
        )
        self._sources[source_id] = readable
        return content


    def readable_files(self, source_id: str, limit: int = 50) -> ReadableFiles:
        """The in-scope files of a pinned source, largest first.

        Lists the tree again at the revision the pin fixed, which is what makes
        the answer reproducible: the pin is a commit, so the same call returns
        the same entries however long ago it was resolved. `truncated` says the
        repository was larger than one listing — surfaced rather than swallowed,
        because a partial set presented as a total is what a snapshot digest is
        supposed to make impossible.

        **This rule is stricter than the one the pin counted with** (`D-242`).
        `pin` admits every entry the path rules allow; a file KAE could read has
        to be small enough to read as well, so anything over
        `scope.max_file_bytes` is left out here and was counted there. The
        difference is returned rather than left as an absence: a person choosing
        files for ingest cannot otherwise tell a deliberate ceiling from a file
        that failed to arrive.
        """

        source = self.source(source_id)
        client = self._client_for(source)
        if source.snapshot is None:
            raise SourceReadError(
                409,
                "this source has not been pinned to a revision",
                remedy="Pin this source to a revision, then read it.",
            )

        entries, truncated = client.tree(source.location, source.snapshot.revision)
        admitted = [entry for entry in entries if not source.scope.excludes(entry["path"])]
        in_scope = [
            entry for entry in admitted if entry["size"] <= source.scope.max_file_bytes
        ]
        in_scope.sort(key=lambda entry: entry["size"], reverse=True)
        return ReadableFiles(
            files=in_scope[:limit],
            truncated=truncated or len(in_scope) > limit,
            omitted_too_large=len(admitted) - len(in_scope),
            max_file_bytes=source.scope.max_file_bytes,
        )

    def read_for_ingest(self, source_id: str, paths: Sequence[str]) -> list[tuple[str, str, str]]:
        """Read several in-scope files, each with the coordinate it was read at.

        **Ingestion, not analysis.** This returns text, the path it came from
        and the coordinate that text may be recorded under. It derives no
        structure, and `ANALYSIS_UNAVAILABLE` stays accurate until something
        does — relabelling this as analysis is the specific dishonesty the
        module docstring was written against.

        The coordinate is the client's answer rather than the pin, because only
        the client knows whether it read history or a working tree (`D-182`).

        Scope is enforced per file rather than trusted from the caller, because
        the caller is a route and a route takes its list from a browser. A path
        outside scope raises rather than being skipped: silently dropping one is
        how a person ends up believing their configuration covered something it
        did not.
        """

        source = self.source(source_id)
        client = self._client_for(source)
        if source.snapshot is None:
            raise SourceReadError(
                409,
                "this source has not been pinned to a revision",
                remedy="Pin this source to a revision, then read it.",
            )

        revision = source.snapshot.revision
        read: list[tuple[str, str, str]] = []
        for path in paths:
            if source.scope.excludes(path):
                raise SourceReadError(
                    403, f"{path} is outside the configured scope for this source"
                )
            text, coordinate = client.read_at(source.location, path, revision)
            read.append((path, text, coordinate))
        return read


def _with(connection: Connection, **changes: object) -> Connection:
    from dataclasses import replace

    return replace(connection, **changes)  # type: ignore[arg-type]


def _with_source(source: Source, **changes: object) -> Source:
    from dataclasses import replace

    return replace(source, **changes)  # type: ignore[arg-type]


__all__ = ["AcquisitionService", "UnknownResource"]
