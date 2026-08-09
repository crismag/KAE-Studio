"""Acquisition, and the four things it must never conflate.

STI-1 exists; STI-2 to STI-4 do not. Most of what these check is that the
difference stays visible — that a verified connection, a readable source and a
pinned commit each mean only what they mean, and that none of them can be read
as "this repository has been analyzed".

The live pin at the end runs against a real repository when configured, and
skips cleanly otherwise.
"""

from __future__ import annotations

import os
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from kae_studio.acquisition import SourceKind, SourceState
from kae_studio.acquisition.github_source import (
    GitHubSourceClient,
    SourceReadError,
    snapshot_digest,
)
from kae_studio.acquisition.model import SourceScope
from kae_studio.acquisition.service import AcquisitionService
from kae_studio.api import create_app
from kae_studio.config import Settings

REPO = "crismag/example"

BASE = {
    "KAE_MEMORY_TOKEN": "token",
    "STUDIO_SESSION_SECRET": "x" * 40,
    "STUDIO_NO_AUTH": "1",
}


def source_client(routes: dict[tuple[str, str], httpx.Response]) -> GitHubSourceClient:
    def handler(request: httpx.Request) -> httpx.Response:
        return routes.get(
            (request.method, request.url.path), httpx.Response(404, json={"message": "Not Found"})
        )

    return GitHubSourceClient("ghp_token", transport=httpx.MockTransport(handler))


class TestTheScopeKeepsSecretsOut:
    """Not a performance concern. `.env` files are exactly what a repository
    reader would otherwise hoover into an evidence store."""

    @pytest.mark.parametrize(
        "path",
        [
            ".env",
            ".env.production",
            "config/id_rsa",
            "certs/server.pem",
            "keys/private.key",
            "node_modules/left-pad/index.js",
            ".git/config",
            "dist/bundle.js",
        ],
    )
    def test_dangerous_and_generated_paths_are_excluded_by_default(self, path: str) -> None:
        assert SourceScope().excludes(path) is True

    @pytest.mark.parametrize("path", ["README.md", "src/app.py", "docs/ARCHITECTURE.md"])
    def test_ordinary_source_and_documentation_is_in_scope(self, path: str) -> None:
        assert SourceScope().excludes(path) is False

    def test_include_paths_narrow_rather_than_widen(self) -> None:
        """An include list must not re-admit what the exclude list refused."""

        scope = SourceScope(include_paths=("docs/",))

        assert scope.excludes("src/app.py") is True
        assert scope.excludes("docs/A.md") is False
        assert scope.excludes("docs/.env") is True


class TestConnectivityProvesOnlyWhatItProves:
    def test_read_and_write_are_reported_separately(self) -> None:
        """They are separate grants.

        One boolean would assert both on the evidence of whichever was tested,
        and "connected ✓" beside a repository is read as permission to write to
        it.
        """

        github = source_client(
            {
                ("GET", f"/repos/{REPO}"): httpx.Response(
                    200,
                    json={
                        "owner": {"login": "crismag"},
                        "permissions": {"pull": True, "push": False},
                        "default_branch": "main",
                    },
                )
            }
        )
        service = AcquisitionService(github)
        connection = service.add_connection("github", "personal", "env:TOKEN")

        result = service.check(connection.connection_id, REPO)

        assert result.can_read is True
        assert result.can_write is False

    def test_the_result_says_in_words_what_it_does_not_prove(self) -> None:
        github = source_client(
            {
                ("GET", f"/repos/{REPO}"): httpx.Response(
                    200, json={"owner": {"login": "crismag"}, "permissions": {"pull": True}}
                )
            }
        )
        service = AcquisitionService(github)
        connection = service.add_connection("github", "personal", "env:TOKEN")

        described = service.check(connection.connection_id, REPO).describe()

        assert "Nothing has been read or analyzed" in described["proves"]

    def test_a_refusal_and_an_outage_are_different_states(self) -> None:
        """One is a permissions problem, the other is an outage.

        They send an operator to completely different places, and a single
        `failed` would send them to the wrong one half the time.
        """

        refused = AcquisitionService(
            source_client({("GET", f"/repos/{REPO}"): httpx.Response(403, json={})})
        )
        down = AcquisitionService(
            source_client({("GET", f"/repos/{REPO}"): httpx.Response(500, json={})})
        )
        a = refused.add_connection("github", "a", "env:T")
        b = down.add_connection("github", "b", "env:T")

        refused.check(a.connection_id, REPO)
        down.check(b.connection_id, REPO)

        assert refused.connection(a.connection_id).state.value == "refused"
        assert down.connection(b.connection_id).state.value == "unreachable"

    def test_a_connection_never_exposes_where_its_secret_lives(self) -> None:
        """Not a secret itself, but it names one.

        Published to a browser it tells an attacker exactly which environment
        variable or file to go after.
        """

        service = AcquisitionService()
        connection = service.add_connection("github", "personal", "env:KAE_GITHUB_TOKEN")

        assert "KAE_GITHUB_TOKEN" not in repr(connection.redacted())
        assert "connection_ref" not in connection.redacted()


class TestPinningIsNotAnalysis:
    def github(self) -> GitHubSourceClient:
        return source_client(
            {
                ("GET", f"/repos/{REPO}"): httpx.Response(
                    200, json={"owner": {"login": "crismag"}, "permissions": {"pull": True}}
                ),
                ("GET", f"/repos/{REPO}/commits/main"): httpx.Response(
                    200, json={"sha": "c0ffee1234567890"}
                ),
                ("GET", f"/repos/{REPO}/git/trees/c0ffee1234567890"): httpx.Response(
                    200,
                    json={
                        "truncated": False,
                        "tree": [
                            {"path": "README.md", "type": "blob", "sha": "b1", "size": 100},
                            {"path": "src/app.py", "type": "blob", "sha": "b2", "size": 200},
                            {"path": ".env", "type": "blob", "sha": "b3", "size": 50},
                            {"path": "src", "type": "tree", "sha": "t1"},
                        ],
                    },
                ),
            }
        )

    def pinned(self) -> tuple[AcquisitionService, Any]:
        service = AcquisitionService(self.github())
        connection = service.add_connection("github", "personal", "env:TOKEN")
        source = service.add_source(
            "p1", SourceKind.GITHUB, connection.connection_id, REPO, "main"
        )
        return service, service.pin(source.source_id)

    def test_a_branch_resolves_to_an_immutable_commit(self) -> None:
        """A finding traced to `main` is traced to whatever `main` is today."""

        _, source = self.pinned()

        assert source.snapshot is not None
        assert source.snapshot.revision == "c0ffee1234567890"

    def test_pinning_reaches_pinned_and_never_analyzed(self) -> None:
        """The state a product most wants to claim, and cannot.

        `PINNED` means we know which bytes we *would* read. Nothing has read
        them, and nothing has proposed a single finding.
        """

        _, source = self.pinned()

        assert source.state is SourceState.PINNED
        assert source.state is not SourceState.ANALYZED

    def test_excluded_files_are_counted_out_and_reported(self) -> None:
        _, source = self.pinned()

        assert source.snapshot is not None
        assert source.snapshot.file_count == 2  # README.md, src/app.py
        assert source.snapshot.excluded_count == 1  # .env

    def test_every_source_carries_the_analysis_gap(self) -> None:
        """On every source, always — not only when analysis is unavailable.

        A field that appeared conditionally is a field a UI can forget to check.
        """

        _, source = self.pinned()

        described = source.describe()
        assert described["analysis"]["state"] == "planned"
        assert "not implemented" in described["analysis"]["reason"]

    def test_the_snapshot_digest_is_order_independent(self) -> None:
        """The same snapshot described twice must digest the same.

        Otherwise "have these files changed?" depends on the order GitHub
        happened to return them.
        """

        forward = [{"path": "a", "sha": "1"}, {"path": "b", "sha": "2"}]
        backward = [{"path": "b", "sha": "2"}, {"path": "a", "sha": "1"}]

        assert snapshot_digest(forward) == snapshot_digest(backward)


class TestTheApiIsHonestAboutAnalysis:
    def client(self) -> TestClient:
        app = create_app(Settings.from_environment(BASE))
        client = TestClient(app)
        return client

    def test_analysis_answers_501_with_what_is_proved_instead(self) -> None:
        """501 rather than 404: a client should discover the gap by asking.

        A 404 would read as a wrong URL, and somebody would go looking for the
        right one.
        """

        with self.client() as browser:
            response = browser.post("/api/sources/src_anything/analysis")

        assert response.status_code == 501
        body = response.json()["error"]
        assert body["code"] == "analysis_not_implemented"
        assert body["state"] == "planned"
        assert "revision pinned" in body["proved_instead"]

    def test_the_source_listing_reports_the_gap_at_the_top_level_too(self) -> None:
        with self.client() as browser:
            body = browser.get("/api/projects/p1/sources").json()

        assert body["analysis"]["state"] == "planned"

    def test_status_reports_analysis_as_planned(self) -> None:
        """An operator looking at a deployment should see it without asking."""

        with self.client() as browser:
            body = browser.get("/api/status").json()

        assert body["source_analysis"] == "planned"


LIVE_REPO = os.environ.get("KAE_STUDIO_LIVE_GITHUB_REPO", "")
LIVE_TOKEN = os.environ.get("KAE_STUDIO_LIVE_GITHUB_TOKEN", "")


@pytest.mark.skipif(
    not (LIVE_REPO and LIVE_TOKEN),
    reason="no live GitHub source configured",
)
def test_a_real_repository_pins_and_reads() -> None:
    """STI-1 against a real repository: verify, pin, read a file.

    Read-only throughout. Nothing here writes, and the source client has no
    method that could.
    """

    service = AcquisitionService(GitHubSourceClient(LIVE_TOKEN))
    connection = service.add_connection("github", "live", "env:TOKEN")
    check = service.check(connection.connection_id, LIVE_REPO)
    assert check.ok and check.can_read

    source = service.add_source(
        "p1", SourceKind.GITHUB, connection.connection_id, LIVE_REPO, "main"
    )
    pinned = service.pin(source.source_id)

    assert pinned.state is SourceState.PINNED
    assert pinned.snapshot is not None
    assert len(pinned.snapshot.revision) == 40, "a pinned revision must be a full commit SHA"
    assert pinned.snapshot.file_count > 0
    assert pinned.snapshot.content_digest.startswith("sha256:")

    content = service.sample(source.source_id, "README.md")
    assert content.strip()

    # Still not analyzed. The whole point.
    assert pinned.state is not SourceState.ANALYZED


@pytest.mark.skipif(not (LIVE_REPO and LIVE_TOKEN), reason="no live GitHub source configured")
def test_a_scoped_out_path_is_refused_before_it_is_fetched() -> None:
    """Scope is enforced on the way out, not filtered on the way back."""

    service = AcquisitionService(GitHubSourceClient(LIVE_TOKEN))
    connection = service.add_connection("github", "live", "env:TOKEN")
    source = service.add_source(
        "p1", SourceKind.GITHUB, connection.connection_id, LIVE_REPO, "main"
    )

    with pytest.raises(SourceReadError, match="outside the configured scope"):
        service.sample(source.source_id, ".env")
