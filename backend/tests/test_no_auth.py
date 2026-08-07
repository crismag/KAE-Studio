"""`STUDIO_NO_AUTH` opens every route, and nothing else does.

Added for browser inspection tooling that cannot drive a password form. The
risk is not the flag, it is the flag arriving somewhere nobody meant it to — so
what these tests protect is the *default*: authentication stays required unless
the variable is set to a value a person clearly typed on purpose.

The other half is visibility. An unauthenticated deployment reports itself at
`/api/status`, because the alternative is that the only way to discover a Studio
is open is to find it open.
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from kae_studio.config import Settings
from kae_studio.security import Operator, Sessions, require_operator

BASE = {
    "KAE_MEMORY_TOKEN": "token",
    "STUDIO_PASSWORD": "password",
    "STUDIO_SESSION_SECRET": "x" * 40,
}


def settings(**overrides: str) -> Settings:
    return Settings.from_environment({**BASE, **overrides})


class TestTheDefaultIsClosed:
    def test_authentication_is_required_when_nothing_is_set(self) -> None:
        assert settings().authentication_required is True

    @pytest.mark.parametrize("value", ["", "0", "false", "no", "off", "maybe", " "])
    def test_only_a_deliberate_value_disables_it(self, value: str) -> None:
        """Anything ambiguous means required.

        A typo'd flag must fail *closed*. `STUDIO_NO_AUTH=flase` leaving a
        deployment open would be the same class of fault as F-001: a
        misconfiguration that produces no error and no visible difference.
        """

        assert settings(STUDIO_NO_AUTH=value).authentication_required is True

    @pytest.mark.parametrize("value", ["1", "true", "TRUE", "yes", "on", " on "])
    def test_the_spellings_people_write(self, value: str) -> None:
        assert settings(STUDIO_NO_AUTH=value).authentication_required is False


class TestThePasswordRequirement:
    def test_a_password_is_required_normally(self) -> None:
        with pytest.raises(Exception, match="STUDIO_PASSWORD"):
            Settings.from_environment({k: v for k, v in BASE.items() if k != "STUDIO_PASSWORD"})

    def test_no_password_is_needed_when_authentication_is_off(self) -> None:
        """Requiring a secret that is never checked teaches nothing."""

        without = {k: v for k, v in BASE.items() if k != "STUDIO_PASSWORD"}
        resolved = Settings.from_environment({**without, "STUDIO_NO_AUTH": "1"})
        assert resolved.authentication_required is False

    def test_the_memory_token_is_still_required(self) -> None:
        """This flag opens Studio's front door, not its credential store.

        Studio still reaches Memory with a bearer token, and an open Studio
        without one is a Studio that cannot read anything.
        """

        without = {k: v for k, v in BASE.items() if k != "KAE_MEMORY_TOKEN"}
        with pytest.raises(Exception, match="KAE_MEMORY_TOKEN"):
            Settings.from_environment({**without, "STUDIO_NO_AUTH": "1"})


class _Request:
    """Enough of a request for the dependency: an app state and cookies."""

    def __init__(self, sessions: Sessions) -> None:
        self.app = type("App", (), {"state": type("S", (), {"sessions": sessions})()})()
        self.cookies: dict[str, str] = {}


def sessions(required: bool) -> Sessions:
    return Sessions(secret="x" * 40, password="password", operator="dev", required=required)


class TestTheDependency:
    def test_no_cookie_is_rejected_when_required(self) -> None:
        with pytest.raises(HTTPException) as raised:
            require_operator(_Request(sessions(required=True)))
        assert raised.value.status_code == 401

    def test_no_cookie_is_accepted_when_not_required(self) -> None:
        assert require_operator(_Request(sessions(required=False))) == Operator(name="dev")

    def test_the_operator_name_still_reaches_memory(self) -> None:
        """Provenance survives the flag.

        A confirmation recorded while authentication is off still carries the
        configured operator name — unproven, but not anonymous, and not a
        different shape of record that later analysis has to special-case.
        """

        assert require_operator(_Request(sessions(required=False))).name == "dev"


class TestItSaysSo:
    def test_status_reports_an_open_deployment(self) -> None:
        assert settings(STUDIO_NO_AUTH="1").describe()["authentication"] == "disabled"

    def test_status_reports_a_closed_one(self) -> None:
        assert settings().describe()["authentication"] == "required"

    def test_the_password_is_never_in_the_description(self) -> None:
        assert "password" not in str(settings().describe()).lower()
