"""Adding a GitHub repository from the Sources room (`D-285`).

The room's picker lists what this deployment's credential can reach and sends
`connection_id: ""` when somebody chooses one — it has nothing else to send,
because since `GH-APP` the ordinary GitHub credential is an App installation and
that issues no per-project `Connection` row. `add_source` required one for every
remote kind, so choosing a repository from a list of repositories KAE could
plainly read answered:

    404 unknown connection    ·   remedy: "Check the identifier."

naming an identifier the person was never shown, with a trailing space where the
missing value would be. The row was written to KAE-Memory *before* the check ran,
so it then appeared in the list underneath the error saying it had failed.

What is asserted here is the whole of that request: the picker's own payload
succeeds against a deployment that has a credential; a named grant is still
required to exist; a named grant now survives into the durable record; and a
refused add leaves nothing behind.
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

pytest.importorskip("cie_slim", reason="cris-cie-slim is a private sibling repository")

from kae_studio.acquisition.service import AcquisitionService

from tests.test_sources_survive_a_deploy import RecordingMemory, app_with

#: Exactly what `PickRepository.tsx` sends when somebody chooses a repository.
#: Written out rather than imported from a helper so that a change to the room's
#: payload has to be made here too, deliberately.
PICKED = {
    "kind": "github",
    "connection_id": "",
    "location": "crismag/KAE-Studio",
    "reference": "main",
    "include_paths": [],
    "documentation_only": False,
}


def reachable(client: TestClient) -> None:
    """Give the app a GitHub credential, as an App installation would.

    `object()` stands in for the client because nothing here reads a repository
    — what is under test is whether a source may be *configured*, which asks
    only whether a provider exists.
    """

    client.app.state.acquisition = AcquisitionService(github=object())  # type: ignore[arg-type,attr-defined]


class TestThePickerSPayloadIsAccepted:
    def test_a_repository_chosen_from_the_picker_is_added(self) -> None:
        memory = RecordingMemory()
        client = app_with(memory)
        try:
            reachable(client)
            response = client.post("/api/projects/p1/sources", json=PICKED)
        finally:
            client.__exit__(None, None, None)

        assert response.status_code == 201, response.text
        assert response.json()["location"] == "crismag/KAE-Studio"

    def test_it_is_recorded_durably_as_naming_no_grant(self) -> None:
        """`None`, and not an invented one.

        The deployment's credential is what reads this source. Recording a
        connection nobody issued would put a grant in the record that the check
        exists to keep out.
        """

        memory = RecordingMemory()
        client = app_with(memory)
        try:
            reachable(client)
            client.post("/api/projects/p1/sources", json=PICKED)
        finally:
            client.__exit__(None, None, None)

        assert memory.rows["p1"][0]["connection_id"] is None

    def test_a_deployment_with_no_credential_says_which_provider(self) -> None:
        """The refusal that stays, in `D-58`'s words rather than about an id.

        The app built here configures no GitHub client at all, which is the
        state the old message was being given for.
        """

        memory = RecordingMemory()
        client = app_with(memory)
        try:
            response = client.post("/api/projects/p1/sources", json=PICKED)
        finally:
            client.__exit__(None, None, None)

        assert response.status_code == 501, response.text
        detail: dict[str, Any] = response.json()["error"]
        assert "GitHub credential" in detail["message"]
        assert "unknown connection" not in detail["message"]


class TestANamedGrantIsUnchanged:
    def test_a_grant_nobody_issued_is_still_refused(self) -> None:
        """`D-22`'s check, which this must not have weakened.

        Naming an identifier is a claim that it exists, and a source pointing at
        a grant that does not is a source nothing can ever read.
        """

        memory = RecordingMemory()
        memory.grant("p1")
        client = app_with(memory)
        try:
            reachable(client)
            response = client.post(
                "/api/projects/p1/sources",
                json={**PICKED, "connection_id": "con-nobody-granted"},
            )
        finally:
            client.__exit__(None, None, None)

        assert response.status_code == 404

    def test_a_refused_add_writes_nothing_durable(self) -> None:
        """The ordering half.

        Registering first meant a refused request still created the row, so the
        source appeared in the list on the next read — the error and the list
        each telling a different story about the same click.
        """

        memory = RecordingMemory()
        memory.grant("p1")
        client = app_with(memory)
        try:
            reachable(client)
            client.post(
                "/api/projects/p1/sources",
                json={**PICKED, "connection_id": "con-nobody-granted"},
            )
        finally:
            client.__exit__(None, None, None)

        assert memory.rows.get("p1", []) == []
        assert memory.registrations == 0

    def test_a_named_grant_reaches_the_durable_record(self) -> None:
        """The dropped field.

        The route sent `None` while holding the value and passing it to the
        in-process service seventeen lines later, so the record said every
        source reached its provider through no connection.
        """

        memory = RecordingMemory()
        durable = memory.grant("p1")
        client = app_with(memory)
        try:
            reachable(client)
            response = client.post(
                "/api/projects/p1/sources", json={**PICKED, "connection_id": durable}
            )
        finally:
            client.__exit__(None, None, None)

        assert response.status_code == 201, response.text
        assert memory.rows["p1"][0]["connection_id"] == durable

    def test_it_survives_the_restart_that_reads_the_record_back(self) -> None:
        """Which is what makes the dropped field cost something.

        A second process holds no sources and rehydrates from the record, so
        whatever the record says is what the working set becomes.
        """

        memory = RecordingMemory()
        durable = memory.grant("p1")
        first = app_with(memory)
        try:
            reachable(first)
            first.post("/api/projects/p1/sources", json={**PICKED, "connection_id": durable})
        finally:
            first.__exit__(None, None, None)

        second = app_with(memory)
        try:
            reachable(second)
            listing = second.get("/api/projects/p1/sources").json()
        finally:
            second.__exit__(None, None, None)

        assert [source["connection_id"] for source in listing["sources"]] == [durable]
