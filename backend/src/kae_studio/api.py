"""The API a browser is allowed to call.

Product-shaped, not a proxy of Memory's surface. The frontend asks for "the
projection for this project"; what that costs in Memory calls is this layer's
problem, and changing it later must not change the browser's contract.

Three rules hold throughout:

**Nothing here decides project truth.** Confirmation, lifecycle, readiness and
assembly are Memory's. This assembles and renders; where it cannot, it says so.

**An unavailable capability is reported, never simulated.** A projection with a
missing section says the section is missing and why. A page that quietly showed
an empty list would be indistinguishable from a project that has nothing.

**The browser never receives a credential.** Not Memory's token, not a provider
key. Only a signed, `HttpOnly` session cookie.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from dataclasses import asdict
from uuid import uuid4
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .acquisition import ANALYSIS_UNAVAILABLE, GitHubSourceClient, SourceKind, SourceReadError
from .acquisition.service import AcquisitionService, UnknownResource
from .artifacts_client import ArtifactsClient, ArtifactsRefused, ArtifactsUnavailable
from .config import Settings
from .generation_input import ContextNotUsable, to_generation_input
from .interviewer import DEFAULT_MODEL, InterviewUnavailable, Interviewer
from .memory_client import MODULE_GAP, MemoryClient, MemoryRefused, MemoryUnavailable
from .security import SESSION_COOKIE, SESSION_MAX_AGE, Operator, Sessions, require_operator


class DestinationIn(BaseModel):
    """Where a package goes. **Never carries a credential.**

    `connection_ref` names a secret that KAE-Artifacts resolves on its own side.
    A browser that could supply a token here would be a browser that had one.
    """

    type: str = "download"
    mode: str = "pull_request"
    target: str = ""
    target_path: str = ""
    base_branch: str = ""
    connection_ref: str = ""


class PlanRequest(BaseModel):
    profile: str = "full-project-foundation"


class PlanEditIn(BaseModel):
    """One plan entry, as the user left it. `None` means "leave this alone"."""

    type: str
    logical_path: str | None = None
    selected: bool | None = None
    options: dict[str, str] | None = None


class PlanEdits(BaseModel):
    edits: list[PlanEditIn]


class GenerateRequest(BaseModel):
    plan_id: str = Field(min_length=1)
    idempotency_key: str = Field(min_length=1, max_length=200)


class PreviewRequest(BaseModel):
    package_id: str = Field(min_length=1)
    destination: DestinationIn


class ApprovalRequest(BaseModel):
    """No approver field. The signed-in operator is the approver.

    A caller-supplied one would let anything claim anybody's approval, and it
    travels into provenance where it reads as a fact about who agreed.
    """

    preview_id: str = Field(min_length=1)


class PublishRequest(BaseModel):
    package_id: str = Field(min_length=1)
    destination: DestinationIn
    approval_id: str = Field(min_length=1)
    idempotency_key: str = Field(min_length=1, max_length=200)


class ConnectionIn(BaseModel):
    provider: str = "github"
    label: str = Field(min_length=1)
    #: A reference to a secret — `env:NAME` — never the secret. A browser that
    #: could send a token here would be a browser that held one.
    connection_ref: str = Field(min_length=1)


class ConnectivityIn(BaseModel):
    connection_id: str = Field(min_length=1)
    location: str = Field(min_length=1)


class SourceIn(BaseModel):
    kind: str = "github"
    connection_id: str = Field(min_length=1)
    location: str = Field(min_length=1)
    reference: str = "HEAD"
    include_paths: list[str] = Field(default_factory=list)
    documentation_only: bool = False


class SignIn(BaseModel):
    password: str = Field(min_length=1)


class MessageIn(BaseModel):
    body: str = Field(min_length=1)
    #: EM-2. `project_input` is interpreted and is the default; `diagnostic`
    #: and `conversation_control` are recorded and never extracted from.
    purpose: str = "project_input"


class AnswerIn(BaseModel):
    answer: str = Field(min_length=1)
    disposition: str = "answered"


class TurnIn(BaseModel):
    """The message the turn responds to. CIE records it as evidence itself."""

    body: str = Field(min_length=1)


class ConfirmSetIn(BaseModel):
    """The statements a single "yes" applies to.

    Bounded because a confirmation set describes one reading. A request naming
    hundreds of items is a caller confirming a project by accident — the
    "inference silently becomes user-confirmed" failure the directive forbids.
    """

    knowledge_ids: list[str] = Field(default_factory=list, max_length=200)


class ReviewIn(BaseModel):
    reason: str = ""
    #: The version the reviewer had on screen. Memory refuses a rejection that
    #: names any other, so a candidate cannot be refused on the strength of
    #: wording that has since been corrected.
    expected_version: int = 0


def create_app(settings: Settings) -> FastAPI:
    """Build the Studio backend."""

    @asynccontextmanager
    async def lifespan(app: FastAPI):  # type: ignore[no-untyped-def]
        app.state.memory = MemoryClient(settings.memory_base_url, settings.memory_token)
        # `None` when no KAE-Artifacts URL is configured, which is a supported
        # deployment rather than a broken one. The routes report the gap; a
        # client constructed against an empty base URL would instead fail per
        # request with a connection error, which reads like an outage.
        app.state.artifacts = (
            ArtifactsClient(settings.artifacts_base_url, settings.artifacts_token)
            if settings.artifacts_base_url
            else None
        )
        # Acquisition (STI-1). Read-only, and its own client: source access and
        # destination access are separate grants even when they name the same
        # repository, and one client would make them one credential.
        source_token = settings.github_source_token
        app.state.acquisition = AcquisitionService(
            GitHubSourceClient(source_token) if source_token else None
        )
        # Built once. Constructing an interviewer per request would rebuild a
        # Memory client on every turn for no gain.
        app.state.interviewer = Interviewer(
            memory_url=settings.memory_base_url, memory_token=settings.memory_token
        )
        yield
        await app.state.memory.aclose()
        if app.state.artifacts is not None:
            await app.state.artifacts.aclose()

    app = FastAPI(
        title="KAE-Studio",
        version="0.1.0",
        description="Studio's trusted application boundary. Holds the Memory credential; the browser does not.",
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.sessions = Sessions(
        secret=settings.session_secret,
        password=settings.operator_password,
        operator=settings.operator_name,
        required=settings.authentication_required,
    )

    if settings.cors_origins:
        # Credentials are required because the session is a cookie, and that
        # forbids a wildcard origin — so an explicit list is not a convenience,
        # it is the only correct configuration.
        app.add_middleware(
            CORSMiddleware,
            allow_origins=list(settings.cors_origins),
            allow_credentials=True,
            allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
            allow_headers=["Content-Type"],
        )

    async def _session_for(client: MemoryClient, project_id: str) -> str:
        """The project's conversation session, opened once if it has none."""

        sessions = await client.sessions(project_id)
        listing = sessions if isinstance(sessions, list) else sessions.get("results", [])
        if listing:
            return str(listing[0]["id"])
        return str((await client.open_session(project_id))["id"])

    def memory(request: Request) -> MemoryClient:
        client: MemoryClient = request.app.state.memory
        return client

    def artifacts(request: Request) -> ArtifactsClient:
        """The KAE-Artifacts client, or a 501 saying it is not configured.

        501 rather than 503: this deployment cannot do it at all, which is an
        operator's setting to fill in. 503 would say "try again", about
        something no amount of retrying will fix.
        """

        client: ArtifactsClient | None = request.app.state.artifacts
        if client is None:
            raise HTTPException(
                status.HTTP_501_NOT_IMPLEMENTED,
                detail={
                    "error": {
                        "code": "artifacts_not_configured",
                        "message": (
                            "This Studio deployment has no KAE-Artifacts service. "
                            "Project knowledge is readable; generating documents "
                            "from it is not available here."
                        ),
                        "remedy": "Set KAE_ARTIFACTS_URL and restart the backend.",
                        "retryable": False,
                    }
                },
            )
        return client

    async def _generation_input(client: MemoryClient, project_id: str) -> dict[str, Any]:
        """Assemble the project's context and shape it for KAE-Artifacts.

        Read fresh on every call rather than cached. A plan proposed against
        stale knowledge would generate documents citing a revision the project
        has moved past, and KAE-Artifacts refuses that mismatch — correctly, but
        the caller would have no idea why.
        """

        project = await client.get_project(project_id)
        name = str(project.get("name", "")) if isinstance(project, dict) else ""
        context = await client.context(project_id)
        return to_generation_input(context, project_name=name)

    # -- session -----------------------------------------------------------

    @app.post("/api/session")
    async def sign_in(body: SignIn, request: Request, response: Response) -> dict[str, Any]:
        """Exchange a password for a session cookie."""

        sessions: Sessions = request.app.state.sessions
        operator = sessions.authenticate(body.password)
        if operator is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "incorrect password")
        response.set_cookie(
            SESSION_COOKIE,
            sessions.issue(operator),
            max_age=SESSION_MAX_AGE,
            # HttpOnly so page JavaScript cannot read it: a token reachable from
            # the DOM is one XSS away from being someone else's.
            httponly=True,
            samesite=settings.cookie_samesite,  # type: ignore[arg-type]
            secure=settings.secure_cookies,
            path="/",
        )
        return {"operator": operator.name}

    @app.get("/api/session")
    async def current_session(operator: Operator = Depends(require_operator)) -> dict[str, Any]:
        return {"operator": operator.name}

    @app.delete("/api/session")
    async def sign_out(response: Response) -> dict[str, Any]:
        response.delete_cookie(SESSION_COOKIE, path="/")
        return {"signed_out": True}

    # -- status ------------------------------------------------------------

    @app.get("/api/status")
    async def status_(request: Request) -> dict[str, Any]:
        """What this deployment is and whether its dependency is reachable.

        Unauthenticated on purpose: a sign-in page that cannot tell you the
        backend is up is a page that looks broken when it is merely locked.
        Carries no secret and no project data.
        """

        try:
            health = await memory(request).health()
            reachable, detail = True, health
        except (MemoryUnavailable, MemoryRefused) as error:
            reachable, detail = False, {"error": str(error)[:200]}
        return {
            "studio": "ok",
            "memory_reachable": reachable,
            "memory": detail,
            **settings.describe(),
            # Described from what is actually configured, not from a literal.
            # This said "CIE is not wired yet" for as long as CIE has been
            # wired — a status endpoint that cannot be wrong about the thing it
            # reports is the only kind worth having, and a hand-written string
            # is not one.
            "interview_provider": {
                "name": f"CIE via Bedrock ({request.app.state.interviewer.model or DEFAULT_MODEL})",
                "mode": "live",
                "note": (
                    "Every conversational decision is CIE's. Studio transports "
                    "and renders, and an unavailable interviewer surfaces as an "
                    "error rather than as a reply."
                ),
            },
            "known_gaps": [asdict(MODULE_GAP)],
        }

    # -- projects ----------------------------------------------------------

    @app.get("/api/projects")
    async def list_projects(
        request: Request, _: Operator = Depends(require_operator)
    ) -> Any:
        return await memory(request).list_projects()

    @app.post("/api/projects")
    async def create_project(
        body: dict[str, Any], request: Request, _: Operator = Depends(require_operator)
    ) -> Any:
        name = str(body.get("name", "")).strip()
        if not name:
            raise HTTPException(422, "name is required")
        return await memory(request).create_project(name, body.get("key"))

    @app.get("/api/projects/{project_id}")
    async def get_project(
        project_id: str, request: Request, _: Operator = Depends(require_operator)
    ) -> Any:
        return await memory(request).get_project(project_id)

    @app.delete("/api/projects/{project_id}")
    async def delete_project(
        project_id: str, request: Request, _: Operator = Depends(require_operator)
    ) -> Any:
        """Delete a project. **Irreversible** — there is no archive.

        Exposed for the browser suite's teardown. A person deleting a project
        should read `deletion-plan` on Memory first; this passes straight
        through, so the safety is Memory's and is not re-implemented here.
        """

        return await memory(request).delete_project(project_id)

    @app.get("/api/projects/{project_id}/projection")
    async def projection(
        project_id: str, request: Request, _: Operator = Depends(require_operator)
    ) -> Any:
        """Everything the workspace renders, in one call.

        One round trip from the browser and several from here. The alternative —
        the frontend orchestrating six Memory calls — would put Studio's
        composition logic in a place that cannot hold a credential.
        """

        from .projection import build_projection

        return await build_projection(memory(request), project_id)

    @app.get("/api/projects/{project_id}/messages")
    async def list_messages(
        project_id: str, request: Request, _: Operator = Depends(require_operator)
    ) -> Any:
        """The conversation, read back from Memory.

        Studio holds no transcript of its own (ADR-0006). What the browser shows
        is what Memory durably has, which is why a reload after a crash shows the
        same conversation rather than a shorter one.
        """

        client = memory(request)
        sessions = await client.sessions(project_id)
        listing = sessions if isinstance(sessions, list) else sessions.get("results", [])
        if not listing:
            return []
        return await client.messages(listing[0]["id"])

    @app.post("/api/projects/{project_id}/messages")
    async def send_message(
        project_id: str,
        body: MessageIn,
        request: Request,
        operator: Operator = Depends(require_operator),
    ) -> Any:
        """Record what was said. **Recording only** — this produces no reply.

        Split from the reply deliberately. The prototype's hook calls
        `submitMessage` and then `respondTo`, and when both wrote a message
        every user turn was stored twice. Memory is append-only, so a duplicate
        is not a cosmetic bug: it is two pieces of evidence where a person said
        one thing, and every count downstream is wrong.
        """

        client = memory(request)
        session_id = await _session_for(client, project_id)
        recorded = await client.post_message(
            session_id, body.body, operator.name, f"studio-{uuid4()}", purpose=body.purpose
        )
        return {"recorded": recorded, "knowledgeChanged": False}

    @app.post("/api/projects/{project_id}/turn")
    async def turn(
        project_id: str, request: Request, body: TurnIn, operator: Operator = Depends(require_operator)
    ) -> Any:
        """Produce the assistant's turn through CIE, and record it.

        **Studio decides nothing about the conversation.** CIE reads the project
        from Memory, reads what was just said, chooses how to investigate, and
        returns the move. What arrives here is transported and rendered.

        This replaced a walk through Memory's clarification queue. That was an
        honest stopgap and it was not an interview: it returned the next
        structural gap in severity order, worded for a machine, without reading
        the answer. Two different answers produced the same next question.

        The move is written back as an agent message because conversation is
        Memory-owned (ADR-0006). CIE deliberately does not record it — whether an
        assistant turn belongs in the transcript is a product decision.
        """

        interviewer: Interviewer | None = request.app.state.interviewer
        if interviewer is None:
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "no interviewer is configured for this deployment",
            )

        try:
            move = await run_in_threadpool(
                interviewer.turn, project_id, body.body, actor=operator.name
            )
        except InterviewUnavailable as error:
            # Surfaced as unavailable, never as a reply. A fallback that reads
            # like a turn is indistinguishable from one, in the transcript and
            # to the person reading it.
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(error)) from None

        client = memory(request)
        session_id = await _session_for(client, project_id)
        next_action = [
            {"kind": a.kind, "label": a.label, "reason": a.reason} for a in move.next_action
        ]
        await client.post_message(
            session_id,
            move.text,
            "kae",
            f"studio-turn-{uuid4()}",
            actor_type="agent",
            message_type="question",
            # Recorded with the turn that produced them. Both were reasoned
            # once, from this turn's projection; keeping them only in the reply
            # meant a refresh either lost them or paid for them again.
            metadata={
                # How the turn was produced, so the explanation can live beside
                # the turn it explains instead of at the foot of the transcript.
                # Before this the transcript carried no interviewing metadata,
                # so "why did KAE ask that" could only be shown for the latest
                # turn — and was shown twice, once per message and once at the
                # bottom, from the same source (PPA-04).
                "skill": move.skill,
                "subject": move.subject,
                "provenance": list(move.provenance),
                "next_action": next_action,
                # So staleness is checkable: a ranking reasoned against a
                # projection the project has since moved past is still guidance,
                # but a reader deserves to know which.
                "projection_fingerprint": (
                    move.projection.fingerprint if move.projection else ""
                ),
            },
        )

        return {
            "move": move.text,
            # Carried so a turn can be reviewed against the interview rubric
            # afterwards, and so "why did it ask that" has an answer.
            "skill": move.skill,
            "subject": move.subject,
            # The statements this move reflected back, as Memory's own ids.
            #
            # **This is what a person's "yes" applies to.** Without it a
            # confirmation gesture would have to guess which statements the
            # sentence covered, and guessing is how "Confirmed" came to be
            # displayed beside "0 of 1 confirmed". Empty is normal: a question
            # asking something new reflects nothing.
            "provenance": list(move.provenance),
            # What to do next, best first, each with the reason it outranks the
            # rest. CIE ranks because nothing else may: Memory's subjects are a
            # stable order rather than a recommended one, and a ranking Studio
            # invented would disagree on screen with the move CIE just chose
            # (ADR-0002).
            "next_action": next_action,
            "source": "cie",
        }

    @app.get("/api/projects/{project_id}/clarifications")
    async def clarifications(
        project_id: str, request: Request, _: Operator = Depends(require_operator)
    ) -> Any:
        return await memory(request).clarifications(project_id)

    @app.post("/api/projects/{project_id}/clarifications/{clarification_id}/answer")
    async def answer(
        project_id: str,
        clarification_id: str,
        body: AnswerIn,
        request: Request,
        operator: Operator = Depends(require_operator),
    ) -> Any:
        """Record an answer, attributed to the signed-in operator.

        The actor is taken from the session rather than the request body. A
        caller-supplied actor is a claim; this is the one thing Studio can
        assert about a confirmation that Memory cannot check for itself.
        """

        return await memory(request).answer_clarification(
            project_id, clarification_id, body.answer, operator.name, body.disposition
        )

    @app.post("/api/projects/{project_id}/knowledge/{knowledge_id}/confirm")
    async def confirm(
        project_id: str,
        knowledge_id: str,
        request: Request,
        operator: Operator = Depends(require_operator),
    ) -> Any:
        return await memory(request).confirm_knowledge(project_id, knowledge_id, operator.name)

    @app.post("/api/projects/{project_id}/knowledge/confirm")
    async def confirm_set(
        project_id: str,
        body: ConfirmSetIn,
        request: Request,
        _: Operator = Depends(require_operator),
    ) -> Any:
        """Confirm every statement a turn reflected back, as one act.

        **The UI action is the confirmation.** A person reads a reading, clicks
        once, and the statements it was built from become confirmed knowledge —
        no follow-up question asking whether they meant it, because the click
        already answered that.

        The set comes from the turn's `provenance`, so agreement lands on what
        was shown rather than on whatever is proposed by the time the click
        arrives. Memory applies it all or nothing.
        """

        if not body.knowledge_ids:
            raise HTTPException(
                422,
                "a confirmation needs the statements it applies to: an empty set "
                "means the reading was lost between showing it and agreeing to it",
            )
        return await memory(request).confirm_knowledge_set(project_id, body.knowledge_ids)

    @app.post("/api/projects/{project_id}/knowledge/{knowledge_id}/reject")
    async def reject(
        project_id: str,
        knowledge_id: str,
        body: ReviewIn,
        request: Request,
        operator: Operator = Depends(require_operator),
    ) -> Any:
        if not body.reason.strip():
            raise HTTPException(
                422,
                "a rejection needs a reason: 'no' without one tells the next reader nothing",
            )
        if body.expected_version < 1:
            raise HTTPException(
                422,
                "a rejection must name the version the reviewer read",
            )
        return await memory(request).reject_knowledge(
            project_id, knowledge_id, operator.name, body.reason, body.expected_version
        )

    @app.get("/api/projects/{project_id}/knowledge/{knowledge_id}/trace")
    async def trace(
        project_id: str,
        knowledge_id: str,
        request: Request,
        _: Operator = Depends(require_operator),
    ) -> Any:
        """The evidence behind a statement.

        Passed through unchanged. Studio does not summarise provenance: a
        rendering that paraphrased the evidence would be a model's account of
        the record standing in for the record.
        """

        return await memory(request).trace(knowledge_id)

    @app.get("/api/projects/{project_id}/deliverables")
    async def deliverables(
        project_id: str, request: Request, _: Operator = Depends(require_operator)
    ) -> Any:
        return await memory(request).deliverables(project_id)

    # -- artifact generation (STI-5, STI-6, STI-7) -------------------------
    #
    # Studio orchestrates and renders. It decides nothing: not what a plan
    # contains, not whether an entry can be generated, not whether an approval
    # still holds. Every one of those is KAE-Artifacts' answer, carried through
    # unchanged — including its refusals, because a UI that flattened
    # `stale_base` into "something went wrong" could only apologise where it
    # should be offering to preview again.

    @app.get("/api/artifact-profiles")
    async def artifact_profiles(
        request: Request, _: Operator = Depends(require_operator)
    ) -> Any:
        """The shapes of package a project can ask for, with the files in each.

        The files matter: a user choosing between `minimal-agent-context` and
        `full-project-foundation` cannot choose between two slugs.
        """

        return await artifacts(request).profiles()

    @app.get("/api/artifact-publishers")
    async def artifact_publishers(
        request: Request, _: Operator = Depends(require_operator)
    ) -> Any:
        return await artifacts(request).publishers()

    @app.post("/api/projects/{project_id}/artifact-plans")
    async def create_artifact_plan(
        project_id: str,
        body: PlanRequest,
        request: Request,
        _: Operator = Depends(require_operator),
    ) -> Any:
        """Propose a plan from the project's current knowledge.

        Assembles context, converts it, and asks KAE-Artifacts. **Nothing is
        generated**, so a user can read this, edit it, and read it again for
        free — which is what makes the plan an argument to have before ten
        wrong files exist rather than after.
        """

        source = await _generation_input(memory(request), project_id)
        return await artifacts(request).create_plan(source, body.profile)

    @app.get("/api/artifact-plans/{plan_id}")
    async def read_artifact_plan(
        plan_id: str, request: Request, _: Operator = Depends(require_operator)
    ) -> Any:
        return await artifacts(request).plan(plan_id)

    @app.patch("/api/artifact-plans/{plan_id}")
    async def edit_artifact_plan(
        plan_id: str,
        body: PlanEdits,
        request: Request,
        _: Operator = Depends(require_operator),
    ) -> Any:
        """Apply a user's edits to paths, selection and options.

        Generation reads the plan, so an edit here is honoured rather than
        recomputed away. An earlier design generated from artifact *types* and
        rebuilt default paths, which meant moving a file did nothing and said
        nothing.
        """

        return await artifacts(request).edit_plan(
            plan_id, [edit.model_dump(exclude_none=True) for edit in body.edits]
        )

    @app.post("/api/projects/{project_id}/generation-runs")
    async def generate_artifacts(
        project_id: str,
        body: GenerateRequest,
        request: Request,
        _: Operator = Depends(require_operator),
    ) -> Any:
        """Generate from the plan as edited, pinned to the current revision.

        The idempotency key comes from the browser so a double-click, a retry
        after a dropped response, or a reload mid-request all resolve to the
        same run rather than to a second one.
        """

        source = await _generation_input(memory(request), project_id)
        return await artifacts(request).generate(source, body.plan_id, body.idempotency_key)

    @app.get("/api/generation-runs/{run_id}")
    async def read_generation_run(
        run_id: str, request: Request, _: Operator = Depends(require_operator)
    ) -> Any:
        return await artifacts(request).run(run_id)

    @app.get("/api/artifacts/{artifact_id}")
    async def read_artifact(
        artifact_id: str, request: Request, _: Operator = Depends(require_operator)
    ) -> Any:
        """One generated document, with its content.

        So a person can read what would be published before agreeing to publish
        it, rather than approving a filename.
        """

        return await artifacts(request).artifact(artifact_id)

    @app.get("/api/artifact-packages/{package_id}")
    async def read_artifact_package(
        package_id: str, request: Request, _: Operator = Depends(require_operator)
    ) -> Any:
        return await artifacts(request).package(package_id)

    @app.post("/api/artifact-packages/{package_id}/validation")
    async def validate_artifact_package(
        package_id: str, request: Request, _: Operator = Depends(require_operator)
    ) -> Any:
        return await artifacts(request).validate(package_id)

    @app.post("/api/artifact-previews")
    async def create_artifact_preview(
        body: PreviewRequest, request: Request, _: Operator = Depends(require_operator)
    ) -> Any:
        """Read the destination and describe exactly what would change.

        Mutates nothing. The per-file outcome is the point: a user approving
        four modifications is agreeing to overwrite four files, and a list of
        filenames never told them so.
        """

        return await artifacts(request).preview(body.package_id, body.destination.model_dump())

    @app.post("/api/artifact-approvals", status_code=status.HTTP_201_CREATED)
    async def approve_artifact_preview(
        body: ApprovalRequest,
        request: Request,
        operator: Operator = Depends(require_operator),
    ) -> Any:
        """Bind an approval to exactly this preview.

        The approver is **the signed-in operator**, taken from the session and
        never from the request body. A caller-supplied approver reference would
        let anything claim anybody's approval, and that reference travels into
        provenance where it is read as a fact about who agreed.
        """

        return await artifacts(request).approve(
            body.preview_id, approver_ref=f"studio:{operator.name}"
        )

    @app.post("/api/artifact-publications", status_code=status.HTTP_202_ACCEPTED)
    async def publish_artifacts(
        body: PublishRequest,
        request: Request,
        operator: Operator = Depends(require_operator),
    ) -> Any:
        """Publish under an approval, and report what the provider confirmed.

        **202**, matching KAE-Artifacts: a publication is a long-running-capable
        resource with a stable id even though it executes synchronously today.
        Declaring 200 here would make moving it behind a queue a breaking change
        for every caller.

        The result carries the outcome — a succeeded publication and a failed
        one are both 202, because the *request* was accepted either way and the
        status field is where the answer lives.
        """

        return await artifacts(request).publish(
            package_id=body.package_id,
            destination=body.destination.model_dump(),
            approval_id=body.approval_id,
            idempotency_key=body.idempotency_key,
            caller=f"studio:{operator.name}",
        )

    @app.get("/api/artifact-publications/{publication_id}")
    async def read_artifact_publication(
        publication_id: str, request: Request, _: Operator = Depends(require_operator)
    ) -> Any:
        return await artifacts(request).publication(publication_id)

    @app.get("/api/artifact-publications/{publication_id}/provenance")
    async def read_artifact_provenance(
        publication_id: str, request: Request, _: Operator = Depends(require_operator)
    ) -> Any:
        """Which knowledge and which bytes produced which destination state."""

        return await artifacts(request).provenance(publication_id)

    # -- acquisition (STI-1) ----------------------------------------------
    #
    # Connections, sources and pinning. **Analysis is not here**, and every
    # source carries a field saying so — see `ANALYSIS_UNAVAILABLE`. The
    # temptation this section exists to resist is letting a verified connection
    # and a pinned commit read, on screen, as "we have analyzed your project".

    def acquisition(request: Request) -> AcquisitionService:
        service: AcquisitionService = request.app.state.acquisition
        return service

    @app.get("/api/connections")
    async def list_connections(
        request: Request, _: Operator = Depends(require_operator)
    ) -> Any:
        # `redacted()`, never the raw object: a connection holds a reference
        # naming where a secret lives, and publishing that to a browser tells an
        # attacker which variable to go after.
        return {"connections": [c.redacted() for c in acquisition(request).connections()]}

    @app.post("/api/connections", status_code=status.HTTP_201_CREATED)
    async def add_connection(
        body: ConnectionIn, request: Request, _: Operator = Depends(require_operator)
    ) -> Any:
        connection = acquisition(request).add_connection(
            body.provider, body.label, body.connection_ref
        )
        return connection.redacted()

    @app.post("/api/connectivity-checks")
    async def check_connectivity(
        body: ConnectivityIn, request: Request, _: Operator = Depends(require_operator)
    ) -> Any:
        """Ask the provider what this credential can do. **Writes nothing.**

        Read and write capability come back separately, because they are
        separate grants. The response says in words what it proves, because a
        green tick beside a repository name is otherwise read as "KAE
        understands this project".
        """

        result = await run_in_threadpool(
            acquisition(request).check, body.connection_id, body.location
        )
        return result.describe()

    @app.get("/api/projects/{project_id}/sources")
    async def list_sources(
        project_id: str, request: Request, _: Operator = Depends(require_operator)
    ) -> Any:
        return {
            "sources": [s.describe() for s in acquisition(request).sources(project_id)],
            "analysis": ANALYSIS_UNAVAILABLE,
        }

    @app.post("/api/projects/{project_id}/sources", status_code=status.HTTP_201_CREATED)
    async def add_source(
        project_id: str,
        body: SourceIn,
        request: Request,
        _: Operator = Depends(require_operator),
    ) -> Any:
        from .acquisition.model import SourceScope

        scope = SourceScope(
            include_paths=tuple(body.include_paths),
            documentation_only=body.documentation_only,
        )
        source = acquisition(request).add_source(
            project_id=project_id,
            kind=SourceKind(body.kind),
            connection_id=body.connection_id,
            location=body.location,
            reference=body.reference,
            scope=scope,
        )
        return source.describe()

    @app.post("/api/sources/{source_id}/pin")
    async def pin_source(
        source_id: str, request: Request, _: Operator = Depends(require_operator)
    ) -> Any:
        """Resolve the reference to an immutable commit and describe the scope.

        The furthest a source can currently go. It reaches `pinned` — which
        means we know exactly which bytes we *would* read, and not that we have
        read or understood a single one of them.
        """

        source = await run_in_threadpool(acquisition(request).pin, source_id)
        return source.describe()

    @app.post("/api/sources/{source_id}/sample")
    async def sample_source(
        source_id: str,
        body: dict[str, str],
        request: Request,
        _: Operator = Depends(require_operator),
    ) -> Any:
        """Read one file, proving content genuinely comes back.

        Distinct from a connectivity check: a token with metadata-only scope
        passes that and fails this.
        """

        path = body.get("path", "")
        if not path:
            raise HTTPException(422, "a path is required")
        content = await run_in_threadpool(acquisition(request).sample, source_id, path)
        return {
            "source_id": source_id,
            "path": path,
            "bytes": len(content.encode()),
            "excerpt": content[:2000],
            "proves": "this credential can read file content at this revision.",
        }

    @app.post("/api/sources/{source_id}/analysis", status_code=status.HTTP_501_NOT_IMPLEMENTED)
    async def analyze_source(
        source_id: str, _: Operator = Depends(require_operator)
    ) -> Any:
        """The route that would start an acquisition run. **It does not exist.**

        Present and returning 501 rather than absent, so a client discovers the
        gap by asking rather than by a 404 it would read as a wrong URL. The
        body says what *is* proved, so a UI can show the user how far they have
        actually got.
        """

        return {"error": {"code": "analysis_not_implemented", **ANALYSIS_UNAVAILABLE}}

    @app.get("/api/projects/{project_id}/modules")
    async def modules(
        project_id: str, _: Operator = Depends(require_operator)
    ) -> Any:
        """Reports a capability gap rather than an empty list.

        Modules are MCP-only by decision, not by omission. An empty array here
        would be indistinguishable from a project with no modules, and the UI
        would render "no modules yet" about a capability that was never asked.
        """

        return {"available": False, "gap": asdict(MODULE_GAP), "results": []}

    # -- error translation -------------------------------------------------

    @app.exception_handler(MemoryUnavailable)
    async def _unavailable(_: Request, error: MemoryUnavailable) -> Response:
        # 503, not 500: the durable store is unreachable and the correct client
        # behaviour is to retry, not to treat this as a bug in the request.
        from fastapi.responses import JSONResponse

        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "error": "memory_unavailable",
                "detail": str(error),
                "note": "Nothing was written. Studio holds no durable state of its own.",
            },
        )

    @app.exception_handler(MemoryRefused)
    async def _refused(_: Request, error: MemoryRefused) -> Response:
        from fastapi.responses import JSONResponse

        return JSONResponse(
            status_code=error.status_code,
            content={"error": "memory_refused", "detail": error.detail},
        )

    @app.exception_handler(ArtifactsRefused)
    async def _artifacts_refused(_: Request, error: ArtifactsRefused) -> Response:
        """Pass the typed refusal through, status and all.

        The UI branches on the code: `stale_base` offers a re-preview,
        `rate_limited` backs off, `publisher_not_configured` points at a
        setting. Collapsing them into one status would leave the interface able
        only to apologise.
        """

        from fastapi.responses import JSONResponse

        return JSONResponse(status_code=error.status_code, content=error.body)

    @app.exception_handler(ArtifactsUnavailable)
    async def _artifacts_unavailable(_: Request, error: ArtifactsUnavailable) -> Response:
        # 503: the service could not be asked. Deliberately not a report about
        # the action — after a publish request that never arrived, "failed" and
        # "succeeded" are equally unfounded.
        from fastapi.responses import JSONResponse

        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "error": {
                    "code": "artifacts_unavailable",
                    "message": str(error),
                    "remedy": "Check the publication list before retrying; the request may not have arrived.",
                    "retryable": True,
                }
            },
        )

    @app.exception_handler(SourceReadError)
    async def _source_unreadable(_: Request, error: SourceReadError) -> Response:
        from fastapi.responses import JSONResponse

        return JSONResponse(
            status_code=error.status if error.status >= 400 else 502,
            content={
                "error": {
                    "code": error.kind,
                    "message": str(error),
                    "remedy": {
                        "not_authorized": "Check the source credential's repository access.",
                        "not_found": "Check the repository name and that the credential can see it.",
                        "rate_limited": "Wait and try again.",
                    }.get(error.kind, "Try again once the provider recovers."),
                    "retryable": error.kind == "rate_limited",
                }
            },
        )

    @app.exception_handler(UnknownResource)
    async def _unknown_acquisition(_: Request, error: UnknownResource) -> Response:
        from fastapi.responses import JSONResponse

        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={
                "error": {
                    "code": "not_found",
                    "message": str(error),
                    "remedy": "Check the identifier.",
                    "retryable": False,
                }
            },
        )

    @app.exception_handler(ContextNotUsable)
    async def _context_not_usable(_: Request, error: ContextNotUsable) -> Response:
        from fastapi.responses import JSONResponse

        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "context_not_usable",
                    "message": str(error),
                    "remedy": "The project has no assemblable context yet. Add knowledge first.",
                    "retryable": False,
                }
            },
        )

    return app


def app_from_environment() -> FastAPI:
    """Entry point for `uvicorn kae_studio.api:app_from_environment --factory`."""

    return create_app(Settings.from_environment())
