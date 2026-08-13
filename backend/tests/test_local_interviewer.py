"""The interviewer runs on this machine, and cloud costs money on purpose.

`OFF-CIE` was carried as *blocked, owner, the largest single item* for a week.
CIE's boundary turned out to be a structural Protocol with one method —
`complete(system, user) -> str` — and Studio's `BedrockReasoner` that satisfies
it is fifteen lines. The item was sized by its importance rather than by its
interface (`D-77`).

The half worth guarding is the default. `ADR-0006` §30: **cloud services require
positive opt-in**, not *use cloud unless unavailable*. So a deployment that
configures nothing interviews locally, and one that wants Bedrock says so — and
one that forgets gets a visible failure naming Ollama rather than a silent
charge, which is why `D-69` had to stop a running stack.
"""

from __future__ import annotations

from typing import Any

import httpx
import pytest

pytest.importorskip("cie_slim", reason="cris-cie-slim is a private sibling repository")

from kae_studio.interviewer import (
    BedrockReasoner,
    InterviewUnavailable,
    OllamaReasoner,
    reasoner_for,
)


class TestWhichProviderAnswers:
    def test_configuring_nothing_interviews_locally(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """§30, as the behaviour of an unconfigured deployment."""

        monkeypatch.delenv("KAE_CIE_PROVIDER", raising=False)

        assert isinstance(reasoner_for(""), OllamaReasoner)

    def test_bedrock_has_to_be_asked_for(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("KAE_CIE_PROVIDER", "bedrock")

        assert isinstance(reasoner_for(""), BedrockReasoner)

    def test_an_explicit_argument_beats_the_environment(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("KAE_CIE_PROVIDER", "ollama")

        assert isinstance(reasoner_for("bedrock"), BedrockReasoner)

    def test_an_unknown_provider_is_refused_rather_than_defaulted(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """A typo must not quietly become the default.

        `KAE_CIE_PROVIDER=bedrok` falling back to local would be a deployment
        that thinks it is using a hosted model and is not — and the reverse
        would spend money nobody asked to spend.
        """

        monkeypatch.delenv("KAE_CIE_PROVIDER", raising=False)

        with pytest.raises(InterviewUnavailable) as raised:
            reasoner_for("bedrok")

        assert "bedrok" in str(raised.value)

    def test_the_local_model_is_the_one_section_13_names(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv("KAE_CIE_MODEL", raising=False)

        assert OllamaReasoner().model == "qwen2.5:14b"


def responding(monkeypatch: pytest.MonkeyPatch, handler: Any) -> OllamaReasoner:
    """An `OllamaReasoner` whose `httpx.post` is the given handler."""

    import httpx as real

    monkeypatch.setattr(real, "post", handler)
    return OllamaReasoner()


class TestItNeverSubstitutesForTheInterviewer:
    """CIE's contract: *raised rather than substituted. The caller may say so;
    it must not present anything else as the interviewer's turn.*"""

    def test_a_move_comes_back_as_written(self, monkeypatch: pytest.MonkeyPatch) -> None:
        reasoner = responding(
            monkeypatch,
            lambda url, **kwargs: httpx.Response(
                200, json={"message": {"content": "Who books the appointments?"}}
            ),
        )

        assert reasoner.complete("you are an interviewer", "hello") == (
            "Who books the appointments?"
        )

    def test_an_empty_completion_is_a_failure_not_a_turn(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """An empty string rendered as the interviewer's move is the exact
        substitution the contract forbids — and it looks like a reply."""

        reasoner = responding(
            monkeypatch,
            lambda url, **kwargs: httpx.Response(200, json={"message": {"content": "   "}}),
        )

        with pytest.raises(InterviewUnavailable):
            reasoner.complete("s", "u")

    def test_ollama_not_running_says_so_and_names_the_alternative(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        def refuse(url: str, **kwargs: Any) -> httpx.Response:
            raise httpx.ConnectError("connection refused")

        with pytest.raises(InterviewUnavailable) as raised:
            responding(monkeypatch, refuse).complete("s", "u")

        message = str(raised.value)
        assert "could not be reached" in message
        # The remedy, both ways: start Ollama, or opt into the hosted model.
        assert "KAE_CIE_PROVIDER=bedrock" in message

    def test_a_missing_model_says_how_to_pull_it(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        reasoner = responding(
            monkeypatch, lambda url, **kwargs: httpx.Response(404, json={"error": "no such model"})
        )

        with pytest.raises(InterviewUnavailable) as raised:
            reasoner.complete("s", "u")

        assert "ollama pull qwen2.5:14b" in str(raised.value)

    def test_it_never_falls_back_to_the_paid_provider(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """The one that would cost money silently.

        A local provider that reached for Bedrock when it could not answer is
        precisely what §30 forbids and what `D-69` had to stop a running stack
        over. The failure must stay a failure.
        """

        def refuse(url: str, **kwargs: Any) -> httpx.Response:
            raise httpx.ConnectError("connection refused")

        reasoner = responding(monkeypatch, refuse)
        called: list[str] = []
        monkeypatch.setattr(
            BedrockReasoner, "complete", lambda self, s, u: called.append("bedrock") or ""
        )

        with pytest.raises(InterviewUnavailable):
            reasoner.complete("s", "u")

        assert called == []


def test_the_system_prompt_and_the_message_both_reach_the_model(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Two strings in. Dropping the system prompt would still return a reply —
    a fluent one, from a model that had not been told what it was doing."""

    sent: dict[str, Any] = {}

    def capture(url: str, **kwargs: Any) -> httpx.Response:
        sent.update(kwargs.get("json") or {})
        return httpx.Response(200, json={"message": {"content": "ok"}})

    responding(monkeypatch, capture).complete("SYSTEM TEXT", "USER TEXT")

    roles = {m["role"]: m["content"] for m in sent["messages"]}
    assert roles == {"system": "SYSTEM TEXT", "user": "USER TEXT"}
    assert sent["stream"] is False
