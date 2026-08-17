"""`D-198` — a question set aside must still be in the room that set it aside.

KAE-Memory's `ClarificationService.candidates` returns questions whose
disposition is `open` and nothing else, unless the caller asks for
`include_deferred`. Studio asked for `limit` only, so pressing *Decide later*
recorded `deferred` in KAE-Memory and then removed the question from the page —
indistinguishable from deleting it — while the deferred counter beside that
control stayed at zero for every project, always.

The double here answers the way KAE-Memory answers: it filters on the flag. So
the assertion is about the outcome a person sees rather than about a query
string.
"""

from __future__ import annotations

import asyncio
from typing import Any

import httpx

from kae_studio.memory_client import MemoryClient

_OPEN = {
    "candidate_key": "question:missing_area:scope:-",
    "question": "What is in scope for the first release?",
    "finding_kind": "missing_area",
    "severity": "major",
    "asked_id": None,
    "disposition": "open",
}
_DEFERRED = {
    "candidate_key": "question:partial_area:budget:-",
    "question": "Who signs off the budget?",
    "finding_kind": "partial_area",
    "severity": "major",
    "asked_id": "m-7",
    "disposition": "deferred",
}


def _client(seen: list[httpx.Request]) -> MemoryClient:
    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        wants_deferred = request.url.params.get("include_deferred") == "true"
        candidates = [_OPEN, _DEFERRED] if wants_deferred else [_OPEN]
        return httpx.Response(200, json={"candidates": candidates, "total": len(candidates)})

    client = MemoryClient("http://memory.invalid", "token")
    client._client = httpx.AsyncClient(  # noqa: SLF001 - no transport seam exists
        base_url="http://memory.invalid",
        transport=httpx.MockTransport(handler),
    )
    return client


def test_a_deferred_question_is_still_listed() -> None:
    seen: list[httpx.Request] = []

    async def read() -> Any:
        client = _client(seen)
        try:
            return await client.clarification_candidates("p1")
        finally:
            await client.aclose()

    body = asyncio.run(read())

    dispositions = [candidate["disposition"] for candidate in body["candidates"]]
    assert "deferred" in dispositions, (
        "a question somebody set aside did not come back, so the room that set "
        "it aside cannot show it or count it"
    )
    assert seen[0].url.params.get("limit") == "20"
