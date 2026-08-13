"""Reading a repository that is already on this machine. **Read-only, confined.**

`ADR-0006` — local execution is the canonical environment, and a local directory
needs no credential, no GitHub App and no network. This is the provider that
makes the repository-to-knowledge path reachable without waiting on `SRC-TOKEN`.

## Why this file is more dangerous than the one beside it

`github_source.py` reaches a remote service that authenticates it. This reaches
**the filesystem of the host process**, over an HTTP API, in a deployment where
`STUDIO_NO_AUTH` is on by decision. A `location` that accepts any path is
`GET /etc/shadow` with extra steps, and a `path` that accepts `../` is the same
thing wearing a repository name.

So (`D-67`):

- `KAE_LOCAL_SOURCE_ROOTS` names what may be read. **Unset means this provider
  does not exist** — never "read anywhere". A local capability that switches
  itself on by default is how a workstation feature becomes a hosted hole.
- Every path is resolved *before* it is checked. `..`, a symlink pointing out of
  the tree, and a symlink whose target moves later are then one case instead of
  three patterns to match. Checking the string first is the classic mistake and
  the guards assert against it specifically.
- The confinement lives here rather than in a route, so it protects the routes
  somebody adds next year as well as the ones that exist now.

There is no method here that mutates anything, which is the property
`github_source.py` opens by claiming and this file inherits deliberately.
"""

from __future__ import annotations

import hashlib
import os
import subprocess
from collections.abc import Sequence
from pathlib import Path

from .github_source import MAX_TREE_ENTRIES, SourceReadError

#: Directories that are never material and are large enough to matter.
SKIP = frozenset(
    {
        ".git",
        "node_modules",
        ".venv",
        "venv",
        "__pycache__",
        ".mypy_cache",
        ".pytest_cache",
        ".ruff_cache",
        "dist",
        "build",
        ".next",
        "target",
    }
)

#: Above this, a file is carried as a reference rather than read (`ADR-0006`
#: §22). Read into a prompt it is noise; read into Memory it is a file dump.
MAX_FILE_BYTES = 1_000_000


class LocalSourceUnavailable(RuntimeError):
    """No roots are configured, in a sentence an operator can act on."""


def resolve_roots(entries: Sequence[str]) -> tuple[Path, ...]:
    """Turn configured strings into directories that exist.

    Takes what `Settings` already parsed rather than reading the environment
    again. Two readers of one variable is how a deployment came to report
    `local_sources: 1` at its status endpoint and list nothing from its picker
    (`D-71`).

    A path that is not a directory is dropped: a typo in a deployment variable
    must not become a root that resolves to something surprising later.
    """

    found = []
    for entry in entries:
        candidate = entry.strip()
        if not candidate:
            continue
        resolved = Path(candidate).expanduser().resolve()
        if resolved.is_dir():
            found.append(resolved)
    return tuple(found)


def configured_roots(environ: dict[str, str] | None = None) -> tuple[Path, ...]:
    """The same, read straight from an environment. For tests and tooling."""

    raw = (environ if environ is not None else dict(os.environ)).get("KAE_LOCAL_SOURCE_ROOTS", "")
    return resolve_roots(raw.split(os.pathsep))


class LocalSourceClient:
    """Describe a tree, read a file, resolve a revision. Nothing else."""

    def __init__(self, roots: tuple[Path, ...]) -> None:
        if not roots:
            raise LocalSourceUnavailable(
                "no local source roots are configured, so no directory may be read. "
                "Set KAE_LOCAL_SOURCE_ROOTS to the directories KAE may read."
            )
        self._roots = roots

    # -- confinement -------------------------------------------------------

    def _within(self, candidate: Path) -> Path:
        """Resolve, then check. Never the other way round.

        `Path.resolve()` collapses `..` and follows symlinks, so what is checked
        is the file that would actually be opened rather than the string that
        was asked for. A check on the unresolved string passes for
        `root/../../etc/passwd` and for a symlink planted inside the root.
        """

        resolved = candidate.expanduser().resolve()
        for root in self._roots:
            if resolved == root or root in resolved.parents:
                return resolved
        raise SourceReadError(404, "that path is not inside a directory KAE may read")

    def _repo(self, location: str) -> Path:
        path = self._within(Path(location))
        if not path.is_dir():
            raise SourceReadError(404, f"there is no directory at {location}")
        return path

    # -- capability --------------------------------------------------------

    def repositories(self, query: str = "", limit: int = 100) -> tuple[list[dict], bool]:
        """What this deployment was configured to reach.

        GitHub's version of this answers *what this credential can see*. The
        local answer is the same question with a different authority, which is
        why the picker needs no second mode.

        A root is itself offered when it is a repository; otherwise its
        immediate children are, because `~/workspaces` is a container of
        projects and not a project.
        """

        found: list[dict] = []
        for root in self._roots:
            candidates = [root] if (root / ".git").exists() else sorted(
                child for child in root.iterdir() if child.is_dir() and child.name not in SKIP
            )
            for candidate in candidates:
                found.append(
                    {
                        "full_name": str(candidate),
                        "default_branch": _branch(candidate),
                        "private": True,
                        # What a person recognises it by. Never invented.
                        "description": _describe(candidate),
                        "updated_at": "",
                    }
                )

        needle = query.strip().lower()
        if needle:
            found = [r for r in found if needle in r["full_name"].lower()]
        return found[:limit], len(found) > limit

    def check(self, repo: str) -> dict:
        """What this deployment can do with this directory.

        `can_write` is **always false**, and not because a permission was
        checked: nothing in this file writes. Reporting the filesystem's opinion
        would describe a capability the code does not have.
        """

        path = self._repo(repo)
        return {
            "account": str(path.parent),
            "can_read": os.access(path, os.R_OK),
            "can_write": False,
            "default_branch": _branch(path),
            "private": True,
        }

    # -- pinning -----------------------------------------------------------

    def resolve(self, repo: str, reference: str) -> str:
        """A reference to an immutable commit, or a digest of the tree.

        A directory that is not a git repository still needs an identity a
        finding can be traced to, and *"whatever was on disk that day"* is not
        one. `git rev-parse` where there is git; a content digest where there is
        not, which changes when the content changes and is the same promise by
        other means.
        """

        path = self._repo(repo)
        if (path / ".git").exists():
            revision = _git(path, "rev-parse", reference or "HEAD")
            if revision:
                return revision
        return self.digest(repo)

    def digest(self, repo: str) -> str:
        """A stable fingerprint of what is readable here (`ADR-0006` §23)."""

        path = self._repo(repo)
        running = hashlib.sha256()
        for entry in _walk(path):
            running.update(entry["path"].encode())
            running.update(entry["sha"].encode())
        return running.hexdigest()

    # -- reading -----------------------------------------------------------

    def tree(self, repo: str, revision: str) -> tuple[list[dict], bool]:
        """Every readable file, relative to the directory.

        `revision` is accepted and unused: this reads the working tree, and
        checking out a historical revision would mutate somebody's checkout,
        which is the one thing a read-only client must never do. Stated rather
        than silently ignored.
        """

        path = self._repo(repo)
        entries = _walk(path)
        return entries[:MAX_TREE_ENTRIES], len(entries) > MAX_TREE_ENTRIES

    def read_file(self, repo: str, path: str, revision: str) -> str:
        """One file's text, bounded.

        Binary content is refused rather than mangled: a decode with
        `errors="replace"` produces something that looks like text, extracts
        into nonsense, and is traceable to a real file — which is worse than a
        refusal a person can read.
        """

        root = self._repo(repo)
        # Joined then confined, so `path` cannot climb out with `../`.
        target = self._within(root / path)
        if not target.is_file():
            raise SourceReadError(404, f"there is no file at {path}")
        if target.stat().st_size > MAX_FILE_BYTES:
            raise SourceReadError(
                413, f"{path} is larger than {MAX_FILE_BYTES} bytes and was not read"
            )
        try:
            return target.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            raise SourceReadError(415, f"{path} is not text this deployment can read") from None
        except OSError as error:
            raise SourceReadError(403, f"{path} could not be read: {error.strerror}") from None


def _walk(root: Path) -> list[dict]:
    """Every readable file with its **content** hash.

    The hash is the identity, not the size. A first draft digested `path:size`,
    which is stable under any edit that keeps the length — a renamed field, a
    flipped boolean, a changed constant — so a snapshot could be reported
    unchanged while the code under it had moved. `ADR-0006` §23 asks for content
    hashes and this is why.

    The shape matches `github_source.tree`'s, `sha` included, because
    `snapshot_digest` consumes both and a provider that returned a different
    shape would fail at the one call that combines them.
    """

    found: list[dict] = []
    for current, directories, files in os.walk(root):
        directories[:] = [d for d in directories if d not in SKIP and not d.startswith(".")]
        for name in files:
            full = Path(current) / name
            try:
                size = full.stat().st_size
                sha = _sha256(full)
            except OSError:
                # A dangling symlink or a file removed mid-walk. Skipped rather
                # than failing the listing: one unreadable entry is not a
                # reason to describe none of the repository.
                continue
            found.append(
                {"path": str(full.relative_to(root)), "size": size, "sha": sha, "type": "blob"}
            )
    return sorted(found, key=lambda entry: entry["path"])


def _sha256(path: Path) -> str:
    """Streamed, so a large file is fingerprinted without being held."""

    running = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(65_536), b""):
            running.update(block)
    return running.hexdigest()


def _git(path: Path, *arguments: str) -> str:
    try:
        done = subprocess.run(  # noqa: S603 - fixed executable, no shell
            ["git", "-C", str(path), *arguments],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return ""
    return done.stdout.strip() if done.returncode == 0 else ""


def _branch(path: Path) -> str:
    return _git(path, "rev-parse", "--abbrev-ref", "HEAD") or ""


def _describe(path: Path) -> str:
    """The first heading of a README, where there is one."""

    for name in ("README.md", "README.rst", "README.txt", "README"):
        readme = path / name
        if not readme.is_file():
            continue
        try:
            for line in readme.read_text(encoding="utf-8").splitlines():
                stripped = line.strip().lstrip("#").strip()
                if not stripped or _is_markup(stripped):
                    continue
                return stripped[:200]
        except (OSError, UnicodeDecodeError):
            return ""
    return ""


def _is_markup(line: str) -> bool:
    """Whether this line is decoration rather than a sentence.

    Two of 29 real repositories open with `<div align="center">`, so the first
    non-empty line described the project as `<div align="center">`. **Skipped
    rather than tag-stripped**: stripping yields an empty string, which renders
    as *this project has no description* — a different and worse claim than
    reading on to the first line that is prose.
    """

    return line.startswith(("<", "![", "[![", "---", "===", "|"))
