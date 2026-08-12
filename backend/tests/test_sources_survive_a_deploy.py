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
