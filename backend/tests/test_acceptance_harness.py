"""The acceptance harness runs against the deployment it is pointed at (`D-64`).

`G4` — run the journeys — sat blocked on `STUDIO_PASSWORD` for a whole run of
this loop, and the blocker was stale. `journey.py` exited before doing anything
if the variable was unset and then signed in unconditionally, so it could not run
against a host with `STUDIO_NO_AUTH` on. That is the host: `/api/status` reports
`authentication: disabled` and every route the harness uses answers `200`
unauthenticated.

These guard the decision rather than the scenarios. What the scenarios prove is a
person's judgement plus a handful of mechanical checks, and neither belongs in a
unit test. What belongs here is that the harness asks the deployment before
deciding it cannot start — and that it still refuses where a password is genuinely
required, which is the case the original check existed for.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from typing import Any

import pytest

HARNESS = Path(__file__).resolve().parents[2] / "e2e" / "acceptance" / "journey.py"


@pytest.fixture
def journey(monkeypatch: pytest.MonkeyPatch) -> Any:
    """The harness, imported as a module rather than run as a script."""

    if not HARNESS.exists():  # pragma: no cover - the file is in the repository
        pytest.skip(f"no acceptance harness at {HARNESS}")
    spec = importlib.util.spec_from_file_location("journey_under_test", HARNESS)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules["journey_under_test"] = module
    spec.loader.exec_module(module)
    yield module
    sys.modules.pop("journey_under_test", None)


def responses(journey: Any, monkeypatch: pytest.MonkeyPatch, status: dict[str, Any]) -> list[str]:
    """Record every path the harness calls, answering `/api/status` with `status`."""

    called: list[str] = []

    def call(path: str, body: object | None = None, method: str = "") -> object:
        called.append(path)
        if path == "/api/status":
            return status
        return {}

    monkeypatch.setattr(journey, "call", call)
    return called


class TestItAsksBeforeItRefuses:
    def test_a_deployment_with_authentication_disabled_is_not_signed_in_to(
        self, journey: Any, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """The whole of `D-64`. This raised `SystemExit` at import-time guard."""

        called = responses(journey, monkeypatch, {"authentication": "disabled"})
        monkeypatch.setattr(journey, "PASSWORD", "")

        journey.sign_in()

        assert called == ["/api/status"]
        assert "/api/session" not in called

    def test_a_deployment_that_requires_it_and_has_no_password_still_refuses(
        self, journey: Any, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """The check is moved, not removed."""

        responses(journey, monkeypatch, {"authentication": "required"})
        monkeypatch.setattr(journey, "PASSWORD", "")

        with pytest.raises(SystemExit) as raised:
            journey.sign_in()

        assert "STUDIO_PASSWORD" in str(raised.value)

    def test_a_deployment_that_requires_it_is_signed_in_to(
        self, journey: Any, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        called = responses(journey, monkeypatch, {"authentication": "required"})
        monkeypatch.setattr(journey, "PASSWORD", "hunter2")

        journey.sign_in()

        assert called == ["/api/status", "/api/session"]

    def test_a_refused_password_is_never_swallowed(
        self, journey: Any, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """The case the original check existed to catch.

        Making `sign_in` tolerate a `401` would have been the smaller change and
        would pass on a deployment that requires authentication and rejects the
        password it was given — a harness reporting success against a host it
        never entered.
        """

        def call(path: str, body: object | None = None, method: str = "") -> object:
            if path == "/api/status":
                return {"authentication": "required"}
            raise RuntimeError("401 /api/session: incorrect password")

        monkeypatch.setattr(journey, "call", call)
        monkeypatch.setattr(journey, "PASSWORD", "wrong")

        with pytest.raises(RuntimeError, match="401"):
            journey.sign_in()

    def test_an_unreadable_status_is_treated_as_requiring_authentication(
        self, journey: Any, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Anything that is not an explicit `disabled` is not a licence to skip.

        A status endpoint that answered something unexpected would otherwise
        make the harness quietly stop signing in, and a run against a protected
        deployment would fail later and more confusingly.
        """

        responses(journey, monkeypatch, {})
        monkeypatch.setattr(journey, "PASSWORD", "")

        assert journey.authentication_required() is True
        with pytest.raises(SystemExit):
            journey.sign_in()
