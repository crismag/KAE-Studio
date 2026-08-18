"""The acquisition vocabulary, with the gaps named as gaps.

Every type here exists to keep two things apart that a user interface wants to
merge. The setup prompt says it directly: *"A successful connection does not
imply a readable source. A readable source does not imply a writable
destination."*
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any


class ConnectionState(StrEnum):
    """How much is known about a provider authorization.

    `CONFIGURED` and `VERIFIED` are deliberately separate. A connection somebody
    typed in is not a connection anybody has used, and the difference is one
    round trip — which is exactly the round trip a setup wizard is tempted to
    skip because it makes the form feel slower.
    """

    CONFIGURED = "configured"
    VERIFIED = "verified"
    #: The provider answered, and said no. Distinct from unreachable: one is a
    #: permissions problem, the other is an outage, and they send an operator to
    #: completely different places.
    REFUSED = "refused"
    UNREACHABLE = "unreachable"


class SourceKind(StrEnum):
    """Where material comes from.

    `§7` names seven. Four exist: a repository, an object store, a file
    somebody hands over, and pasted text (`D-24`). Upload decode lives in
    Studio (`VC-06/H`): PDF, Word, Excel, CSV and plain text become evidence
    through the same ingest path paste already uses. Analysis is still 501.

    **URL is not among these by omission.** It needs outbound egress from the
    host, which is a surface somebody has to sanction rather than something a
    source kind quietly acquires.
    """

    GITHUB = "github"
    #: A directory already on this machine (`ADR-0006`). Needs no credential,
    #: no App and no network — which is why it is the source kind that made the
    #: repository-to-knowledge path reachable at all (`D-67`).
    LOCAL = "local"
    S3 = "s3"
    UPLOAD = "upload"
    #: Text a person typed or pasted. Its content is in hand the moment it
    #: arrives, so it is never `configured` — there is nothing left to reach.
    PASTE = "paste"


class SourceState(StrEnum):
    """What is actually true about a source, in the order it becomes true.

    The whole point of this enumeration is that **`ANALYZED` cannot currently be
    reached**. Nothing in this package sets it; nothing can, because analysis is
    not implemented. It is declared so the states below it cannot quietly stand
    in for it — a `PINNED` source rendered as "analyzed" would be a claim about
    understanding a project made on the strength of a successful HTTP GET.
    """

    #: Configured, never contacted.
    CONFIGURED = "configured"
    #: The provider confirmed the location exists and is readable.
    READABLE = "readable"
    #: Resolved to an immutable revision. A branch moves; a commit does not.
    PINNED = "pinned"
    #: Content has been read, findings proposed, and evidence retained.
    #: **Not reachable yet.**
    ANALYZED = "analyzed"


#: Returned wherever a caller asks for analysis. A capability gap reported as a
#: fact, in the same shape Studio already uses for Memory's MCP-only gaps —
#: because a UI that receives an empty findings list cannot tell it apart from a
#: repository in which nothing was found.
ANALYSIS_UNAVAILABLE = {
    "capability": "source.analysis",
    "reason": (
        "Reading a repository into proposed findings is not implemented. A source "
        "can be connected, read and pinned to an exact commit; nothing yet turns "
        "that snapshot into project knowledge."
    ),
    "state": "planned",
    "proved_instead": ["connection verified", "source readable", "revision pinned"],
}


@dataclass(frozen=True, slots=True)
class Connection:
    """A revocable authorization relationship with a provider account.

    **Holds a reference, never a secret.** `connection_ref` names where the
    credential lives — `env:KAE_GITHUB_TOKEN` — and the trusted backend resolves
    it at the moment of a call. A connection object travels into API responses
    that reach a browser; a token in one would be a token in a browser.
    """

    connection_id: str
    provider: str
    #: What a person calls it. Never the account's credentials, and never an
    #: identifier that would let somebody else use it.
    label: str
    connection_ref: str
    state: ConnectionState = ConnectionState.CONFIGURED
    #: Capabilities the provider confirmed, separately. Read permission does not
    #: imply write permission, and a single `verified: true` would assert both
    #: on the evidence of whichever was checked.
    can_read: bool = False
    can_write: bool = False
    account: str = ""
    verified_at: datetime | None = None
    detail: str = ""

    def redacted(self) -> dict[str, object]:
        """What a browser may see. **Never `connection_ref`.**

        It is not a secret itself, but it names one — and a reference published
        to a browser tells an attacker exactly which environment variable or
        file to go after.
        """

        return {
            "connection_id": self.connection_id,
            "provider": self.provider,
            "label": self.label,
            "state": self.state.value,
            "can_read": self.can_read,
            "can_write": self.can_write,
            "account": self.account,
            "verified_at": self.verified_at.isoformat() if self.verified_at else "",
            "detail": self.detail,
        }


@dataclass(frozen=True, slots=True)
class SourceScope:
    """How much of a source KAE may read.

    Defaults exclude the things that are large, generated, or secret. Not a
    performance concern: `.env` files and key material are exactly what a
    repository reader would otherwise hoover into an evidence store.
    """

    include_paths: tuple[str, ...] = ()
    exclude_paths: tuple[str, ...] = (
        ".git/",
        "node_modules/",
        "vendor/",
        "dist/",
        "build/",
        ".venv/",
        "__pycache__/",
        ".env",
        ".env.*",
        "*.pem",
        "*.key",
        "*.p12",
        "id_rsa*",
    )
    max_file_bytes: int = 1_000_000
    documentation_only: bool = False

    @classmethod
    def from_record(cls, record: Mapping[str, Any] | None) -> SourceScope:
        """Rebuild a scope from KAE-Memory's durable record (`D-223`).

        Here rather than in the route that reads it, because a route rebuilding
        this by hand re-derives four defaults the dataclass already owns and got
        one of them wrong: it fell back to no exclusions at all, so after a
        restart `.env` and `*.pem` were in scope for every source.

        **The exclusions are unioned with the defaults, not replaced by them.**
        They are a floor rather than a setting — nothing can configure them —
        so a record holding fewer is repaired on read instead of by a migration,
        and anything it holds beyond them is kept. The cost is that an empty
        exclusion list is inexpressible, which no caller has ever asked for.
        """

        scope = record or {}
        stored = tuple(str(pattern) for pattern in scope.get("exclude_paths", ()))
        floor = cls().exclude_paths
        return cls(
            include_paths=tuple(str(prefix) for prefix in scope.get("include_paths", ())),
            exclude_paths=stored + tuple(p for p in floor if p not in stored),
            max_file_bytes=int(scope.get("max_file_bytes", cls().max_file_bytes)),
            documentation_only=bool(scope.get("documentation_only", False)),
        )

    def excludes(self, path: str) -> bool:
        """Whether a path is out of scope. Prefix and simple-glob matching."""

        from fnmatch import fnmatch

        for pattern in self.exclude_paths:
            if pattern.endswith("/") and (path.startswith(pattern) or f"/{pattern}" in f"/{path}"):
                return True
            if fnmatch(path, pattern) or fnmatch(path.rsplit("/", 1)[-1], pattern):
                return True
        if self.include_paths:
            return not any(path.startswith(prefix) for prefix in self.include_paths)
        return False


@dataclass(frozen=True, slots=True)
class SourceSnapshot:
    """An immutable resolved revision. The thing analysis would run against.

    A branch is not a snapshot: it moves, and a finding traced to `main` is
    traced to whatever `main` happens to be when somebody reads the trace. The
    commit SHA is what makes provenance mean anything later.
    """

    revision: str
    resolved_at: datetime
    #: What the scope actually admitted, at that revision. Counts rather than
    #: contents — this is a description of a snapshot, not the snapshot.
    file_count: int = 0
    total_bytes: int = 0
    excluded_count: int = 0
    #: A digest over the paths and blob ids in scope. Two snapshots with the
    #: same digest hold the same files, which is what makes "has this changed
    #: since we read it?" answerable without reading it again.
    content_digest: str = ""


@dataclass(frozen=True, slots=True)
class ReadableFiles:
    """What a pinned source offers a person to read, and what it withheld.

    `omitted_too_large` is the whole reason this is a type rather than a list.
    A snapshot's `file_count` is every entry the path rules admit; this listing
    additionally requires a file small enough to read, so the two numbers
    disagree on any repository with a lock file in it. Returning the difference
    keeps the stricter rule visible where it applies (`D-242`).
    """

    files: list[dict[str, Any]]
    #: The repository was larger than one listing, or the limit cut it.
    truncated: bool
    #: In scope by path, left out by the byte ceiling.
    omitted_too_large: int
    max_file_bytes: int


@dataclass(frozen=True, slots=True)
class Source:
    """A provider location KAE may read from."""

    source_id: str
    project_id: str
    kind: SourceKind
    connection_id: str
    #: `owner/repo` for GitHub, a bucket for S3, an upload id otherwise.
    location: str
    #: The branch, tag or prefix a user chose. **Not** what gets analyzed —
    #: `snapshot.revision` is, and the two differ the moment somebody commits.
    reference: str = ""
    scope: SourceScope = field(default_factory=SourceScope)
    state: SourceState = SourceState.CONFIGURED
    snapshot: SourceSnapshot | None = None
    last_error: str = ""
    #: Where this source's material is to live (`ADR-0004`), or `""` when
    #: nobody has decided. Not defaulted to `memory`: KAE-Memory keeps the
    #: column nullable because an undecided source passing for one somebody
    #: chose to keep is the more expensive of the two mistakes. The five words
    #: are Memory's and are validated there; this carries whichever it returned.
    disposition: str = ""
    #: When KAE stopped reading this source, ISO-8601, or `""` while it is
    #: still read (`D-254`). **Not a `SourceState`**: retirement is orthogonal
    #: to the four states rather than a fifth point along them — a source stops
    #: being read from wherever it had got to and comes back there. The
    #: timestamp rather than a flag, because *when did we stop reading this* is
    #: the question the surface answers and Memory keeps the first answer.
    retired_at: str = ""

    @property
    def retired(self) -> bool:
        return bool(self.retired_at)

    def describe(self) -> dict[str, object]:
        """What a browser sees, including what is *not* true yet.

        `analysis` is present on every source and always reports the gap. A
        field that appeared only when analysis was unavailable would be a field
        a UI could forget to check.
        """

        return {
            "source_id": self.source_id,
            "project_id": self.project_id,
            "kind": self.kind.value,
            "connection_id": self.connection_id,
            "location": self.location,
            "reference": self.reference,
            "state": self.state.value,
            "scope": {
                "include_paths": list(self.scope.include_paths),
                "exclude_paths": list(self.scope.exclude_paths),
                "max_file_bytes": self.scope.max_file_bytes,
                "documentation_only": self.scope.documentation_only,
            },
            "snapshot": (
                {
                    "revision": self.snapshot.revision,
                    "resolved_at": self.snapshot.resolved_at.isoformat(),
                    "file_count": self.snapshot.file_count,
                    "total_bytes": self.snapshot.total_bytes,
                    "excluded_count": self.snapshot.excluded_count,
                    "content_digest": self.snapshot.content_digest,
                }
                if self.snapshot
                else None
            ),
            "last_error": self.last_error,
            # `null`, never a default word. A reader has to be able to tell
            # "nobody has decided" from "somebody chose to keep this".
            "disposition": self.disposition or None,
            # `null` while the source is read, which a reader can tell from a
            # timestamp. There is no `retired: false` beside it: two fields for
            # one fact are two chances to disagree.
            "retired_at": self.retired_at or None,
            "analysis": ANALYSIS_UNAVAILABLE,
        }


@dataclass(frozen=True, slots=True)
class ConnectivityCheck:
    """The result of asking a provider what a credential can do.

    **Non-destructive by definition.** The setup prompt requires that a
    connectivity check "must not silently publish user content" — so this is
    produced by reads alone, and write capability is inferred from the
    permissions the provider reports rather than by writing something to find
    out.
    """

    ok: bool
    provider: str
    account: str = ""
    can_read: bool = False
    can_write: bool = False
    #: Neutral. A provider's own message names the account and the installation.
    detail: str = ""
    checked_at: datetime = field(default_factory=lambda: datetime.now(UTC))

    def describe(self) -> dict[str, object]:
        return {
            "ok": self.ok,
            "provider": self.provider,
            "account": self.account,
            "can_read": self.can_read,
            "can_write": self.can_write,
            "detail": self.detail,
            "checked_at": self.checked_at.isoformat(),
            # Said explicitly, every time. A green tick beside a repository name
            # is read as "KAE understands this project", and the distance
            # between that and what a connectivity check proves is the whole
            # reason this field exists.
            "proves": "the credential can reach this location. Nothing has been read or analyzed.",
        }


__all__ = [
    "ANALYSIS_UNAVAILABLE",
    "Connection",
    "ConnectionState",
    "ConnectivityCheck",
    "Source",
    "SourceKind",
    "SourceScope",
    "SourceSnapshot",
    "SourceState",
]
