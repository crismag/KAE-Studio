"""Does every key the browser puts in a body reach a field this backend declares?

The third question at Studio's own seam, and the last one nothing asked.
`test_the_browser_calls_routes_this_backend_serves.py` (`D-301`) asks whether the
*route* exists. This asks what the browser **sends** to it, which is the
direction with no signal at either end: FastAPI parses a body through Pydantic,
whose `extra` default is `ignore` and which no model in `api.py` overrides, so an
undeclared key is not a `422` — it is dropped in the parser and the handler runs
with the field at its default.

That is not hypothetical. `D-304`/`D-306` is exactly this failure one seam
outward: Studio sent `reviewer` to a KAE-Memory route that declared no body, and
for months every confirmation in the audit trail named nobody while the call
answered `200`. `client_request_fields.py` now guards that seam. Between the
browser and this backend the same silence was unguarded, and it is the seam a
person is standing at.

It lives here rather than in `development/checks/` because both ends are in this
repository and this pipeline can run them — `D-247`/`D-251`, and the same reason
the route check gives.

## Where each side's truth comes from

**Declared: the Pydantic models in `api.py`, read with `ast`.** A handler
parameter annotated with a class defined in that module is the body; its
`AnnAssign` fields, plus those of any base also defined there, are what a caller
may send.

**Sent: `body: JSON.stringify({…})` at a `call` site in `src/`.** The call-site
machinery is imported from the route check rather than copied, so the two
questions cannot drift into disagreeing about which sites exist.

`callArtifacts` and `sendToArtifacts` are deliberately out of scope. They reach
KAE-Artifacts, which publishes no recorded contract, and answering the field
question off its decorators would be this check inventing what it verifies —
`D-295`'s rule at a different seam.

## Only one direction fails

A key sent that the route does not declare is a **failure**. A declared field
that is not sent is not reported at all, for `D-305`'s reason: request models are
mostly optional fields with defaults, so a caller omitting one is exercising the
contract rather than drifting from it, and that list would be almost entirely
correct omissions.

A body this check cannot read — a spread, a variable, a computed key — is
**counted and listed**, never silently passed over.

## The controls (`D-219`)

* **a body sent to a route whose handler declares no model is a failure**, since
  that is precisely the `D-304` shape and would otherwise resolve to an empty
  set of declared fields and pass;
* **a body sent to a route this backend does not serve is a failure**, rather
  than an unresolvable comparison that passes for free;
* **the counts are asserted non-zero**, so a scan that read nothing cannot pass.
"""

from __future__ import annotations

import ast
import re
from dataclasses import dataclass
from pathlib import Path

from tests.test_the_browser_calls_routes_this_backend_serves import (
    API,
    REPOSITORY,
    SENDERS,
    VERBS,
    _arguments,
    _forwarding_spans,
    _normalise,
    _path_literal,
    _skip_brackets,
    _skip_string,
    frontend_files,
)

Route = tuple[str, str]


@dataclass(frozen=True)
class Body:
    where: str
    method: str
    path: str
    #: `None` when the object literal could not be read — a spread, a variable
    #: or a computed key. Listed rather than dropped.
    keys: frozenset[str] | None


# --------------------------------------------------------------------------
# What this backend declares
# --------------------------------------------------------------------------


def _models(module: ast.Module) -> dict[str, ast.ClassDef]:
    return {
        node.name: node
        for node in module.body
        if isinstance(node, ast.ClassDef)
        and any(isinstance(base, ast.Name) and base.id == "BaseModel" for base in node.bases)
        or isinstance(node, ast.ClassDef)
        and any(isinstance(base, ast.Name) for base in node.bases)
    }


#: A handler that takes `dict[str, Any]` accepts every key and drops none.
ANYTHING = "anything"


def _is_untyped_body(annotation: ast.expr | None) -> bool:
    if isinstance(annotation, ast.Name):
        return annotation.id in {"dict", "Any"}
    if isinstance(annotation, ast.Subscript) and isinstance(annotation.value, ast.Name):
        return annotation.value.id == "dict"
    return False


def _fields(name: str, models: dict[str, ast.ClassDef], seen: frozenset[str]) -> set[str]:
    node = models.get(name)
    if node is None or name in seen:
        return set()
    fields = {
        target.target.id
        for target in node.body
        if isinstance(target, ast.AnnAssign) and isinstance(target.target, ast.Name)
    }
    for base in node.bases:
        if isinstance(base, ast.Name):
            fields |= _fields(base.id, models, seen | {name})
    return fields


def declared_by_models(source: Path) -> dict[Route, set[str] | str | None]:
    """Each served route, and the body fields its handler declares.

    Three states, and telling them apart is the whole check:

    * a set — the handler takes a Pydantic model, so an undeclared key is
      dropped by `extra="ignore"` and the call still answers 200;
    * `ANYTHING` — the handler takes `dict[str, Any]`, which accepts every key
      and drops none. Nothing can drift here, and calling it a failure would
      make the check argue with a deliberate choice;
    * `None` — the handler takes no body at all. A caller sending one is the
      `D-304` shape exactly, and it is a failure.
    """

    module = ast.parse(source.read_text())
    models = _models(module)
    declared: dict[Route, set[str] | str | None] = {}

    for node in ast.walk(module):
        if not isinstance(node, ast.AsyncFunctionDef | ast.FunctionDef):
            continue
        routes: list[Route] = []
        for decorator in node.decorator_list:
            if not isinstance(decorator, ast.Call):
                continue
            func = decorator.func
            if not isinstance(func, ast.Attribute) or func.attr not in VERBS:
                continue
            if not isinstance(func.value, ast.Name) or func.value.id != "app":
                continue
            if not decorator.args or not isinstance(decorator.args[0], ast.Constant):
                continue
            path = decorator.args[0].value
            if isinstance(path, str):
                routes.append((func.attr.upper(), _normalise(path)))
        if not routes:
            continue

        fields: set[str] | str | None = None
        for argument in [*node.args.args, *node.args.kwonlyargs]:
            annotation = argument.annotation
            if isinstance(annotation, ast.Name) and annotation.id in models:
                fields = _fields(annotation.id, models, frozenset())
                break
            if _is_untyped_body(annotation):
                fields = ANYTHING
                break
        for route in routes:
            declared[route] = fields
    return declared


# --------------------------------------------------------------------------
# What the browser sends
# --------------------------------------------------------------------------


def _object_keys(text: str) -> frozenset[str] | None:
    """The top-level keys of an object literal, or `None` if it is not readable."""

    stripped = text.strip()
    if not stripped.startswith("{"):
        return None
    if _skip_brackets(stripped, 0) != len(stripped):
        return None

    keys: set[str] = set()
    inner = stripped[1:-1]
    start = index = 0
    parts: list[str] = []
    while index < len(inner):
        char = inner[index]
        if char in "'\"`" or inner.startswith(("//", "/*"), index):
            index = _skip_string(inner, index)
            continue
        if char in "([{":
            index = _skip_brackets(inner, index)
            continue
        if char == ",":
            parts.append(inner[start:index])
            start = index = index + 1
            continue
        index += 1
    parts.append(inner[start:])

    for part in (candidate.strip() for candidate in parts):
        if not part or part.startswith("//"):
            continue
        # A spread merges keys decided elsewhere; a computed key is not a name.
        if part.startswith("...") or part.startswith("["):
            return None
        name = part.split(":", 1)[0].strip().strip("'\"")
        if not re.fullmatch(r"[A-Za-z_$][\w$]*", name):
            return None
        keys.add(name)
    return frozenset(keys)


def _body_argument(rest: str) -> str | None:
    """The expression inside `body: JSON.stringify(…)`, if the site has one."""

    match = re.search(r"\bbody:\s*JSON\.stringify\s*\(", rest)
    if match is None:
        return None
    inner = _arguments(rest, match.end() - 1)
    return inner[0] if inner else None


def bodies_sent(source: Path) -> list[Body]:
    text = source.read_text()
    spans = _forwarding_spans(text)
    sent: list[Body] = []

    for match in re.finditer(r"(?<![.\w$])(" + "|".join(SENDERS) + r")\s*(?=[<(])", text):
        if any(start <= match.start() < end for start, end in spans):
            continue
        cursor = match.end()
        if text[cursor] == "<":
            depth = 0
            while cursor < len(text):
                if text[cursor] == "<":
                    depth += 1
                elif text[cursor] == ">":
                    depth -= 1
                    if depth == 0:
                        cursor += 1
                        break
                elif text[cursor] in "'\"`":
                    cursor = _skip_string(text, cursor)
                    continue
                elif text[cursor] in "([{":
                    cursor = _skip_brackets(text, cursor)
                    continue
                cursor += 1
            while cursor < len(text) and text[cursor].isspace():
                cursor += 1
        if cursor >= len(text) or text[cursor] != "(":
            continue

        arguments = _arguments(text, cursor)
        if len(arguments) < 2:
            continue
        read = _path_literal(arguments[0])
        if read is None:
            continue

        rest = " ".join(arguments[1:])
        argument = _body_argument(rest)
        if argument is None:
            continue
        verb = re.search(r"method:\s*['\"](\w+)['\"]", rest)
        if verb is None:
            continue

        where = f"{source.relative_to(REPOSITORY)}:{text.count(chr(10), 0, match.start()) + 1}"
        sent.append(
            Body(where, verb.group(1).upper(), _normalise(read[0]), _object_keys(argument))
        )
    return sent


def scan() -> list[Body]:
    return [body for path in frontend_files() for body in bodies_sent(path)]


# --------------------------------------------------------------------------
# The comparison
# --------------------------------------------------------------------------


def test_every_key_the_browser_sends_is_one_this_backend_declares() -> None:
    declared = declared_by_models(API)
    drifted = []
    for body in scan():
        if body.keys is None:
            continue
        if (body.method, body.path) not in declared:
            drifted.append(
                f"{body.where} sends a body to {body.method} {body.path}, which this "
                "backend does not serve. The route check names the same site; this one "
                "must not pass it over as an unresolvable comparison."
            )
            continue
        fields = declared[(body.method, body.path)]
        if fields == ANYTHING:
            continue
        if fields is None:
            drifted.append(
                f"{body.where} sends {sorted(body.keys)} to {body.method} {body.path}, "
                "whose handler declares no body model this check can read. Pydantic "
                "drops undeclared keys and answers 200, so nothing at either end "
                "reports it — that is D-304, where every confirmation named nobody."
            )
            continue
        extra = sorted(body.keys - fields)
        if extra:
            drifted.append(
                f"{body.where} sends {extra} to {body.method} {body.path}, which "
                f"declares {sorted(fields)}. `extra` defaults to `ignore`, so the key "
                "is dropped in the parser and the call still answers 200."
            )
    assert not drifted, "\n".join(drifted)


def test_a_body_this_check_cannot_read_is_named_rather_than_passed_over() -> None:
    """Listed, not failed. A spread is a legitimate way to build a body.

    Asserted exactly, so a new one arrives with the commit that writes it rather
    than joining a growing set of sites nobody is comparing.
    """

    opaque = sorted(
        f"{body.where} {body.method} {body.path}" for body in scan() if body.keys is None
    )
    assert opaque == [], (
        "Every body the browser sends is currently a literal this check can read. "
        "The first one that is not arrives with the commit that writes it, and "
        "belongs in this list with a reason — never in silence.\n" + "\n".join(opaque)
    )


def test_the_scan_read_something() -> None:
    """`D-219`: a comparison over nothing finds no drift and passes.

    The floors are below today's counts rather than equal to them, so ordinary
    growth does not fail the check while a scan that stopped resolving does.
    """

    bodies = scan()
    keys = sum(len(body.keys or ()) for body in bodies)
    assert len(bodies) >= 20, f"only {len(bodies)} body site(s) found"
    assert keys >= 30, f"only {keys} key(s) read"
    assert sum(
        1 for fields in declared_by_models(API).values() if isinstance(fields, set) and fields
    ) >= 20
