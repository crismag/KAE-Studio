"""Every skill CIE can choose has a sentence a person can read.

The seam: skills are defined in cris-cie-slim and explained in Studio's
`SKILL_SENTENCES`, and nothing connected the two. Four skills added in one
day — `recommend`, `adopt_working_assumption`, `answer_and_resume`,
`offer_to_defer` — rendered as *"it is working through adopt working
assumption"* instead of a sentence somebody wrote.

**This is the only place the check can live.** The table is TypeScript and the
skills are Python; the frontend cannot import `cie_slim`, and a frontend test
listing the names by hand would just restate the table it is checking. Studio's
backend imports both worlds, so it is where the two can be compared.

The fallback in `WhyThisQuestion` stays and is not a substitute for this: CIE
chooses its skills freely, so the table *will* fall behind again, and naming the
raw skill is worse prose and better information than showing no reason at all.
What this catches is the gap while it is still cheap to close.
"""

from __future__ import annotations

import re
from pathlib import Path

from cie_slim.kae.skills import SKILL_NAMES

#: The table, read from source rather than duplicated here.
#:
#: Duplicating it would make this test pass whenever both copies were wrong
#: together, which is the failure mode of every hand-maintained mirror.
TABLE = (
    Path(__file__).resolve().parents[2]
    / "src"
    / "components"
    / "project"
    / "skillSentences.ts"
)


def _explained() -> set[str]:
    source = TABLE.read_text(encoding="utf-8")
    block = source[source.index("export const SKILL_SENTENCES") :]
    block = block[: block.index("\n}")]
    return set(re.findall(r"^\s{2}([a-z_]+):", block, flags=re.MULTILINE))


def test_the_table_is_where_this_test_thinks_it_is() -> None:
    """A guard on the guard: a rename would leave this passing on nothing."""

    assert TABLE.exists(), f"{TABLE} moved; this check is now blind"
    assert len(_explained()) > 10


def test_every_skill_has_a_sentence() -> None:
    missing = sorted(SKILL_NAMES - _explained())

    assert not missing, (
        f"{missing} can be chosen by CIE and have no sentence in "
        f"SKILL_SENTENCES, so 'why did KAE ask that' falls back to naming the "
        f"skill. Add a line to skillSentences.ts."
    )


def test_no_sentence_explains_a_skill_that_no_longer_exists() -> None:
    """A stale entry is dead prose that reads as current."""

    unknown = sorted(_explained() - SKILL_NAMES)

    assert not unknown, f"{unknown} are explained and cannot be chosen"
