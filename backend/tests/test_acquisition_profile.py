"""Offline stops the source picker, and an absent credential is not what does it.

`ADR-0006` §4 names the network policy as the part that cannot be bolted on
later, and states the defect exactly: *"today an absent credential is the only
thing stopping a remote call."* `OFF-PROFILE` closed that at the model providers.
This is the other door — reading somebody else's repository (`D-177`).

Nothing here imports `api` or `interviewer`, so these guards run in the pipeline
that has no `cris-cie-slim` checkout (`AUD-033`). A guard on deployment posture
that shows up in CI as a skip with a reason is not a guard.
"""

from __future__ import annotations

import httpx
import pytest

from kae_studio.acquisition.github_source import GitHubSourceClient, reach_of_api
from kae_studio.runtime_profile import (
    HYBRID,
    LOCAL,
    OFFLINE,
    PRODUCTION,
    VARIABLE,
    ProfileViolation,
    Reach,
)


@pytest.fixture(autouse=True)
def _no_declared_profile(monkeypatch: pytest.MonkeyPatch) -> None:
    """Every deployment today declares nothing. Tests that care set it."""

    monkeypatch.delenv(VARIABLE, raising=False)


def _client(api_base: str = "https://api.github.com") -> GitHubSourceClient:
    return GitHubSourceClient(
        "ghp_token", api_base=api_base, transport=httpx.MockTransport(lambda _: httpx.Response(200))
    )


class TestWhereAGitHubApiIs:
    """Reach, not vendor — the same rule KAE-Artifacts publishes by (`D-175`)."""

    def test_the_public_api_is_somebody_elses(self) -> None:
        assert reach_of_api("https://api.github.com") == Reach.HOSTED

    def test_a_self_hosted_forge_is_on_the_network(self) -> None:
        assert reach_of_api("https://git.internal/api/v3") == Reach.NETWORK

    def test_one_on_this_machine_is_on_this_machine(self) -> None:
        assert reach_of_api("http://127.0.0.1:3000/api/v3") == Reach.HOST


class TestTheClientIsRefusedBeforeItExists:
    def test_offline_may_not_read_github_com(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv(VARIABLE, OFFLINE)

        with pytest.raises(ProfileViolation) as raised:
            _client()

        message = str(raised.value)
        assert f"{VARIABLE}=offline" in message
        assert "hosted" in message

    def test_local_may_not_either_and_says_so_by_reach(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv(VARIABLE, LOCAL)

        with pytest.raises(ProfileViolation):
            _client()

    def test_local_may_read_a_forge_on_the_network(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """The case that makes the reach axis worth having: a GitHub Enterprise
        on the LAN is not a hosted API, and refusing it by the vendor's name
        would be classifying the word *GitHub*."""

        monkeypatch.setenv(VARIABLE, LOCAL)

        assert _client("https://git.internal/api/v3") is not None

    def test_offline_may_read_one_on_this_machine(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv(VARIABLE, OFFLINE)

        assert _client("http://127.0.0.1:3000/api/v3") is not None

    def test_offline_may_not_read_that_forge_on_the_network(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv(VARIABLE, OFFLINE)

        with pytest.raises(ProfileViolation) as raised:
            _client("https://git.internal/api/v3")

        assert "network" in str(raised.value)

    @pytest.mark.parametrize("profile", [HYBRID, PRODUCTION])
    def test_the_profiles_that_permit_it_read_exactly_as_before(
        self, profile: str, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv(VARIABLE, profile)

        assert _client() is not None

    def test_an_undeclared_profile_constrains_nothing(self) -> None:
        """Every deployment today. Unset is unconstrained, because defaulting
        would change what an existing one may reach without anybody deciding."""

        assert _client() is not None

    def test_a_credential_is_still_required_and_the_two_are_separate(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """The point of `ADR-0006` §4: the posture and the credential are
        different reasons, and neither stands in for the other. A permitted
        profile does not conjure a token, and a token does not defeat a profile.
        """

        monkeypatch.setenv(VARIABLE, PRODUCTION)

        with pytest.raises(ValueError, match="needs a token"):
            GitHubSourceClient("  ")
