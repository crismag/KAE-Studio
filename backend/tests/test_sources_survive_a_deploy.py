"""A configured source is still there after the process restarts (`RFA-6`).

`AUD-005`, from the audit: *"connections vanish on restart."* Studio's
`AcquisitionService` holds `self._sources: dict`, so somebody who connected a
repository, chose its include paths and pinned a revision lost all of it on the
next deploy — silently, with the page afterwards reading exactly like a project
that had never been configured.

`ADR-0004` ruled that KAE-Memory owns the source reference and `D-21` built the
table. This is the half that makes Studio use it.

## Why the restart is simulated with a second app

The durable side is proved in KAE-Memory's own suite, against a real database.
What is Studio's to prove is the plumbing either side of it: that configuring a
source **writes** to the record, and that a process which has never seen that
source **reads it back**. A fake Memory that keeps its rows between two apps
isolates exactly that, and nothing else.
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

pytest.importorskip("cie_slim", reason="cris-cie-slim is a private sibling repository")

from kae_studio.api import create_app
from kae_studio.config import Settings

BASE = {
    "KAE_MEMORY_TOKEN": "token",
    "STUDIO_SESSION_SECRET": "x" * 40,
    "STUDIO_NO_AUTH": "1",
}


class RecordingMemory:
    """A KAE-Memory that keeps its source rows, and only its source rows.

    Deliberately **not** a spread of the real client: a mock built by copying an
    object's attributes loses its prototype methods, and the resulting port
    fails every call — which renders as a failed read and passes a
    failure-assertion for entirely the wrong reason. Every method used here is
    written out.
    """

    def __init__(self) -> None:
        self.rows: dict[str, list[dict[str, Any]]] = {}
        self.registrations = 0
        #: Grants a person made, which outlive any process (`D-22`).
        self.connections: dict[str, list[dict[str, Any]]] = {}
        self.configuration: dict[str, dict[str, str]] = {}
        #: Every retirement Memory actually recorded, so a second one that
        #: reached the record is visible rather than inferred from a timestamp.
        self.retirements: list[str] = []

    def grant(self, project_id: str, connection_id: str = "con-durable") -> str:
        self.connections.setdefault(project_id, []).append(
            {
                "connection_id": connection_id,
                "provider": "github",
                "state": "granted",
                "credential_reference": "env:STUDIO_GITHUB_SOURCE_TOKEN",
                "authorized_by": "cris",
                "detail": "",
            }
        )
        return connection_id

    async def register_source(self, project_id: str, body: dict[str, Any]) -> dict[str, Any]:
        self.registrations += 1
        rows = self.rows.setdefault(project_id, [])
        for row in rows:
            # Idempotent by (kind, location), as Memory is. A double that
            # created a second row would hide a client that registers twice.
            if row["kind"] == body["kind"] and row["location"] == body["location"]:
                row["scope"] = body["scope"]
                return row
        row = {
            "source_id": f"00000000-0000-0000-0000-00000000000{len(rows)}",
            "project_id": project_id,
            "kind": body["kind"],
            "location": body["location"],
            "state": body.get("state", "configured"),
            "connection_id": body.get("connection_id"),
            "scope": body.get("scope", {}),
            "pinned_revision": None,
            "digest": None,
            "disposition": None,
            "detail": "",
            "pinned": False,
        }
        rows.append(row)
        return row

    async def configure(
        self, project_id: str, field: str, value: str, **_: Any
    ) -> dict[str, Any]:
        self.configuration.setdefault(project_id, {})[field] = value
        return {"field": field, "value": value, "state": "confirmed"}

    async def ingest_document(
        self, project_id: str, title: str, text: str, **_: Any
    ) -> dict[str, Any]:
        # Carries loss, because `AUD-024` is that loss must reach a person and
        # a double that never reports any cannot catch a route that drops it.
        return {
            "document": title,
            "chunks_recorded": 1,
            "truncated_chunks": 3,
            "warnings": ["content was cut at the chunk ceiling"],
        }

    async def memory_connections(self, project_id: str) -> list[dict[str, Any]]:
        return list(self.connections.get(project_id, []))

    async def project_sources(self, project_id: str) -> list[dict[str, Any]]:
        return list(self.rows.get(project_id, []))

    async def setup_state(self, project_id: str) -> dict[str, Any]:
        """The shape the deployed `/v1/projects/{id}/setup` returns."""

        return {
            "project_id": project_id,
            "configuration": {
                field: {"value": value, "state": "confirmed", "in_use": True}
                for field, value in self.configuration.get(project_id, {}).items()
            },
        }

    async def pin_source(
        self, project_id: str, source_id: str, body: dict[str, Any]
    ) -> dict[str, Any]:
        for row in self.rows.get(project_id, []):
            if row["source_id"] == source_id:
                row["pinned_revision"] = body["revision"]
                row["state"] = body.get("state", "pinned")
                row["pinned"] = True
                return row
        raise AssertionError(f"pinned an unknown source {source_id}")

    async def record_source_state(
        self, project_id: str, source_id: str, state: str, detail: str = ""
    ) -> dict[str, Any]:
        for row in self.rows.get(project_id, []):
            if row["source_id"] == source_id:
                row["state"] = state
                row["detail"] = detail
                return row
        raise AssertionError(f"recorded state for an unknown source {source_id}")

    async def source_material(self, project_id: str) -> dict[str, Any]:
        """What a decision about each source would apply to (`D-170`).

        The double counts nothing itself: the join is KAE-Memory's and is proved
        against a real database in its own suite. What is Studio's to prove is
        that the numbers arrive unchanged, so the shape is fixed here and the
        values are arbitrary.
        """

        return {
            "sources": [
                {
                    "source_id": row["source_id"],
                    "kind": row["kind"],
                    "location": row["location"],
                    "disposition": row.get("disposition"),
                    "documents": 4,
                    "stored_bodies": 11,
                }
                for row in self.rows.get(project_id, [])
            ],
            "unattributed_documents": 2,
            "unattributed_bodies": 6,
        }

    async def classify_source(
        self, project_id: str, source_id: str, disposition: str
    ) -> dict[str, Any]:
        """Memory owns the vocabulary (`ADR-0004`, `D-168`), so the double does too.

        A double that accepted any word would let a Studio-side typo pass a test
        the deployment refuses.
        """

        from kae_studio.memory_client import MemoryRefused

        known = ("memory", "rag", "artifact", "reference", "ephemeral")
        if disposition.strip().lower() not in known:
            raise MemoryRefused(422, f"disposition must be one of {', '.join(known)}")
        for row in self.rows.get(project_id, []):
            if row["source_id"] == source_id:
                row["disposition"] = disposition.strip().lower()
                return row
        raise AssertionError(f"classified an unknown source {source_id}")

    def _row(self, project_id: str, source_id: str) -> dict[str, Any]:
        for row in self.rows.get(project_id, []):
            if row["source_id"] == source_id:
                return row
        raise AssertionError(f"unknown source {source_id}")

    async def stop_reading_source(self, project_id: str, source_id: str) -> dict[str, Any]:
        """Memory's own idempotence, because the surface depends on it (`D-254`).

        A double that overwrote the timestamp on every call would let a Studio
        change that retires twice pass, while the deployment answers *when did
        we stop reading this* with the wrong hour.
        """

        row = self._row(project_id, source_id)
        if not row.get("retired_at"):
            row["retired_at"] = f"2026-08-17T0{len(self.retirements)}:00:00+00:00"
            self.retirements.append(source_id)
        return row

    async def resume_reading_source(self, project_id: str, source_id: str) -> dict[str, Any]:
        row = self._row(project_id, source_id)
        row["retired_at"] = None
        return row

    async def aclose(self) -> None:
        """Closing is not a failure, and a stub that raises breaks teardown."""


class FailingMemory(RecordingMemory):
    """A Memory that cannot be reached when the listing asks."""

    async def project_sources(self, project_id: str) -> list[dict[str, Any]]:
        from kae_studio.memory_client import MemoryUnavailable

        raise MemoryUnavailable("could not reach KAE-Memory: connection refused")


def app_with(memory: RecordingMemory) -> TestClient:
    app = create_app(Settings.from_environment(BASE))
    client = TestClient(app)
    client.__enter__()
    # Replaced after startup, because startup builds the real one.
    app.state.memory = memory
    return client


CONFIGURED = {
    "kind": "github",
    "connection_id": "conn_1",
    "location": "kae/ministry-reporting",
    "reference": "main",
    "include_paths": ["docs/", "src/"],
    "documentation_only": False,
}


def connect(client: TestClient) -> str:
    connection = client.post(
        "/api/connections",
        json={
            "provider": "github",
            "label": "Source repository",
            "connection_ref": "env:STUDIO_GITHUB_SOURCE_TOKEN",
        },
    ).json()
    return str(connection["connection_id"])


class TestItSurvivesTheDeploy:
    def test_a_source_configured_before_a_restart_is_there_after_it(self) -> None:
        """`AUD-005`, as an assertion a dictionary cannot satisfy.

        The second app has never seen this source. Everything it knows comes
        from the record.
        """

        memory = RecordingMemory()
        first = app_with(memory)
        first.post(
            "/api/projects/p1/sources", json={**CONFIGURED, "connection_id": connect(first)}
        )
        first.__exit__(None, None, None)

        second = app_with(memory)
        try:
            listed = second.get("/api/projects/p1/sources").json()
        finally:
            second.__exit__(None, None, None)

        assert [source["location"] for source in listed["sources"]] == [
            "kae/ministry-reporting"
        ]

    def test_the_include_paths_survive_with_it(self) -> None:
        """The part that costs a person real thinking rather than typing.

        A repository can be re-picked from a list. What KAE should and should
        not read is a decision, and losing it silently is losing the decision.
        """

        memory = RecordingMemory()
        first = app_with(memory)
        first.post(
            "/api/projects/p1/sources", json={**CONFIGURED, "connection_id": connect(first)}
        )
        first.__exit__(None, None, None)

        second = app_with(memory)
        try:
            source = second.get("/api/projects/p1/sources").json()["sources"][0]
        finally:
            second.__exit__(None, None, None)

        assert source["scope"]["include_paths"] == ["docs/", "src/"]

    def test_the_secret_exclusions_survive_with_them(self) -> None:
        """`D-223`. The include paths survived and the exclusions did not.

        `SourceScope.exclude_paths` defaults to thirteen patterns whose
        docstring says they are not a performance concern — `.env` and `*.pem`
        are *"exactly what a repository reader would otherwise hoover into an
        evidence store."* The route recorded `[]` and the reader honoured it,
        so every source read back in a later process had no exclusions at all
        and `read_for_ingest`'s per-file refusal passed everything.

        Asserted through `excludes()` rather than on the list, because what
        matters is whether a path is refused, not which pattern refuses it.
        """

        from kae_studio.acquisition.model import SourceScope

        memory = RecordingMemory()
        first = app_with(memory)
        first.post(
            "/api/projects/p1/sources", json={**CONFIGURED, "connection_id": connect(first)}
        )
        first.__exit__(None, None, None)

        # The durable record says what was excluded, rather than nothing.
        assert ".env" in memory.rows["p1"][0]["scope"]["exclude_paths"]

        second = app_with(memory)
        try:
            source = second.get("/api/projects/p1/sources").json()["sources"][0]
        finally:
            second.__exit__(None, None, None)

        restored = SourceScope.from_record(source["scope"])
        for secret in (".env", ".env.production", "deploy/id_rsa", "certs/server.pem"):
            assert restored.excludes(secret), secret
        # And the decision that *was* configured is still the one in force.
        assert restored.include_paths == ("docs/", "src/")

    def test_a_record_written_before_the_fix_reads_as_the_floor(self) -> None:
        """`D-223`. Every row already in the store holds `[]`.

        Unioned rather than defaulted-when-empty, so a row that predates this
        needs no migration to be safe, and a row carrying a project's own
        exclusion keeps it.
        """

        from kae_studio.acquisition.model import SourceScope

        stale = SourceScope.from_record({"include_paths": [], "exclude_paths": []})
        assert stale.excludes(".env")

        added = SourceScope.from_record({"exclude_paths": ["fixtures/"]})
        assert added.excludes("fixtures/big.json")
        assert added.excludes("secrets/id_rsa")

    def test_it_takes_memory_s_identity_rather_than_minting_its_own(self) -> None:
        """One source, one id.

        Studio minting an id and telling Memory afterwards would give a source
        two identities whenever the second call failed — one durable, one not —
        and every later call would have to know which it was holding.
        """

        memory = RecordingMemory()
        client = app_with(memory)
        try:
            created = client.post(
                "/api/projects/p1/sources",
                json={**CONFIGURED, "connection_id": connect(client)},
            ).json()
        finally:
            client.__exit__(None, None, None)

        assert created["source_id"] == memory.rows["p1"][0]["source_id"]
        assert not created["source_id"].startswith("src_")

    def test_listing_twice_does_not_register_twice(self) -> None:
        # Rehydration is a read. A listing that re-registered what it read would
        # write on every page load, which is the shape of the bug that put
        # twenty questions into a transcript per projection (PPA-02/03).
        memory = RecordingMemory()
        client = app_with(memory)
        try:
            client.post(
                "/api/projects/p1/sources",
                json={**CONFIGURED, "connection_id": connect(client)},
            )
            client.get("/api/projects/p1/sources")
            client.get("/api/projects/p1/sources")
        finally:
            client.__exit__(None, None, None)

        assert memory.registrations == 1


class TestWhenTheRecordCannotBeRead:
    def test_it_says_so_rather_than_reporting_no_sources(self) -> None:
        """The substitution this codebase exists to refuse.

        An empty list is a claim about the project. *"I could not ask"* is a
        claim about this deployment, and after a restart the two look identical
        on screen while meaning opposite things.
        """

        client = app_with(FailingMemory())
        try:
            body = client.get("/api/projects/p1/sources").json()
        finally:
            client.__exit__(None, None, None)

        assert body["sources"] == []
        assert "could not be read" in body["unavailable"]
        assert "connection refused" in body["unavailable"]

    def test_a_readable_record_says_nothing(self) -> None:
        # The other half. A standing notice on every project is a notice nobody
        # reads, and it would make the one above invisible.
        client = app_with(RecordingMemory())
        try:
            body = client.get("/api/projects/p1/sources").json()
        finally:
            client.__exit__(None, None, None)

        assert body["unavailable"] == ""


class TestAddingASourceAfterARestart:
    """`D-22` — the workflow and the setup page stop contradicting each other.

    `add_source` validates its `connection_id` against this process's working
    set, and the product records connections in KAE-Memory. So somebody who
    authorized GitHub last week met *unknown connection* in the Sources Room
    while Project setup, two clicks away, showed the same connection as granted.

    Worse than the vanishing it replaced: the record says the thing exists and
    the workflow says it does not.
    """

    def test_a_grant_this_process_never_saw_is_enough_to_add_a_source(self) -> None:
        memory = RecordingMemory()
        durable = memory.grant("p1")

        # A fresh app. It has never issued a connection and holds none.
        client = app_with(memory)
        try:
            response = client.post(
                "/api/projects/p1/sources", json={**CONFIGURED, "connection_id": durable}
            )
        finally:
            client.__exit__(None, None, None)

        assert response.status_code == 201, response.text
        assert response.json()["location"] == "kae/ministry-reporting"

    def test_a_connection_nobody_granted_is_still_refused(self) -> None:
        """The half that keeps the fix from being a hole.

        Rehydrating must not mean accepting any identifier a browser sends. A
        source pointing at a grant that does not exist would be a source nothing
        can ever read, recorded as though it were configured.
        """

        memory = RecordingMemory()
        memory.grant("p1")

        client = app_with(memory)
        try:
            response = client.post(
                "/api/projects/p1/sources",
                json={**CONFIGURED, "connection_id": "con-nobody-granted"},
            )
        finally:
            client.__exit__(None, None, None)

        assert response.status_code == 404

    def test_another_project_s_grant_does_not_carry(self) -> None:
        """One environment variable, many project-scoped grants.

        The reason per-project won (`D-22`): permission to use a credential for
        one project is a decision, and a second project inheriting it is a
        decision nobody made.
        """

        memory = RecordingMemory()
        theirs = memory.grant("someone-else")

        client = app_with(memory)
        try:
            response = client.post(
                "/api/projects/p1/sources", json={**CONFIGURED, "connection_id": theirs}
            )
        finally:
            client.__exit__(None, None, None)

        assert response.status_code == 404

    def test_a_rehydrated_grant_is_not_reported_as_verified(self) -> None:
        """Memory's `granted` means a person authorized this.

        It does not mean the provider was contacted, and this process has
        contacted nothing since it started. Verification is one round trip, and
        claiming it without making it is exactly what `ConnectionState` splits
        `configured` from `verified` to prevent.
        """

        memory = RecordingMemory()
        durable = memory.grant("p1")

        client = app_with(memory)
        try:
            client.post("/api/projects/p1/sources", json={**CONFIGURED, "connection_id": durable})
            listed = client.get("/api/connections").json()["connections"]
        finally:
            client.__exit__(None, None, None)

        assert [c["state"] for c in listed] == ["configured"]
        # And never the reference itself: it names an environment variable, and
        # publishing that to a browser says which one to go after.
        assert all("connection_ref" not in c for c in listed)


class TestTheRepositoryNamedInSetupIsASource:
    """`D-23` — the loop between the two surfaces has something in it.

    Project setup wrote `primary_repository` into `project_configuration`. The
    Sources Room listed sources. Nothing joined them, so a person who named
    their repository in setup was told by the Sources Room that no repository
    was connected — with a button sending them back to setup, where it already
    was. Each screen was truthful, which is why it survived being built twice in
    one run.
    """

    def test_naming_it_registers_it(self) -> None:
        memory = RecordingMemory()
        client = app_with(memory)
        try:
            client.post(
                "/api/projects/p1/setup/configuration",
                json={"field": "primary_repository", "value": "kae/ministry-reporting"},
            )
            listed = client.get("/api/projects/p1/sources").json()
        finally:
            client.__exit__(None, None, None)

        assert [source["location"] for source in listed["sources"]] == [
            "kae/ministry-reporting"
        ]

    def test_it_is_named_rather_than_read(self) -> None:
        """`configured`, never `readable`.

        Nothing has contacted the provider. Claiming access on the strength of
        somebody typing a repository name is the substitution `SourceState`
        exists to refuse — a successful form submission is not a successful GET.
        """

        memory = RecordingMemory()
        client = app_with(memory)
        try:
            client.post(
                "/api/projects/p1/setup/configuration",
                json={"field": "primary_repository", "value": "kae/ministry-reporting"},
            )
            source = client.get("/api/projects/p1/sources").json()["sources"][0]
        finally:
            client.__exit__(None, None, None)

        assert source["state"] == "configured"
        assert source["snapshot"] is None

    def test_saving_the_same_repository_twice_registers_one_source(self) -> None:
        memory = RecordingMemory()
        client = app_with(memory)
        try:
            for _ in range(2):
                client.post(
                    "/api/projects/p1/setup/configuration",
                    json={"field": "primary_repository", "value": "kae/ministry-reporting"},
                )
            listed = client.get("/api/projects/p1/sources").json()
        finally:
            client.__exit__(None, None, None)

        assert len(listed["sources"]) == 1

    def test_changing_it_does_not_delete_the_previous_source(self) -> None:
        """Deleting acquired configuration is an act nobody has designed.

        Two sources after a change is visibly odd and recoverable. A source
        deleted because somebody edited a field is neither, and a settings write
        is the worst possible place to invent a deletion.
        """

        memory = RecordingMemory()
        client = app_with(memory)
        try:
            for repository in ("kae/first", "kae/second"):
                client.post(
                    "/api/projects/p1/setup/configuration",
                    json={"field": "primary_repository", "value": repository},
                )
            listed = client.get("/api/projects/p1/sources").json()
        finally:
            client.__exit__(None, None, None)

        assert {source["location"] for source in listed["sources"]} == {
            "kae/first",
            "kae/second",
        }

    def test_another_setting_registers_nothing(self) -> None:
        # Only the repository is a source. A project kind or a working
        # directory is a setting, and registering one as a source would put a
        # row in the intake record for something nobody can read.
        memory = RecordingMemory()
        client = app_with(memory)
        try:
            client.post(
                "/api/projects/p1/setup/configuration",
                json={"field": "project_kind", "value": "web_application"},
            )
            listed = client.get("/api/projects/p1/sources").json()
        finally:
            client.__exit__(None, None, None)

        assert listed["sources"] == []

    def test_clearing_it_registers_nothing(self) -> None:
        memory = RecordingMemory()
        client = app_with(memory)
        try:
            client.post(
                "/api/projects/p1/setup/configuration",
                json={"field": "primary_repository", "value": "   "},
            )
            listed = client.get("/api/projects/p1/sources").json()
        finally:
            client.__exit__(None, None, None)

        assert listed["sources"] == []


class TestAPastedDocumentIsASource:
    """`D-24` — the surface that answers *what has this project been given?*

    `POST /v1/projects/{id}/documents` chunks a pasted document, stores it
    verbatim as evidence and queues extraction. It has worked the whole time and
    left **no record that intake happened**, so the Sources Room listed
    repositories and nothing else. Somebody who handed KAE their brief saw no
    trace of it anywhere that names intake.

    Same shape as `D-23`: one idea, two records, and the surface that should
    answer the question answering part of it.
    """

    def test_pasting_records_the_intake(self) -> None:
        memory = RecordingMemory()
        client = app_with(memory)
        try:
            client.post(
                "/api/projects/p1/documents",
                json={"title": "Project brief", "text": "We need monthly reports."},
            )
            listed = client.get("/api/projects/p1/sources").json()
        finally:
            client.__exit__(None, None, None)

        assert [(s["kind"], s["location"]) for s in listed["sources"]] == [
            ("paste", "Project brief")
        ]

    def test_its_content_is_in_hand_rather_than_reachable(self) -> None:
        """`readable`, never `configured`.

        The content arrived with the request. A state meaning *"we know where
        this is"* would understate a document already held — and `analyzed`
        would overstate it, because whether findings were proposed is the
        extraction run's business and those runs are shown elsewhere.
        """

        memory = RecordingMemory()
        client = app_with(memory)
        try:
            client.post(
                "/api/projects/p1/documents",
                json={"title": "Project brief", "text": "We need monthly reports."},
            )
            source = client.get("/api/projects/p1/sources").json()["sources"][0]
        finally:
            client.__exit__(None, None, None)

        assert source["state"] == "readable"

    def test_re_pasting_a_corrected_brief_is_one_source(self) -> None:
        """The same origin supplying material again, not a second origin.

        A row per submission would make the manifest a log, and the question
        the Sources Room answers is *where does this project's material come
        from* rather than *how many times was it sent*.
        """

        memory = RecordingMemory()
        client = app_with(memory)
        try:
            for text in ("We need monthly reports.", "We need monthly reports, signed off."):
                client.post(
                    "/api/projects/p1/documents", json={"title": "Project brief", "text": text}
                )
            listed = client.get("/api/projects/p1/sources").json()
        finally:
            client.__exit__(None, None, None)

        assert len(listed["sources"]) == 1

    def test_a_different_document_is_a_different_source(self) -> None:
        memory = RecordingMemory()
        client = app_with(memory)
        try:
            for title in ("Project brief", "Integration specification"):
                client.post(
                    "/api/projects/p1/documents", json={"title": title, "text": "Something."}
                )
            listed = client.get("/api/projects/p1/sources").json()
        finally:
            client.__exit__(None, None, None)

        assert {s["location"] for s in listed["sources"]} == {
            "Project brief",
            "Integration specification",
        }

    def test_the_ingest_response_reaches_the_caller_unaltered(self) -> None:
        """`AUD-024`, which this change must not undo.

        Memory's body carries `truncated_chunks` and `warnings`, and a document
        silently cut at a chunk limit is the finding. Recording a source
        afterwards must not swallow or reshape that answer.
        """

        memory = RecordingMemory()
        client = app_with(memory)
        try:
            body = client.post(
                "/api/projects/p1/documents",
                json={"title": "Project brief", "text": "We need monthly reports."},
            ).json()
        finally:
            client.__exit__(None, None, None)

        assert body["truncated_chunks"] == 3
        assert body["warnings"] == ["content was cut at the chunk ceiling"]

    def test_a_document_with_no_title_records_no_source(self) -> None:
        # Identity is the title. A blank one would register a source nobody can
        # tell apart from the next blank one.
        memory = RecordingMemory()
        client = app_with(memory)
        try:
            client.post("/api/projects/p1/documents", json={"title": "   ", "text": "Something."})
            listed = client.get("/api/projects/p1/sources").json()
        finally:
            client.__exit__(None, None, None)

        assert listed["sources"] == []


class TestARepositoryNamedBeforeD23:
    """The configured repository is a Source, however it got configured (`D-55`).

    `D-23` registers it **on the write**, so every project configured before that
    increment shipped names a repository and has no Source. Read from the live
    host: *Cris Test 2* returns `primary_repository: crismag/KAE-Studio`,
    `state: confirmed`, and a source list that is empty with `unavailable: ""` —
    Memory was asked and holds nothing. The Sources Room then offers *"connect
    one in Project setup"*, which is where the repository already is.

    These fix the invariant rather than the rows: a named primary repository is
    a Source no matter which path named it.
    """

    def test_a_repository_configured_without_studio_becomes_a_source(self) -> None:
        memory = RecordingMemory()
        # Written straight into the record, as a project configured before
        # `D-23` was. No Studio route ran, so nothing registered anything.
        memory.configuration["p1"] = {"primary_repository": "crismag/KAE-Studio"}

        client = app_with(memory)
        try:
            listed = client.get("/api/projects/p1/sources").json()
        finally:
            client.__exit__(None, None, None)

        assert [s["location"] for s in listed["sources"]] == ["crismag/KAE-Studio"]
        # `configured`, never `readable`: this path contacted no provider.
        assert listed["sources"][0]["state"] == "configured"
        # Registered durably, not conjured into the working set — a source with
        # no id cannot be pinned, sampled or read, and one kind of Source is
        # what `§7` is for.
        assert memory.rows["p1"][0]["source_id"]

    def test_repairing_twice_registers_once(self) -> None:
        """A read is not a way to accumulate rows."""

        memory = RecordingMemory()
        memory.configuration["p1"] = {"primary_repository": "crismag/KAE-Studio"}

        client = app_with(memory)
        try:
            client.get("/api/projects/p1/sources")
            client.get("/api/projects/p1/sources")
            listed = client.get("/api/projects/p1/sources").json()
        finally:
            client.__exit__(None, None, None)

        assert memory.registrations == 1
        assert len(listed["sources"]) == 1

    def test_a_project_naming_no_repository_registers_nothing(self) -> None:
        """The repair is bounded by the field, not by the project."""

        memory = RecordingMemory()
        memory.configuration["p1"] = {"primary_branch": "main"}

        client = app_with(memory)
        try:
            listed = client.get("/api/projects/p1/sources").json()
        finally:
            client.__exit__(None, None, None)

        assert listed["sources"] == []
        assert memory.registrations == 0

    def test_the_repair_never_disturbs_a_source_already_there(self) -> None:
        """Changing the repository leaves the previous source alone (`D-23`).

        The chosen scope is the evidence. Registration is idempotent by
        `(kind, location)` and **overwrites `scope`**, so a repair that swept
        every source rather than the one missing location would silently discard
        the include paths somebody chose.
        """

        memory = RecordingMemory()
        client = app_with(memory)
        try:
            client.post(
                "/api/projects/p1/sources",
                json={**CONFIGURED, "connection_id": connect(client)},
            )
            # The same repository, named in Project Setup as well. This is the
            # ordinary case, not a contrived one: somebody adds a source with
            # include paths and then names that repository as the project's.
            memory.configuration["p1"] = {"primary_repository": "kae/ministry-reporting"}
            listed = client.get("/api/projects/p1/sources").json()
        finally:
            client.__exit__(None, None, None)

        assert [s["location"] for s in listed["sources"]] == ["kae/ministry-reporting"]
        assert listed["sources"][0]["scope"]["include_paths"] == ["docs/", "src/"]
        assert memory.rows["p1"][0]["scope"]["include_paths"] == ["docs/", "src/"]


class TestALocalSourceCanActuallyBeAdded:
    """`D-88` — the folder branch could not add anything.

    `D-68` decided a local directory needs no authorisation and therefore no
    connection. `SourceIn.connection_id` still required one, so every local
    source was rejected by request validation before the service that
    implements the rule ever saw it — and the `+` menu's *a folder on this
    machine*, the one branch that needs no credential, silently failed.
    """

    def test_a_local_source_needs_no_connection_id(self) -> None:
        memory = RecordingMemory()
        client = app_with(memory)
        try:
            response = client.post(
                "/api/projects/p1/sources",
                json={"kind": "local", "location": "/mnt/ai/workspaces/KAE-Studio", "reference": ""},
            )
        finally:
            client.__exit__(None, None, None)

        assert response.status_code == 201, response.text
        assert response.json()["kind"] == "local"

    def test_a_github_source_still_needs_one(self) -> None:
        # The check moved to the service, it did not go away: a GitHub source
        # configured against a credential nobody issued is the thing it stops.
        memory = RecordingMemory()
        client = app_with(memory)
        try:
            response = client.post(
                "/api/projects/p1/sources",
                json={"kind": "github", "location": "crismag/KAE-Studio", "reference": "main"},
            )
        finally:
            client.__exit__(None, None, None)

        assert response.status_code >= 400


class TestTheRepairInfersTheKind:
    """`D-55`'s repair registered every `primary_repository` as `github`.

    Choosing a folder therefore produced a source badged **GitHub** whose
    location was an absolute path, and the setup summary showed the path where a
    repository name belongs (`D-88`).
    """

    def test_an_absolute_path_is_registered_as_local(self) -> None:
        memory = RecordingMemory()
        client = app_with(memory)
        try:
            client.post(
                "/api/projects/p1/setup/configuration",
                json={"field": "primary_repository", "value": "/mnt/ai/workspaces/KAE-Studio"},
            )
        finally:
            client.__exit__(None, None, None)

        assert memory.rows["p1"][0]["kind"] == "local"

    def test_an_owner_name_is_still_github(self) -> None:
        memory = RecordingMemory()
        client = app_with(memory)
        try:
            client.post(
                "/api/projects/p1/setup/configuration",
                json={"field": "primary_repository", "value": "crismag/KAE-Studio"},
            )
        finally:
            client.__exit__(None, None, None)

        assert memory.rows["p1"][0]["kind"] == "github"


class TestTheDispositionIsDecidedInStudioAndKeptInMemory:
    """`ING-REF`/`D-168`: where a source's material lives becomes decidable.

    Recorded, and acted on by nothing — which is why every assertion here is
    about the record and none is about content moving.
    """

    def _configured_source(self, client: TestClient) -> str:
        registered = client.post(
            "/api/projects/p1/sources",
            json={**CONFIGURED, "connection_id": connect(client)},
        ).json()
        return str(registered["source_id"])

    def test_an_undecided_source_reports_nothing_rather_than_a_default(self) -> None:
        """`null` and `memory` are different claims, and a reader must see which."""

        client = app_with(RecordingMemory())
        try:
            self._configured_source(client)
            listed = client.get("/api/projects/p1/sources").json()
        finally:
            client.__exit__(None, None, None)

        assert listed["sources"][0]["disposition"] is None

    def test_the_chosen_word_reaches_memory_and_comes_back(self) -> None:
        memory = RecordingMemory()
        client = app_with(memory)
        try:
            source_id = self._configured_source(client)
            response = client.post(
                f"/api/sources/{source_id}/disposition", json={"disposition": "ephemeral"}
            )
        finally:
            client.__exit__(None, None, None)

        assert response.status_code == 200
        assert response.json()["disposition"] == "ephemeral"
        assert memory.rows["p1"][0]["disposition"] == "ephemeral"

    def test_the_decision_outlives_the_process(self) -> None:
        """`AUD-005`. The second app never saw the choice being made."""

        memory = RecordingMemory()
        first = app_with(memory)
        source_id = self._configured_source(first)
        first.post(f"/api/sources/{source_id}/disposition", json={"disposition": "reference"})
        first.__exit__(None, None, None)

        second = app_with(memory)
        try:
            listed = second.get("/api/projects/p1/sources").json()
        finally:
            second.__exit__(None, None, None)

        assert listed["sources"][0]["disposition"] == "reference"

    def test_a_word_memory_refuses_never_lands_in_the_working_set(self) -> None:
        """Studio holds no second copy of the vocabulary (`D-125`).

        It must also not keep a value the record does not have: a working set
        that accepted `archive` would show a disposition no restart could
        reproduce.
        """

        memory = RecordingMemory()
        client = app_with(memory)
        try:
            source_id = self._configured_source(client)
            refused = client.post(
                f"/api/sources/{source_id}/disposition", json={"disposition": "archive"}
            )
            listed = client.get("/api/projects/p1/sources").json()
        finally:
            client.__exit__(None, None, None)

        assert refused.status_code == 422
        assert "ephemeral" in refused.json()["detail"]
        assert listed["sources"][0]["disposition"] is None

    def test_the_material_a_decision_would_reach_is_carried_unshaped(self) -> None:
        """`D-171`. Both counts arrive, and neither is folded into the other.

        `documents` is what a person chose and `stored_bodies` is what that
        choice produced. A proxy that summed or dropped one would answer a
        question the surface did not ask, and the surface is the only place that
        can decide which number it is showing.
        """

        client = app_with(RecordingMemory())
        try:
            source_id = self._configured_source(client)
            report = client.get("/api/projects/p1/source-material")
        finally:
            client.__exit__(None, None, None)

        assert report.status_code == 200
        body = report.json()
        assert body["sources"] == [
            {
                "source_id": source_id,
                "kind": "github",
                "location": "kae/ministry-reporting",
                "disposition": None,
                "documents": 4,
                "stored_bodies": 11,
            }
        ]
        # Kept apart, never folded into a total. Material naming no source is
        # material no decision on this page can govern.
        assert body["unattributed_documents"] == 2
        assert body["unattributed_bodies"] == 6

    def test_the_report_does_not_act_on_the_word_it_reports(self) -> None:
        """Counted the same whichever disposition was chosen (`D-169`).

        Nothing in the estate reads the column, and a proxy that quietly zeroed
        an `ephemeral` source's material would be the first thing that did —
        while looking like a display detail.
        """

        client = app_with(RecordingMemory())
        try:
            source_id = self._configured_source(client)
            before = client.get("/api/projects/p1/source-material").json()
            client.post(
                f"/api/sources/{source_id}/disposition", json={"disposition": "ephemeral"}
            )
            after = client.get("/api/projects/p1/source-material").json()
        finally:
            client.__exit__(None, None, None)

        assert before["sources"][0]["documents"] == after["sources"][0]["documents"]
        assert before["sources"][0]["stored_bodies"] == after["sources"][0]["stored_bodies"]
        assert after["sources"][0]["disposition"] == "ephemeral"


class TestASourceCanBeStoppedWithoutBeingErased:
    """`SRC-ACT`'s Studio half — `D-230`, `D-254`, `D-258`.

    The owner ruled that removing a source does not remove what it taught KAE,
    and KAE-Memory built retirement rather than deletion for a reason about
    provenance: every ingested document is grouped by `source_id`, so the row's
    absence turns all of it into material naming no source.

    What is Studio's to prove is the plumbing — that the gesture reaches the
    record, that the record's answer is what the working set holds, and that a
    restart does not resurrect a source nobody is reading.
    """

    def _configured_source(self, client: TestClient) -> str:
        registered = client.post(
            "/api/projects/p1/sources",
            json={**CONFIGURED, "connection_id": connect(client)},
        ).json()
        return str(registered["source_id"])

    def test_a_source_being_read_reports_no_retirement(self) -> None:
        """`null`, and no `retired: false` beside it."""

        client = app_with(RecordingMemory())
        try:
            self._configured_source(client)
            listed = client.get("/api/projects/p1/sources").json()
        finally:
            client.__exit__(None, None, None)

        assert listed["sources"][0]["retired_at"] is None

    def test_stopping_reaches_the_record_and_comes_back(self) -> None:
        memory = RecordingMemory()
        client = app_with(memory)
        try:
            source_id = self._configured_source(client)
            response = client.post(f"/api/sources/{source_id}/retirement")
        finally:
            client.__exit__(None, None, None)

        assert response.status_code == 200, response.text
        assert response.json()["retired_at"] == memory.rows["p1"][0]["retired_at"]
        assert memory.rows["p1"][0]["retired_at"]

    def test_nothing_the_source_produced_is_removed_with_it(self) -> None:
        """`D-230` as an assertion rather than a docstring.

        The material report is the only thing in Studio that can see what a
        source produced, and it must read the same afterwards. A control
        labelled *Stop reading* beside counts that fell to zero would be a
        deletion with a gentler word on it.
        """

        client = app_with(RecordingMemory())
        try:
            source_id = self._configured_source(client)
            before = client.get("/api/projects/p1/source-material").json()
            client.post(f"/api/sources/{source_id}/retirement")
            after = client.get("/api/projects/p1/source-material").json()
        finally:
            client.__exit__(None, None, None)

        assert [entry["source_id"] for entry in after["sources"]] == [source_id]
        assert before["sources"][0]["documents"] == after["sources"][0]["documents"]
        assert before["sources"][0]["stored_bodies"] == after["sources"][0]["stored_bodies"]

    def test_the_source_is_still_listed(self) -> None:
        # Retirement is not disappearance. A source that vanished from the list
        # would leave a person with no way to start reading it again, which is
        # the irreversible control `D-254` refused to build.
        client = app_with(RecordingMemory())
        try:
            source_id = self._configured_source(client)
            client.post(f"/api/sources/{source_id}/retirement")
            listed = client.get("/api/projects/p1/sources").json()
        finally:
            client.__exit__(None, None, None)

        assert [s["source_id"] for s in listed["sources"]] == [source_id]
        assert listed["sources"][0]["retired_at"]

    def test_stopping_twice_keeps_the_first_answer(self) -> None:
        """*When did we stop reading this* has one true answer (`D-254`)."""

        memory = RecordingMemory()
        client = app_with(memory)
        try:
            source_id = self._configured_source(client)
            first = client.post(f"/api/sources/{source_id}/retirement").json()
            second = client.post(f"/api/sources/{source_id}/retirement").json()
        finally:
            client.__exit__(None, None, None)

        assert first["retired_at"] == second["retired_at"]
        assert memory.retirements == [source_id]

    def test_reading_again_clears_it(self) -> None:
        memory = RecordingMemory()
        client = app_with(memory)
        try:
            source_id = self._configured_source(client)
            client.post(f"/api/sources/{source_id}/retirement")
            resumed = client.delete(f"/api/sources/{source_id}/retirement")
            listed = client.get("/api/projects/p1/sources").json()
        finally:
            client.__exit__(None, None, None)

        assert resumed.status_code == 200, resumed.text
        assert resumed.json()["retired_at"] is None
        assert listed["sources"][0]["retired_at"] is None

    def test_the_source_comes_back_where_it_was_left(self) -> None:
        """Stopping reading a source never moved it backwards (`D-254`).

        Retirement is orthogonal to `SourceState` rather than a fifth point
        along it, and a resume that reset the state would make the reversal
        cost a person whatever the source had reached.

        Proved on a pasted document, which reaches `readable` through the
        product's own path. A state written straight into the double would
        prove nothing: the working set is authoritative over the record for
        exactly this field, and `adopt` would ignore it.
        """

        client = app_with(RecordingMemory())
        try:
            client.post(
                "/api/projects/p1/documents",
                json={"title": "Project brief", "text": "We need monthly reports."},
            )
            source_id = client.get("/api/projects/p1/sources").json()["sources"][0]["source_id"]
            client.post(f"/api/sources/{source_id}/retirement")
            client.delete(f"/api/sources/{source_id}/retirement")
            source = client.get("/api/projects/p1/sources").json()["sources"][0]
        finally:
            client.__exit__(None, None, None)

        assert source["state"] == "readable"
        assert source["retired_at"] is None

    def test_the_retirement_outlives_the_process(self) -> None:
        """`AUD-005`. Without this a restart reads every source as live.

        The second app has never seen the gesture, so a working set that held
        the timestamp only in memory would show a source KAE is not reading as
        one it is — and the page would offer to stop reading it again.
        """

        memory = RecordingMemory()
        first = app_with(memory)
        source_id = self._configured_source(first)
        first.post(f"/api/sources/{source_id}/retirement")
        first.__exit__(None, None, None)

        second = app_with(memory)
        try:
            listed = second.get("/api/projects/p1/sources").json()
        finally:
            second.__exit__(None, None, None)

        assert listed["sources"][0]["retired_at"] == memory.rows["p1"][0]["retired_at"]

    def test_re_registering_the_same_repository_is_the_update_path(self) -> None:
        """Update-a-source needs no route of its own (`SRC-ACT`).

        `register` is idempotent on `(project, kind, location)` and restates
        scope, which is what updating a source is. Asserted here so the row's
        second half is proved rather than argued.
        """

        memory = RecordingMemory()
        client = app_with(memory)
        try:
            connection = connect(client)
            client.post(
                "/api/projects/p1/sources", json={**CONFIGURED, "connection_id": connection}
            )
            client.post(
                "/api/projects/p1/sources",
                json={**CONFIGURED, "connection_id": connection, "include_paths": ["docs/"]},
            )
            listed = client.get("/api/projects/p1/sources").json()
        finally:
            client.__exit__(None, None, None)

        assert len(listed["sources"]) == 1
        assert memory.rows["p1"][0]["scope"]["include_paths"] == ["docs/"]
