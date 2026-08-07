"""A session cookie is Secure unless a deployment says otherwise.

This defaulted from the bind address — Secure unless bound to loopback — which
is backwards for the deployment shape that matters. Behind nginx the process
binds to `127.0.0.1` while being served over HTTPS to the internet, so the flag
defaulted *off* exactly where it needed to be on.

Same root cause as KAE-Memory's F-001: the interface a process binds to is not
the interface a user reaches, and the process cannot tell the difference. Found
while preparing that deployment, before making it.
"""

from __future__ import annotations

import pytest

from kae_studio.config import Settings

BASE = {
    "KAE_MEMORY_TOKEN": "token",
    "STUDIO_PASSWORD": "password",
    "STUDIO_SESSION_SECRET": "x" * 40,
}


def settings(**overrides: str) -> Settings:
    return Settings.from_environment({**BASE, **overrides})


class TestSecureByDefault:
    def test_the_proxied_shape_is_secure(self) -> None:
        """Bound to loopback, served over HTTPS. The case that was wrong."""

        assert settings(STUDIO_HOST="127.0.0.1").secure_cookies is True

    def test_an_exposed_bind_is_secure(self) -> None:
        assert settings(STUDIO_HOST="0.0.0.0").secure_cookies is True

    def test_no_host_at_all_is_secure(self) -> None:
        assert settings().secure_cookies is True


class TestTheOptOutIsExplicit:
    @pytest.mark.parametrize("value", ["0", "false", "no", "FALSE"])
    def test_it_can_be_turned_off_deliberately(self, value: str) -> None:
        """Local development over plain HTTP needs it off, and has to say so."""

        assert settings(STUDIO_SECURE_COOKIES=value).secure_cookies is False

    @pytest.mark.parametrize("value", ["1", "true", "yes", "anything else"])
    def test_everything_else_leaves_it_on(self, value: str) -> None:
        assert settings(STUDIO_SECURE_COOKIES=value).secure_cookies is True


class TestSameSite:
    """`lax` protects against CSRF and blocks split-origin deployments.

    Both are true, so this is a deployment choice rather than a default anyone
    can pick correctly for everyone. Same-origin keeps `lax`; a frontend on a
    different host has to say `none`, and a browser then requires `Secure`.
    """

    def test_it_defaults_to_lax(self) -> None:
        assert settings().cookie_samesite == "lax"

    def test_none_is_allowed_with_secure(self) -> None:
        assert (
            settings(STUDIO_COOKIE_SAMESITE="none", STUDIO_SECURE_COOKIES="1").cookie_samesite
            == "none"
        )

    def test_none_without_secure_is_refused(self) -> None:
        """A browser rejects the pair, so the session never persists and sign-in
        appears to do nothing. Failing at startup beats debugging that."""

        with pytest.raises(ValueError, match="requires STUDIO_SECURE_COOKIES"):
            settings(STUDIO_COOKIE_SAMESITE="none", STUDIO_SECURE_COOKIES="0")

    def test_nonsense_is_refused(self) -> None:
        with pytest.raises(ValueError, match="lax, strict, or none"):
            settings(STUDIO_COOKIE_SAMESITE="sometimes")
