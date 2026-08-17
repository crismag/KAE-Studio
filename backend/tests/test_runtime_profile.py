"""What this deployment may reach, and why the word has to have a consequence.

`ADR-0006` §4: offline is **enforced**, not inferred from a missing credential.
`D-172` landed that in KAE-Memory and `D-174` brings the same four words here.

This module deliberately imports nothing from `interviewer`, so it runs in a
pipeline that has no `cie_slim` checkout (`AUD-033`) — the one place where a
guard on deployment posture must not be a skip with a reason.
"""

from __future__ import annotations

import pytest

from kae_studio.runtime_profile import (
    HYBRID,
    LOCAL,
    OFFLINE,
    PRODUCTION,
    PROFILES,
    VARIABLE,
    ProfileViolation,
    Reach,
    permits,
    profile_name,
    reach_of_url,
    require,
)


class TestTheVocabularyIsTheEstateS:
    """Copied from KAE-Memory rather than shared, so it is asserted literally.

    The two repositories have no library between them (`D-174`). A rename here
    that KAE-Memory did not make would otherwise be a green suite over a
    deployment where one word means two things.
    """

    def test_the_four_profiles_are_named_as_memory_names_them(self) -> None:
        assert PROFILES == ("offline", "local", "hybrid", "production")
        assert (OFFLINE, LOCAL, HYBRID, PRODUCTION) == PROFILES
        assert VARIABLE == "KAE_RUNTIME_PROFILE"

    def test_the_four_reaches_are_named_as_memory_names_them(self) -> None:
        assert [member.value for member in Reach] == [
            "in_process",
            "host",
            "network",
            "hosted",
        ]

    def test_no_two_profiles_permit_the_same_thing(self) -> None:
        """A word with no consequence is the illusion this estate audits for.

        `in_process` is what distinguishes `hybrid` from `production`, and it is
        why the member is kept in a repository that has no such provider yet.
        """

        sets = [frozenset(r for r in Reach if permits(name, r)) for name in PROFILES]
        assert len(set(sets)) == len(PROFILES)

    def test_production_refuses_a_stand_in(self) -> None:
        assert not permits(PRODUCTION, Reach.IN_PROCESS)


class TestWhatEachProfilePermits:
    def test_offline_refuses_a_hosted_api(self) -> None:
        assert not permits(OFFLINE, Reach.HOSTED)
        assert permits(OFFLINE, Reach.HOST)

    def test_offline_refuses_a_local_adapter_pointed_off_the_machine(self) -> None:
        """The case the vendor axis would have missed."""

        assert not permits(OFFLINE, Reach.NETWORK)
        assert permits(LOCAL, Reach.NETWORK)

    def test_hybrid_permits_everything(self) -> None:
        assert all(permits(HYBRID, reach) for reach in Reach)

    def test_unset_is_unconstrained(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """`D-172`: defaulting to `local` would change what an existing
        deployment may reach without anybody deciding."""

        monkeypatch.delenv(VARIABLE, raising=False)

        assert profile_name() is None
        assert all(permits(None, reach) for reach in Reach)

    def test_a_misspelt_profile_refuses_rather_than_going_unconstrained(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """`KAE_RUNTIME_PROFILE=ofline` permitting everything is the deployment
        that believes it is offline and is not."""

        monkeypatch.setenv(VARIABLE, "ofline")

        with pytest.raises(ProfileViolation) as raised:
            profile_name()

        assert "offline" in str(raised.value)


class TestReachIsReadFromTheUrl:
    @pytest.mark.parametrize("url", ["http://127.0.0.1:11434", "http://localhost:11434"])
    def test_loopback_stays_on_this_machine(self, url: str) -> None:
        assert reach_of_url(url) == Reach.HOST

    @pytest.mark.parametrize("url", ["http://gpu-box:11434", "http://10.0.0.4:11434", ""])
    def test_anything_else_is_the_network(self, url: str) -> None:
        """Including an unparseable one. Guessing `host` would let `offline`
        pass a call that leaves the machine, which is the one mistake this
        cannot make."""

        assert reach_of_url(url) == Reach.NETWORK


class TestRequireSaysWhatItRefusedAndWhatItAllows:
    def test_it_returns_quietly_when_the_profile_permits(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv(VARIABLE, OFFLINE)

        require(Reach.HOST, variable="KAE_CIE_PROVIDER", value="ollama")

    def test_a_refusal_names_the_profile_the_variable_and_the_alternatives(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv(VARIABLE, OFFLINE)

        with pytest.raises(ProfileViolation) as raised:
            require(Reach.HOSTED, variable="KAE_CIE_PROVIDER", value="bedrock")

        message = str(raised.value)
        assert "offline" in message and "KAE_CIE_PROVIDER" in message
        assert "hosted" in message
        # An operator who has just been refused needs to know what would work.
        assert "host" in message
