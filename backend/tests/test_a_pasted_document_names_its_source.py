"""A pasted document is listed under the source registered for it (`D-286`).

`POST /api/projects/{id}/documents` does two durable writes: it hands the text
to KAE-Memory, and it registers a `Source` for it so the paste appears in the
Sources room beside the repositories (`D-24`). It did them in that order and
never joined them, so the ingestion run carried no `source_id` — and
`SourceService.material` and `GET .../sources/{id}/documents` both key on
exactly that (`D-164`, `D-259`).

The result was a source that existed *only* because of one document and said it
had none. The panel `D-260` had just shipped — *What KAE has read from this
source* — was empty for every paste and every upload, and the source list showed
them at 0 documents, 0 bodies, permanently.

Registering first is what makes the link possible at all: Memory refuses a
`source_id` naming no source of the project, so the identifier has to exist
before the document that names it.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

pytest.importorskip("cie_slim", reason="cris-cie-slim is a private sibling repository")

from tests.test_sources_survive_a_deploy import RecordingMemory, app_with

PASTED = {"title": "Discovery notes", "text": "The billing run is monthly."}


def ingest(memory: RecordingMemory, **overrides: object) -> TestClient:
    client = app_with(memory)
    try:
        client.post("/api/projects/p1/documents", json={**PASTED, **overrides})
    finally:
        client.__exit__(None, None, None)
    return client


class TestTheDocumentNamesItsSource:
    def test_the_ingestion_carries_the_registered_source(self) -> None:
        memory = RecordingMemory()
        ingest(memory)

        registered = memory.rows["p1"][0]["source_id"]
        assert memory.documents[0]["source_id"] == registered

    def test_the_source_is_registered_before_the_document_that_names_it(self) -> None:
        """Not an ordering preference — Memory refuses the other order.

        A `source_id` naming no source of the project is a 404 from Memory
        rather than a stored null, so ingesting first leaves nothing to name.
        """

        memory = RecordingMemory()
        ingest(memory)

        assert memory.calls == ["register_source", "ingest_document"]

    def test_an_upload_is_linked_the_same_way(self) -> None:
        memory = RecordingMemory()
        ingest(memory, origin="upload")

        assert memory.rows["p1"][0]["kind"] == "upload"
        assert memory.documents[0]["source_id"] == memory.rows["p1"][0]["source_id"]

    def test_giving_the_same_title_again_names_the_same_source(self) -> None:
        """Identity is the title (`D-24`), and the link must follow it.

        A corrected brief is the same origin supplying material again. If the
        second document named a different source the room would show one
        origin's material split across two rows.
        """

        memory = RecordingMemory()
        ingest(memory)
        ingest(memory, text="The billing run is quarterly.")

        assert len(memory.rows["p1"]) == 1
        registered = memory.rows["p1"][0]["source_id"]
        assert [document["source_id"] for document in memory.documents] == [
            registered,
            registered,
        ]


class TestNothingIsInvented:
    def test_a_document_with_no_usable_title_names_no_source(self) -> None:
        """The branch that registers nothing must send nothing.

        `None` and not a fabricated identifier: Memory reads a document
        arriving without one as a bare paste, which is what this is.
        """

        memory = RecordingMemory()
        ingest(memory, title="   ")

        assert memory.rows.get("p1", []) == []
        assert memory.documents[0]["source_id"] is None

    def test_what_memory_reported_still_reaches_the_caller(self) -> None:
        """`AUD-024`, which the reordering must not have cost.

        The response is Memory's 202 body unaltered, and it is the only place a
        person learns their document was cut short.
        """

        memory = RecordingMemory()
        client = app_with(memory)
        try:
            response = client.post("/api/projects/p1/documents", json=PASTED)
        finally:
            client.__exit__(None, None, None)

        assert response.status_code == 200, response.text
        assert response.json()["truncated_chunks"] == 3
