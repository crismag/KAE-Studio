"""B3 · A connected repository becomes evidence, without anybody retyping it.

The gap GitHub issue #3 recorded, closed at the point where it was real: a user
said their context was in a GitHub repository and was asked to paste its
contents, three times.

`B1` stopped Studio materialising questions on every page load. `B2` gave CIE a
skill that outranks continuing its own line of questioning when somebody points
at evidence, and a rule forbidding it from declining access without naming the
route. Both of those are only honest if the route exists. This is the route.

## What it must not become

**Ingestion is not analysis, and the distinction is the whole reason this
module has a docstring.** These files become durable evidence; extraction
proposes candidates from their text; a person confirms. Nothing derives
structure, so `source.analysis` stays a capability gap and `/analysis` still
returns 501 — asserted below, because relabelling this as analysis is the
cheapest possible lie and would undo `ANALYSIS_UNAVAILABLE`'s entire purpose.
"""

from __future__ import annotations

from typing import Any

import httpx
import pytest

pytest.importorskip("cie_slim", reason="cris-cie-slim is a private sibling repository")

from fastapi.testclient import TestClient  # noqa: E402

from kae_studio.acquisition import SourceKind  # noqa: E402
from kae_studio.acquisition.github_source import GitHubSourceClient  # noqa: E402
from kae_studio.acquisition.service import AcquisitionService  # noqa: E402
from kae_studio.api import create_app  # noqa: E402
from kae_studio.config import Settings  # noqa: E402

BASE = {
    "KAE_MEMORY_TOKEN": "token",
    "STUDIO_SESSION_SECRET": "x" * 40,
    "STUDIO_NO_AUTH": "1",
}

REVISION = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678"


def _github() -> GitHubSourceClient:
    """A GitHub that answers for one repository at one revision."""

    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path == "/repos/owner/repo":
            return httpx.Response(
                200,
                json={
                    "owner": {"login": "owner"},
                    "permissions": {"pull": True, "push": False},
                    "default_branch": "main",
                    "private": False,
                },
            )
        if path.startswith("/repos/owner/repo/commits"):
            return httpx.Response(200, json={"sha": REVISION})
        if path.startswith("/repos/owner/repo/git/trees"):
            return httpx.Response(
                200,
                json={
                    "truncated": False,
                    "tree": [
                        {"path": "README.md", "type": "blob", "sha": "b1", "size": 400},
                        {"path": "docs/SPEC.md", "type": "blob", "sha": "b2", "size": 900},
                        # Excluded by the default scope. It must not appear in a
                        # listing, and asking for it by name must be refused.
                        {"path": ".env", "type": "blob", "sha": "b3", "size": 20},
                    ],
                },
            )
        if path == "/repos/owner/repo/contents/README.md":
            import base64

            body = base64.b64encode(b"Invoices are sent within three days.").decode()
            return httpx.Response(200, json={"encoding": "base64", "content": body})
        return httpx.Response(404, json={"message": "Not Found"})

    return GitHubSourceClient("token", transport=httpx.MockTransport(handler))


class _RecordingMemory:
    """Records what Studio handed Memory, and answers everything else emptily."""

    def __init__(self) -> None:
        self.documents: list[tuple[str, str]] = []
        self.provenance: list[tuple[str | None, str | None]] = []

    async def ingest_document(
        self,
        project_id: str,
        document: str,
        text: str,
        max_chunks: int | None = None,
        source_type: str | None = None,
        source_id: str | None = None,
    ) -> Any:
        self.documents.append((document, text))
        self.provenance.append((source_type, source_id))
        return {"chunks_recorded": 1, "truncated_chunks": 0, "warnings": []}

    def __getattr__(self, name: str) -> Any:
        async def empty(*_a: Any, **_k: Any) -> Any:
            return {}

        async def shut_down(*_a: Any, **_k: Any) -> None:
            return None

        return shut_down if name == "aclose" else empty


def _pinned(app: Any) -> str:
    """A source connected, verified and pinned — everything B3 builds on."""

    service: AcquisitionService = app.state.acquisition
    connection = service.add_connection("github", "test", "env:TOKEN")
    service.check(connection.connection_id, "owner/repo")
    source = service.add_source("p1", SourceKind.GITHUB, connection.connection_id, "owner/repo", "main")
    service.pin(source.source_id)
    return source.source_id


@pytest.fixture
def client_and_memory() -> Any:
    """Substitutions go *after* the lifespan, which builds its own of both.

    Setting `app.state.acquisition` before entering looks right and is
    overwritten on startup — the service then has no GitHub client and every
    route answers 501, which reads as the product refusing rather than the
    fixture being wrong.
    """

    app = create_app(Settings.from_environment(BASE))
    memory = _RecordingMemory()
    with TestClient(app) as client:
        app.state.acquisition = AcquisitionService(github=_github())
        app.state.memory = memory
        yield client, memory, _pinned(app)


def test_a_pinned_source_lists_the_files_it_would_read(client_and_memory: Any) -> None:
    """"412 files" was all a user could see. Now they can see which."""

    client, _memory, source_id = client_and_memory

    body = client.get(f"/api/sources/{source_id}/files").json()

    paths = [entry["path"] for entry in body["files"]]
    assert "README.md" in paths
    assert "docs/SPEC.md" in paths
    # Scope is applied to the listing, not only to the read. Offering a path
    # that would then be refused is a worse experience than not offering it.
    assert ".env" not in paths


def test_chosen_files_become_evidence_in_memory(client_and_memory: Any) -> None:
    client, memory, source_id = client_and_memory

    response = client.post(
        f"/api/sources/{source_id}/ingest",
        json={"project_id": "p1", "paths": ["README.md"]},
    )

    assert response.status_code == 200
    assert len(memory.documents) == 1
    document, text = memory.documents[0]
    # The document name carries repository, revision and path, because that is
    # the provenance somebody reads months later.
    assert "owner/repo" in document
    assert REVISION[:7] in document
    assert "README.md" in document
    assert "Invoices are sent within three days." in text


def test_a_repository_file_is_recorded_as_one(client_and_memory: Any) -> None:
    """The name carried the provenance and the request did not (`D-164`).

    `IngestDocumentRequest.source_type` defaults to an imported document, so a
    caller that says nothing has every file it read out of a repository stored
    as something somebody pasted — in the product whose claim is that it can say
    where a statement came from. The source identifier travels with it because
    the disposition that decides whether the body may be kept lives on that row
    and nothing else connects the two.
    """

    client, memory, source_id = client_and_memory

    client.post(
        f"/api/sources/{source_id}/ingest",
        json={"project_id": "p1", "paths": ["README.md"]},
    )

    assert memory.provenance == [("repository", source_id)]


def test_every_kind_that_can_be_read_says_what_it_is() -> None:
    """The mapping covers the read path exactly, and is not allowed to drift.

    `_MEMORY_SOURCE_TYPES` is indexed rather than defaulted, so a kind added to
    the read path and forgotten here would be a `KeyError` at ingest — and a
    kind given a fallback would be the defect the table exists to close, quietly
    back. Both directions fail here first.
    """

    from pathlib import Path

    from kae_studio.acquisition.local_source import LocalSourceClient
    from kae_studio.acquisition.model import Source, SourceScope
    from kae_studio.acquisition.service import SourceReadError
    from kae_studio.api import _MEMORY_SOURCE_TYPES

    service = AcquisitionService(github=_github(), local=LocalSourceClient((Path("/tmp"),)))

    for kind in SourceKind:
        source = Source(
            source_id="s1",
            project_id="p1",
            kind=kind,
            connection_id="c1",
            location="owner/repo",
            reference="main",
            scope=SourceScope(),
        )
        try:
            service._client_for(source)
        except SourceReadError:
            readable = False
        else:
            readable = True

        assert readable == (kind in _MEMORY_SOURCE_TYPES), (
            f"{kind.value} is readable={readable} and mapped="
            f"{kind in _MEMORY_SOURCE_TYPES}; the two sets must be the same one"
        )


def test_a_path_outside_scope_is_refused_rather_than_skipped(client_and_memory: Any) -> None:
    """Silently dropping it is how somebody believes their scope covered it.

    The paths come from a browser, so the caller is not trusted — scope is
    enforced per file at the point of reading.
    """

    client, memory, source_id = client_and_memory

    response = client.post(
        f"/api/sources/{source_id}/ingest",
        json={"project_id": "p1", "paths": ["README.md", ".env"]},
    )

    assert response.status_code == 403
    assert memory.documents == [], "a refused batch must not half-ingest"


def test_ingest_needs_at_least_one_named_file(client_and_memory: Any) -> None:
    """No "everything in scope" button.

    Ingesting a whole repository unasked is the bulk import the acquisition
    contract warns against, and choosing is how a person tells KAE what matters.
    """

    client, _memory, source_id = client_and_memory

    response = client.post(f"/api/sources/{source_id}/ingest", json={"project_id": "p1", "paths": []})

    assert response.status_code == 422


def test_ingesting_does_not_make_the_source_analyzed(client_and_memory: Any) -> None:
    """The assertion that stops this becoming the lie it was built to avoid.

    Reading files is not deriving structure. If ingestion ever flipped
    `analysis` to available, KAE would be claiming it understood a repository
    because it had read some of it — which is precisely what issue #3's
    honesty constraint forbids.
    """

    client, _memory, source_id = client_and_memory

    client.post(f"/api/sources/{source_id}/ingest", json={"project_id": "p1", "paths": ["README.md"]})

    listed = client.get("/api/projects/p1/sources").json()
    entries = listed.get("sources", listed) if isinstance(listed, dict) else listed
    assert entries[0]["analysis"]["capability"] == "source.analysis"
    assert entries[0]["state"] != "analyzed"
    assert client.post(f"/api/sources/{source_id}/analysis").status_code == 501
