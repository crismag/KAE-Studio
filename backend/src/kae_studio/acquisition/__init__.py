"""Reading an existing project into KAE. STI-1 to STI-4.

**Begun, not finished.** What exists here is the half that can be proved:
connections, sources, and pinning a branch to an immutable commit. What does not
exist is analysis — turning a pinned snapshot into proposed findings — and the
vocabulary below is shaped so that gap is visible rather than glossed.

## The distinction this package exists to keep

Four different facts, routinely collapsed into one green tick:

| Fact | Proved by |
| --- | --- |
| a credential works | a connectivity check |
| a repository is readable | resolving a ref and reading a sample |
| a snapshot is pinned | an immutable commit SHA |
| **a repository is analyzed** | **nothing yet** |

The fourth is the one a product is tempted to claim. "Connected to
owner/repo ✓" next to a Continue button reads as *we have understood your
project*, and a user who believes that will expect the next screen to know
things about it. `SourceState` names the four separately so a UI cannot render
the first three as the fourth without deliberately choosing to.

## Why acquisition is not in KAE-Artifacts

`ARCHITECTURE_AND_CONTRACTS.md` is explicit: *"Do not put repository parsing
into KAE-Artifacts."* That service turns knowledge into files. This turns files
into evidence. They are opposite directions and share nothing but a provider.
"""

from .github_source import GitHubSourceClient, SourceReadError
from .model import (
    ANALYSIS_UNAVAILABLE,
    Connection,
    ConnectionState,
    ConnectivityCheck,
    Source,
    SourceKind,
    SourceScope,
    SourceSnapshot,
    SourceState,
)

__all__ = [
    "ANALYSIS_UNAVAILABLE",
    "Connection",
    "ConnectionState",
    "ConnectivityCheck",
    "GitHubSourceClient",
    "Source",
    "SourceKind",
    "SourceReadError",
    "SourceScope",
    "SourceSnapshot",
    "SourceState",
]
