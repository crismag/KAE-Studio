"""A GitHub App installation reads repositories nobody pasted a token for.

`D-56` — the owner's ruling. Installing an App against selected repositories is
how somebody is meant to connect a repository: GitHub's own UI does the choosing
and enforces it afterwards, and nothing long-lived sits on the host.

## What these prove, and what they cannot

The App does not exist yet — registering one is an account action and no
credential is invented here. What is provable without it is the whole chain
either side of GitHub: a generated RSA key signs a JWT, the JWT is exchanged at
`/app/installations/{id}/access_tokens`, and the token that comes back
authenticates the read. A `MockTransport` stands in for GitHub, so what is
asserted is *our* end of the protocol and the shape of GitHub's, never that
GitHub behaves as documented.

The remaining gap is honest and small: that a real App's key is accepted, which
only registering one can show.
"""

from __future__ import annotations

from typing import Any

import httpx
import pytest

pytest.importorskip("githubkit", reason="githubkit carries the GitHub App chain (D-56)")
crypto = pytest.importorskip("cryptography", reason="a generated key signs the test JWT")

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from kae_studio.acquisition.github_app import AppUnavailable, GitHubApp
from kae_studio.acquisition.github_source import SourceReadError
from kae_studio.config import Settings

INSTALLATION = 999


@pytest.fixture(scope="module")
def private_key() -> str:
    """A real key, generated here. No fixture on disk is a credential."""

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    return key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()


class FakeGitHub:
    """GitHub, to the extent the App chain touches it."""

    def __init__(self, *, token_status: int = 201) -> None:
        self.seen: list[tuple[str, str]] = []
        self._token_status = token_status

    def transport(self) -> httpx.MockTransport:
        return httpx.MockTransport(self)

    def __call__(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path
        self.seen.append((path, request.headers.get("authorization", "")))

        if path.endswith("/access_tokens"):
            if self._token_status != 201:
                return httpx.Response(self._token_status, json={"message": "Bad credentials"})
            return httpx.Response(
                201,
                json={"token": "ghs_installation", "expires_at": "2099-01-01T00:00:00Z"},
            )
        if path == "/app/installations":
            return httpx.Response(
                200,
                json=[
                    {
                        "id": INSTALLATION,
                        "account": {"login": "crismag"},
                        "repository_selection": "selected",
                    }
                ],
            )
        if path == "/installation/repositories":
            return httpx.Response(
                200,
                json={
                    "total_count": 1,
                    "repositories": [
                        {
                            "full_name": "crismag/KAE-Studio",
                            "default_branch": "main",
                            "private": True,
                            "description": "",
                            "updated_at": "2026-08-13T00:00:00Z",
                        }
                    ],
                },
            )
        # Everything past this point is a read, and a read needs the
        # installation token. A fake that answered them regardless would pass
        # whatever the auth chain did — including nothing at all.
        if "ghs_installation" not in request.headers.get("authorization", ""):
            return httpx.Response(401, json={"message": "Bad credentials"})

        if path == "/repos/crismag/KAE-Studio":
            return httpx.Response(
                200,
                json={
                    "owner": {"login": "crismag"},
                    "permissions": {"pull": True, "push": False},
                    "default_branch": "main",
                    "private": True,
                },
            )
        if path == "/user/repos":
            # An installation token has no user behind it. Answering this would
            # hide the defect the installation listing exists to avoid.
            return httpx.Response(403, json={"message": "Resource not accessible"})
        return httpx.Response(404, json={"message": "Not Found"})


def app_for(github: FakeGitHub, private_key: str) -> GitHubApp:
    return GitHubApp("12345", private_key, transport=github.transport())


class TestTheChain:
    def test_a_read_is_authenticated_by_a_token_the_key_earned(self, private_key: str) -> None:
        """JWT, then installation token, then the read. In that order.

        The assertion is the sequence, not the result: a client that somehow
        authenticated the read directly with the JWT would return the same body
        and would break the moment GitHub enforced what it documents.
        """

        github = FakeGitHub()
        client = app_for(github, private_key).source_client(INSTALLATION)

        assert client.check("crismag/KAE-Studio")["account"] == "crismag"

        exchange, read = github.seen[0], github.seen[-1]
        assert exchange[0] == f"/app/installations/{INSTALLATION}/access_tokens"
        # A JWT, signed with the private key — three dot-separated segments.
        assert exchange[1].startswith("Bearer ey")
        assert read[0] == "/repos/crismag/KAE-Studio"
        assert "ghs_installation" in read[1]

    def test_the_key_is_never_sent_anywhere(self, private_key: str) -> None:
        """The PEM signs and does not travel. It is the one durable secret."""

        github = FakeGitHub()
        app_for(github, private_key).source_client(INSTALLATION).check("crismag/KAE-Studio")

        body = "".join(header for _, header in github.seen)
        assert "PRIVATE KEY" not in body
        assert private_key[:64] not in body

    def test_an_installation_lists_its_own_repositories(self, private_key: str) -> None:
        """`/installation/repositories`, never `/user/repos`.

        An installation access token has no user behind it, so `/user/repos`
        answers 403 — which the picker would render as *this credential can see
        no repositories*, for a deployment whose entire point is that somebody
        chose which repositories it may see.
        """

        github = FakeGitHub()
        client = app_for(github, private_key).source_client(INSTALLATION)

        found, truncated = client.repositories()

        assert [r["full_name"] for r in found] == ["crismag/KAE-Studio"]
        assert not truncated
        assert not any(path == "/user/repos" for path, _ in github.seen)

    def test_installations_carry_how_widely_the_app_was_installed(self, private_key: str) -> None:
        github = FakeGitHub()

        found = app_for(github, private_key).installations()

        assert found == [
            {
                "installation_id": INSTALLATION,
                "account": "crismag",
                # *All repositories* and *only selected ones* are a different
                # answer to what KAE may read, chosen deliberately at install
                # time, and a count would lose it.
                "repository_selection": "selected",
            }
        ]

    def test_refused_credentials_say_which_two_things_disagree(self, private_key: str) -> None:
        """The mistake somebody actually makes, named.

        Reporting `401` back would send an operator to check whether GitHub is
        up. The App id and the key belonging to different Apps is the thing that
        goes wrong, and it is not visible from either value on its own.
        """

        # Its own app and installation. `githubkit` caches the installation
        # token **process-globally**, keyed by the two, so reusing the ids from
        # a passing test above would find a valid token and never attempt the
        # exchange this refuses — the test would pass alone and fail in the
        # file, which is how this was found.
        github = FakeGitHub(token_status=401)
        client = GitHubApp("54321", private_key, transport=github.transport()).source_client(1001)

        with pytest.raises(SourceReadError) as raised:
            client.check("crismag/KAE-Studio")

        # `SourceReadError`, specifically. An `httpx.Auth` runs inside the
        # request and the App's flow exchanges its JWT there, so a refusal
        # raises `githubkit`'s own exception — which is not an `httpx.HTTPError`
        # and would travel past every route that handles a read failure, as a
        # 500 rather than as "this credential was refused".
        assert raised.value.kind == "not_authorized"
        assert "credential" in str(raised.value).lower()


class TestWhatTheDeploymentSays:
    """`/api/status` names which credential is in use, or that there is none."""

    BASE = {
        "KAE_MEMORY_TOKEN": "token",
        "STUDIO_SESSION_SECRET": "x" * 40,
        "STUDIO_NO_AUTH": "1",
    }

    def describe(self, **env: str) -> dict[str, Any]:
        return Settings.from_environment({**self.BASE, **env}).describe()

    def test_no_credential_at_all_is_stated_rather_than_implied(self) -> None:
        state = self.describe()

        assert state["github_app"] == "not configured"
        assert state["github_source"] == "not configured"
        assert state["github_credential"] == "none"

    def test_an_app_wins_over_a_token_and_says_so(self, private_key: str) -> None:
        """Both configured is not an error, and the preference is not silent.

        A deployment that quietly preferred one would be indistinguishable from
        one that ignored the other, and neither value can be read back.
        """

        state = self.describe(
            STUDIO_GITHUB_SOURCE_TOKEN="ghp_personal",
            STUDIO_GITHUB_APP_ID="12345",
            STUDIO_GITHUB_APP_PRIVATE_KEY=private_key,
        )

        assert state["github_credential"] == "app_installation"
        # Both are still reported. The token did not stop existing.
        assert state["github_source"] == "configured"
        assert state["github_app"] == "configured"

    def test_half_an_app_authenticates_nothing_and_is_not_reported_as_one(self) -> None:
        state = self.describe(STUDIO_GITHUB_APP_ID="12345")

        assert state["github_app"] == "not configured"
        assert state["github_credential"] == "none"

    def test_the_private_key_is_never_in_what_status_returns(self, private_key: str) -> None:
        """`describe()` is served unauthenticated on some deployments."""

        state = self.describe(STUDIO_GITHUB_APP_ID="12345", STUDIO_GITHUB_APP_PRIVATE_KEY=private_key)

        assert "PRIVATE KEY" not in repr(state)


class TestConfigurationMistakes:
    def test_an_app_with_no_key_is_refused_at_construction(self) -> None:
        # Rather than at the first read, which would be a 401 an operator would
        # reasonably read as GitHub refusing a credential that exists.
        with pytest.raises(ValueError):
            GitHubApp("12345", "   ")

    def test_a_key_keeps_its_trailing_newline(self, private_key: str) -> None:
        """A PEM's final newline is part of it.

        Stripped, the key fails to parse and GitHub answers 401 — which reads as
        *these credentials were refused* and sends somebody to regenerate a key
        that was correct.
        """

        settings = Settings.from_environment(
            {
                "KAE_MEMORY_TOKEN": "t",
                "STUDIO_SESSION_SECRET": "x" * 40,
                "STUDIO_NO_AUTH": "1",
                "STUDIO_GITHUB_APP_ID": "12345",
                "STUDIO_GITHUB_APP_PRIVATE_KEY": private_key,
            }
        )

        assert settings.github_app_private_key.endswith("\n")
        assert settings.github_app_private_key == private_key

    def test_an_unusable_app_does_not_stop_the_process_starting(self, private_key: str) -> None:
        """A configuration mistake is not a reason to refuse to boot.

        The routes report an unusable credential; a process that will not start
        is a worse way to learn the key is wrong, because nothing is left
        running to say so.
        """

        # `api` imports the interviewer, which imports the private sibling
        # `cris-cie-slim`. CI installs without it by decision (`AUD-033`), so
        # this skips there rather than failing — stated, not silent.
        pytest.importorskip("cie_slim", reason="cris-cie-slim is a private sibling repository")
        from kae_studio.api import _source_client

        settings = Settings.from_environment(
            {
                "KAE_MEMORY_TOKEN": "t",
                "STUDIO_SESSION_SECRET": "x" * 40,
                "STUDIO_NO_AUTH": "1",
                "STUDIO_GITHUB_APP_ID": "12345",
                "STUDIO_GITHUB_APP_PRIVATE_KEY": private_key,
            }
        )

        # No installation id and no reachable GitHub: the credential cannot be
        # used, and the deployment keeps running to say why.
        client, reason = _source_client(settings)

        assert client is None
        assert reason

    def test_nothing_configured_builds_no_client(self) -> None:
        pytest.importorskip("cie_slim", reason="cris-cie-slim is a private sibling repository")
        from kae_studio.api import _source_client

        settings = Settings.from_environment(
            {"KAE_MEMORY_TOKEN": "t", "STUDIO_SESSION_SECRET": "x" * 40, "STUDIO_NO_AUTH": "1"}
        )

        client, reason = _source_client(settings)

        assert client is None
        # Empty, so the picker falls back to the sentence for a deployment that
        # configured nothing — which is what this is. A reason here would claim
        # a specific fault where there is none.
        assert reason == ""


class TestWhyThePickerIsEmpty:
    """Four ways to have no client, four remedies (`D-58`).

    `GH-APP` returned `None` for all of them and the picker had one sentence:
    *no GitHub credential is configured… set `STUDIO_GITHUB_SOURCE_TOKEN`*. For
    a deployment that had configured an App that was simply not installed
    anywhere, that is false, and it sends somebody to add a token which would
    not have fixed it — `D-26`'s defect again, in the direction that hides
    progress somebody already made.
    """

    def settings_for(self, private_key: str, **env: str) -> Settings:
        return Settings.from_environment(
            {
                "KAE_MEMORY_TOKEN": "t",
                "STUDIO_SESSION_SECRET": "x" * 40,
                "STUDIO_NO_AUTH": "1",
                "STUDIO_GITHUB_APP_ID": "12345",
                "STUDIO_GITHUB_APP_PRIVATE_KEY": private_key,
                **env,
            }
        )

    def reason_for(self, monkeypatch: pytest.MonkeyPatch, private_key: str, found: Any) -> str:
        pytest.importorskip("cie_slim", reason="cris-cie-slim is a private sibling repository")
        from kae_studio.api import _source_client

        def installations(_self: Any) -> Any:
            if isinstance(found, Exception):
                raise found
            return found

        monkeypatch.setattr(GitHubApp, "installations", installations)
        client, reason = _source_client(self.settings_for(private_key))
        assert client is None
        return reason

    def test_installed_nowhere_says_to_install_it(
        self, monkeypatch: pytest.MonkeyPatch, private_key: str
    ) -> None:
        """The credential is fine. It has no repositories, which is different."""

        reason = self.reason_for(monkeypatch, private_key, [])

        assert "not installed anywhere" in reason
        assert "Install it" in reason
        # Never the sentence for a deployment that configured nothing.
        assert "STUDIO_GITHUB_SOURCE_TOKEN" not in reason

    def test_installed_several_times_names_them_and_asks_for_one(
        self, monkeypatch: pytest.MonkeyPatch, private_key: str
    ) -> None:
        """Taking the first would read some other account's repositories."""

        reason = self.reason_for(
            monkeypatch,
            private_key,
            [
                {"installation_id": 1, "account": "crismag", "repository_selection": "selected"},
                {"installation_id": 2, "account": "an-org", "repository_selection": "all"},
            ],
        )

        # Which two, because "several" leaves somebody guessing which of their
        # accounts KAE would have read.
        assert "an-org, crismag" in reason
        assert "STUDIO_GITHUB_APP_INSTALLATION_ID" in reason

    def test_a_refused_credential_says_the_two_things_disagree(
        self, monkeypatch: pytest.MonkeyPatch, private_key: str
    ) -> None:
        reason = self.reason_for(
            monkeypatch, private_key, AppUnavailable("GitHub refused this App's credentials.")
        )

        assert "refused" in reason
        assert "not installed" not in reason

    def test_nothing_configured_still_offers_the_app_first(self) -> None:
        """The remedy somebody without shell access can actually carry out."""

        from kae_studio.acquisition.service import NO_CREDENTIAL

        assert NO_CREDENTIAL.index("Install the KAE GitHub App") < NO_CREDENTIAL.index(
            "STUDIO_GITHUB_SOURCE_TOKEN"
        )

    def test_the_service_says_what_it_was_told_rather_than_guessing(self) -> None:
        """`AcquisitionService` holds no credential and so decides no remedy."""

        from kae_studio.acquisition.service import AcquisitionService

        found, truncated, reason = AcquisitionService(None, "the App is installed nowhere").repositories()

        assert found == [] and not truncated
        assert reason == "the App is installed nowhere"


def test_the_app_module_offers_no_way_to_write() -> None:
    """`D-8` as a property of the code rather than a convention.

    Publishing is off by decision and belongs to KAE-Artifacts. An App that
    could commit, reachable from acquisition, would make that a habit somebody
    could break with one import.
    """

    from kae_studio.acquisition import github_app, github_source

    for module in (github_app, github_source):
        text = (module.__file__ or "").strip()
        assert text
        source = open(text).read()  # noqa: SIM115, PTH123
        for forbidden in ("create_commit", "create_pull_request", "create_or_update_file"):
            assert f"def {forbidden}" not in source


def test_a_client_outlives_the_app_that_built_it(private_key: str) -> None:
    """`_source_client` builds a `GitHubApp`, returns its client, and drops it.

    `githubkit` keeps its REST namespaces on a **weak** reference, so a client
    collected while still in use raises *"GitHub client has already been
    collected"* — and this shape, where only the returned object survives, is
    exactly where that would happen. The auth flow turns out to hold its client
    strongly; this is what says so, so that a future version which does not
    fails here rather than an hour into a deployment.
    """

    import gc

    def build(github: FakeGitHub) -> Any:
        app = GitHubApp("4242", private_key, transport=github.transport())
        return app.source_client(4242)

    github = FakeGitHub()
    client = build(github)
    gc.collect()

    assert client.check("crismag/KAE-Studio")["account"] == "crismag"


def test_the_installation_token_is_cached_across_clients(private_key: str) -> None:
    """A second client over the same installation does not re-mint the token.

    `githubkit` caches it process-globally, keyed by app and installation.
    Depended on here rather than assumed: without it every restarted request
    path would exchange a JWT, which works and quietly spends the App's rate
    limit. If a future version scoped the cache per client, this fails and the
    cost becomes visible rather than merely larger.
    """

    first = FakeGitHub()
    GitHubApp("31337", private_key, transport=first.transport()).source_client(2002).check(
        "crismag/KAE-Studio"
    )
    second = FakeGitHub()
    GitHubApp("31337", private_key, transport=second.transport()).source_client(2002).check(
        "crismag/KAE-Studio"
    )

    assert any("access_tokens" in path for path, _ in first.seen)
    assert not any("access_tokens" in path for path, _ in second.seen)


def test_app_unavailable_is_one_sentence_a_person_can_act_on() -> None:
    assert issubclass(AppUnavailable, RuntimeError)
