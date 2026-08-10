"""Studio's complete output journey, against a real GitHub repository.

The proof the whole integration exists for, driven through **Studio's
browser-facing API** — the same routes the React app calls — with a real
KAE-Artifacts service behind it and a real repository behind that:

    Memory revision → plan → generate → validate → preview
      → approval → branch → commit → draft PR → read-back → provenance

Memory is faked, because it needs a database and this is not a test of Memory.
Everything else is real: the Studio routes, the artifacts client, the HTTP
adapter, the repository.

**Skips by default.** Set both variables to run it:

    export KAE_STUDIO_LIVE_GITHUB_REPO=you/a-throwaway-repo
    export KAE_STUDIO_LIVE_GITHUB_TOKEN="$(gh auth token)"
    .venv/bin/pytest tests/test_live_journey.py -q -s

It creates a branch and a draft pull request and does not delete them. Use a
repository you are willing to have that happen to.
"""

from __future__ import annotations

import os
import uuid
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
# Before the `kae_studio` imports below, because those are what pull CIE in.
pytest.importorskip("cie_slim", reason="cris-cie-slim is a private sibling repository")


from kae_studio.api import create_app
from kae_studio.artifacts_client import ArtifactsClient
from kae_studio.config import Settings

from .test_artifact_routes import FakeMemory

REPO = os.environ.get("KAE_STUDIO_LIVE_GITHUB_REPO", "")
TOKEN = os.environ.get("KAE_STUDIO_LIVE_GITHUB_TOKEN", "")

needs_github = pytest.mark.skipif(
    not (REPO and TOKEN),
    reason=(
        "no live GitHub destination configured. Set KAE_STUDIO_LIVE_GITHUB_REPO "
        "and KAE_STUDIO_LIVE_GITHUB_TOKEN to a repository you own and are "
        "willing to have branches created in."
    ),
)

pytest.importorskip("kae_artifacts.api.app", reason="KAE-Artifacts is not installed")


@contextmanager
def studio_over_real_github():
    """Studio, over a real KAE-Artifacts, over the real GitHub adapter."""

    from kae_artifacts.api.app import create_app as artifacts_app
    from kae_artifacts.application.services import ArtifactService
    from kae_artifacts.publishers.github import GitHubPublisher
    from kae_artifacts.publishers.github_http import GitHubHttpClient

    service = ArtifactService()
    service.github = GitHubPublisher(GitHubHttpClient(TOKEN))

    client = ArtifactsClient("http://artifacts.test")
    client._client = httpx.AsyncClient(  # noqa: SLF001 — wiring a real app in process
        transport=httpx.ASGITransport(app=artifacts_app(service)),
        base_url="http://artifacts.test",
        timeout=60.0,
    )

    app = create_app(
        Settings.from_environment(
            {
                "KAE_MEMORY_TOKEN": "token",
                "STUDIO_SESSION_SECRET": "x" * 40,
                "STUDIO_NO_AUTH": "1",
                "KAE_ARTIFACTS_URL": "http://artifacts.test",
            }
        )
    )
    with TestClient(app) as browser:
        app.state.memory = FakeMemory()
        app.state.artifacts = client
        yield browser


@needs_github
def test_a_memory_revision_becomes_a_reviewed_draft_pull_request() -> None:
    run = uuid.uuid4().hex[:8]
    destination: dict[str, Any] = {
        "type": "github",
        "mode": "pull_request",
        "target": REPO,
        "target_path": f"docs/studio-journey/{run}",
        "base_branch": "main",
    }

    with studio_over_real_github() as browser:
        plan = browser.post(
            "/api/projects/dabbcd54/artifact-plans", json={"profile": "minimal-agent-context"}
        ).json()
        assert plan["input_revision"] == "memory:281"

        generated = browser.post(
            "/api/projects/dabbcd54/generation-runs",
            json={"plan_id": plan["plan_id"], "idempotency_key": f"j-gen-{run}"},
        ).json()
        assert generated["status"] == "succeeded"
        package_id = generated["package_id"]

        assert browser.post(f"/api/artifact-packages/{package_id}/validation").json()[
            "publishable"
        ]

        preview = browser.post(
            "/api/artifact-previews",
            json={"package_id": package_id, "destination": destination},
        ).json()
        # A GitHub preview must carry the base commit it was read against.
        # Without it there is nothing for the approval to go stale against.
        assert preview["base_token"]
        assert preview["has_changes"] is True

        approval = browser.post(
            "/api/artifact-approvals", json={"preview_id": preview["preview_id"]}
        ).json()
        # The signed-in operator, resolved server-side. A request-supplied
        # approver would let anything claim anybody's approval.
        assert approval["approver_ref"] == "studio:operator"

        published = browser.post(
            "/api/artifact-publications",
            json={
                "package_id": package_id,
                "destination": destination,
                "approval_id": approval["approval_id"],
                "idempotency_key": f"j-pub-{run}",
            },
        )
        assert published.status_code == 202
        result = published.json()
        assert result["status"] == "succeeded", result["detail"]
        assert result["external_reference"], "no commit SHA was recorded"
        assert "/pull/" in result["review_url"], "no pull request was opened"

        # The retry a user produces by double-clicking, or a proxy produces by
        # replaying a request whose response was lost.
        again = browser.post(
            "/api/artifact-publications",
            json={
                "package_id": package_id,
                "destination": destination,
                "approval_id": approval["approval_id"],
                "idempotency_key": f"j-pub-{run}",
            },
        ).json()
        assert again["publication_id"] == result["publication_id"]

        provenance = browser.get(
            f"/api/artifact-publications/{result['publication_id']}/provenance"
        ).json()
        assert provenance["input_revision"] == "memory:281"
        assert provenance["approver_ref"] == "studio:operator"
        assert provenance["external_reference"] == result["external_reference"]
        # It travels. A connection reference in it would be a pointer to a
        # secret in a record designed to be handed around.
        assert "connection_ref" not in repr(provenance)


@needs_github
def test_the_default_branch_is_never_the_destination() -> None:
    """Studio must not be able to ask for a direct write to `main`.

    The publisher refuses `direct` mode regardless, but a UI that offered it
    would be offering something that always fails — and the failure would look
    like a bug rather than a policy.
    """

    with studio_over_real_github() as browser:
        plan = browser.post(
            "/api/projects/dabbcd54/artifact-plans", json={"profile": "minimal-agent-context"}
        ).json()
        generated = browser.post(
            "/api/projects/dabbcd54/generation-runs",
            json={"plan_id": plan["plan_id"], "idempotency_key": f"d-{uuid.uuid4().hex[:8]}"},
        ).json()
        destination = {
            "type": "github",
            "mode": "direct",
            "target": REPO,
            "target_path": "docs/should-never-exist",
            "base_branch": "main",
        }
        preview = browser.post(
            "/api/artifact-previews",
            json={"package_id": generated["package_id"], "destination": destination},
        ).json()
        approval = browser.post(
            "/api/artifact-approvals", json={"preview_id": preview["preview_id"]}
        ).json()

        result = browser.post(
            "/api/artifact-publications",
            json={
                "package_id": generated["package_id"],
                "destination": destination,
                "approval_id": approval["approval_id"],
                "idempotency_key": f"d-pub-{uuid.uuid4().hex[:8]}",
            },
        ).json()

        assert result["status"] == "failed"
        assert "direct_mode_refused" in result["detail"]
