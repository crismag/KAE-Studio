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

    async def register_source(self, project_id: str, body: dict[str, Any]) -> Any:
        """Record where this project's material comes from (`D-21`).

        Idempotent by `(kind, location)` on Memory's side, so a retry after a
        lost response registers nothing twice.
        """

        return await self._request("POST", f"/v1/projects/{project_id}/sources", json=body)

    async def project_sources(self, project_id: str) -> Any:
        return await self._request("GET", f"/v1/projects/{project_id}/sources")

    async def record_source_state(
        self, project_id: str, source_id: str, state: str, detail: str = ""
    ) -> Any:
        return await self._request(
            "POST",
            f"/v1/projects/{project_id}/sources/{source_id}/state",
            json={"state": state, "detail": detail},
        )

    async def classify_source(self, project_id: str, source_id: str, disposition: str) -> Any:
        """Record where this source's material is to live (`ADR-0004`, `D-168`).

        The word is passed through unread. Memory holds the five and refuses
        anything else with the list in the message, so a closed set here would
        be a second authority over one vocabulary — free to disagree the day a
        sixth is ruled.
        """

        return await self._request(
            "POST",
            f"/v1/projects/{project_id}/sources/{source_id}/disposition",
            json={"disposition": disposition},
        )

    async def pin_source(self, project_id: str, source_id: str, body: dict[str, Any]) -> Any:
        """Fix a source to the revision Studio resolved against the provider."""

        return await self._request(
            "POST", f"/v1/projects/{project_id}/sources/{source_id}/pin", json=body
        )

    async def review(self, project_id: str) -> Any:
        """Quality findings, most severe first (`D-30`).

        A pure read. Memory derives these on every request rather than storing
        them, *"so the findings can never disagree with the state they
        describe"* — which is also why calling it on a projection is safe, and
        why nothing here can accept or dismiss one.
        """

        return await self._request("GET", f"/v1/projects/{project_id}/review")

    async def module_graph(self, project_id: str) -> Any:
        """Every module, every edge, and the order they can be built in.

        Reads only. Defining a module and drawing an edge stay on MCP until
        somebody rules who may draw an architecture (`D-19`).
        """

        return await self._request("GET", f"/v1/projects/{project_id}/modules/graph")

    async def module_neighbourhood(self, project_id: str, key: str) -> Any:
        """One module, and what it touches in both directions."""

        return await self._request("GET", f"/v1/projects/{project_id}/modules/{key}")

    async def readiness(self, project_id: str) -> Any:
        return await self._request("GET", f"/v1/projects/{project_id}/readiness")

    async def knowledge(self, project_id: str, lifecycle: str | None = None) -> Any:
        params = {"lifecycle": lifecycle} if lifecycle else None
        return await self._request("GET", f"/v1/projects/{project_id}/knowledge", params=params)

    async def clarifications(self, project_id: str, limit: int = 20) -> Any:
        """Ask, and materialise. **Only when a question is being put to somebody.**

        POST, not GET: this creates the questions it returns, and a GET that
        mutates is one a prefetch performs again (ADR-0023).

        For *displaying* what could be asked, use `clarification_candidates`.
        Reaching for this one to fill a panel is what put ten machine-generated
        questions into a transcript before its second human message.
        """

        return await self._request(
            "POST", f"/v1/projects/{project_id}/clarifications", params={"limit": limit}
        )

    async def clarification_candidates(self, project_id: str, limit: int = 20) -> Any:
        """What the findings justify asking. **Writes nothing.**

        The observational half of the same question, and the one a projection
        wants. The projection was calling `clarifications`, so **every page
        load materialised up to twenty questions into the project's
        transcript** — which is the mechanism behind GitHub issue #3's ten
        machine-generated messages arriving before the user's second sentence.

        A candidate carries `candidate_key` always and `asked_id` only once
        somebody has actually been shown it, so a consumer can tell "this could
        be asked" from "this was asked" without causing the second.
        """

        return await self._request(
            "GET", f"/v1/projects/{project_id}/clarifications/candidates", params={"limit": limit}
        )

    async def ingest_document(
        self,
        project_id: str,
        document: str,
        text: str,
        max_chunks: int | None = None,
        source_type: str | None = None,
        source_id: str | None = None,
    ) -> Any:
        """Hand Memory a document. It chunks, records verbatim, and queues extraction.

        The method that did not exist, and whose absence was the whole of
        "acquire before asking" on Studio's side: `POST /v1/projects/{id}/documents`
        has been there the entire time, and Studio had no way to call it — so a
        user who offered a repository was asked to paste its contents.

        Text, not bytes. Memory parses no file formats, so decoding is the
        caller's problem and pretending otherwise here would push a gap one
        layer down where it is harder to see.

        Returns Memory's 202 body, which carries `truncated_chunks` and
        `warnings`. **Both must reach a person.** A document silently cut at
        `max_chunks` is the failure `AUD-024` was about.

        `source_type` and `source_id` say what was read and where from. Both
        omitted is a paste, which is what Memory assumes when neither arrives —
        and for the whole life of this method that assumption was applied to
        repository files too, because the parameters did not exist (`D-164`).
        """

        body: dict[str, Any] = {"document": document, "text": text}
        if max_chunks is not None:
            body["max_chunks"] = max_chunks
        if source_type is not None:
            body["source_type"] = source_type
        if source_id is not None:
            body["source_id"] = source_id
        return await self._request("POST", f"/v1/projects/{project_id}/documents", json=body)

    async def extraction_coverage(self, project_id: str) -> Any:
        """How much of what was submitted became knowledge.

        Read beside readiness, never mixed into it. A project is not *less
        ready* for having lost content — it is less **read**, and one number
        cannot say both.
        """

        return await self._request("GET", f"/v1/projects/{project_id}/extraction-coverage")

    async def runs(self, project_id: str) -> Any:
        """Every agent run this project has produced.

        **Fully populated and rendered nowhere.** Memory records status, attempt
        number, error code and message, the continuation checkpoint, timings and
        what each run produced — and no Studio surface reads any of it, so a
        person who starts a parse watches nothing and a run that failed is
        indistinguishable from one that never started (`VC-02`).
        """

        return await self._request("GET", f"/v1/projects/{project_id}/runs")

    async def blockers(self, project_id: str) -> Any:
        return await self._request("GET", f"/v1/projects/{project_id}/blockers")

    async def enqueue_review(self, project_id: str, idempotency_key: str) -> Any:
        """Ask Memory to classify what the project holds into discovery areas.

        **The middle link of the product's own heartbeat, and Studio never
        pulled it.** Extraction writes knowledge, review assigns each statement
        to an area, readiness counts statements per area. `EM-5` found the
        middle link had no caller outside a unit test and exposed it over HTTP
        and MCP — and Studio, the only interface a person uses, still did not
        call it. Measured on the deployed system: `Cris Test 2` holds five
        successful extraction runs, zero review runs, and readiness `0% ·
        not_started` that no amount of confirming could move (`AUD-041`).

        The key is required rather than optional, and that is Memory's decision
        rather than ours: review is a model call over every statement the
        project holds, so a retried request without one is a second bill and a
        second set of classifications for one intent. Studio derives it from the
        knowledge revision, which means one review per state of the project —
        pressing twice on unchanged knowledge returns the first run.

        202. A worker does the work, and the caller returns as soon as the run
        is durable.
        """

        return await self._request(
            "POST",
            f"/v1/projects/{project_id}/review/runs",
            json={"idempotency_key": idempotency_key},
        )

    async def attention(
        self, project_id: str, open_only: bool = True, include_deferred: bool = False
    ) -> Any:
        """The human-attention queue — the third layer of `ADR-0007`.

        Not the proposed-knowledge list. That list is extracted evidence and is
        read from `/knowledge`; this one holds the few things synthesis decided
        are worth a person's time, and on the owner's own project the two differ
        by two orders of magnitude — 803 proposed rows against 8 items.

        `include_deferred` defaults to Memory's own default. A postponed item is
        still owed and is deliberately no longer recommended, so a caller that
        wants both compartments has to say so.
        """

        return await self._request(
            "GET",
            f"/v1/projects/{project_id}/attention",
            params={"open_only": open_only, "include_deferred": include_deferred},
        )

    async def defer_attention(self, project_id: str, item_id: str) -> Any:
        """Postpone an item. It stays owed; it stops being recommended."""

        return await self._request(
            "POST", f"/v1/projects/{project_id}/attention/{item_id}/defer"
        )

    async def reopen_attention(self, project_id: str, item_id: str) -> Any:
        """Return a postponed item to the live queue."""

        return await self._request(
            "POST", f"/v1/projects/{project_id}/attention/{item_id}/reopen"
        )

    async def synthesized_model(self, project_id: str, domain: str | None = None) -> Any:
        """The current project model. Empty until a synthesizer has run."""

        params = {"domain": domain} if domain else None
        return await self._request("GET", f"/v1/projects/{project_id}/model", params=params)

    async def synthesized_object(self, project_id: str, object_id: str) -> Any:
        """One model object and the evidence it rests on, as sentences.

        The listing above carries no evidence at all. This is the read that
        answers *what supports this* about a single object, and it is separate
        because a queue of eight would otherwise cost eight reads to draw.
        """

        return await self._request("GET", f"/v1/projects/{project_id}/model/{object_id}")

    async def run_unknown_synthesis(self, project_id: str, idempotency_key: str) -> Any:
        """Turn current unknowns into themes, and the material few into attention.

        The only route that *produces* the queue (`D-115`). The key is required
        for `enqueue_review`'s reason: the run is work, and a retried request
        without one buys it twice for a single intent.

        The report carries what was **withheld** as well as what was promoted,
        and every field of it is passed through. 36 themes becoming 8 items makes
        the 28 exclusions the first question anybody asks, and an adapter that
        summarised the report here would make them unanswerable upstream.
        """

        return await self._request(
            "POST",
            f"/v1/projects/{project_id}/model/unknowns/runs",
            json={"idempotency_key": idempotency_key},
        )

    # No contradictions listing exists over HTTP — the routes are POST to record
    # and POST to resolve. Readiness carries `unresolved_contradiction_count`,
    # so the count is reportable and the items are not. Recorded here rather
    # than as an empty list, because zero and unavailable are different facts.

    async def preliminary_context(self, project_id: str) -> Any:
        return await self._request("GET", f"/v1/projects/{project_id}/preliminary-context")

    async def setup_state(self, project_id: str) -> Any:
        """What this project is configured to do, apart from what it knows.

        This method existed and had **zero callers**, pointing at a live
        endpoint, for as long as it has existed. Studio's Project Setup stage
        did not exist, so nothing asked.
        """

        return await self._request("GET", f"/v1/projects/{project_id}/setup")

    async def configure(
        self,
        project_id: str,
        field: str,
        value: str,
        state: str = "confirmed",
        evidence: str = "",
        confirmed_by: str | None = None,
    ) -> Any:
        """Set one configuration field, returning the whole setup state.

        Memory returns the recomputed state rather than the field, because a
        person setting a value wants to know what it unblocked.
        """

        return await self._request(
            "POST",
            f"/v1/projects/{project_id}/setup/configuration",
            json={
                "field": field,
                "value": value,
                "state": state,
                "evidence": evidence,
                "confirmed_by": confirmed_by,
            },
        )

    async def register_target(
        self,
        project_id: str,
        provider: str,
        name: str,
        configuration: dict[str, str],
        connection_id: str | None = None,
        purpose: str = "deliverable",
        make_default: bool = False,
    ) -> Any:
        """Register where this project may publish — the output repository.

        The coordinate lives on the target and **never on a publication
        request**: a request that could name a destination inline would make
        every authorisation check advisory.
        """

        return await self._request(
            "POST",
            f"/v1/projects/{project_id}/publication-targets",
            json={
                "provider": provider,
                "name": name,
                "purpose": purpose,
                "configuration": configuration,
                "connection_id": connection_id,
                "make_default": make_default,
            },
        )

    async def set_default_target(
        self, project_id: str, target_id: str, purpose: str = "deliverable"
    ) -> Any:
        return await self._request(
            "POST",
            f"/v1/projects/{project_id}/publication-targets/default",
            json={"target_id": target_id, "purpose": purpose},
        )

    async def memory_connections(self, project_id: str) -> Any:
        """Connections recorded in Memory — durable, unlike Studio's own.

        Named apart from `AcquisitionService`'s connections deliberately. Those
        live in a process-memory dict and vanish on restart (`AUD-005`); these
        are the record. Per `ADR-0004` the durable half belongs in Memory and
        the acquiring stays in Studio.
        """

        return await self._request("GET", f"/v1/projects/{project_id}/connections")

    async def record_connection(
        self,
        project_id: str,
        provider: str,
        credential_reference: str | None,
        state: str = "never_granted",
        authorized_by: str | None = None,
        detail: str = "",
    ) -> Any:
        """Record permission to reach a provider, **never the credential**.

        `credential_reference` names where a credential lives — `env:NAME`.
        Memory refuses anything that looks like a secret, because the record is
        returned to callers and a secret in it is a secret disclosed.
        """

        return await self._request(
            "POST",
            f"/v1/projects/{project_id}/connections",
            json={
                "provider": provider,
                "credential_reference": credential_reference,
                "state": state,
                "authorized_by": authorized_by,
                "detail": detail,
            },
        )

    async def authorize_connection(
        self,
        project_id: str,
        connection_id: str,
        state: str,
        authorized_by: str | None = None,
        detail: str = "",
    ) -> Any:
        return await self._request(
            "POST",
            f"/v1/projects/{project_id}/connections/{connection_id}/authorization",
            json={"state": state, "authorized_by": authorized_by, "detail": detail},
        )

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
    capability="modules.curate",
    reason=(
        "Modules can be read here. Proposing one, or drawing an edge between two, "
        "is KAE-Memory's MCP write path — Studio's curation flow is a different "
        "act with its own contract, still to be reconciled (N12). Nothing here "
        "simulates it."
    ),
)
"""What Studio still cannot do with a module, now that it can read one.

This used to say modules were unreadable, and it was true: KAE-Memory had no
module route at all, so Studio's projection reported the whole capability
missing. `D-19` added the reads, and the gap narrowed to what it always
actually was — **curation**, not visibility.

Kept as a value rather than a sentence at each call site, so the reason travels
with the gap and a reader is not left thinking it is an outage.
"""
