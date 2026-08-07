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

from .config import Settings
from .interviewer import InterviewUnavailable, Interviewer
from .memory_client import MODULE_GAP, MemoryClient, MemoryRefused, MemoryUnavailable
from .security import SESSION_COOKIE, SESSION_MAX_AGE, Operator, Sessions, require_operator


class SignIn(BaseModel):
    password: str = Field(min_length=1)


class MessageIn(BaseModel):
    body: str = Field(min_length=1)


class AnswerIn(BaseModel):
    answer: str = Field(min_length=1)
    disposition: str = "answered"


class TurnIn(BaseModel):
    """The message the turn responds to. CIE records it as evidence itself."""

    body: str = Field(min_length=1)


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
        # Built once. Constructing an interviewer per request would rebuild a
        # Memory client on every turn for no gain.
        app.state.interviewer = Interviewer(
            memory_url=settings.memory_base_url, memory_token=settings.memory_token
        )
        yield
        await app.state.memory.aclose()

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
            samesite="lax",
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
            "interview_provider": {
                "name": "KAE-Memory clarifications",
                "mode": "live",
                "note": "Real project gaps, not a model. CIE is not wired yet.",
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
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "name is required")
        return await memory(request).create_project(name, body.get("key"))

    @app.get("/api/projects/{project_id}")
    async def get_project(
        project_id: str, request: Request, _: Operator = Depends(require_operator)
    ) -> Any:
        return await memory(request).get_project(project_id)

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
            session_id, body.body, operator.name, f"studio-{uuid4()}"
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
        await client.post_message(
            session_id,
            move.text,
            "kae",
            f"studio-turn-{uuid4()}",
            actor_type="agent",
            message_type="question",
        )

        return {
            "move": move.text,
            # Carried so a turn can be reviewed against the interview rubric
            # afterwards, and so "why did it ask that" has an answer.
            "skill": move.skill,
            "subject": move.subject,
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
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "a rejection needs a reason: 'no' without one tells the next reader nothing",
            )
        if body.expected_version < 1:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
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

    return app


def app_from_environment() -> FastAPI:
    """Entry point for `uvicorn kae_studio.api:app_from_environment --factory`."""

    return create_app(Settings.from_environment())
