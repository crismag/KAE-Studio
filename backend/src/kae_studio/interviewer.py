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


@dataclass(frozen=True)
class Interviewer:
    """Holds what a turn needs, so a route does not assemble it each time."""

    memory_url: str
    memory_token: str
    model: str = ""

    def turn(self, project_id: str, message: str, *, actor: str) -> Move:
        """One conversational turn. Raises rather than substituting."""

        return converse(
            project_id,
            message,
            memory=CieMemoryClient(self.memory_url, self.memory_token),
            model=BedrockReasoner(self.model),
            actor=actor,
        )


__all__ = ["BedrockReasoner", "Interviewer", "InterviewUnavailable", "Move"]
