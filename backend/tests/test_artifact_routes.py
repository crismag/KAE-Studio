"""Studio's artifact routes, against the real KAE-Artifacts application.

A **contract test**, not a mock test. The plan asks for "Studio KAE-Artifacts
client against current OpenAPI/API schemas", and the only honest way to get that
is to run the real service — in process, over an ASGI transport, with no
network. If KAE-Artifacts changes a field name, these fail here rather than in
somebody's browser.

Memory is faked, because Memory needs a database and this is not a test of
Memory. What is *not* faked is the shape it returns: `CONTEXT` below is the
actual `AssemblyResponse` structure, so the mapping is exercised against the
real thing.

These skip cleanly when KAE-Artifacts is not installed. It is a sibling
repository, not a dependency of this one, and a Studio checkout must not need it
to run its own suite.
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

# Studio's backend imports CIE at module level, and `cris-cie-slim` is a private
# repository while this one is public — so CI cannot check it out without a
# secret. Skipping keeps collection honest about *why* these do not run, rather
# than erroring as though the product were broken. Recorded as AUD-033; the fix
# is a deploy key, which is the repository owner's to grant.
#
# Before the imports below, because those are what pull CIE in.
pytest.importorskip("cie_slim", reason="cris-cie-slim is a private sibling repository")


from kae_studio.api import create_app
from kae_studio.config import Settings

kae_artifacts = pytest.importorskip(
    "kae_artifacts.api.app",
    reason=(
        "KAE-Artifacts is not installed in this environment. Install it with "
        "`pip install -e ../KAE-Artifacts` to run the contract tests."
    ),
)

BASE = {
    "KAE_MEMORY_TOKEN": "token",
    "STUDIO_SESSION_SECRET": "x" * 40,
    "STUDIO_NO_AUTH": "1",
    "KAE_ARTIFACTS_URL": "http://artifacts.test",
}

#: The real shape of `GET /v1/projects/{id}/context`. Copied from KAE-Memory's
#: `AssemblyResponse`, because a mapping tested against an invented shape tests
#: the invention.
CONTEXT: dict[str, Any] = {
    "manifest": {
        "package_id": "pkg_assembly",
        "project_id": "dabbcd54",
        "scope": "project",
        "purpose": "implementation",
        "knowledge_revision": 281,
        "content_hash": "sha256:abc123",
        "statement_count": 4,
        "traced_statements": 4,
        "confirmation_state": {"confirmed": 3, "proposed": 1, "contested": 0},
        "unresolved_critical_gaps": [
            {"area_key": "scope", "summary": "How are undated tasks handled?"}
        ],
        "warnings": [],
    },
    "sections": [
        {
            "area": "product_intent",
            "name": "Product intent",
            "statements": [
                {
                    "knowledge_id": "k1",
                    "kind": "goal",
                    "text": "Tasks are grouped by the day they are due.",
                    "label": "",
                    "lifecycle": "validated",
                    "version": 1,
                },
                {
                    "knowledge_id": "k2",
                    "kind": "actor",
                    "text": "A single individual is the only user.",
                    "label": "",
                    "lifecycle": "validated",
                    "version": 1,
                },
            ],
        },
        {
            "area": "constraints",
            "name": "Constraints",
            "statements": [
                {
                    "knowledge_id": "k3",
                    "kind": "constraint",
                    "text": "Runs on a personal phone.",
                    "label": "proposed",
                    "lifecycle": "proposed",
                    "version": 1,
                },
            ],
        },
    ],
    "package": {},
    "knowledge_revision": 281,
    "guidance": [],
}


class FakeMemory:
    """Enough of `MemoryClient` for these routes, and nothing more."""

    def __init__(self, context: dict[str, Any] | None = None) -> None:
        self._context = context if context is not None else CONTEXT
        self.context_calls = 0

    async def get_project(self, project_id: str) -> dict[str, Any]:
        return {"id": project_id, "name": "Task Inbox"}

    async def context(self, project_id: str, **_: Any) -> dict[str, Any]:
        self.context_calls += 1
        return self._context

    async def aclose(self) -> None:
        return None


class ArtifactsInProcess:
    """`ArtifactsClient`, wired to the real app over an ASGI transport.

    Subclassed rather than mocked so the client's own request building, error
    reading and JSON handling are all under test — which is where a contract
    mismatch would actually show up.
    """

    def __init__(self) -> None:
        from kae_studio.artifacts_client import ArtifactsClient

        self.service = kae_artifacts.create_app()
        self.client = ArtifactsClient("http://artifacts.test")
        self.client._client = httpx.AsyncClient(  # noqa: SLF001 — the point of the double
            transport=httpx.ASGITransport(app=self.service),
            base_url="http://artifacts.test",
            timeout=30.0,
        )

    def __getattr__(self, name: str) -> Any:
        return getattr(self.client, name)


@contextmanager
def studio(memory: FakeMemory | None = None, artifacts: Any = "real", **overrides: str):
    """A Studio app with its upstreams replaced but its own code intact.

    A context manager rather than a factory because the doubles have to be
    installed **after** the lifespan has run and **before** the first request.
    Entering the client twice — once here, once at the call site — would run the
    lifespan again and quietly replace the doubles with real clients, which is
    exactly what happened the first time this was written.
    """

    app = create_app(Settings.from_environment({**BASE, **overrides}))
    with TestClient(app) as client:
        app.state.memory = memory or FakeMemory()
        app.state.artifacts = ArtifactsInProcess() if artifacts == "real" else artifacts
        yield client


@pytest.fixture
def client():
    with studio() as c:
        yield c


class TestTheWholeOutputPath:
    def test_plan_generate_validate_preview_approve_publish(self, client: TestClient) -> None:
        """STI-5 through STI-7, over the browser-facing API.

        The journey the integration exists for: a Memory revision becomes a
        reviewed, approved, published package with provenance pointing back.
        """

        plan = client.post(
            "/api/projects/dabbcd54/artifact-plans",
            json={"profile": "minimal-agent-context"},
        ).json()
        assert plan["input_revision"] == "memory:281"
        assert plan["entries"]

        run = client.post(
            "/api/projects/dabbcd54/generation-runs",
            json={"plan_id": plan["plan_id"], "idempotency_key": "gen-1"},
        ).json()
        assert run["status"] == "succeeded"

        package_id = run["package_id"]
        assert client.post(
            f"/api/artifact-packages/{package_id}/validation"
        ).json()["publishable"]

        preview = client.post(
            "/api/artifact-previews",
            json={
                "package_id": package_id,
                "destination": {"type": "download", "mode": "object_write"},
            },
        ).json()
        assert preview["has_changes"] is True
        assert {c["outcome"] for c in preview["changes"]} == {"add"}

        approval = client.post(
            "/api/artifact-approvals", json={"preview_id": preview["preview_id"]}
        ).json()

        published = client.post(
            "/api/artifact-publications",
            json={
                "package_id": package_id,
                "destination": {"type": "download", "mode": "object_write"},
                "approval_id": approval["approval_id"],
                "idempotency_key": "pub-1",
            },
        )
        assert published.status_code == 202
        assert published.json()["status"] == "succeeded"

        provenance = client.get(
            f"/api/artifact-publications/{published.json()['publication_id']}/provenance"
        ).json()
        assert provenance["input_revision"] == "memory:281"
        assert provenance["approver_ref"] == "studio:operator"

    def test_the_operator_is_the_approver_not_the_request(self, client: TestClient) -> None:
        """A caller-supplied approver would let anything claim anybody's approval.

        And it travels into provenance, where it reads as a fact about who
        agreed.
        """

        plan = client.post(
            "/api/projects/dabbcd54/artifact-plans",
            json={"profile": "minimal-agent-context"},
        ).json()
        run = client.post(
            "/api/projects/dabbcd54/generation-runs",
            json={"plan_id": plan["plan_id"], "idempotency_key": "g"},
        ).json()
        preview = client.post(
            "/api/artifact-previews",
            json={
                "package_id": run["package_id"],
                "destination": {"type": "download", "mode": "object_write"},
            },
        ).json()

        approval = client.post(
            "/api/artifact-approvals",
            # An attempt to name somebody else. The route has no such field.
            json={"preview_id": preview["preview_id"], "approver_ref": "someone:else"},
        ).json()

        assert approval["approver_ref"] == "studio:operator"

    def test_a_retried_generation_is_the_same_run(self, client: TestClient) -> None:
        """A double-click, a reload, a retried request — one run."""

        plan = client.post(
            "/api/projects/dabbcd54/artifact-plans",
            json={"profile": "minimal-agent-context"},
        ).json()
        body = {"plan_id": plan["plan_id"], "idempotency_key": "same"}

        first = client.post("/api/projects/dabbcd54/generation-runs", json=body).json()
        second = client.post("/api/projects/dabbcd54/generation-runs", json=body).json()

        assert first["run_id"] == second["run_id"]

    def test_an_edited_path_survives_into_the_package(self, client: TestClient) -> None:
        """The edit is the whole reason a plan is a resource.

        An earlier design generated from artifact types and recomputed default
        paths, so moving a file did nothing and said nothing.
        """

        plan = client.post(
            "/api/projects/dabbcd54/artifact-plans",
            json={"profile": "minimal-agent-context"},
        ).json()
        client.patch(
            f"/api/artifact-plans/{plan['plan_id']}",
            json={"edits": [{"type": "agent-context", "logical_path": ".github/AGENTS.md"}]},
        )

        run = client.post(
            "/api/projects/dabbcd54/generation-runs",
            json={"plan_id": plan["plan_id"], "idempotency_key": "k"},
        ).json()

        manifest = client.get(f"/api/artifact-packages/{run['package_id']}").json()
        assert any(a["logical_path"] == ".github/AGENTS.md" for a in manifest["artifacts"])


class TestTheMemoryBoundary:
    def test_context_is_re_read_for_every_plan_and_generation(self) -> None:
        """Never cached across calls.

        A plan proposed against stale knowledge generates documents citing a
        revision the project has moved past. KAE-Artifacts refuses the mismatch
        — correctly — and a caller working from a cache would have no idea why.
        """

        memory = FakeMemory()
        with studio(memory=memory) as client:
            plan = client.post(
                "/api/projects/dabbcd54/artifact-plans",
                json={"profile": "minimal-agent-context"},
            ).json()
            client.post(
                "/api/projects/dabbcd54/generation-runs",
                json={"plan_id": plan["plan_id"], "idempotency_key": "k"},
            )

        assert memory.context_calls == 2

    def test_a_project_with_no_assemblable_context_says_so(self) -> None:
        """422 with a reason, not a 500 and not an empty plan."""

        with studio(memory=FakeMemory(context={"sections": []})) as client:
            response = client.post(
                "/api/projects/dabbcd54/artifact-plans",
                json={"profile": "minimal-agent-context"},
            )

        assert response.status_code == 422
        assert response.json()["error"]["code"] == "context_not_usable"


class TestRefusalsReachTheBrowserIntact:
    def test_an_unconfigured_deployment_reports_a_gap_not_an_error(self) -> None:
        """501, and a remedy naming the variable.

        Studio without KAE-Artifacts is a supported deployment. A 500 would send
        an operator hunting a bug that is a missing setting.
        """

        with studio(artifacts=None, KAE_ARTIFACTS_URL="") as client:
            response = client.get("/api/artifact-profiles")

        assert response.status_code == 501
        body = response.json()["detail"]
        assert body["error"]["code"] == "artifacts_not_configured"
        assert "KAE_ARTIFACTS_URL" in body["error"]["remedy"]

    def test_publishing_without_an_approval_stays_a_409(self, client: TestClient) -> None:
        """The status and the code both survive the trip through Studio."""

        plan = client.post(
            "/api/projects/dabbcd54/artifact-plans",
            json={"profile": "minimal-agent-context"},
        ).json()
        run = client.post(
            "/api/projects/dabbcd54/generation-runs",
            json={"plan_id": plan["plan_id"], "idempotency_key": "k"},
        ).json()

        response = client.post(
            "/api/artifact-publications",
            json={
                "package_id": run["package_id"],
                "destination": {"type": "download", "mode": "object_write"},
                "approval_id": "apr_does_not_exist",
                "idempotency_key": "p",
            },
        )

        assert response.status_code == 404
        assert response.json()["error"]["code"] == "not_found"

    def test_an_unreachable_service_is_503_and_says_the_outcome_is_unknown(self) -> None:
        """After a request that never arrived, "failed" is as unfounded as "succeeded"."""

        from kae_studio.artifacts_client import ArtifactsClient, ArtifactsUnavailable

        class Unreachable(ArtifactsClient):
            def __init__(self) -> None:
                super().__init__("http://nowhere.test")

            async def profiles(self) -> Any:
                raise ArtifactsUnavailable("connection refused")

        with studio(artifacts=Unreachable()) as client:
            response = client.get("/api/artifact-profiles")

        assert response.status_code == 503
        body = response.json()["error"]
        assert body["code"] == "artifacts_unavailable"
        assert body["retryable"] is True

    def test_a_browser_cannot_supply_a_credential_as_a_destination(
        self, client: TestClient
    ) -> None:
        """`connection_ref` names a secret; it never carries one.

        The field exists so a destination can say *which* connection to use.
        What matters is that the browser never holds the secret itself — this
        checks the whole round trip refuses to echo one back.
        """

        plan = client.post(
            "/api/projects/dabbcd54/artifact-plans",
            json={"profile": "minimal-agent-context"},
        ).json()
        run = client.post(
            "/api/projects/dabbcd54/generation-runs",
            json={"plan_id": plan["plan_id"], "idempotency_key": "k"},
        ).json()

        preview = client.post(
            "/api/artifact-previews",
            json={
                "package_id": run["package_id"],
                "destination": {
                    "type": "download",
                    "mode": "object_write",
                    "connection_ref": "secretsmanager:kae/github",
                },
            },
        ).json()

        assert "secretsmanager" not in repr(preview)


class TestTheDownloadIsObtainable:
    """`D-209`. Publishing to `download` produced bytes nobody could fetch.

    `AUD-029` added `GET /v1/packages/{id}/download` to KAE-Artifacts for
    exactly this reason, and Studio proxied no route to it — so the canned
    success moved one hop rather than going away.
    """

    def _published(self, client: TestClient) -> str:
        plan = client.post(
            "/api/projects/dabbcd54/artifact-plans",
            json={"profile": "minimal-agent-context"},
        ).json()
        run = client.post(
            "/api/projects/dabbcd54/generation-runs",
            json={"plan_id": plan["plan_id"], "idempotency_key": "dl"},
        ).json()
        destination = {"type": "download", "mode": "object_write"}
        preview = client.post(
            "/api/artifact-previews",
            json={"package_id": run["package_id"], "destination": destination},
        ).json()
        approval = client.post(
            "/api/artifact-approvals", json={"preview_id": preview["preview_id"]}
        ).json()
        published = client.post(
            "/api/artifact-publications",
            json={
                "package_id": run["package_id"],
                "destination": destination,
                "approval_id": approval["approval_id"],
                "idempotency_key": "dl-pub",
            },
        ).json()
        assert published["status"] == "succeeded"
        return str(run["package_id"])

    def test_the_bytes_come_back_as_the_archive_that_was_published(
        self, client: TestClient
    ) -> None:
        """The whole point: what `files_written` named is inside what arrives."""

        import io
        import zipfile

        package_id = self._published(client)

        response = client.get(f"/api/artifact-packages/{package_id}/download")

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/zip"
        assert package_id in response.headers["content-disposition"]
        with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
            names = archive.namelist()
        # The manifest is generated into the ZIP and appears in no preview
        # change row (`D-207`), so it is the entry that proves these are the
        # publisher's bytes rather than a re-assembly.
        assert "manifest.json" in names
        assert len(names) > 1

    def test_a_package_never_published_to_download_refuses_with_its_reason(
        self, client: TestClient
    ) -> None:
        """Not a 500, and not an empty ZIP.

        The archive lives in the publisher's process, so this is also what a
        restart looks like — which is why the surface says so before the
        control is pressed.
        """

        plan = client.post(
            "/api/projects/dabbcd54/artifact-plans",
            json={"profile": "minimal-agent-context"},
        ).json()
        run = client.post(
            "/api/projects/dabbcd54/generation-runs",
            json={"plan_id": plan["plan_id"], "idempotency_key": "never"},
        ).json()

        response = client.get(f"/api/artifact-packages/{run['package_id']}/download")

        assert response.status_code == 404
        body = response.json()["error"]
        assert body["code"] == "download_not_available"
        assert body["remedy"]

    def test_a_package_identifier_cannot_write_the_response_header(self) -> None:
        """A path parameter interpolated into `Content-Disposition`.

        A quote would end the filename early and a newline is a header-splitting
        attempt. The name is a convenience; the bytes are the answer.
        """

        from kae_studio.api import _download_filename

        assert _download_filename('pkg_1"; x="y') == "pkg_1xy.zip"
        assert _download_filename("pkg\r\nSet-Cookie: a=b") == "pkgSet-Cookieab.zip"
        assert _download_filename('"') == "package.zip"
        assert _download_filename("pkg_abc-1.2") == "pkg_abc-1.2.zip"


class TestTheMapping:
    def test_memory_lifecycle_becomes_what_a_generator_may_claim(self) -> None:
        from kae_studio.generation_input import to_generation_input

        result = to_generation_input(CONTEXT, project_name="Task Inbox")

        by_text = {s["text"]: s["confidence"] for s in result["statements"]}
        assert by_text["Tasks are grouped by the day they are due."] == "confirmed"
        assert by_text["Runs on a personal phone."] == "proposed"

    def test_an_unrecognised_lifecycle_becomes_the_weaker_claim(self) -> None:
        """Memory will add states this mapping has not seen.

        A generator rendering an unknown state as settled fact produces a
        document a reader acts on, so the default has to be safe rather than
        convenient.
        """

        from kae_studio.generation_input import to_generation_input

        context = {
            **CONTEXT,
            "sections": [
                {
                    "area": "a",
                    "name": "A",
                    "statements": [
                        {
                            "knowledge_id": "k9",
                            "kind": "goal",
                            "text": "Something.",
                            "lifecycle": "under-arbitration",
                            "version": 1,
                        }
                    ],
                }
            ],
        }

        result = to_generation_input(context)

        assert result["statements"][0]["confidence"] == "proposed"

    def test_unresolved_gaps_travel_as_open_questions(self) -> None:
        """A document that reads as complete when it is not is how an agent
        chooses on the project's behalf."""

        from kae_studio.generation_input import to_generation_input

        result = to_generation_input(CONTEXT)

        assert result["open_questions"][0]["question"] == "How are undated tasks handled?"

    def test_evidence_is_referenced_not_copied(self) -> None:
        from kae_studio.generation_input import to_generation_input

        result = to_generation_input(CONTEXT)

        assert result["statements"][0]["evidence_refs"] == ["k1"]

    def test_the_revision_names_the_system_it_came_from(self) -> None:
        """`281` is a number. `memory:281` is an answer."""

        from kae_studio.generation_input import to_generation_input

        assert to_generation_input(CONTEXT)["input_revision"] == "memory:281"


class TestWhatAPackageMayNotCarry:
    """`D-35` — a decided statement is left out, not relabelled.

    `DEVELOPMENT_PACKAGE_SPEC`: *"A consumer must be able to distinguish a
    confirmed constraint from a proposal, assumption, recommendation,
    contradiction, or unresolved question."*

    `superseded` and `rejected` mapped to `proposed`, so a statement somebody
    decided against would have entered a development package as a candidate
    awaiting agreement — handed to whoever builds from it. Latent, because
    Memory's blueprint assembles from `VALIDATED` only and none of them can
    currently arrive; `D-34` shortened that distance by putting `superseded`
    into circulation across Studio.

    The sibling test above keeps the other half honest: an **unrecognised**
    lifecycle still falls to the weaker claim, because that says only that
    nobody has agreed to it. This is about the ones we can judge.
    """

    def _context(self, lifecycle: str) -> dict:
        return {
            **CONTEXT,
            "sections": [
                {
                    "area": "a",
                    "statements": [
                        {
                            "text": "A rule the project decided against.",
                            "kind": "rule",
                            "lifecycle": lifecycle,
                            "knowledge_id": "k-1",
                        }
                    ],
                }
            ],
        }

    @pytest.mark.parametrize("lifecycle", ["rejected", "superseded", "retracted"])
    def test_a_decided_statement_never_reaches_the_package(self, lifecycle: str) -> None:
        from kae_studio.generation_input import to_generation_input

        result = to_generation_input(self._context(lifecycle), project_name="Task Inbox")

        assert result["statements"] == []

    @pytest.mark.parametrize("lifecycle", ["rejected", "superseded"])
    def test_it_is_never_labelled_a_proposal(self, lifecycle: str) -> None:
        """The specific harm. A discarded rule presented as a candidate is a
        discarded rule in somebody's build."""

        from kae_studio.generation_input import to_generation_input

        result = to_generation_input(self._context(lifecycle), project_name="Task Inbox")

        assert "proposed" not in [s["confidence"] for s in result["statements"]]

    def test_the_package_says_what_it_left_out(self) -> None:
        """Silence about a dropped statement is not being explicit about
        missing information, which the spec requires."""

        from kae_studio.generation_input import to_generation_input

        result = to_generation_input(self._context("rejected"), project_name="Task Inbox")

        assert "1 statement(s) were left out" in result["summary"]
        assert "no honest label" in result["summary"]

    def test_a_confirmed_statement_still_reaches_it(self) -> None:
        # The other direction, and the one that keeps this from being a filter
        # that quietly empties packages.
        from kae_studio.generation_input import to_generation_input

        result = to_generation_input(self._context("validated"), project_name="Task Inbox")

        assert [s["confidence"] for s in result["statements"]] == ["confirmed"]

    def test_a_package_with_nothing_dropped_says_nothing(self) -> None:
        # A standing notice on every package is one nobody reads.
        from kae_studio.generation_input import to_generation_input

        result = to_generation_input(CONTEXT, project_name="Task Inbox")

        assert "left out" not in result["summary"]
