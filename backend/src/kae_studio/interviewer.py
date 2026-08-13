"""Studio's connection to CIE. Transport, and nothing else.

Every conversational decision belongs to `cie_slim.kae.conversation` — which
skill applies, what to ask, whether to ask at all. Studio's part is to hand over
the project and the message, and to render what comes back.

**Nothing in this file decides what to say**, and nothing in it should ever
start to. The pull is real: when a turn reads badly the quickest fix is a
special case here, and a few of those make Studio a second interviewer competing
with the first. If the conversation is wrong, it is wrong in CIE.

## Why the model client is built here

CIE takes a reasoner as an argument rather than constructing one. That keeps the
interview logic testable without a provider, and it puts the choice of model
where the deployment is configured — which is Studio's process, not CIE's
library.

## When CIE cannot answer

`InterviewUnavailable` propagates. Studio surfaces it as an unavailable
interviewer, never as a reply. A fallback that reads like a turn is worse than
an error: the operator cannot tell the difference, and neither can the
transcript.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

from cie_slim.kae.conversation import InterviewUnavailable, Move, converse
from cie_slim.kae.memory_client import MemoryClient as CieMemoryClient

#: Reachable in ca-central-1 and adequate for interview reasoning. Overridable
#: because a deployment may have access to different models than this one.
DEFAULT_MODEL = "global.anthropic.claude-sonnet-4-6"

#: §13 names this the general model, and it runs on the workstation.
DEFAULT_LOCAL_MODEL = "qwen2.5:14b"
OLLAMA_URL = "http://127.0.0.1:11434"


class BedrockReasoner:
    """Satisfies CIE's `Reasoner` protocol using Bedrock.

    Built here rather than imported from CIE's provider set so Studio's
    dependency is the protocol — two strings in, one out — and not CIE's
    configuration machinery.
    """

    def __init__(self, model: str = "", region: str = "") -> None:
        self.model = model or os.environ.get("KAE_CIE_MODEL", "") or DEFAULT_MODEL
        self.region = region or os.environ.get("AWS_REGION", "") or "ca-central-1"

    def complete(self, system: str, user: str) -> str:
        from anthropic import AnthropicBedrock

        client = AnthropicBedrock(aws_region=self.region)
        message = client.messages.create(
            model=self.model,
            max_tokens=1_000,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return "".join(block.text for block in message.content if block.type == "text")


class OllamaReasoner:
    """Satisfies the same protocol using a model on this machine.

    `ADR-0006`: local execution is the reference architecture, so this is the
    default and Bedrock is the opt-in (`D-77`). The protocol is two strings in
    and one out, which is why a second provider costs this little.
    """

    def __init__(self, model: str = "", base_url: str = "") -> None:
        self.model = model or os.environ.get("KAE_CIE_MODEL", "") or DEFAULT_LOCAL_MODEL
        self.base_url = (base_url or os.environ.get("OLLAMA_URL", "") or OLLAMA_URL).rstrip("/")

    def complete(self, system: str, user: str) -> str:
        import httpx

        try:
            response = httpx.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model,
                    "stream": False,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                },
                # A 14B model on a cold GPU takes tens of seconds for a first
                # token. A short timeout here reads as "the interviewer is
                # broken" when it is only loading.
                timeout=300.0,
            )
        except httpx.HTTPError as error:
            raise InterviewUnavailable(
                f"the local interviewer at {self.base_url} could not be reached: "
                f"{type(error).__name__}. Start Ollama, or set "
                "KAE_CIE_PROVIDER=bedrock to use a hosted model."
            ) from None

        if response.status_code == 404:
            raise InterviewUnavailable(
                f"Ollama has no model {self.model!r}. Pull it with: ollama pull {self.model}"
            )
        if response.status_code != 200:
            raise InterviewUnavailable(
                f"the local interviewer refused the request: {response.status_code}"
            )

        content = (response.json().get("message") or {}).get("content", "")
        if not content.strip():
            # Never returned as a turn. An empty completion rendered as the
            # interviewer's move is the substitution CIE's contract forbids.
            raise InterviewUnavailable("the local interviewer returned an empty response")
        return str(content)


def reasoner_for(provider: str, model: str = "") -> BedrockReasoner | OllamaReasoner:
    """Which provider produces the move.

    **Local by default, cloud by opt-in** — `ADR-0006` §30, *cloud services
    require positive opt-in*, not *use cloud unless unavailable*. A deployment
    that wants Bedrock says so; one that forgets gets a visible failure naming
    Ollama rather than a silent charge (`D-77`).
    """

    chosen = (provider or os.environ.get("KAE_CIE_PROVIDER", "") or "ollama").strip().lower()
    if chosen == "bedrock":
        return BedrockReasoner(model)
    if chosen == "ollama":
        return OllamaReasoner(model)
    raise InterviewUnavailable(
        f"unknown interviewer provider {chosen!r}. Set KAE_CIE_PROVIDER to 'ollama' or 'bedrock'."
    )


@dataclass(frozen=True)
class Interviewer:
    """Holds what a turn needs, so a route does not assemble it each time."""

    memory_url: str
    memory_token: str
    model: str = ""
    provider: str = ""

    def turn(self, project_id: str, message: str, *, actor: str) -> Move:
        """One conversational turn. Raises rather than substituting."""

        return converse(
            project_id,
            message,
            memory=CieMemoryClient(self.memory_url, self.memory_token),
            model=reasoner_for(self.provider, self.model),
            actor=actor,
        )


__all__ = [
    "BedrockReasoner",
    "Interviewer",
    "InterviewUnavailable",
    "Move",
    "OllamaReasoner",
    "reasoner_for",
]
