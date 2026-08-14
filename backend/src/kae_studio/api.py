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
from typing import Any, Literal

from fastapi import Depends, FastAPI, File, HTTPException, Request, Response, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .acquisition import ANALYSIS_UNAVAILABLE, GitHubSourceClient, SourceKind, SourceReadError
from .acquisition.clone import CloneError, clone
from .acquisition.github_app import AppUnavailable, GitHubApp
from .acquisition.local_source import LocalSourceClient, resolve_roots
from .acquisition.service import AcquisitionService, UnknownResource
from .artifacts_client import ArtifactsClient, ArtifactsRefused, ArtifactsUnavailable
from .config import Settings
from .generation_input import ContextNotUsable, to_generation_input
from .interviewer import DEFAULT_MODEL, InterviewUnavailable, Interviewer, describe_interviewer
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


class IngestTextIn(BaseModel):
    """A document a person pasted, with a name they will recognise later.

    `title` is what provenance shows beside every statement extracted from this
    text, so "pasted text" is a worse default than it looks — a project with
    four of them cannot tell them apart.
    """

    title: str = Field(min_length=1, max_length=200)
    text: str = Field(min_length=1)
    max_chunks: int | None = None
    #: How the text arrived. Decode is Studio's; Memory only ever sees text.
    #: `upload` is recorded as that kind so the Sources list does not pretend
    #: a PDF was typed.
    origin: Literal["paste", "upload"] = "paste"


class ConfigureFieldIn(BaseModel):
    """One configuration field, set by a person.

    `state` defaults to `confirmed` and the route supplies the operator as
    `confirmed_by`, because a value typed into a form by a signed-in person is
    exactly what `confirmed` means. A caller-supplied attribution would let
    anything claim anybody's agreement.
    """

    field: str = Field(min_length=1)
    value: str
    state: str = "confirmed"
    evidence: str = ""


class RegisterTargetIn(BaseModel):
    """Where this project's outputs go.

    `configuration` is the coordinate — repository and path. Memory refuses any
    key that looks like a credential, so a token pasted here is rejected rather
    than stored and returned.
    """

    provider: str = "github"
    name: str = Field(min_length=1)
    purpose: str = "deliverable"
    configuration: dict[str, str] = Field(default_factory=dict)
    connection_id: str | None = None
    make_default: bool = False


class SetDefaultTargetIn(BaseModel):
    target_id: str = Field(min_length=1)
    purpose: str = "deliverable"


class RecordConnectionIn(BaseModel):
    """Permission to reach a provider. **Never the credential itself.**"""

    provider: str = "github"
    credential_reference: str | None = None
    detail: str = ""


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


class CloneIn(BaseModel):
    """Which repository to copy here. `owner/name`, as the picker reports it."""

    full_name: str = Field(min_length=3)


class SourceIn(BaseModel):
    kind: str = "github"
    # **Not required.** `D-68` decided a local directory needs no authorisation
    # to reach and so needs no connection; this route never got the memo and
    # rejected every local source with a validation error, so the `+` menu's
    # folder branch could not add anything at all (`D-88`).
    #
    # The rule is enforced where it belongs: `AcquisitionService.add_source`
    # demands a connection for every kind except `local`.
    connection_id: str = ""
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


class RecommendationIn(BaseModel):
    """A person's disposition on something KAE advised.

    The three the interaction contract maps to transitions. `modify` carries the
    wording a person changed it to — accepting an edited recommendation is still
    KAE's idea and still their decision, and losing the edit would record
    agreement with something they explicitly did not agree with.
    """

    disposition: str = Field(pattern="^(accept|modify|keep_open)$")
    advice: str = Field(min_length=1)
    reason: str = Field(min_length=1)
    consequence: str = "rework"
    revisit: str = "before_build"
    subject: str = ""
    modified_to: str = ""


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


def _source_client(settings: Settings) -> tuple[GitHubSourceClient | None, str]:
    """The read client this deployment can build, and why it could not.

    `None` is a supported deployment and not a broken one — a client built over
    an empty credential would fail per request with a 401, which reads like a
    revoked grant rather than a deployment nobody has finished.

    The sentence matters as much as the client. There are four ways to have no
    client and they have four different remedies (`D-58`); returning `None`
    alone made a configured App report as *no credential configured* and sent
    somebody to add a token that would not have helped.
    """

    if settings.github_app:
        app = GitHubApp(settings.github_app_id, settings.github_app_private_key)
        if settings.github_app_installation_id:
            return app.source_client(int(settings.github_app_installation_id)), ""
        # No installation named, so ask. One needs no choosing; several without
        # a choice is ambiguous, and taking the first would silently read some
        # other account's repositories.
        try:
            found = app.installations()
        except AppUnavailable as error:
            # Reported rather than raised: an App whose key GitHub refuses is a
            # configuration mistake, and a process that will not boot is a worse
            # way to learn about one — nothing is left running to say so.
            return None, str(error)
        if len(found) == 1:
            return app.source_client(found[0]["installation_id"]), ""
        if not found:
            reason = (
                "The KAE GitHub App is configured and is not installed anywhere, "
                "so it can reach no repositories. Install it against the "
                "repositories KAE may read."
            )
            # A registered App is not yet a *granted* one — installing it is an
            # act on the owner's GitHub account and nobody else can perform it.
            # A deployment holding a personal token as well plainly wants to read
            # something in the meantime, and going dark until the install happens
            # would take away a picker that works. The reason is still carried,
            # so the state is visible rather than papered over.
            if settings.github_source_token:
                return GitHubSourceClient(settings.github_source_token), reason
            return None, reason
        accounts = ", ".join(sorted(row["account"] for row in found if row["account"]))
        return None, (
            f"The KAE GitHub App is installed {len(found)} times ({accounts}) and "
            "this deployment does not say which to read as. Set "
            "STUDIO_GITHUB_APP_INSTALLATION_ID on the host and restart Studio."
        )
    if settings.github_source_token:
        return GitHubSourceClient(settings.github_source_token), ""
    return None, ""


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
        # A GitHub App installation wins over a personal token where both are
        # configured (`D-56`): it is scoped to repositories somebody chose in
        # GitHub's own UI, and it leaves nothing long-lived on the host.
        # `/api/status` reports which is in use, because a silent preference and
        # an ignored setting look identical from outside.
        client, unavailable = _source_client(settings)
        # A directory on this machine needs no credential (`ADR-0006`, `D-67`).
        # `None` where no roots are configured, which means the provider does
        # not exist rather than that it may read anywhere.
        # From `settings`, never from `os.environ` again. `Settings` already
        # resolved this, and re-reading the environment here made the status
        # endpoint and the provider answer from two different places — so a
        # deployment could report `local_sources: 1` and list nothing, which is
        # how a test caught it (`D-71`).
        roots = resolve_roots(settings.local_source_roots)
        app.state.acquisition = AcquisitionService(
            client, unavailable, local=LocalSourceClient(roots) if roots else None
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
                # Derived, never hardcoded. This said "Bedrock" in every page
                # footer while a local model was answering (`D-78`).
                "name": describe_interviewer(
                    request.app.state.interviewer.provider,
                    request.app.state.interviewer.model,
                ),
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

    @app.post("/api/projects/{project_id}/documents")
    async def ingest_text(
        project_id: str,
        body: IngestTextIn,
        request: Request,
        _: Operator = Depends(require_operator),
    ) -> Any:
        """Hand Memory a document typed or pasted by a person.

        **The shortest real path into a project that is not the interview.**
        `POST /v1/projects/{id}/documents` has been live the whole time: it
        chunks, stores the text verbatim as evidence, and queues one extraction
        run per chunk. Studio had no surface for it, so a person with material
        already written down had to retype it into a conversation.

        Memory's 202 body is returned **unaltered**. It carries
        `truncated_chunks` and `warnings`, and both must reach a person — a
        document silently cut at a chunk limit is `AUD-024`.
        """

        ingested = await memory(request).ingest_document(
            project_id, body.title, body.text, max_chunks=body.max_chunks
        )

        # A pasted or uploaded document is a Source (`D-24`, `§7`). Decode
        # happens in Studio; Memory only ever sees text. Kind records how it
        # arrived so a PDF is not listed as something somebody typed.
        #
        # Identity is the title on Memory's side: giving a corrected brief
        # again is the same origin supplying material, not a second origin.
        title = body.title.strip()
        if title:
            await memory(request).register_source(
                project_id,
                {
                    "kind": body.origin,
                    "location": title,
                    # `readable`, never `configured`: the content arrived with
                    # the request. There is nothing left to reach, and a state
                    # meaning "we know where it is" would understate it.
                    #
                    # And never `analyzed` — that is the extraction run's
                    # business, the runs are already on `/ingestion`, and the
                    # state stays unreachable while repository analysis is
                    # unbuilt.
                    "state": "readable",
                    "connection_id": None,
                    "scope": {},
                },
            )

        return ingested

    @app.post("/api/decode")
    async def decode_upload(
        request: Request,
        _: Operator = Depends(require_operator),
        file: UploadFile = File(...),
    ) -> Any:
        """Turn an uploaded file into text a person can review, then ingest.

        Preview only. Nothing is written to Memory. The caller confirms, and
        `POST /api/projects/{id}/documents` with `origin=upload` is the ingest.

        Types we cannot read are refused (`415`), never accepted and emptied.
        A scanned PDF that yields almost no text is a warning, not a silent
        success. This is not analysis: `/analysis` stays 501.
        """

        from .acquisition.decode import MAX_BYTES, DecodeError, decode

        chunks: list[bytes] = []
        total = 0
        while True:
            piece = await file.read(64 * 1024)
            if not piece:
                break
            total += len(piece)
            if total > MAX_BYTES:
                raise HTTPException(
                    status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    (
                        f"This file is larger than {MAX_BYTES // (1024 * 1024)} MB, "
                        "which KAE will not read. Paste the relevant passages, or split the file."
                    ),
                )
            chunks.append(piece)

        try:
            decoded = decode(b"".join(chunks), file.filename or "upload", file.content_type or "")
        except DecodeError as error:
            message = str(error)
            code = (
                status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
                if "cannot read this file type" in message or "Legacy Word" in message
                else status.HTTP_422_UNPROCESSABLE_ENTITY
            )
            raise HTTPException(code, message) from error

        return {
            "text": decoded.text,
            "warnings": decoded.warnings,
            "format": decoded.format,
            "suggested_title": decoded.suggested_title,
        }

    @app.get("/api/projects/{project_id}/extraction-coverage")
    async def extraction_coverage(
        project_id: str, request: Request, _: Operator = Depends(require_operator)
    ) -> Any:
        """How much of what was submitted became knowledge.

        Read beside readiness and never mixed into it. A project is not *less
        ready* for having lost content — it is less **read**, and one number
        cannot say both.
        """

        return await memory(request).extraction_coverage(project_id)

    @app.get("/api/projects/{project_id}/runs")
    async def runs(
        project_id: str, request: Request, _: Operator = Depends(require_operator)
    ) -> Any:
        """What KAE has actually done to this project, and how each attempt ended.

        Memory's runs API is complete and was rendered by nothing (`VC-02`), so
        ingestion showed a person a spinner and then a number, with no way to
        tell a failed extraction from one that never ran.
        """

        return await memory(request).runs(project_id)

    @app.get("/api/projects/{project_id}/setup")
    async def setup_state(
        project_id: str, request: Request, _: Operator = Depends(require_operator)
    ) -> Any:
        """What this project is configured to do — stage one of seven.

        Read from Memory, which has modelled all of it since migration `0020`
        and had **no write path and no reader**. `memory_client.setup_state()`
        existed with zero callers, pointing at a live endpoint, because Studio
        had no Project Setup stage to call it from.

        Deliberately separate from `/readiness`. Setup readiness and knowledge
        readiness answer different questions, and a surface that read one as the
        other would tell a person a well-understood project can publish.
        """

        return await memory(request).setup_state(project_id)

    @app.post("/api/projects/{project_id}/setup/configuration")
    async def configure_project(
        project_id: str,
        body: ConfigureFieldIn,
        request: Request,
        operator: Operator = Depends(require_operator),
    ) -> Any:
        """Set one configuration field, attributed to the signed-in operator.

        The attribution is taken from the session rather than the body, the
        same rule confirmation follows: it is the one thing Studio can assert
        about a value that Memory cannot check for itself.
        """

        configured = await memory(request).configure(
            project_id,
            body.field,
            body.value,
            state=body.state,
            evidence=body.evidence,
            confirmed_by=operator.name if body.state == "confirmed" else None,
        )

        # The repository a person names here **is** a Source (`D-23`, `§7`).
        # Without this the Sources Room said "no repository connected yet" and
        # sent them to this page, where their repository already was — a closed
        # loop with nothing in it, and each screen individually truthful.
        #
        # Idempotent on Memory's side by (kind, location), so re-saving the same
        # repository registers nothing twice. Changing it leaves the previous
        # source alone: deleting acquired configuration is an act nobody has
        # designed, and a settings write is the worst place to invent one.
        if body.field == "primary_repository" and body.value.strip():
            location = body.value.strip()
            await memory(request).register_source(
                project_id,
                {
                    # **Inferred, not assumed.** This hardcoded `github`, so
                    # choosing a folder on this machine registered a source
                    # badged GitHub whose location was an absolute path — and
                    # the summary then showed the path as the repository's name
                    # (`D-88`).
                    "kind": "local" if location.startswith("/") else "github",
                    "location": location,
                    # Named, not read. `configured` is the honest state: nothing
                    # has contacted the provider, and `readable` on the strength
                    # of somebody typing a repository name would be a claim
                    # about access made without asking for any.
                    "state": "configured",
                    # A connection is not required to name a repository. Pinning
                    # needs a credential; this does not, and refusing to record
                    # a repository somebody plainly named would be worse than
                    # recording one that cannot be read yet.
                    "connection_id": None,
                    "scope": {},
                },
            )

        return configured

    @app.post("/api/projects/{project_id}/publication-targets")
    async def register_publication_target(
        project_id: str,
        body: RegisterTargetIn,
        request: Request,
        _: Operator = Depends(require_operator),
    ) -> Any:
        """Register where outputs go. The coordinate lives here, not on a publish."""

        return await memory(request).register_target(
            project_id,
            body.provider,
            body.name,
            body.configuration,
            connection_id=body.connection_id,
            purpose=body.purpose,
            make_default=body.make_default,
        )

    @app.post("/api/projects/{project_id}/publication-targets/default")
    async def set_default_publication_target(
        project_id: str,
        body: SetDefaultTargetIn,
        request: Request,
        _: Operator = Depends(require_operator),
    ) -> Any:
        return await memory(request).set_default_target(
            project_id, body.target_id, purpose=body.purpose
        )

    @app.get("/api/projects/{project_id}/memory-connections")
    async def memory_connections(
        project_id: str, request: Request, _: Operator = Depends(require_operator)
    ) -> Any:
        """Connections recorded durably in Memory.

        Distinct from `/api/connections`, which lists `AcquisitionService`'s
        process-memory dict — that one vanishes on restart (`AUD-005`). Per
        `ADR-0004` the durable record belongs in Memory while the acquiring
        stays here, so both exist and the surface says which is which.
        """

        return await memory(request).memory_connections(project_id)

    @app.post("/api/projects/{project_id}/memory-connections")
    async def record_memory_connection(
        project_id: str,
        body: RecordConnectionIn,
        request: Request,
        _: Operator = Depends(require_operator),
    ) -> Any:
        return await memory(request).record_connection(
            project_id,
            body.provider,
            body.credential_reference,
            detail=body.detail,
        )

    @app.post("/api/projects/{project_id}/memory-connections/{connection_id}/authorization")
    async def authorize_memory_connection(
        project_id: str,
        connection_id: str,
        request: Request,
        operator: Operator = Depends(require_operator),
    ) -> Any:
        """Mark a connection granted, naming the person who granted it.

        No body: the state is `granted` and the authoriser is the signed-in
        operator. Anything else would let a caller claim somebody else's
        authorisation, which is the field's entire purpose.
        """

        return await memory(request).authorize_connection(
            project_id, connection_id, "granted", authorized_by=operator.name
        )

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

        # What the turn settled on its own account, recorded as assumptions.
        #
        # This is the half that makes C-4 durable. Grading a conclusion stops
        # the interviewer asking about it; recording it is what stops the
        # conclusion evaporating — and what lets it be revisited when its
        # trigger fires rather than never.
        #
        # Assumptions, never knowledge. KAE's interpretation must stay
        # distinguishable from what a person said, which is the whole reason the
        # type exists.
        #
        # Failures here do not fail the turn. The reply is what the person is
        # waiting for; losing a recorded assumption is a smaller harm than
        # losing the conversation, and the turn still carries them in its own
        # metadata either way.
        for conclusion in move.concluded:
            try:
                await client.record_assumption(
                    project_id,
                    subject=move.subject or "conversation",
                    assumed_value=conclusion.statement,
                    reason=f"concluded by KAE during a planning turn ({move.skill})",
                    consequence=conclusion.consequence,
                    revisit=conclusion.revisit_when,
                )
            except (MemoryRefused, MemoryUnavailable):
                pass
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
                "concluded": [
                    {
                        "statement": c.statement,
                        "consequence": c.consequence,
                        "revisit_when": c.revisit_when,
                        "material": c.is_material,
                    }
                    for c in move.concluded
                ],
                "next_action": next_action,
                # Advice, persisted with the turn that gave it.
                #
                # It was returned on the response and stored nowhere, so a
                # refresh erased every recommendation card from the transcript
                # while the conclusions beside them survived (AUD-013). A
                # recommendation is a claim KAE made; losing it on reload makes
                # the transcript disagree with itself between sessions.
                "recommendation": (
                    {
                        "advice": move.recommendation.advice,
                        "reason": move.recommendation.reason,
                        "consequence": move.recommendation.consequence,
                    }
                    if move.recommendation
                    else None
                ),
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
            # What the turn settled without being told to. Carried so the
            # interface can show a material conclusion straight away and let
            # someone disagree while the sentence is still on screen — waiting
            # for a refetch would make disagreeing cost more than accepting.
            "concluded": [
                {
                    "statement": c.statement,
                    "consequence": c.consequence,
                    "revisit_when": c.revisit_when,
                    "material": c.is_material,
                }
                for c in move.concluded
            ],
            # What KAE advises, when it advises anything, so the interface can
            # offer the dispositions rather than leaving a person to retype it.
            "recommendation": (
                {
                    "advice": move.recommendation.advice,
                    "reason": move.recommendation.reason,
                    "consequence": move.recommendation.consequence,
                }
                if move.recommendation
                else None
            ),
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

    @app.post("/api/projects/{project_id}/classify")
    async def classify(
        project_id: str,
        request: Request,
        _: Operator = Depends(require_operator),
    ) -> Any:
        """Classify what the project holds into discovery areas.

        **The middle link of the heartbeat, reachable from the product for the
        first time.** Extraction writes knowledge; review assigns each statement
        to an area; readiness counts statements per area. Without the middle
        one, a project accumulates confirmed statements and reports `0% ·
        not_started` forever — which is what the deployed `Cris Test 2` did
        across five extraction runs and no review runs (`AUD-041`).

        **Explicit rather than automatic, and that is a deferral not a
        judgement.** Review is a model call over every statement the project
        holds, so running it after each turn changes what the product costs to
        operate. That decision belongs to whoever pays for it; making the
        capability reachable does not.

        The idempotency key is the project's knowledge revision, so one review
        exists per state of the project. Pressing again on unchanged knowledge
        returns the run that already happened rather than buying a second one.
        """

        readiness = await memory(request).readiness(project_id)
        payload = readiness if isinstance(readiness, dict) else {}
        classification = payload.get("classification")
        engine = classification.get("engine") if isinstance(classification, dict) else None

        # **Refuse when there is nothing to classify**, and refuse *here* rather
        # than relying on the idempotency key.
        #
        # The key alone does not hold. A review assigns area links, which bumps
        # the knowledge revision, so the revision after a review is never the
        # revision the key was taken at — pressing twice in a row bought two
        # model passes over every statement in the project. Measured on the
        # deployed system: the second request returned a different run id.
        #
        # `is_stale` is the question actually being asked. It is false when
        # readiness was calculated at the project's current revision, which is
        # exactly "the classification covers what the project holds now".
        if engine is not None and payload.get("is_stale") is False:
            return {
                "status": "already_current",
                "engine": engine,
                "knowledge_revision": payload.get("current_knowledge_revision"),
            }

        revision = payload.get("current_knowledge_revision")
        # Falls back to the snapshot's own revision, then to the project id
        # alone. A missing revision must not silently become a shared key that
        # makes every project's first review the same run.
        if revision is None:
            revision = payload.get("knowledge_revision")
        key = f"studio-review-{project_id}-{revision if revision is not None else 'unknown'}"
        return await memory(request).enqueue_review(project_id, key)

    @app.post("/api/projects/{project_id}/knowledge/{knowledge_id}/confirm")
    async def confirm(
        project_id: str,
        knowledge_id: str,
        request: Request,
        operator: Operator = Depends(require_operator),
    ) -> Any:
        return await memory(request).confirm_knowledge(project_id, knowledge_id, operator.name)

    @app.post("/api/projects/{project_id}/recommendations")
    async def decide_recommendation(
        project_id: str,
        body: RecommendationIn,
        request: Request,
        _: Operator = Depends(require_operator),
    ) -> Any:
        """Record what a person did with KAE's advice.

        **The click is the decision** — nothing asks afterwards whether they
        meant it, and the three dispositions cost the same. If accepting were a
        click and disagreeing a paragraph, the product would have a thumb on the
        scale.

        Each writes a different origin, because they are different facts:

            accept    → kae_recommended_accepted   KAE advised, they agreed
            modify    → kae_recommended_accepted   with their wording
            keep_open → unresolved_alternative     nobody chose yet

        None of them is `user_stated`. An accepted recommendation is still KAE's
        idea, and recording it as something the customer said would erase the
        one distinction that makes advice safe to give.
        """

        origin = (
            "unresolved_alternative" if body.disposition == "keep_open"
            else "kae_recommended_accepted"
        )
        value = body.modified_to.strip() or body.advice
        reason = {
            "accept": f"KAE recommended this and the operator accepted it: {body.reason}",
            "modify": f"KAE recommended this, the operator edited it: {body.reason}",
            "keep_open": f"KAE recommended this and the operator kept it open: {body.reason}",
        }[body.disposition]

        return await memory(request).record_assumption(
            project_id,
            subject=body.subject or "conversation",
            assumed_value=value,
            reason=reason,
            consequence=body.consequence,
            # An option nobody chose has to come back, or "keep open" is a way
            # of losing the question politely.
            revisit="before_build" if body.disposition == "keep_open" else body.revisit,
            origin=origin,
        )

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
        """This process's connections, across every project.

        **Not the durable record and not what source creation reads** (`D-22`).
        The record is per-project and lives in KAE-Memory, reached through
        `/api/projects/{id}/memory-connections`; this is the working set, and it
        is empty until something rehydrates it.

        Kept because no page reads it and a route may not be removed before its
        replacement is verified — there is nothing here to verify a replacement
        against.
        """


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

    async def _rehydrate_connections(request: Request, project_id: str) -> None:
        """Take this project's durable connections into the working set (`D-22`).

        Source creation validates its `connection_id` against the working set,
        and the product records connections in Memory. Without this, somebody
        who authorized GitHub last week is told *unknown connection* while the
        Project setup page two clicks away shows the same connection as granted
        — the record saying a thing exists and the workflow saying it does not.
        """

        from .acquisition.model import Connection, ConnectionState

        payload = await memory(request).memory_connections(project_id)
        entries = payload if isinstance(payload, list) else payload.get("connections", [])
        for entry in entries if isinstance(entries, list) else []:
            if not isinstance(entry, dict):
                continue
            acquisition(request).adopt_connection(
                Connection(
                    connection_id=str(entry.get("connection_id", "")),
                    provider=str(entry.get("provider", "")),
                    # Memory records the grant, not what somebody calls it.
                    # Naming it after the provider beats inventing a label.
                    label=str(entry.get("provider", "")),
                    connection_ref=str(entry.get("credential_reference") or ""),
                    # `configured`, never `verified`. Memory's `granted` means a
                    # person authorized this; it does not mean the provider was
                    # contacted, and this process has contacted nothing since it
                    # started. Verification is one round trip and claiming it
                    # without making it is what `ConnectionState` exists to stop.
                    state=ConnectionState.CONFIGURED,
                    detail=str(entry.get("detail", "")),
                )
            )

    async def _rehydrate(request: Request, project_id: str) -> None:
        """Take this project's durable sources into the working set (`D-21`).

        `AUD-005` was that a deploy erased every source somebody had configured.
        It no longer does — KAE-Memory holds them — but this process starts
        empty, so the record has to be read back before the working set can be
        right.

        Failure here is **not** fatal and is not silent either: the response
        falls back to whatever this process holds, which after a restart is
        nothing. Saying "no sources" when Memory could not be asked would be
        the substitution this codebase exists to refuse, so the caller is told.
        """

        from .acquisition.model import Source, SourceKind, SourceScope, SourceState

        def adopt(entry: dict[str, Any]) -> str:
            """Take one durable record into the working set; return its location."""

            try:
                kind = SourceKind(entry.get("kind", ""))
                state = SourceState(entry.get("state", "configured"))
            except ValueError:
                # A kind or state this deployment does not know. Skipped rather
                # than coerced: a source rendered under the wrong kind is worse
                # than one a newer Studio will show.
                return ""
            scope = entry.get("scope") or {}
            location = str(entry.get("location", ""))
            acquisition(request).adopt(
                Source(
                    source_id=str(entry.get("source_id", "")),
                    project_id=project_id,
                    kind=kind,
                    connection_id=str(entry.get("connection_id") or ""),
                    location=location,
                    reference=str(scope.get("reference", "")),
                    scope=SourceScope(
                        include_paths=tuple(scope.get("include_paths", ())),
                        exclude_paths=tuple(scope.get("exclude_paths", ())),
                        max_file_bytes=int(
                            scope.get("max_file_bytes", SourceScope().max_file_bytes)
                        ),
                        documentation_only=bool(scope.get("documentation_only", False)),
                    ),
                    state=state,
                )
            )
            return location

        payload = await memory(request).project_sources(project_id)
        known = {
            adopt(entry)
            for entry in (payload if isinstance(payload, list) else [])
            if isinstance(entry, dict)
        }

        # The repository named in Project Setup **is** a Source (`§7`, `D-23`).
        # `D-23` asserted that on the write and nothing re-asserted it after, so
        # every project configured before it shipped names a repository and has
        # no Source — the Sources Room sends those people to Project Setup, where
        # their repository already is. That was the whole defect `D-23` recorded
        # as closed, still open on all existing data (`D-55`).
        #
        # Reconciled here rather than backfilled by migration so the invariant
        # holds for any future path that sets the field without passing through
        # Studio. Bounded to one field, idempotent by `(kind, location)` on
        # Memory's side, and additive: nothing is renamed or removed.
        setup = await memory(request).setup_state(project_id)
        configured = ""
        if isinstance(setup, dict):
            field = (setup.get("configuration") or {}).get("primary_repository")
            if isinstance(field, dict):
                configured = str(field.get("value") or "").strip()

        if configured and configured not in known:
            registered = await memory(request).register_source(
                project_id,
                {
                    "kind": "github",
                    "location": configured,
                    # `configured`, for `D-23`'s reason: naming a repository is
                    # not reaching one, and this path has contacted nothing.
                    "state": "configured",
                    "connection_id": None,
                    "scope": {},
                },
            )
            if isinstance(registered, dict):
                adopt(registered)

    @app.get("/api/projects/{project_id}/sources")
    async def list_sources(
        project_id: str, request: Request, _: Operator = Depends(require_operator)
    ) -> Any:
        unavailable = ""
        try:
            await _rehydrate(request, project_id)
        except (MemoryUnavailable, MemoryRefused) as error:
            unavailable = f"Configured sources could not be read from KAE-Memory: {error}"

        return {
            "sources": [s.describe() for s in acquisition(request).sources(project_id)],
            "analysis": ANALYSIS_UNAVAILABLE,
            # Empty when the record was read. Non-empty means this list may be
            # short, and a caller must not render it as "no sources".
            "unavailable": unavailable,
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
        # The connection this names is the project's, and its record is
        # Memory's (`D-22`). Without this the first source added after a restart
        # is refused against a grant the setup page is displaying as live.
        await _rehydrate_connections(request, project_id)
        # Recorded durably first, and its identity comes back from there
        # (`D-21`). Minting an id here and telling Memory afterwards would give
        # one source two identities whenever the second call failed.
        registered = await memory(request).register_source(
            project_id,
            {
                "kind": body.kind,
                "location": body.location,
                "state": "configured",
                "connection_id": None,
                "scope": {
                    "include_paths": list(body.include_paths),
                    "exclude_paths": [],
                    "max_file_bytes": scope.max_file_bytes,
                    "documentation_only": body.documentation_only,
                    "reference": body.reference,
                },
            },
        )
        source = acquisition(request).add_source(
            project_id=project_id,
            kind=SourceKind(body.kind),
            connection_id=body.connection_id,
            location=body.location,
            reference=body.reference,
            scope=scope,
            source_id=str(registered.get("source_id")) if isinstance(registered, dict) else None,
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
        if source.snapshot is not None:
            # The revision is the point of the record. A pin held only in this
            # process is one the next deploy erases, which is `AUD-005` in the
            # single place it costs the most.
            await memory(request).pin_source(
                source.project_id,
                source.source_id,
                {
                    "revision": source.snapshot.revision,
                    "digest": source.snapshot.content_digest or None,
                    "state": source.state.value,
                },
            )
        else:
            await memory(request).record_source_state(
                source.project_id, source.source_id, source.state.value, source.last_error
            )
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

    # `/api/github/repositories` kept because the deployed bundle calls it and
    # the run rule is that no route is deleted before its replacement is
    # verified. Both answer from the same function; the name is the only
    # difference, and the old one stopped being true when the listing began
    # carrying local directories (`D-71`).
    @app.post("/api/repositories/clone", status_code=status.HTTP_201_CREATED)
    async def clone_repository(
        body: CloneIn, request: Request, _: Operator = Depends(require_operator)
    ) -> Any:
        """Copy a GitHub repository onto this machine, then read it as a folder.

        The `+` menu said **Not yet** and was right: nothing ran `git clone`.
        With a credential present and roots configured, it can (`D-93`).

        Deliberately **not** a source registration. This puts a checkout on
        disk; choosing it as a source is the same act as choosing any other
        folder, and doing both here would make one button mean two things.

        The **first** configured root receives the copy. A deployment that reads
        several directories has no basis in the request for choosing between
        them, and asking a person to pick one would put a filesystem layout in
        front of somebody who asked for a repository.
        """

        roots = resolve_roots(settings.local_source_roots)
        if not roots:
            raise HTTPException(
                status.HTTP_501_NOT_IMPLEMENTED,
                "This deployment writes no local directories, so there is nowhere to clone into. "
                "Set KAE_LOCAL_SOURCE_ROOTS on the host.",
            )
        if not settings.github_source_token and not settings.github_app_id:
            raise HTTPException(
                status.HTTP_501_NOT_IMPLEMENTED,
                "This deployment holds no GitHub credential, so a private repository cannot be "
                "cloned. Connect an account in Settings.",
            )

        try:
            target = await run_in_threadpool(
                clone, body.full_name, roots[0], settings.github_source_token
            )
        except CloneError as error:
            # 409, not 500. Every one of these is a condition a person can act
            # on — a name that does not resolve, a directory already there, a
            # credential that cannot read it.
            raise HTTPException(status.HTTP_409_CONFLICT, str(error)) from None

        return {
            "location": str(target),
            "kind": "local",
            # What was proved, in the vocabulary the rest of acquisition uses:
            # the bytes are here. Nothing has read them.
            "proves": "this repository is now on this machine and can be read as a folder.",
        }

    @app.get("/api/github/installations")
    async def github_installations(
        request: Request, _: Operator = Depends(require_operator)
    ) -> Any:
        """Where the GitHub App is installed, and how widely.

        **Read-only, and that is the whole of what S3 can honestly offer**
        (`D-90`). Listing is free — `GitHubApp.installations()` already exists
        and needs no storage. *Choosing* one durably needs somewhere to keep the
        choice, and there is nowhere: `KNOWN_FIELDS` refuses a seventh
        configuration field, Studio holds no durable state of its own (`D-21`,
        `D-22`), and an installation is a fact about **this deployment** rather
        than about one project, so a per-project field would model it wrongly
        even if one existed.

        So this names the accounts and the reason string keeps saying which
        setting selects between them. A picker that appeared to choose and
        silently forgot on restart would be worse than the sentence.
        """

        if not settings.github_app:
            return {
                "installations": [],
                # Not an error. A deployment with no App is a supported
                # deployment, and `github_app: not configured` at `/api/status`
                # already says so.
                "unavailable_reason": "",
                "selected": settings.github_app_installation_id or "",
            }

        app_client = GitHubApp(settings.github_app_id, settings.github_app_private_key)
        try:
            found = await run_in_threadpool(app_client.installations)
        except AppUnavailable as error:
            return {"installations": [], "unavailable_reason": str(error), "selected": ""}

        return {
            "installations": found,
            # A registered App that nobody has installed is the state this
            # deployment is in the moment the owner creates one, and the empty
            # list alone reads as *KAE cannot see your account* — which sends
            # somebody to check the key rather than to click Install.
            "unavailable_reason": ""
            if found
            else (
                "This GitHub App is registered and not installed on any account yet, "
                "so it can reach no repositories. Install it on the account whose "
                "repositories KAE may read."
            ),
            # Which one this deployment reads as, when it has been told. Empty
            # with several installed is the case that needs a person.
            "selected": settings.github_app_installation_id or "",
        }

    @app.get("/api/repositories")
    @app.get("/api/github/repositories")
    async def github_repositories(
        request: Request, q: str = "", _: Operator = Depends(require_operator)
    ) -> Any:
        """Repositories this deployment can reach — local and remote.

        **Not only GitHub**, despite one of the two paths that reach this. A
        local directory needs no credential, so the answer here can be
        non-empty on a deployment holding none at all (`D-68`, `D-71`).

        **The listing that makes selection possible.** Without it, choosing a
        repository means typing `owner/name` from memory into a free-text field
        and discovering whether you were right by watching a check fail — which
        is configuration wearing the costume of a form. `§6` of the UX package:
        *workflow pages select configured resources.*

        Never raises for a missing credential. `unavailable_reason` carries the
        sentence instead, because a picker with no options and no explanation is
        the one state a person cannot act on.
        """

        found, truncated, reason = await run_in_threadpool(
            acquisition(request).repositories, q
        )
        return {
            "repositories": found,
            "truncated": truncated,
            "unavailable_reason": reason,
            "proves": "this credential can see these repositories. Nothing has been read.",
        }

    @app.get("/api/sources/{source_id}/files")
    async def source_files(
        source_id: str,
        request: Request,
        limit: int = 50,
        _: Operator = Depends(require_operator),
    ) -> Any:
        """The in-scope files of a pinned source, largest first.

        The tree has always been resolved — `pin` reads it to count files and
        bytes — and it was never returned, so a user could see *412 files* and
        not one of their names. Read-only, and at the pinned revision, so what
        this lists is exactly what an ingest would read.
        """

        files, truncated = await run_in_threadpool(
            acquisition(request).readable_files, source_id, limit
        )
        return {
            "source_id": source_id,
            "files": files,
            "truncated": truncated,
            "proves": "these paths exist in scope at the pinned revision.",
        }

    @app.post("/api/sources/{source_id}/ingest")
    async def ingest_source(
        source_id: str,
        body: dict[str, Any],
        request: Request,
        _: Operator = Depends(require_operator),
    ) -> Any:
        """Read chosen files at the pinned revision and hand them to Memory.

        **This is ingestion, and calling it analysis would be the lie this
        module exists to avoid.** Nothing here derives structure: the files
        become durable evidence, extraction proposes candidates from their text,
        and a person confirms. `ANALYSIS_UNAVAILABLE` stays accurate, and
        `/analysis` still returns 501.

        What it does close is the gap GitHub issue #3 recorded — a user offering
        a repository and being asked to paste its contents. Now there is
        something for *"connect it here"* to mean.

        Paths are explicit rather than "everything in scope". A person choosing
        what KAE reads is a person who can tell it what matters, and ingesting a
        whole repository unasked is the bulk-import the acquisition contract
        warns against.
        """

        paths = [p for p in body.get("paths", []) if isinstance(p, str) and p.strip()]
        if not paths:
            raise HTTPException(422, "name at least one file to ingest")

        read = await run_in_threadpool(acquisition(request).read_for_ingest, source_id, paths)
        source = acquisition(request).source(source_id)
        revision = source.snapshot.revision if source.snapshot else ""

        results = []
        for path, text in read:
            # One document per file, named for where it came from and pinned to
            # the revision. That name is the provenance a reader sees later, so
            # it carries both or it carries neither.
            outcome = await memory(request).ingest_document(
                body.get("project_id", ""),
                document=f"{source.location}@{revision[:7]}:{path}",
                text=text,
            )
            results.append({"path": path, "ingested": outcome})

        return {
            "source_id": source_id,
            "revision": revision,
            "ingested": results,
            "proves": (
                "these files were read at this revision and recorded as evidence. "
                "Extraction proposes candidates from them; nothing is confirmed, "
                "and no structure has been derived."
            ),
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
    async def modules(project_id: str, _: Operator = Depends(require_operator)) -> Any:
        """Every module, every edge, and the order they can be built in.

        This returned a hardcoded capability gap — *"modules are MCP-only by
        decision, not by omission"* — which was accurate and is no longer.
        KAE-Memory had no module route at all; `D-19` added the reads, and an
        agent connected over MCP could see a project's architecture while its
        owner could not.

        The gap that remains is **curation**: proposing a module or drawing an
        edge is still a write path Studio has no contract for, and nothing here
        simulates one.
        """

        graph = await client.module_graph(project_id)
        return {
            "available": True,
            "gap": asdict(MODULE_GAP),
            "graph": graph,
        }

    @app.get("/api/projects/{project_id}/modules/{key}")
    async def module_neighbourhood(
        project_id: str, key: str, _: Operator = Depends(require_operator)
    ) -> Any:
        """One module, and what it touches in both directions.

        The *"dig deeper for module-level information"* half. Dependencies and
        dependents arrive together because they answer opposite questions a
        reader needs at the same moment: what must exist before I build this,
        and what breaks if I change it.
        """

        return await client.module_neighbourhood(project_id, key)

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
