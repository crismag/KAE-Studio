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
