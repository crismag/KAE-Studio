"""No `SourceReadError` is raised without the one action that would resolve it.

`UX-16`, `D-269`, and it lives in its own file for the reason recorded as
`D-292`: this is an `ast` scan over `src/`, it needs neither the app nor the
private sibling, and while it shared a module with a route test it skipped in
KAE-Studio's CI along with it. It is the guard of that pair most worth running
on every push — it fails when somebody *adds* a raise site, which is the change
a reviewer waves through and no route test can see.

Nothing here may import `kae_studio`. An import of the app brings
`pytest.importorskip("cie_slim")` with it, and the file leaves CI's reach again
without anybody noticing (`development/checks/ci_blind_spot.py` in
KAE-Ecosystem is what would notice).
"""

from __future__ import annotations

import ast
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "src" / "kae_studio"

#: The statuses `SourceReadError.kind` maps to a remedy of its own, plus 502 —
#: the one status where waiting for the provider is the true next action,
#: because it is raised where GitHub could not be reached or answered with
#: nothing.
CARRIED_BY_THE_STATUS = frozenset({401, 403, 404, 429, 502})


def _constructions() -> list[tuple[str, ast.Call]]:
    """Every `SourceReadError(...)` in ``src``, keyed by module and line."""

    found = []
    for path in sorted(SRC.rglob("*.py")):
        module = path.relative_to(SRC).as_posix()
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
            if (
                isinstance(node, ast.Call)
                and isinstance(node.func, ast.Name)
                and node.func.id == "SourceReadError"
            ):
                found.append((f"{module}:{node.lineno}", node))
    return found


def test_the_scan_finds_the_raise_sites_it_is_asserting_about() -> None:
    """An absence found by a scan is not a finding until the scan finds something.

    Without this, a rename of `SourceReadError` turns the guard below into a
    loop over an empty list that passes for free — the shape `D-219` filed
    three unproducible relation kinds on.
    """

    assert len(_constructions()) > 1


def test_a_status_the_table_cannot_answer_carries_its_own_remedy() -> None:
    """Adding a raise site is exactly when the outage sentence gets inherited.

    The handler falls back to *"Try again once the provider recovers"*, so a new
    status with no `remedy=` is not a missing string — it is a confident wrong
    instruction. Checked here rather than trusted to review, in the shape the
    egress and local-model door registries use.
    """

    silent = []
    for where, call in _constructions():
        if not call.args:
            continue
        status = call.args[0]
        if not isinstance(status, ast.Constant) or not isinstance(status.value, int):
            # A status that is not written here is the provider's own answer
            # being passed through (`github_source.py`'s `_get`), and that is
            # the one case where waiting for the provider to recover is the
            # true next action. The risk this guard exists for is a status
            # somebody typed.
            continue
        if status.value in CARRIED_BY_THE_STATUS:
            continue
        if not any(keyword.arg == "remedy" for keyword in call.keywords):
            silent.append(f"{where} raises {status.value}")

    assert not silent, (
        "these refusals fall through to the provider-outage remedy and say to wait "
        "for something that is not happening:\n  "
        + "\n  ".join(silent)
        + "\nPass remedy= with the one action that would resolve it."
    )
