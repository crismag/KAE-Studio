"""Copying a repository onto this machine so it can be read as a folder.

The `+` menu offered *clone a repository here first* and said **Not yet**,
truthfully: nothing in the estate ran `git clone`. With a credential present and
local roots configured, the honest answer changed (`D-93`).

## Two things this refuses to do

**The token never lands on disk.** `git clone https://token@github.com/...`
writes the credential into `.git/config`, where it outlives the process and gets
copied wherever the checkout goes. The header is passed with `-c` on the command
line instead, which git does not persist, and the remote is left as a plain
`https://github.com/...` URL that will ask for credentials rather than carry
them.

**Nothing is written outside a configured root.** `D-67`'s confinement applies
to writing at least as much as to reading: a clone target assembled from a
repository name is an attacker-supplied path, and `../../` in a repository name
would otherwise put a checkout anywhere this process can write.
"""

from __future__ import annotations

import subprocess
from pathlib import Path


class CloneError(RuntimeError):
    """A clone could not be made, in one sentence a person can act on."""


def clone(
    full_name: str,
    root: Path,
    token: str = "",
    *,
    timeout: float = 600.0,
) -> Path:
    """Clone `owner/name` into `root`, returning where it landed.

    Refuses rather than overwrites: a directory that already exists is somebody
    else's checkout, possibly with uncommitted work in it, and *clone* is not a
    word that should ever destroy one.
    """

    owner, _, name = full_name.partition("/")
    if not owner or not name or "/" in name:
        raise CloneError(f"{full_name!r} is not an owner/name repository")

    target = (root / name).resolve()
    # Written before it is used, and checked after resolving — `..` in a name
    # would otherwise escape the root (`D-67`).
    if target != root.resolve() and root.resolve() not in target.parents:
        raise CloneError("a clone may only be written inside a configured source root")
    if target.exists():
        raise CloneError(
            f"{target} already exists. KAE will not clone over a directory it did not create."
        )

    # The token as a request header, never in the URL. `-c` settings are not
    # written to the clone's config, so nothing survives this command.
    command = ["git"]
    if token.strip():
        command += ["-c", f"http.extraHeader=Authorization: Bearer {token.strip()}"]
    command += [
        "-c",
        "credential.helper=",
        "clone",
        "--depth",
        # Enough to read and to pin. Full history is not needed to propose
        # statements from a file, and a shallow clone of a large repository is
        # the difference between seconds and minutes.
        "1",
        f"https://github.com/{full_name}.git",
        str(target),
    ]

    try:
        done = subprocess.run(  # noqa: S603 - fixed executable, no shell
            command, capture_output=True, text=True, timeout=timeout, check=False
        )
    except subprocess.TimeoutExpired as error:
        raise CloneError(f"cloning {full_name} took longer than {timeout:.0f}s") from error
    except OSError as error:
        raise CloneError(f"git could not be run: {error.strerror}") from error

    if done.returncode != 0:
        raise CloneError(_why(full_name, done.stderr))

    return target


def _why(full_name: str, stderr: str) -> str:
    """git's failure, in terms that name the remedy.

    git's own message is written for somebody at a terminal and mentions
    credential helpers and askpass. What a person here needs is which of three
    things went wrong.
    """

    text = (stderr or "").lower()
    if "not found" in text or "repository not found" in text:
        # GitHub answers 404 for *private and not yours* as well as *absent*,
        # deliberately, and repeating "not found" would send somebody to check
        # the spelling of a repository they can see in the picker.
        return (
            f"GitHub did not return {full_name}. It may not exist, or this "
            "deployment's credential may not be allowed to read it."
        )
    if "authentication" in text or "denied" in text or "403" in text:
        return f"GitHub refused this deployment's credential for {full_name}."
    if "could not resolve host" in text or "network" in text:
        return "GitHub could not be reached from this machine."
    return f"git could not clone {full_name}."


__all__ = ["CloneError", "clone"]
