"""Every way out of this process is a door, and each one says what refuses it.

`ADR-0006` §30 argues that the network policy *"cannot be bolted on after the
providers multiply"*. `D-172` gated Studio's one provider, `D-177` its source
client, `D-179` the App beside it — and `D-180` found `git clone`, which none of
those passes saw because they looked for a constructed HTTP client and this is a
subprocess. This is the check that the next one cannot arrive unnoticed
(`D-181`).

It fails in three directions:

* a module reaches out and is registered nowhere;
* a door is registered against a variable that no ``runtime_profile.require`` in
  ``src`` actually refuses on — a registry nobody checks is a docstring, and this
  estate has been caught by a sentence asserting a gate no branch enforced
  (`D-32`);
* an entry is stale: registered here and no longer reaching anything.

**`subprocess` is scanned for.** That is `D-180`'s whole lesson. Egress is not
always an SDK, and a scan that looked only for clients would reproduce exactly
the miss it exists to catch.

**Nothing here imports `api` or `interviewer`**, so these guards run in the
pipeline that has no `cris-cie-slim` checkout (`AUD-033`). A guard on deployment
posture that shows up in CI as a skip with a reason is not a guard.

**The limit, stated rather than hidden:** the scan knows the libraries the
estate has. A client on an SDK nobody has imported yet would not match. Memory's
version of this file closes that with a dependency-classification pass over
`pyproject.toml`; this one deliberately does not (`D-181`), because Studio's
backend declares three local file decoders and a private sibling repository, and
placing those forever is a judgement rather than a check.
"""

from __future__ import annotations

import ast
from collections.abc import Iterator, Mapping
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "src" / "kae_studio"

EGRESS_IMPORTS = frozenset(
    {
        "anthropic",
        "boto3",
        "githubkit",
        "httpx",
        # `D-180`. A command is a client the estate does not have to import.
        "subprocess",
    }
) | frozenset(
    {"aiohttp", "ftplib", "openai", "requests", "smtplib", "socket", "urllib.request", "websockets"}
)
"""What the estate imports today, plus the ways it plausibly would tomorrow."""


DOORS: Mapping[str, str] = {
    "acquisition/clone.py": "git clone",
    "acquisition/github_app.py": "the GitHub App",
    "acquisition/github_source.py": "the GitHub source client",
    "interviewer.py": "KAE_CIE_PROVIDER",
}
"""Module → the name a profile check refuses under.

Three of the four are not environment variables, and that is Studio's shape
rather than a looseness: Memory picks a provider by variable, and here the
credential and the address come from settings that several variables feed. What
the registry needs is that the refusal exists and is findable, which is what the
check below reads.
"""


UNDECIDED: Mapping[str, str] = {
    "artifacts_client.py": (
        "ARTIFACTS_BASE_URL. Reaches KAE-Artifacts, which is genuinely on the network when "
        "the estate is spread across machines. Whether Studio's link to its own estate is a "
        "reach the profile rules on, or the deployment's own topology, is the open question "
        "on OFF-POLICY — and refusing it is refusing to boot."
    ),
    "memory_client.py": (
        "MEMORY_BASE_URL. The same open question, and the sharper case: /api/status exists "
        "to be answerable when things are wrong, and it cannot answer if the profile "
        "refused the client it reports on."
    ),
}
"""Doors with no refusal, each naming the question that has not been answered.

Not a waiting room for work nobody did. `D-181`: a registry may honestly say
*nothing refuses this yet, and here is why that is undecided* — what it may not
do is leave the door out. This category is why the check could be written before
the question was settled, and writing it is what found `D-180`.
"""


NOT_DOORS: Mapping[str, str] = {
    "acquisition/local_source.py": (
        "git -C <path> rev-parse reads a checkout already on this machine — a branch name "
        "and a commit. No remote is named and no socket is opened, the same reason "
        "LocalSourceClient itself is ungated (`D-177`)."
    ),
}
"""Imports something network-capable and reaches nothing. Each says why.

Deliberately a registry with reasons rather than a cleverer scan. Deciding
whether an import is a reach is a judgement, and a heuristic making it silently
is the thing this file exists to refuse.
"""


def _modules() -> Iterator[tuple[str, ast.Module]]:
    for path in sorted(SRC.rglob("*.py")):
        yield path.relative_to(SRC).as_posix(), ast.parse(path.read_text(encoding="utf-8"))


def _imported_names(tree: ast.Module) -> set[str]:
    """Every module name imported anywhere, including inside a function body.

    Providers here are imported lazily inside constructors, so a scan reading
    only module-level imports would report the Bedrock door as absent.
    """

    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            names.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module and not node.level:
            names.add(node.module)
    return names


def _reaches_out(tree: ast.Module) -> bool:
    return any(
        name == library or name.startswith(f"{library}.")
        for name in _imported_names(tree)
        for library in EGRESS_IMPORTS
    )


def _refused_names() -> set[str]:
    """The names some ``runtime_profile.require`` in ``src`` actually refuses under."""

    refused: set[str] = set()
    for _, tree in _modules():
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            function = node.func
            if not isinstance(function, ast.Attribute) or function.attr != "require":
                continue
            for keyword in node.keywords:
                if keyword.arg == "variable" and isinstance(keyword.value, ast.Constant):
                    refused.add(str(keyword.value.value))
    return refused


class TestEveryDoorIsRegistered:
    def test_no_module_reaches_out_without_being_registered(self) -> None:
        known = set(DOORS) | set(UNDECIDED) | set(NOT_DOORS)
        unregistered = sorted(
            module for module, tree in _modules() if _reaches_out(tree) and module not in known
        )
        assert not unregistered, (
            "these modules import a network-capable library and are registered nowhere:\n  "
            + "\n  ".join(unregistered)
            + "\nGive the call a runtime_profile.require and add it to DOORS, or say here "
            "why nothing refuses it yet, or why it is not a reach at all."
        )

    def test_no_entry_is_stale(self) -> None:
        """A registry entry for a module that stopped reaching out reads exactly
        like a gated door, and hides the next one that takes its place."""

        trees = dict(_modules())
        stale = sorted(
            module
            for module in (*DOORS, *UNDECIDED, *NOT_DOORS)
            if module not in trees or not _reaches_out(trees[module])
        )
        assert not stale, "registered here and no longer importing anything outbound: " + ", ".join(
            stale
        )

    def test_a_module_is_in_exactly_one_registry(self) -> None:
        entries = [*DOORS, *UNDECIDED, *NOT_DOORS]
        assert len(entries) == len(set(entries)), "a module is registered twice: " + ", ".join(
            sorted({name for name in entries if entries.count(name) > 1})
        )


class TestEveryDoorIsRefusedSomewhere:
    def test_each_door_names_something_a_profile_check_refuses_on(self) -> None:
        refused = _refused_names()
        ungated = sorted({name for name in DOORS.values() if name not in refused})
        assert not ungated, (
            "these doors are registered against names that no runtime_profile.require "
            "in src refuses on: " + ", ".join(ungated)
        )

    def test_the_four_that_are_gated_stay_gated(self) -> None:
        """`D-172`, `D-177`, `D-179` and `D-180`, one apiece. Losing one would be silent."""

        assert _refused_names() >= {
            "KAE_CIE_PROVIDER",
            "git clone",
            "the GitHub App",
            "the GitHub source client",
        }


class TestTheUndecidedDoorsStaySaidOutLoud:
    """The category exists so the check could be written before the question was
    answered (`D-181`). Its failure mode is somebody emptying it quietly."""

    def test_the_estates_own_base_urls_are_still_listed_as_undecided(self) -> None:
        assert set(UNDECIDED) == {"artifacts_client.py", "memory_client.py"}, (
            "the two links to Studio's own estate are the open question on OFF-POLICY. "
            "If one has been decided, it moves to DOORS with the refusal that decided it — "
            "not out of the registries altogether."
        )

    def test_each_undecided_door_names_the_question(self) -> None:
        for module, reason in UNDECIDED.items():
            assert "open question" in reason or "question" in reason, (
                f"{module} is registered as undecided without naming what is undecided"
            )
