"""Reading a GitHub repository. **Read-only, by construction.**

A separate client from the one KAE-Artifacts publishes with, and the separation
is the point rather than an accident of packaging:

**Different direction.** That one writes; this one reads. Sharing a client would
put a `create_commit` method one autocomplete away from acquisition code whose
entire contract is that it does not write.

**Different owner.** `ARCHITECTURE_AND_CONTRACTS.md`: *"Do not put repository
parsing into KAE-Artifacts."* Acquisition is Studio's, so its client is here.

**Different authorization.** Source access and destination access are separate
grants even when they name the same repository. A single client would make them
a single credential by default, and the first time somebody connected a source
they would have granted a destination.

There is no method on this class that mutates anything. That is not a policy
this enforces at runtime; it is a property of what is written here, and it is
worth keeping true.
"""

from __future__ import annotations

import base64
import hashlib
from typing import Any

import httpx

API_VERSION = "2022-11-28"

#: How many tree entries to consider. A repository with more is not refused —
#: it is reported as truncated, because silently describing half a repository
#: as though it were the whole one is the failure this bound would otherwise
#: introduce.
MAX_TREE_ENTRIES = 20_000


class SourceReadError(RuntimeError):
    """A source could not be read, in terms a UI can act on.

    Carries a status and a neutral message. GitHub's own text names the account
    and the app installation, and this reaches a browser.
    """

    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status

    @property
    def kind(self) -> str:
        """What the user should do about it, rather than what HTTP said."""

        if self.status in (401, 403):
            return "not_authorized"
        if self.status == 404:
            return "not_found"
        if self.status == 429:
            return "rate_limited"
        return "unavailable"


class GitHubSourceClient:
    """Resolve a reference, describe a tree, read a file. Nothing else."""

    def __init__(
        self,
        token: str,
        *,
        api_base: str = "https://api.github.com",
        timeout: float = 30.0,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        if not token.strip():
            raise ValueError("a GitHub source client needs a token")
        self._client = httpx.Client(
            base_url=api_base.rstrip("/"),
            timeout=timeout,
            transport=transport,
            headers={
                "Authorization": f"Bearer {token.strip()}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": API_VERSION,
                "User-Agent": "KAE-Studio",
            },
        )

    def close(self) -> None:
        self._client.close()

    def _get(self, path: str, **kwargs: Any) -> Any:
        try:
            response = self._client.get(path, **kwargs)
        except httpx.HTTPError as error:
            raise SourceReadError(502, f"could not reach GitHub: {type(error).__name__}") from None
        if response.status_code == 200:
            return response.json()
        if response.status_code == 403 and response.headers.get("x-ratelimit-remaining") == "0":
            raise SourceReadError(429, "GitHub is rate limiting this credential")
        raise SourceReadError(response.status_code, _neutral(response.status_code))

    # -- capability --------------------------------------------------------

    def check(self, repo: str) -> dict[str, Any]:
        """What this credential can do with this repository.

        Read and write are reported **separately**, from the permissions GitHub
        returns. Write is never established by writing something: a connectivity
        check that published a file to find out whether it could would be the
        exact behaviour the setup prompt forbids.
        """

        body = self._get(f"/repos/{repo}")
        permissions = body.get("permissions", {}) or {}
        return {
            "account": str(body.get("owner", {}).get("login", "")),
            "can_read": bool(permissions.get("pull", True)),
            "can_write": bool(permissions.get("push", False)),
            "default_branch": str(body.get("default_branch", "main")),
            "private": bool(body.get("private", False)),
        }

    # -- pinning -----------------------------------------------------------

    def resolve(self, repo: str, reference: str) -> str:
        """A branch, tag or SHA to an immutable commit SHA.

        The one operation that turns a moving target into something a finding
        can be traced to. A branch name in provenance means "whatever that
        branch pointed at when somebody read the trace", which is to say
        nothing.
        """

        body = self._get(f"/repos/{repo}/commits/{reference}")
        sha = str(body.get("sha", ""))
        if not sha:
            raise SourceReadError(502, "GitHub returned no commit for that reference")
        return sha

    def tree(self, repo: str, revision: str) -> tuple[list[dict[str, Any]], bool]:
        """Every blob at a revision, and whether GitHub truncated the answer.

        The truncation flag is returned rather than swallowed. A repository too
        large to list in one call is a repository this cannot honestly describe,
        and reporting a partial count as a total is how a snapshot digest ends
        up meaning nothing.
        """

        body = self._get(f"/repos/{repo}/git/trees/{revision}", params={"recursive": "1"})
        entries = [
            {"path": str(e["path"]), "sha": str(e["sha"]), "size": int(e.get("size", 0))}
            for e in body.get("tree", [])[:MAX_TREE_ENTRIES]
            if e.get("type") == "blob"
        ]
        truncated = bool(body.get("truncated", False)) or len(body.get("tree", [])) > MAX_TREE_ENTRIES
        return entries, truncated

    def read_file(self, repo: str, path: str, revision: str) -> str:
        """One file's text at a revision.

        Used for the harmless sample a connectivity proof reads. Bounded by the
        contents API, which refuses to inline anything large — and a file this
        cannot read is reported rather than returned empty.
        """

        body = self._get(f"/repos/{repo}/contents/{path}", params={"ref": revision})
        if isinstance(body, list):
            raise SourceReadError(422, f"{path} is a directory, not a file")
        if body.get("encoding") != "base64":
            raise SourceReadError(422, f"{path} is too large to read through the contents API")
        return base64.b64decode(body.get("content", "")).decode("utf-8", errors="replace")


def snapshot_digest(entries: list[dict[str, Any]]) -> str:
    """A digest over the paths and blob ids in scope.

    Over blob **ids**, not contents: it answers "are these the same files?"
    without downloading a repository to find out. Sorted, so the same snapshot
    described twice produces the same digest regardless of the order GitHub
    happened to return.
    """

    joined = "\n".join(f"{e['path']}:{e['sha']}" for e in sorted(entries, key=lambda e: e["path"]))
    return f"sha256:{hashlib.sha256(joined.encode()).hexdigest()}"


def _neutral(status: int) -> str:
    return {
        401: "GitHub rejected the credential",
        403: "GitHub refused this operation for this credential",
        404: "the repository or reference was not found, or is not visible",
        409: "the repository is empty",
        422: "GitHub rejected the request as invalid",
    }.get(status, f"GitHub returned {status}")


__all__ = ["API_VERSION", "MAX_TREE_ENTRIES", "GitHubSourceClient", "SourceReadError", "snapshot_digest"]
