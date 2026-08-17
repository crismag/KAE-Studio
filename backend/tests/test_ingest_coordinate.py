"""What an ingested file is named after, and why it is not always the pin.

`D-182`. A source is pinned to a revision, and the ingest route names every
document it creates `"{location}@{revision[:7]}:{path}"`. For
`GitHubSourceClient` that is a true sentence — the pin goes to the contents API
as `ref` and GitHub serves that revision's blob. For `LocalSourceClient` it was
not: that client says in its own docstring that `revision` is *"accepted and
unused"*, because checking out history would mutate somebody's checkout, so what
it returns is the working tree. An uncommitted edit is the ordinary state of a
checkout somebody is working in, and the route recorded those bytes as the
contents of a commit that does not contain them.

These guards live at the service and client level rather than behind the route
because `kae_studio.api` imports `cie_slim`, a private sibling repository CI has
no checkout of (`AUD-033`). A guard that skips in the pipeline is a guard the
pipeline does not have.
"""

from __future__ import annotations

import base64
from pathlib import Path

import httpx
import pytest

from kae_studio.acquisition.github_source import GitHubSourceClient
from kae_studio.acquisition.local_source import LocalSourceClient
from kae_studio.acquisition.model import SourceKind
from kae_studio.acquisition.service import AcquisitionService

PIN = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678"


@pytest.fixture
def workspace(tmp_path: Path) -> Path:
    root = tmp_path / "workspaces"
    (root / "crm").mkdir(parents=True)
    (root / "crm" / "README.md").write_text("Invoices are sent within three days.\n")
    return root


def _github() -> GitHubSourceClient:
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
            return httpx.Response(200, json={"sha": PIN})
        if path.startswith("/repos/owner/repo/git/trees"):
            return httpx.Response(
                200,
                json={
                    "truncated": False,
                    "tree": [{"path": "README.md", "type": "blob", "sha": "b1", "size": 40}],
                },
            )
        if path == "/repos/owner/repo/contents/README.md":
            body = base64.b64encode(b"Invoices are sent within three days.").decode()
            return httpx.Response(200, json={"encoding": "base64", "content": body})
        return httpx.Response(404, json={"message": "Not Found"})

    return GitHubSourceClient("token", transport=httpx.MockTransport(handler))


def _local_service(workspace: Path) -> AcquisitionService:
    return AcquisitionService(
        None,  # type: ignore[arg-type]
        "no GitHub credential is configured",
        local=LocalSourceClient((workspace.resolve(),)),
    )


def _local_source(service: AcquisitionService, workspace: Path) -> str:
    source = service.add_source(
        project_id="p1",
        kind=SourceKind.LOCAL,
        connection_id="",
        location=str(workspace / "crm"),
        reference="",
    )
    service.pin(source.source_id)
    return source.source_id


def test_a_local_file_is_named_after_the_bytes_that_were_read(workspace: Path) -> None:
    """The coordinate identifies the content, not a commit nobody opened."""

    client = LocalSourceClient((workspace.resolve(),))
    repo = str(workspace / "crm")

    text, coordinate = client.read_at(repo, "README.md", PIN)

    assert text.startswith("Invoices are sent")
    assert coordinate != PIN
    entries, _ = client.tree(repo, PIN)
    # The same hash the file listing shows, so a coordinate on a statement can
    # be matched against the tree it came from rather than merely being unique.
    assert coordinate == next(e["sha"] for e in entries if e["path"] == "README.md")


def test_editing_the_working_tree_moves_the_coordinate(workspace: Path) -> None:
    """The defect, made visible: the pin cannot see this and the coordinate can.

    A pin is taken once. Everything after it — the edit somebody has not
    committed, the branch they switched to — is invisible to a name built from
    the pin, and every one of those reads would have been recorded under the
    same coordinate.
    """

    client = LocalSourceClient((workspace.resolve(),))
    repo = str(workspace / "crm")

    _, before = client.read_at(repo, "README.md", PIN)
    (workspace / "crm" / "README.md").write_text("Invoices are sent within thirty days.\n")
    _, after = client.read_at(repo, "README.md", PIN)

    assert before != after


def test_a_github_file_is_named_after_the_pin() -> None:
    """Because the pin is what that provider read. Nothing here changes."""

    text, coordinate = _github().read_at("owner/repo", "README.md", PIN)

    assert text.startswith("Invoices are sent")
    assert coordinate == PIN


def test_the_service_carries_a_coordinate_out_per_file(workspace: Path) -> None:
    """The route cannot compute this, so the client has to hand it over."""

    service = _local_service(workspace)
    source_id = _local_source(service, workspace)

    read = service.read_for_ingest(source_id, ["README.md"])

    assert len(read) == 1
    path, text, coordinate = read[0]
    assert path == "README.md"
    assert text.startswith("Invoices are sent")
    source = service.source(source_id)
    assert source.snapshot is not None
    assert coordinate != source.snapshot.revision
