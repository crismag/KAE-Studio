"""The only thing in Studio that holds a KAE-Memory credential.

Every call to Memory goes through here, so there is exactly one place that
knows the token and one place to look when something is unauthorised.

**Studio does not reimplement Memory's rules.** It does not decide what a
lifecycle transition means, what readiness is, or whether a statement is
confirmed. Where Memory has no capability, this reports the gap rather than
simulating success in Studio state — the failure mode
`INTERFACE_ARCHITECTURE.md` names explicitly.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx


class MemoryUnavailable(RuntimeError):
    """Memory could not be reached, or answered in a way we cannot use.

    Distinct from a capability gap: this means the durable store is unreachable,
    and Studio must not present anything it says as project truth.
    """


class MemoryRefused(RuntimeError):
    """Memory refused the request, and the refusal is the answer.

    Carries the status so a route can pass an authorisation failure through as
    an authorisation failure rather than flattening it to 500.
    """

    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


@dataclass(frozen=True, slots=True)
class CapabilityGap:
    """Something Studio needs and this Memory version does not offer over HTTP.

    Returned rather than raised. A gap is a fact about the platform that the UI
    should render honestly — "modules are not available here, and this is why" —
    not an error that makes a page fail to load.
    """

    capability: str
    reason: str
    reachable_by: str = "MCP"


class MemoryClient:
    """A bounded client over KAE-Memory's versioned HTTP API."""

    def __init__(self, base_url: str, token: str, timeout: float = 20.0) -> None:
        self._client = httpx.AsyncClient(
            base_url=base_url,
            timeout=timeout,
            headers={"Authorization": f"Bearer {token}"},
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        try:
            response = await self._client.request(method, path, **kwargs)
        except httpx.HTTPError as error:
            raise MemoryUnavailable(f"could not reach KAE-Memory: {error}") from None

        if response.status_code >= 400:
            detail = response.text[:400]
            # 5xx is Memory being broken; 4xx is Memory answering. Only the
            # first means the durable store is untrustworthy right now.
            if response.status_code >= 500:
                raise MemoryUnavailable(f"KAE-Memory returned {response.status_code}: {detail}")
            raise MemoryRefused(response.status_code, detail)

        if not response.content:
            return None
        return response.json()

    # -- reads -------------------------------------------------------------

    async def health(self) -> Any:
        return await self._request("GET", "/health")

    async def list_projects(self) -> Any:
        return await self._request("GET", "/v1/projects")

    async def get_project(self, project_id: str) -> Any:
        return await self._request("GET", f"/v1/projects/{project_id}")

    async def readiness(self, project_id: str) -> Any:
        return await self._request("GET", f"/v1/projects/{project_id}/readiness")

    async def knowledge(self, project_id: str, lifecycle: str | None = None) -> Any:
        params = {"lifecycle": lifecycle} if lifecycle else None
        return await self._request("GET", f"/v1/projects/{project_id}/knowledge", params=params)

    async def clarifications(self, project_id: str, limit: int = 20) -> Any:
        # POST, not GET: listing materialises the questions it returns, and a
        # GET that mutates is one a prefetch performs again (ADR-0023).
        return await self._request(
            "POST", f"/v1/projects/{project_id}/clarifications", params={"limit": limit}
        )

    async def extraction_coverage(self, project_id: str) -> Any:
        """How much of what was submitted became knowledge.

        Read beside readiness, never mixed into it. A project is not *less
        ready* for having lost content — it is less **read**, and one number
        cannot say both.
        """

        return await self._request("GET", f"/v1/projects/{project_id}/extraction-coverage")

    async def blockers(self, project_id: str) -> Any:
        return await self._request("GET", f"/v1/projects/{project_id}/blockers")

    # No contradictions listing exists over HTTP — the routes are POST to record
    # and POST to resolve. Readiness carries `unresolved_contradiction_count`,
    # so the count is reportable and the items are not. Recorded here rather
    # than as an empty list, because zero and unavailable are different facts.

    async def preliminary_context(self, project_id: str) -> Any:
        return await self._request("GET", f"/v1/projects/{project_id}/preliminary-context")

    async def setup_state(self, project_id: str) -> Any:
        return await self._request("GET", f"/v1/projects/{project_id}/setup")

    async def trace(self, knowledge_id: str) -> Any:
        """Where a statement came from.

        Memory already records this; Studio simply had no way to show it. The
        answer to "why does KAE believe this" is stored provenance, not a model
        explaining itself after the fact — and the difference is the whole
        reason to surface it.
        """

        return await self._request("GET", f"/v1/knowledge/{knowledge_id}/trace")

    async def context(
        self, project_id: str, purpose: str = "implementation", include_proposed: bool = False
    ) -> Any:
        """The bounded, revision-pinned context that generation reads.

        `include_proposed` defaults to false, matching Memory. Proposed
        statements are candidates; a package generated from them by default
        would turn "somebody said this once" into a document an implementer
        follows. When they are included they arrive labelled, and the label
        survives all the way into the generated file.
        """

        return await self._request(
            "GET",
            f"/v1/projects/{project_id}/context",
            params={"purpose": purpose, "include_proposed": include_proposed},
        )

    async def deliverables(self, project_id: str) -> Any:
        return await self._request("GET", f"/v1/projects/{project_id}/deliverables")

    async def publication_targets(self, project_id: str) -> Any:
        return await self._request("GET", f"/v1/projects/{project_id}/publication-targets")

    # -- writes ------------------------------------------------------------

    async def sessions(self, project_id: str) -> Any:
        return await self._request("GET", f"/v1/projects/{project_id}/sessions")

    async def open_session(self, project_id: str, kind: str = "discovery") -> Any:
        return await self._request(
            "POST", f"/v1/projects/{project_id}/sessions", json={"session_type": kind}
        )

    async def messages(self, session_id: str) -> Any:
        return await self._request("GET", f"/v1/sessions/{session_id}/messages")

    async def post_message(
        self,
        session_id: str,
        content: str,
        actor: str,
        idempotency_key: str,
        actor_type: str = "user",
        message_type: str = "input",
        purpose: str = "project_input",
        metadata: dict[str, Any] | None = None,
    ) -> Any:
        """Record one message. `actor_type` distinguishes a person from an agent.

        The distinction is not cosmetic: KAE's review surface exists to keep a
        model's output from being read as a person's statement, and an assistant
        turn stored as `user` would be exactly that confusion in the evidence
        log.

        `purpose` (EM-2) is the other axis: `project_input` is interpreted and
        is the default, `diagnostic` is stored and never extracted from. A
        health check or a round-trip proof should send `diagnostic`, or its text
        becomes candidate project knowledge.
        """

        return await self._request(
            "POST",
            f"/v1/sessions/{session_id}/messages",
            json={
                "content": content,
                "actor_type": actor_type,
                "actor_id": actor,
                "message_type": message_type,
                "idempotency_key": idempotency_key,
                "purpose": purpose,
                # Structure *about* the turn — what it reflected, what it
                # recommended next. Durable here rather than in the browser, so
                # a refresh does not lose a recommendation that cost a model
                # call to reason out.
                "metadata": metadata or {},
            },
        )

    async def create_project(self, name: str, key: str | None = None) -> Any:
        body: dict[str, Any] = {"name": name}
        if key:
            body["key"] = key
        return await self._request("POST", "/v1/projects", json=body)

    async def delete_project(self, project_id: str) -> Any:
        """Remove a project and everything scoped to it. Irreversible.

        Here so the browser suite can clean up after itself. It writes real
        messages to real Memory deliberately -- that is why it catches faults an
        API test cannot -- and before deletion existed the only way to stop the
        accumulation was to stop running it.
        """

        return await self._request("DELETE", f"/v1/projects/{project_id}")

    async def answer_clarification(
        self,
        project_id: str,
        clarification_id: str,
        answer: str,
        actor: str,
        disposition: str = "answered",
    ) -> Any:
        return await self._request(
            "POST",
            f"/v1/projects/{project_id}/clarifications/{clarification_id}/answer",
            json={"answer": answer, "actor_id": actor, "disposition": disposition},
        )

    async def confirm_knowledge(self, project_id: str, knowledge_id: str, reviewer: str) -> Any:
        # Not project-scoped, unlike reject. A knowledge id is globally unique,
        # and confirm was added before the project-scoped convention settled.
        return await self._request(
            "POST", f"/v1/knowledge/{knowledge_id}/confirm", json={"reviewer": reviewer}
        )

    async def record_assumption(
        self,
        project_id: str,
        subject: str,
        assumed_value: str,
        reason: str,
        consequence: str,
        revisit: str,
        origin: str = "kae_inferred",
    ) -> Any:
        """Record something a turn settled on its own account.

        **Never as knowledge.** An assumption is KAE's interpretation standing in
        for information nobody supplied, and the whole point of the type is that
        it stays distinguishable from what a person said. Writing these as
        knowledge would be model output re-entering as evidence.

        `consequence` is what decides whether anyone is interrupted about it;
        `revisit` is what stops it becoming a commitment nobody remembers making.
        """

        return await self._request(
            "POST",
            f"/v1/projects/{project_id}/assumptions",
            json={
                "origin": origin,
                "subject": subject,
                "assumed_value": assumed_value,
                "reason": reason,
                "consequence": consequence,
                "revisit": revisit,
                # Reversible: a working assumption that could not be revised
                # would be a decision, and CIE is not entitled to make one.
                "reversible": True,
            },
        )

    async def confirm_knowledge_set(self, project_id: str, knowledge_ids: list[str]) -> Any:
        """Confirm the statements one reading was built from, as one act.

        The counterpart to a turn's `provenance`. A person agreed to a sentence,
        not to a list of rows, so the rows are confirmed together or not at all —
        Memory refuses partway, which is what stops someone believing they
        agreed to a reading while part of it stayed proposed.
        """

        return await self._request(
            "POST",
            f"/v1/projects/{project_id}/knowledge/confirm",
            json={"item_ids": knowledge_ids},
        )

    async def reject_knowledge(
        self,
        project_id: str,
        knowledge_id: str,
        reviewer: str,
        note: str,
        expected_version: int,
    ) -> Any:
        """Reject a candidate the reviewer has actually read.

        `note`, not `reason` — Memory has no `reason` field, and sending one
        meant the reviewer's words were silently dropped while the request
        still looked well-formed.

        `expected_version` is Memory's optimistic-concurrency check: a
        rejection that names a version other than the current one is refused,
        so a candidate cannot be rejected on the strength of wording that has
        since changed. Passing the version the browser displayed is the whole
        point; computing it here would defeat the check by always agreeing.
        """

        return await self._request(
            "POST",
            f"/v1/projects/{project_id}/knowledge/{knowledge_id}/reject",
            json={
                "reviewer": reviewer,
                "note": note,
                "expected_version": expected_version,
            },
        )


MODULE_GAP = CapabilityGap(
    capability="modules",
    reason=(
        "KAE-Memory exposes modules over MCP only, deliberately: the consumer of a "
        "module graph is a coding agent implementing one module. Studio's curation "
        "flow is a different act with its own contract, still to be reconciled (N12). "
        "Nothing here simulates it."
    ),
)
"""The one gap Studio's prototype UI assumes away.

Recorded as a value rather than discovered at each call site, so the reason
travels with the gap and a reader is not left thinking it is an outage.
"""
