"""RFA-7 · Reading a project must not put questions to the person.

The regression guard for GitHub issue #3, at the point where it was actually
caused.

## What happened

`Cris Test 2` produced 21 messages, 13 of them machine-generated, and ten of
those were the readiness areas arriving one per turn **before the user's second
sentence**. The user then offered their GitHub repository three times and was
asked to paste its contents instead.

The acquisition half of that is workstream B. This is the other half, and it is
smaller and worse: `projection.py` called `memory.clarifications()`, which is a
POST that *materialises* every question it returns. So loading the workspace —
loading any page — wrote up to twenty questions into the transcript, and doing
it twice wrote them once and displayed them twice.

Memory has had `GET /v1/projects/{id}/clarifications/candidates` since
`RUN-D13`, built precisely so a caller could show what might be asked without
asking it. Studio did not call it.

## The invariant

**A read is a read.** Opening a page, refreshing it, or a prefetch performing it
again must leave the transcript exactly as it was.
"""

from __future__ import annotations

from typing import Any

import pytest

pytest.importorskip("cie_slim", reason="cris-cie-slim is a private sibling repository")

from fastapi.testclient import TestClient  # noqa: E402

from kae_studio.api import create_app  # noqa: E402
from kae_studio.config import Settings  # noqa: E402

BASE = {
    "KAE_MEMORY_TOKEN": "token",
    "STUDIO_SESSION_SECRET": "x" * 40,
    "STUDIO_NO_AUTH": "1",
}


class _CountingMemory:
    """A Memory that records which clarification call it was asked for.

    The distinction is the whole test: `clarifications` materialises and
    `clarification_candidates` does not, so counting them separately is the only
    way to tell a read from a write when both return the same shape.
    """

    def __init__(self) -> None:
        self.materialised = 0
        self.observed = 0

    async def clarifications(self, project_id: str, limit: int = 20) -> Any:
        self.materialised += 1
        return {"questions": []}

    async def clarification_candidates(self, project_id: str, limit: int = 20) -> Any:
        self.observed += 1
        return {
            "candidates": [
                {
                    "candidate_key": "question:missing_area:scope:-",
                    "question": "What is in scope for the first release?",
                    "finding_kind": "missing_area",
                    "severity": "major",
                    "area_key": "scope",
                    "asked_id": None,
                    "disposition": "open",
                }
            ]
        }

    async def get_project(self, project_id: str) -> Any:
        return {"id": project_id, "name": "Test 2", "phase": "discovery", "knowledge_revision": 3}

    async def readiness(self, project_id: str) -> Any:
        return {"percentage": 0, "areas": [], "status": "not_started"}

    async def knowledge(self, project_id: str, lifecycle: str | None = None) -> Any:
        return []

    async def blockers(self, project_id: str) -> Any:
        return []

    async def preliminary_context(self, project_id: str) -> Any:
        return {"warnings": [], "material_unknowns": []}

    async def extraction_coverage(self, project_id: str) -> Any:
        return {"succeeded": 0, "abandoned": 0, "complete": True}

    async def module_graph(self, project_id: str) -> Any:
        # A read, like everything else a projection does. Present here so this
        # double answers every call the projection makes — a stub missing one
        # raises before `_safe` can catch it, and the failure reads as a
        # product defect rather than an incomplete test.
        return {"modules": [], "edges": [], "build_order": []}

    async def review(self, project_id: str) -> Any:
        return {"findings": [], "counts": {}}

    async def aclose(self) -> None:
        """Closing is not a failure, and a stub that raises here breaks teardown."""


def _client(memory: _CountingMemory) -> TestClient:
    app = create_app(Settings.from_environment(BASE))
    client = TestClient(app)
    client.__enter__()
    app.state.memory = memory
    return client


def test_reading_a_projection_asks_nobody_anything() -> None:
    memory = _CountingMemory()
    client = _client(memory)
    try:
        client.get("/api/projects/p1/projection")
        client.get("/api/projects/p1/projection")
        client.get("/api/projects/p1/projection")
    finally:
        client.__exit__(None, None, None)

    # Three page loads. Under the old path that was up to sixty questions
    # written into somebody's transcript.
    assert memory.materialised == 0, (
        "reading the projection materialised questions — this is issue #3's "
        "ten machine messages, arriving before the user's second sentence"
    )
    assert memory.observed == 3


def test_a_candidate_nobody_has_been_asked_says_so() -> None:
    """`asked` is what stops a control being offered for an unseen question.

    Answering requires a message id, and a candidate that has never been put to
    anybody does not have one. Rendering an answer control for it would either
    fail, or silently ask the question in order to answer it — which is the same
    defect wearing a different hat.
    """

    memory = _CountingMemory()
    client = _client(memory)
    try:
        body = client.get("/api/projects/p1/projection").json()
    finally:
        client.__exit__(None, None, None)

    [question] = body["openQuestions"]
    assert question["asked"] is False
    # The deterministic key, not an empty string: the unknown is identifiable
    # even though nobody has been shown it.
    assert question["id"].startswith("question:")
