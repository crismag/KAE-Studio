"""A local source reads inside its roots and nowhere else (`D-67`).

`ADR-0006` makes local execution canonical, and a local directory needs no
credential, no GitHub App and no network — which is why this provider comes
first. It is also the most dangerous thing in the acquisition package: it reaches
the host's filesystem over an HTTP API, in a deployment where `STUDIO_NO_AUTH` is
on by decision.

Most of what follows is therefore about the boundary rather than the feature. The
escape attempts are the point: `..`, an absolute path, a symlink planted inside
the root, and a root that is a prefix of another directory's name.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from kae_studio.acquisition.github_source import SourceReadError
from kae_studio.acquisition.local_source import (
    LocalSourceClient,
    LocalSourceUnavailable,
    configured_roots,
)


@pytest.fixture
def workspace(tmp_path: Path) -> Path:
    """A root with a project in it, and a secret outside it."""

    root = tmp_path / "workspaces"
    (root / "crm").mkdir(parents=True)
    (root / "crm" / "README.md").write_text("# CRM Application\n\nBooking and billing.\n")
    (root / "crm" / "main.py").write_text("print('hello')\n")
    (root / "crm" / "node_modules").mkdir()
    (root / "crm" / "node_modules" / "junk.js").write_text("x")
    (tmp_path / "secret.txt").write_text("nobody may read this")
    return root


@pytest.fixture
def client(workspace: Path) -> LocalSourceClient:
    return LocalSourceClient((workspace.resolve(),))


class TestTheBoundary:
    """Every one of these is a way somebody reads a file they may not."""

    def test_a_directory_outside_every_root_is_refused(
        self, client: LocalSourceClient, workspace: Path
    ) -> None:
        with pytest.raises(SourceReadError) as raised:
            client.tree(str(workspace.parent), "HEAD")

        assert raised.value.status == 404

    def test_climbing_out_with_dot_dot_is_refused(
        self, client: LocalSourceClient, workspace: Path
    ) -> None:
        with pytest.raises(SourceReadError):
            client.tree(f"{workspace}/crm/../..", "HEAD")

    def test_a_file_path_cannot_climb_out_of_its_repository(
        self, client: LocalSourceClient, workspace: Path
    ) -> None:
        """The second door, and the one a route-level check would miss.

        The repository is legal; the path within it is not. Confinement has to
        apply to the join, not only to the location.
        """

        with pytest.raises(SourceReadError):
            client.read_file(f"{workspace}/crm", "../../secret.txt", "HEAD")

    def test_a_symlink_pointing_out_of_the_root_is_refused(
        self, client: LocalSourceClient, workspace: Path
    ) -> None:
        """Resolve, **then** check.

        A check on the unresolved string sees `crm/escape.txt`, which is inside
        the root, and opens the file it points at, which is not. This is the
        classic mistake and the reason `_within` resolves first.
        """

        (workspace / "crm" / "escape.txt").symlink_to(workspace.parent / "secret.txt")

        with pytest.raises(SourceReadError):
            client.read_file(f"{workspace}/crm", "escape.txt", "HEAD")

    def test_a_sibling_whose_name_starts_with_the_root_is_refused(
        self, workspace: Path, tmp_path: Path
    ) -> None:
        """`/workspaces` must not authorise `/workspaces-private`.

        A prefix comparison on strings would allow it. The check is on resolved
        path *ancestry*, which is why it does not.
        """

        private = tmp_path / "workspaces-private"
        private.mkdir()
        (private / "secret.md").write_text("no")
        client = LocalSourceClient((workspace.resolve(),))

        with pytest.raises(SourceReadError):
            client.tree(str(private), "HEAD")

    def test_no_roots_configured_builds_nothing(self) -> None:
        """Unset means the provider does not exist, never 'read anywhere'."""

        with pytest.raises(LocalSourceUnavailable) as raised:
            LocalSourceClient(())

        assert "KAE_LOCAL_SOURCE_ROOTS" in str(raised.value)

    def test_an_unset_variable_yields_no_roots(self) -> None:
        assert configured_roots({}) == ()

    def test_a_root_that_is_not_a_directory_is_dropped(self, tmp_path: Path) -> None:
        # A typo in a deployment variable must not become a root that resolves
        # to something surprising later.
        missing = tmp_path / "not-there"
        assert configured_roots({"KAE_LOCAL_SOURCE_ROOTS": str(missing)}) == ()

    def test_several_roots_are_read_from_one_variable(self, tmp_path: Path) -> None:
        first, second = tmp_path / "a", tmp_path / "b"
        first.mkdir()
        second.mkdir()

        found = configured_roots({"KAE_LOCAL_SOURCE_ROOTS": f"{first}{os.pathsep}{second}"})

        assert found == (first.resolve(), second.resolve())


class TestWhatItReads:
    def test_the_tree_is_the_files_and_not_the_noise(self, client: LocalSourceClient, workspace: Path) -> None:
        entries, truncated = client.tree(f"{workspace}/crm", "HEAD")

        assert sorted(e["path"] for e in entries) == ["README.md", "main.py"]
        assert not truncated
        # `node_modules` is not material and is large enough to matter.
        assert not any("node_modules" in e["path"] for e in entries)

    def test_a_file_comes_back_as_its_text(self, client: LocalSourceClient, workspace: Path) -> None:
        assert client.read_file(f"{workspace}/crm", "main.py", "HEAD") == "print('hello')\n"

    def test_binary_content_is_refused_rather_than_mangled(
        self, client: LocalSourceClient, workspace: Path
    ) -> None:
        """A replacement-character decode extracts into traceable nonsense."""

        (workspace / "crm" / "logo.png").write_bytes(b"\x89PNG\r\n\x1a\n\xff\xfe")

        with pytest.raises(SourceReadError) as raised:
            client.read_file(f"{workspace}/crm", "logo.png", "HEAD")

        assert raised.value.status == 415

    def test_a_large_file_is_refused_with_its_size(
        self, client: LocalSourceClient, workspace: Path
    ) -> None:
        (workspace / "crm" / "big.txt").write_text("x" * 1_000_001)

        with pytest.raises(SourceReadError) as raised:
            client.read_file(f"{workspace}/crm", "big.txt", "HEAD")

        assert raised.value.status == 413

    def test_write_is_reported_as_impossible_because_it_is(
        self, client: LocalSourceClient, workspace: Path
    ) -> None:
        """Not a permission that was checked. Nothing here writes."""

        capability = client.check(f"{workspace}/crm")

        assert capability["can_read"] is True
        assert capability["can_write"] is False

    def test_projects_are_offered_from_a_container_root(
        self, client: LocalSourceClient, workspace: Path
    ) -> None:
        """`~/workspaces` is a container of projects, not a project."""

        found, _ = client.repositories()

        assert [Path(r["full_name"]).name for r in found] == ["crm"]
        assert found[0]["description"] == "CRM Application"

    def test_a_query_narrows_the_listing(self, client: LocalSourceClient) -> None:
        assert client.repositories("crm")[0]
        assert client.repositories("nothing-like-this")[0] == []


class TestIdentity:
    def test_a_directory_without_git_still_resolves_to_something_stable(
        self, client: LocalSourceClient, workspace: Path
    ) -> None:
        """*Whatever was on disk that day* is not an identity a finding can cite."""

        first = client.resolve(f"{workspace}/crm", "HEAD")
        again = client.resolve(f"{workspace}/crm", "HEAD")

        assert first and first == again

    def test_the_digest_changes_when_the_content_does(
        self, client: LocalSourceClient, workspace: Path
    ) -> None:
        """A fingerprint that never moves would make every snapshot identical."""

        before = client.digest(f"{workspace}/crm")
        # **The same length.** The first draft digested `path:size`, which this
        # edit leaves untouched — so a snapshot would have been reported
        # unchanged while the code under it had moved. A longer replacement
        # would have passed against the defect.
        (workspace / "crm" / "main.py").write_text("print('HELLO')\n")

        assert client.digest(f"{workspace}/crm") != before


def test_nothing_here_writes() -> None:
    """`D-67`, as a property of the file rather than a promise about it.

    The GitHub client opens by claiming it has no mutating method and this one
    inherits the claim. A local client that could write is a materially
    different object, and the difference must not arrive by autocomplete.
    """

    from kae_studio.acquisition import local_source

    source = Path(local_source.__file__).read_text()
    for forbidden in ("write_text(", "write_bytes(", "shutil.", "os.remove", "unlink(", "mkdir("):
        assert forbidden not in source, f"{forbidden} appeared in a read-only client"


class TestTheServiceDispatchesByKind:
    """`§7`'s one Source abstraction, with two providers behind it (`D-68`).

    `AcquisitionService` held one client and asked `self._github is None` in
    seven places. A second provider makes that question the wrong one: a source
    knows where it came from, so the service does not need a mode.
    """

    def service(self, workspace: Path, github: object | None = None) -> object:
        from kae_studio.acquisition.service import AcquisitionService

        return AcquisitionService(
            github,  # type: ignore[arg-type]
            "no GitHub credential is configured",
            local=LocalSourceClient((workspace.resolve(),)),
        )

    def test_a_local_source_reads_without_any_credential(
        self, workspace: Path
    ) -> None:
        """The whole point of `ADR-0006`'s first increment."""

        from kae_studio.acquisition.model import SourceKind

        service = self.service(workspace)
        source = service.add_source(  # type: ignore[attr-defined]
            project_id="p1",
            kind=SourceKind.LOCAL,
            connection_id="",
            location=str(workspace / "crm"),
            reference="",
        )
        pinned = service.pin(source.source_id)  # type: ignore[attr-defined]

        assert pinned.snapshot is not None
        assert pinned.snapshot.file_count == 2
        # An identity a finding can cite, from a directory with no git in it.
        assert pinned.snapshot.revision

    def test_a_local_source_needs_no_connection(self, workspace: Path) -> None:
        """Reaching a directory requires no authorisation to reach it.

        Demanding one would be a grant with nothing behind it — `§19`, and the
        reason Settings has no revoke control.
        """

        from kae_studio.acquisition.model import SourceKind

        service = self.service(workspace)
        source = service.add_source(  # type: ignore[attr-defined]
            project_id="p1",
            kind=SourceKind.LOCAL,
            connection_id="",
            location=str(workspace / "crm"),
            reference="",
        )

        assert source.connection_id == ""

    def test_a_github_source_with_no_credential_says_which_provider(
        self, workspace: Path
    ) -> None:
        """Not *no credential configured* — that was `D-58`'s defect returning."""

        from kae_studio.acquisition.model import SourceKind

        service = self.service(workspace)
        connection = service.add_connection("github", "source", "env:TOKEN")  # type: ignore[attr-defined]
        source = service.add_source(  # type: ignore[attr-defined]
            project_id="p1",
            kind=SourceKind.GITHUB,
            connection_id=connection.connection_id,
            location="crismag/KAE-Studio",
            reference="main",
        )
        updated = service.pin(source.source_id)  # type: ignore[attr-defined]

        assert "GitHub" in (updated.last_error or "")

    def test_the_listing_merges_and_every_entry_says_which_it_is(
        self, workspace: Path
    ) -> None:
        """One picker, not a mode toggle.

        `full_name` is `owner/name` for one provider and an absolute path for
        the other. Without `kind` a reader cannot tell them apart, and inventing
        a fake `owner/name` for a directory would make them untraceable.
        """

        class FakeGitHub:
            def repositories(self, query: str = "", limit: int = 100) -> tuple[list[dict], bool]:
                return [{"full_name": "crismag/KAE-Studio", "default_branch": "main"}], False

        found, _, reason = self.service(workspace, FakeGitHub()).repositories()  # type: ignore[attr-defined]

        assert reason == ""
        assert {entry["kind"] for entry in found} == {"local", "github"}

    def test_a_refused_credential_does_not_hide_the_local_answers(
        self, workspace: Path
    ) -> None:
        """A picker that emptied itself because GitHub said no would be lying.

        The directories are plainly readable and have nothing to do with the
        credential that was refused.
        """

        class RefusingGitHub:
            def repositories(self, query: str = "", limit: int = 100) -> tuple[list[dict], bool]:
                raise SourceReadError(401, "GitHub refused this credential")

        found, _, reason = self.service(workspace, RefusingGitHub()).repositories()  # type: ignore[attr-defined]

        assert [entry["kind"] for entry in found] == ["local"]
        # Still reported. A short list presented as complete is the other defect.
        assert "refused" in reason

    def test_no_provider_at_all_still_says_so(self) -> None:
        from kae_studio.acquisition.service import AcquisitionService

        found, _, reason = AcquisitionService(None, "").repositories()

        assert found == []
        assert "Install the KAE GitHub App" in reason
