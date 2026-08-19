"""Does every key the browser reads out of the projection get composed here?

The fourth question at Studio's own seam, and `D-322`. Two docstrings in this
directory call the request-body check *the last one nothing asked*, and they are
wrong by one: `test_the_browser_calls_routes_this_backend_serves.py` (`D-301`)
asks whether the **route** exists, `test_the_browser_sends_fields_this_backend
_declares.py` (`D-307`) asks what the browser **sends**, and nothing asks what
the browser **reads back**.

That direction is where the silence is worst. `liveServices.ts` declares
`BackendProjection` — its own comment calls it *"shape of the backend's
projection"* — and reads the response through `call<BackendProjection>(…)`,
which is a cast, not a check. Rename a key in `projection.py` and `tsc` stays
green, `toProjection` still builds an object, the counts are still right, and
the value is `undefined`. `D-302` is that failure one seam outward, where three
keys had been read out of a route that never sent them; here it is the seam a
person is standing at.

## Where each side's truth comes from

**Composed: every string key of every dict literal in `projection.py` and
`definition.py`, read with `ast`.** Those two modules are the whole of what the
projection route returns — `build_projection` composes the envelope and calls
`build_definition` for the one block it does not.

**Read: the field names of `BackendProjection` and `BackendStatement` in
`liveServices.ts`.** They are the browser's written-down copy of this backend's
answer, which is what makes them checkable at all.

## By name, not by structure, and deliberately

A nested comparison would need to resolve the nine helper functions that return
the projection's sub-objects (`_health`, `_classification`, `_gap`, …) back into
the shape they land in. Guessing at that resolution would be this check
inventing what it verifies (`D-295`), so what is compared is the set of names.

**What that catches is a rename**, which is the failure this exists for. What it
does not catch is a key moved from one nesting level to another while keeping
its name. That limit is written here rather than left for a reader to assume,
because a check whose reach is overstated is worth less than one with none.

## Only one direction fails

A name the browser declares that this backend composes nowhere is a **failure**:
it reads `undefined`. A name composed and not declared is the browser declining
a field on purpose, which is `D-294`'s argument, and that list would be almost
entirely correct omissions — so it is not reported at all.

## The controls (`D-219`)

* **both interfaces must be found and read**, and an unparseable one is a
  failure rather than an empty set that compares equal to everything;
* **the counts are asserted with a floor**, so a scan that resolved nothing
  cannot pass;
* **every registered exception must still be declared by the browser**, so an
  entry left behind by a deleted field is reported rather than kept forever.
"""

from __future__ import annotations

import ast
import re
from pathlib import Path

REPOSITORY = Path(__file__).resolve().parents[2]

#: The two modules that compose the projection route's answer, and no others.
#: `build_projection` builds the envelope; `build_definition` builds the one
#: block it delegates.
COMPOSERS = (
    REPOSITORY / "backend" / "src" / "kae_studio" / "projection.py",
    REPOSITORY / "backend" / "src" / "kae_studio" / "definition.py",
)

SERVICES = REPOSITORY / "src" / "services" / "live" / "liveServices.ts"

#: The browser's written-down copy of what this backend answers with.
INTERFACES = ("BackendProjection", "BackendStatement")

#: Names the browser declares that nothing composes, each with the reason it is
#: not a defect. An entry here is a claim, so `test_every_exception_is_still
#: _declared` fails when one stops being true.
EXPECTED_UNCOMPOSED = {
    # `definition.py` returns `"workflows": []` unconditionally and declares the
    # section as a gap, so no workflow entry is ever produced and these two are
    # the fields such an entry would carry. Registered rather than deleted from
    # the interface: the gap is honest and these are what the section will send
    # when it can be filled.
    "steps": "workflows is a declared gap, so no entry carrying it is composed",
    "realizedBy": "workflows is a declared gap, so no entry carrying it is composed",
}

#: Floors, not exact counts — these move whenever anybody adds a field, and a
#: check that has to be edited to add one gets edited without being read.
LEAST_DECLARED = 60
LEAST_COMPOSED = 90
LEAST_RESOLVED = 60


def composed_names() -> set[str]:
    """Every string key of every dict literal the projection is built from."""

    names: set[str] = set()
    for path in COMPOSERS:
        module = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(module):
            if not isinstance(node, ast.Dict):
                continue
            for key in node.keys:
                if isinstance(key, ast.Constant) and isinstance(key.value, str):
                    names.add(key.value)
    return names


def _interface_body(source: str, name: str) -> str:
    """The text of one TypeScript interface, braces balanced.

    Raises rather than returning nothing: an interface that cannot be found is
    the control this check would otherwise pass vacuously against.
    """

    marker = f"interface {name}"
    start = source.find(marker)
    if start < 0:
        raise AssertionError(f"{SERVICES.name} declares no interface {name}")
    depth = 0
    for index in range(source.index("{", start), len(source)):
        if source[index] == "{":
            depth += 1
        elif source[index] == "}":
            depth -= 1
            if depth == 0:
                return source[start : index + 1]
    raise AssertionError(f"interface {name} is not closed in {SERVICES.name}")


#: A field declaration, including the optional marker and any nesting depth.
#: Anchored to the line so a type expression mentioning a colon cannot be read
#: as a second field.
_FIELD = re.compile(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\??:", re.MULTILINE)


def declared_names() -> set[str]:
    """Every field name the browser writes down as part of the projection."""

    source = SERVICES.read_text(encoding="utf-8")
    names: set[str] = set()
    for interface in INTERFACES:
        names |= set(_FIELD.findall(_interface_body(source, interface)))
    return names


def test_every_field_the_browser_reads_is_composed_by_this_backend() -> None:
    declared = declared_names()
    composed = composed_names()
    missing = sorted(declared - composed - set(EXPECTED_UNCOMPOSED))
    assert not missing, (
        "the browser declares fields of the projection that nothing composes, "
        "so each reads `undefined` behind a green typecheck: " + ", ".join(missing)
    )


def test_every_exception_is_still_declared() -> None:
    """A registered exception that stopped being declared is a stale claim."""

    declared = declared_names()
    stale = sorted(name for name in EXPECTED_UNCOMPOSED if name not in declared)
    assert not stale, (
        "these are registered as declared-but-uncomposed and the browser no "
        "longer declares them; delete the entries: " + ", ".join(stale)
    )


def test_the_scan_read_both_sides() -> None:
    """A comparison of two empty sets passes and asserts nothing (`D-219`)."""

    declared = declared_names()
    composed = composed_names()
    assert len(declared) >= LEAST_DECLARED, f"only {len(declared)} field(s) read from the browser"
    assert len(composed) >= LEAST_COMPOSED, f"only {len(composed)} key(s) read from the backend"
    assert len(declared & composed) >= LEAST_RESOLVED, (
        f"only {len(declared & composed)} name(s) matched, which is too few for the "
        "comparison above to mean anything"
    )
