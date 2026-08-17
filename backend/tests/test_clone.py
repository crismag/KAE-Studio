"""Cloning writes inside a root, and never writes a credential (`D-93`).

The `+` menu said *clone a repository here first — **Not yet***, truthfully:
nothing in the estate ran `git clone`. With a credential present and local roots
configured, the honest answer changed, and the two things worth guarding are the
two ways this could go badly.

**The token must not land on disk.** `git clone https://token@github.com/…`
writes the credential into `.git/config`, where it outlives the process and is
copied wherever the checkout goes.

**Nothing may be written outside a configured root.** `D-67` confined *reading*;
a clone target assembled from a repository name is attacker-supplied and confines
*writing* for the same reason.
"""

from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any

import pytest

from kae_studio.acquisition.clone import CloneError, clone


@pytest.fixture
def root(tmp_path: Path) -> Path:
    workspace = tmp_path / "workspaces"
    workspace.mkdir()
    return workspace


def recording(monkeypatch: pytest.MonkeyPatch, returncode: int = 0, stderr: str = "") -> list[Any]:
    """Capture the git command instead of running it."""

    seen: list[Any] = []

    def fake_run(command: Any, **kwargs: Any) -> Any:
        seen.append(command)
        if returncode == 0:
            Path(command[-1]).mkdir(parents=True, exist_ok=True)
        return subprocess.CompletedProcess(command, returncode, "", stderr)

    monkeypatch.setattr(subprocess, "run", fake_run)
    return seen


class TestTheCredentialNeverLandsOnDisk:
    def test_the_token_is_a_header_and_not_part_of_the_url(
        self, root: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """The whole reason this is not one line of shell.

        A token in the URL is written into `.git/config` by clone itself. `-c`
        settings are not persisted, so the header dies with the command.
        """

        seen = recording(monkeypatch)

        clone("crismag/KAE-Studio", root, token="ghp_secret")

        command = seen[0]
        url = next(part for part in command if part.startswith("https://"))
        assert url == "https://github.com/crismag/KAE-Studio.git"
        assert "ghp_secret" not in url
        # Present, but as a header passed with `-c`.
        assert any("http.extraHeader=Authorization: Bearer ghp_secret" == part for part in command)

    def test_it_asks_git_not_to_use_a_credential_helper(
        self, root: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # Otherwise a helper on the host can silently supply a different
        # identity than the one this deployment was configured with.
        seen = recording(monkeypatch)

        clone("crismag/KAE-Studio", root)

        assert "credential.helper=" in seen[0]

    def test_a_public_clone_sends_no_header_at_all(
        self, root: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        seen = recording(monkeypatch)

        clone("crismag/KAE-Studio", root, token="")

        assert not any("Authorization" in str(part) for part in seen[0])


class TestItWritesOnlyInsideARoot:
    def test_a_name_that_climbs_out_is_refused(
        self, root: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """`D-67` confined reading; writing needs it at least as much.

        `owner/..` is the case that reaches the confinement check — a name
        containing a slash is refused earlier, by the owner/name rule, so
        testing with one would leave this guard unproven.
        """

        recording(monkeypatch)

        with pytest.raises(CloneError, match="inside a configured source root"):
            clone("crismag/..", root)

    def test_a_name_that_is_not_owner_slash_repo_is_refused(
        self, root: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        recording(monkeypatch)

        for bad in ("KAE-Studio", "", "a/b/c"):
            with pytest.raises(CloneError):
                clone(bad, root)

    def test_it_lands_under_the_root_it_was_given(
        self, root: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        recording(monkeypatch)

        target = clone("crismag/KAE-Studio", root)

        assert target == (root / "KAE-Studio").resolve()

    def test_an_existing_directory_is_never_cloned_over(
        self, root: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """*Clone* is not a word that should ever destroy somebody's work.

        A directory that is already there may hold uncommitted changes, and this
        process did not create it.
        """

        (root / "KAE-Studio").mkdir()
        recording(monkeypatch)

        with pytest.raises(CloneError, match="already exists"):
            clone("crismag/KAE-Studio", root)


class TestWhenGitFails:
    def test_a_missing_repository_names_both_possibilities(
        self, root: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """GitHub answers 404 for *private and not yours* as well as *absent*.

        Repeating "not found" would send somebody to check the spelling of a
        repository they can see in the picker.
        """

        recording(monkeypatch, returncode=128, stderr="remote: Repository not found.")

        with pytest.raises(CloneError) as raised:
            clone("crismag/KAE-Studio", root)

        assert "may not exist" in str(raised.value)
        assert "not be allowed to read it" in str(raised.value)

    def test_a_refused_credential_says_so(
        self, root: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        recording(monkeypatch, returncode=128, stderr="fatal: Authentication failed")

        with pytest.raises(CloneError, match="refused"):
            clone("crismag/KAE-Studio", root)

    def test_no_network_is_its_own_answer(
        self, root: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        recording(monkeypatch, returncode=128, stderr="fatal: could not resolve host: github.com")

        with pytest.raises(CloneError, match="could not be reached"):
            clone("crismag/KAE-Studio", root)


class TestThePostureIsAnAnswerTheRouteCanGive:
    """`D-180`. The refusal happens in `clone()`; this is the route reporting it
    as *this deployment is not set up to do this* rather than as a 500.

    501 beside the other two, not 409: the route's conflicts are conditions in
    the request, and nothing about ``full_name`` would change a posture.
    """

    def test_offline_answers_501_and_names_the_variable(
        self, root: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        pytest.importorskip("cie_slim", reason="cris-cie-slim is a private sibling repository")

        from fastapi.testclient import TestClient

        from kae_studio.api import create_app
        from kae_studio.config import Settings
        from kae_studio.runtime_profile import VARIABLE

        monkeypatch.setenv(VARIABLE, "offline")
        seen = recording(monkeypatch)
        environment = {
            "KAE_MEMORY_TOKEN": "token",
            "STUDIO_SESSION_SECRET": "x" * 40,
            "STUDIO_NO_AUTH": "1",
            "STUDIO_GITHUB_SOURCE_TOKEN": "ghp_token",
            "KAE_LOCAL_SOURCE_ROOTS": str(root),
        }
        settings = Settings.from_environment(environment)
        with TestClient(create_app(settings)) as client:
            response = client.post("/api/repositories/clone", json={"full_name": "crismag/kae"})

        assert response.status_code == 501
        assert VARIABLE in response.json()["detail"]
        # The credential was present and the root configured, so nothing but the
        # posture stopped this — and it stopped it before git ran.
        assert seen == []
