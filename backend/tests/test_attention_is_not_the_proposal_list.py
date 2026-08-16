"""The queue Studio proxies is the attention layer, not the evidence list.

`ADR-0007` separates three layers, and the whole value of `SYN-3e` is that the
third is two orders of magnitude smaller than the first — 8 attention items
against 803 proposed rows on the owner's own project. Two things can go wrong at
this hop and neither would fail anything else.

**The proxy could read the wrong layer.** `/knowledge` and `/attention` both
return a list of things with titles, so a route wired to the first would render
without error and be the queue this package exists to remove.

**The run report could be summarised here.** Memory computes `withheld`
deliberately: 36 themes becoming 8 items makes the 28 exclusions the first
question anybody asks. A field computed carefully, transmitted faithfully and
dropped at the last hop is the largest recurring defect in this estate, and it
is invisible — the surface looks finished without it.
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Iterator

from fastapi.testclient import TestClient

import pytest

# As in `test_confirmation_gesture`: Studio's backend imports CIE at module
# level and `cris-cie-slim` is private, so CI cannot check it out without the
# deploy key `AUD-033b` is waiting on.
pytest.importorskip("cie_slim", reason="cris-cie-slim is a private sibling repository")


from kae_studio.api import create_app
from kae_studio.config import Settings

REPORT = {
    "project_id": "p1",
    "considered": 41,
    "resolved": 5,
    "themes": 36,
    "raised": [{"attention_item_id": "attn-1", "question": "Who approves a return"}],
    "withheld": ["Which fields are mandatory", "How long a return is retained"],
    "clustered": True,
    "ranked_by_blocking": True,
}


class RecordingMemory:
    """Records which Memory routes the proxy actually reached for."""

    def __init__(self, revision: int | None = 7) -> None:
        self.calls: list[str] = []
        self.keys: list[str] = []
        self._revision = revision

    async def attention(self, project_id: str, open_only: bool = True) -> Any:
        self.calls.append("attention")
        return [
            {
                "id": "attn-1",
                "project_id": project_id,
                "kind": "material_unknown",
                "title": "Who approves a return",
                "explanation": "Three unknowns ask this and nothing answers it.",
                "status": "open",
                "identity_key": "who-approves",
                "recommendation": "Name the approver.",
                "synthesized_object_id": "obj-1",
                "priority": 1,
                "actions": ["answer", "defer"],
                "created_at": None,
                "updated_at": None,
            }
        ]

    async def synthesized_model(self, project_id: str, domain: str | None = None) -> Any:
        self.calls.append("synthesized_model")
        return []

    async def knowledge(self, project_id: str, lifecycle: str | None = None) -> Any:
        self.calls.append("knowledge")
        return []

    async def readiness(self, project_id: str) -> Any:
        self.calls.append("readiness")
        return {} if self._revision is None else {"current_knowledge_revision": self._revision}

    async def run_unknown_synthesis(self, project_id: str, idempotency_key: str) -> Any:
        self.calls.append("run_unknown_synthesis")
        self.keys.append(idempotency_key)
        return REPORT

    async def aclose(self) -> None:
        return None


@contextmanager
def studio(memory: RecordingMemory) -> Iterator[TestClient]:
    app = create_app(
        Settings.from_environment(
            {
                "KAE_MEMORY_TOKEN": "token",
                "STUDIO_SESSION_SECRET": "x" * 40,
                "STUDIO_NO_AUTH": "1",
            }
        )
    )
    with TestClient(app) as browser:
        app.state.memory = memory
        yield browser


def test_the_queue_comes_from_the_attention_layer_and_not_from_knowledge() -> None:
    memory = RecordingMemory()
    with studio(memory) as browser:
        response = browser.get("/api/projects/p1/attention")

    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == ["attn-1"]
    # The one assertion that distinguishes this route from the 803-row queue.
    assert "knowledge" not in memory.calls


def test_the_item_arrives_with_the_actions_it_names() -> None:
    """Studio must not invent a gesture the backend refuses (`SYN-4`).

    The actions are carried on the item, so dropping them at the proxy would
    leave the surface with nothing to render but buttons it chose itself.
    """

    memory = RecordingMemory()
    with studio(memory) as browser:
        item = browser.get("/api/projects/p1/attention").json()[0]

    assert item["actions"] == ["answer", "defer"]
    assert item["recommendation"] == "Name the approver."


def test_a_run_reports_what_it_withheld() -> None:
    memory = RecordingMemory()
    with studio(memory) as browser:
        report = browser.post("/api/projects/p1/attention/runs").json()

    assert memory.calls[-1] == "run_unknown_synthesis"
    # Every field, not a summary. 8 items from 36 themes is only legible with
    # the exclusions beside it.
    assert report["withheld"] == REPORT["withheld"]
    assert report["themes"] == 36
    assert report["clustered"] is True


def test_the_run_is_keyed_by_the_project_and_its_knowledge_revision() -> None:
    """One change event per state of the project, and never one shared between
    projects — which is what a key without the id would be."""

    memory = RecordingMemory(revision=7)
    with studio(memory) as browser:
        browser.post("/api/projects/p1/attention/runs")

    assert memory.keys == ["studio-unknowns-p1-7"]


def test_a_memory_that_reports_no_revision_still_keys_per_project() -> None:
    """The degenerate case, which must not collapse two projects into one run."""

    with studio(RecordingMemory(revision=None)) as browser:
        browser.post("/api/projects/p1/attention/runs")
    memory = RecordingMemory(revision=None)
    with studio(memory) as browser:
        browser.post("/api/projects/p2/attention/runs")

    assert memory.keys == ["studio-unknowns-p2-unknown"]


def test_the_model_route_reads_the_model_and_not_the_evidence_behind_it() -> None:
    memory = RecordingMemory()
    with studio(memory) as browser:
        response = browser.get("/api/projects/p1/synthesized-model")

    assert response.status_code == 200
    assert memory.calls == ["synthesized_model"]
