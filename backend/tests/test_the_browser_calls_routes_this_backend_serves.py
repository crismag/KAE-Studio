"""Does every route the browser names exist on the backend in this repository?

`STUDIO-OWN-SEAM` / `D-301`. The estate's route check (`development/checks/
client_routes.py`, `D-294`/`D-297`) points *outward* — Studio's backend to
KAE-Memory and KAE-Artifacts — because those are the seams no single pipeline
holds both ends of. The seam **inside** KAE-Studio is unchecked for the same
reason: the frontend suite drives `mockServices`, so a path string is never sent
to a real router, and this backend suite exercises routes without knowing which
ones the browser names. A route renamed in `api.py` is green in both halves of
one repository's CI and a `404` in front of a person.

It lives here rather than in `development/checks/` because both ends are in this
repository and this pipeline can run them, which is the rule `D-247`/`D-251`
state.

## Where each side's truth comes from

**Served: the `@app.<verb>` decorators in `api.py`, read with `ast`.** Building
the application would be the primary record and would also take this file out of
CI — `kae_studio.api` imports `interviewer`, which imports `cie_slim`, a private
sibling the runner does not install (`AUD-033`). `CI-BLIND-3` is that mistake,
one tick old. Reading a file in its own repository, in its own suite, at the same
commit is `D-300`'s precedent and not the sibling-guessing `D-296` deleted.

The weaker reading is not merely asserted to be equivalent:
`test_the_decorators_are_what_the_application_serves` compares it against
`create_app` wherever `cie_slim` is installed, and skips where it is not.

**Called: the senders in `src/`.** `liveServices.ts` funnels everything through
`call`, `callForm`, `callArtifacts` and `sendToArtifacts`; the shell components
call `fetch` against the same base directly. Calls made *inside* those four
helpers are the pass-through, not a call site.

## What is compared

Method and path, both exact, with interpolations reduced to `{}` on the calling
side and parameters reduced to `{}` on the served side.

A trailing interpolation glued to a path segment is a **query string** and is
stripped, which is `D-297`'s finding at a different seam: in OpenAPI a query
parameter is declared beside a path and is not part of its identity. Stripping
it silently would hide a real path suffix built from a variable, so every
stripped site is registered by path below and the register is asserted exactly.

## The controls (`D-219`)

A scan that resolves nothing finds no mismatches and passes, so:

* **an unreadable call site is a failure**, not a skipped line;
* **both counts are asserted non-zero**, and so is the number of files scanned.
"""

from __future__ import annotations

import ast
import re
from dataclasses import dataclass
from pathlib import Path

import pytest

REPOSITORY = Path(__file__).resolve().parents[2]
FRONTEND = REPOSITORY / "src"
API = REPOSITORY / "backend" / "src" / "kae_studio" / "api.py"

VERBS = ("get", "post", "put", "patch", "delete")

#: The helpers every browser request goes through. `fetch` is here because the
#: shell components (`SignInGate`, `ProjectGate`, `useDeploymentStatus`) call it
#: against the same base URL without going through `liveServices`.
SENDERS = ("call", "callForm", "callArtifacts", "sendToArtifacts", "fetch")

#: `callForm` is multipart and hard-codes its verb, so its call sites carry no
#: `method:` and are not unreadable for the lack of one.
IMPLIED_METHOD = {"callForm": "POST"}

#: The base URL interpolation. `${API}/api/status` is `/api/status`; every other
#: interpolation is a hole.
BASE_NAME = "API"

#: Call sites that append a query string to a path with an interpolation rather
#: than writing a literal `?`. Registered by path, because line numbers rot, and
#: asserted exactly so that a third one fails on the commit that adds it — the
#: strip is otherwise the one place this check could narrow a real path suffix
#: into a route that happens to be served.
QUERY_SUFFIXES = {
    "/api/repositories",
    "/api/projects/{}/attention",
}

Route = tuple[str, str]


@dataclass(frozen=True)
class Call:
    where: str
    method: str | None
    path: str | None


def _normalise(path: str) -> str:
    return re.sub(r"\{[^}]*\}", "{}", path.split("?", 1)[0])


# --------------------------------------------------------------------------
# What this backend serves
# --------------------------------------------------------------------------


def served_by_decorators(source: Path) -> tuple[set[Route], list[str]]:
    """Every `@app.<verb>("/path")` in `api.py`, and every one that is not a literal."""

    module = ast.parse(source.read_text())
    routes: set[Route] = set()
    unreadable: list[str] = []
    for node in ast.walk(module):
        if not isinstance(node, ast.AsyncFunctionDef | ast.FunctionDef):
            continue
        for decorator in node.decorator_list:
            if not isinstance(decorator, ast.Call):
                continue
            func = decorator.func
            if not isinstance(func, ast.Attribute) or func.attr not in VERBS:
                continue
            if not isinstance(func.value, ast.Name) or func.value.id != "app":
                continue
            if not decorator.args or not isinstance(decorator.args[0], ast.Constant):
                unreadable.append(f"{source.name}:{decorator.lineno}")
                continue
            path = decorator.args[0].value
            if not isinstance(path, str):
                unreadable.append(f"{source.name}:{decorator.lineno}")
                continue
            routes.add((func.attr.upper(), _normalise(path)))
    return routes, unreadable


# --------------------------------------------------------------------------
# What the browser calls
# --------------------------------------------------------------------------


def _skip_string(text: str, index: int) -> int:
    """Past the string, template or comment starting at ``index``."""

    quote = text[index]
    if quote in "'\"":
        index += 1
        while index < len(text):
            if text[index] == "\\":
                index += 2
                continue
            if text[index] == quote:
                return index + 1
            index += 1
        return index
    if quote == "`":
        index += 1
        while index < len(text):
            if text[index] == "\\":
                index += 2
                continue
            if text[index] == "`":
                return index + 1
            if text.startswith("${", index):
                index = _skip_brackets(text, index + 1)
                continue
            index += 1
        return index
    if text.startswith("//", index):
        end = text.find("\n", index)
        return len(text) if end == -1 else end
    if text.startswith("/*", index):
        end = text.find("*/", index)
        return len(text) if end == -1 else end + 2
    return index + 1


def _skip_brackets(text: str, index: int) -> int:
    """Past the bracket opened at ``index``, ignoring brackets inside strings."""

    pairs = {"(": ")", "[": "]", "{": "}"}
    stack = [pairs[text[index]]]
    index += 1
    while index < len(text) and stack:
        char = text[index]
        if char in "'\"`" or text.startswith(("//", "/*"), index):
            index = _skip_string(text, index)
            continue
        if char in pairs:
            stack.append(pairs[char])
            index += 1
            continue
        if char == stack[-1]:
            stack.pop()
            index += 1
            continue
        index += 1
    return index


def _forwarding_spans(text: str) -> list[tuple[int, int]]:
    """The bodies of the sender helpers — a `fetch` inside one is the pass-through."""

    spans: list[tuple[int, int]] = []
    for match in re.finditer(r"\basync function (\w+)\s*[<(]", text):
        if match.group(1) not in SENDERS:
            continue
        body = text.find("{", match.end())
        if body != -1:
            spans.append((match.start(), _skip_brackets(text, body)))
    return spans


def _arguments(text: str, open_paren: int) -> list[str]:
    """The top-level arguments of the call whose `(` is at ``open_paren``."""

    end = _skip_brackets(text, open_paren)
    inner = text[open_paren + 1 : end - 1]
    parts: list[str] = []
    start = index = 0
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
    return [part.strip() for part in parts if part.strip()]


def _path_literal(argument: str) -> tuple[str, bool] | None:
    """The path this argument is, and whether a query interpolation was stripped.

    `None` when the argument is not a single string or template literal — which
    is a call site this check cannot read, and therefore a failure.
    """

    if not argument or argument[0] not in "'\"`":
        return None
    end = _skip_string(argument, 0)
    if argument[end:].strip():
        return None
    if argument[0] != "`":
        return argument[1:-1], False

    body = argument[1:-1]
    out = ""
    index = 0
    ends_interpolated = False
    while index < len(body):
        if body.startswith("${", index):
            close = _skip_brackets(body, index + 1)
            expression = body[index + 2 : close - 1].strip()
            out += "" if expression == BASE_NAME else "{}"
            ends_interpolated = close == len(body)
            index = close
            continue
        if body[index] == "\\":
            out += body[index : index + 2]
            index += 2
            continue
        out += body[index]
        ends_interpolated = False
        index += 1

    # Glued to a segment rather than being one, with no literal `?` anywhere to
    # cut at: the interpolation is the whole query string. A template that does
    # write `?…=${value}` needs no strip — `_normalise` cuts it there.
    if ends_interpolated and "?" not in out and out.endswith("{}") and not out[:-2].endswith("/"):
        return out[:-2], True
    return out, False


def calls_made(source: Path) -> tuple[list[Call], set[str]]:
    text = source.read_text()
    spans = _forwarding_spans(text)
    calls: list[Call] = []
    stripped: set[str] = set()

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

        where = f"{source.relative_to(REPOSITORY)}:{text.count(chr(10), 0, match.start()) + 1}"
        arguments = _arguments(text, cursor)
        if not arguments:
            calls.append(Call(where, None, None))
            continue

        read = _path_literal(arguments[0])
        if read is None:
            calls.append(Call(where, None, None))
            continue
        path, was_query = read
        if was_query:
            stripped.add(_normalise(path))

        implied = IMPLIED_METHOD.get(match.group(1))
        rest = " ".join(arguments[1:])
        if implied is not None:
            method: str | None = implied
        elif "method" not in rest:
            method = "GET"
        else:
            verb = re.search(r"method:\s*['\"](\w+)['\"]", rest)
            method = verb.group(1).upper() if verb else None

        calls.append(Call(where, method, _normalise(path)))

    return calls, stripped


def frontend_files() -> list[Path]:
    return sorted(
        path
        for pattern in ("*.ts", "*.tsx")
        for path in FRONTEND.rglob(pattern)
        if ".test." not in path.name and not path.name.endswith(".d.ts")
    )


def scan() -> tuple[list[Call], set[str], int]:
    calls: list[Call] = []
    stripped: set[str] = set()
    scanned = 0
    for path in frontend_files():
        found, suffixes = calls_made(path)
        if found:
            scanned += 1
        calls += found
        stripped |= suffixes
    return calls, stripped, scanned


# --------------------------------------------------------------------------
# The comparison
# --------------------------------------------------------------------------


def test_every_route_the_browser_names_is_one_this_backend_serves() -> None:
    routes, _ = served_by_decorators(API)
    calls, _, _ = scan()

    missing = [
        f"{call.where} calls {call.method} {call.path}, which this backend does not "
        "serve. Both halves of this repository's CI are blind to it: the frontend "
        "suite drives mockServices and the backend suite does not know which routes "
        "the browser names."
        for call in calls
        if call.method is not None
        and call.path is not None
        and (call.method, call.path) not in routes
    ]
    assert not missing, "\n".join(missing)


def test_a_call_site_this_check_cannot_read_is_a_failure() -> None:
    """`D-219`: passing over an unreadable call site is the same as not running."""

    calls, _, _ = scan()
    unreadable = [
        f"{call.where} builds its method or path from something this check cannot "
        "read, so the route it names is unverified. Make the literal visible, or "
        "route the call through one of SENDERS."
        for call in calls
        if call.method is None or call.path is None
    ]
    assert not unreadable, "\n".join(unreadable)


def test_the_scan_read_both_sides() -> None:
    """A scan that resolves nothing finds no mismatches and passes for free."""

    routes, unreadable = served_by_decorators(API)
    calls, _, scanned = scan()

    assert not unreadable, f"routes registered from a non-literal path: {unreadable}"
    assert len(routes) >= 70, f"only {len(routes)} route(s) read from {API.name}"
    assert len(calls) >= 30, f"only {len(calls)} call site(s) read from {FRONTEND}"
    assert scanned >= 2, f"only {scanned} frontend file(s) name a route"


def test_the_query_suffixes_are_registered() -> None:
    """A path built with a trailing interpolation is stripped, and never quietly.

    The strip is what stops `…/attention${query}` reporting drift on a route that
    is served (`D-297`). It is also the one place this check could narrow a real
    path suffix into a shorter route that happens to exist, so the sites are
    registered by path and asserted exactly.
    """

    _, stripped, _ = scan()
    assert stripped == QUERY_SUFFIXES


def test_the_decorators_are_what_the_application_serves() -> None:
    """The weaker reading, compared against the stronger one where it is available.

    This is the arm that skips without `cie_slim`, and it is the only one — the
    check above it runs on the runner (`CI-BLIND-3`).
    """

    pytest.importorskip("cie_slim", reason="cris-cie-slim is a private sibling repository")

    from kae_studio.api import create_app
    from kae_studio.config import Settings

    app = create_app(
        Settings.from_environment(
            {
                "KAE_MEMORY_TOKEN": "token",
                "STUDIO_PASSWORD": "password",
                "STUDIO_SESSION_SECRET": "x" * 40,
            }
        )
    )
    served = {
        (method, _normalise(route.path))
        for route in app.routes
        if hasattr(route, "methods")
        for method in route.methods - {"HEAD", "OPTIONS"}
    }
    # FastAPI's own four. They are not decorated in `api.py` and no browser code
    # names them, so the source reading cannot and need not see them.
    built_in = {
        ("GET", "/docs"),
        ("GET", "/docs/oauth2-redirect"),
        ("GET", "/openapi.json"),
        ("GET", "/redoc"),
    }
    routes, _ = served_by_decorators(API)
    assert routes == served - built_in
