"""What this deployment is configured as.

Every value comes from the environment, and the two that are secrets have no
default — a backend that starts with a guessable session key or an empty Memory
token is one that looks configured and is not.
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass


class ConfigurationError(RuntimeError):
    """The backend cannot start as configured."""


@dataclass(frozen=True, slots=True)
class Settings:
    """Resolved configuration for one process."""

    memory_base_url: str
    memory_token: str
    """The bare token value, not the `name:token` pair.

    `KAE_API_TOKENS` on the Memory side is a list of `name:token` pairs and the
    name is the principal's label. A client sends only the token — passing the
    pair authenticates as nobody, and Memory correctly answers 401.
    """
    session_secret: str
    operator_password: str
    operator_name: str
    cors_origins: tuple[str, ...]
    host: str
    port: int
    secure_cookies: bool
    #: `lax` when the frontend is served from the same origin as this backend,
    #: which is the stronger posture and the default. `none` is required when
    #: they are separate origins — a browser will not send a `lax` cookie on a
    #: cross-site request, so a split-origin deployment simply appears to be
    #: signed out.
    cookie_samesite: str

    @classmethod
    def from_environment(cls, environ: Mapping[str, str] | None = None) -> "Settings":
        """Resolve settings, refusing what cannot be started safely.

        `KAE_MEMORY_TOKEN`, `STUDIO_SESSION_SECRET` and `STUDIO_PASSWORD` are
        required and deliberately have no fallback. A development default for
        any of them would eventually reach a deployment, because the thing that
        makes a default convenient is that nobody has to think about it.
        """

        env = os.environ if environ is None else environ

        missing = [
            name
            for name in ("KAE_MEMORY_TOKEN", "STUDIO_SESSION_SECRET", "STUDIO_PASSWORD")
            if not env.get(name, "").strip()
        ]
        if missing:
            raise ConfigurationError(
                f"missing required configuration: {', '.join(missing)}. "
                f"These have no defaults on purpose — a guessable session key or "
                f"an absent Memory token would start a backend that looks "
                f"configured and is not."
            )

        secret = env["STUDIO_SESSION_SECRET"].strip()
        if len(secret) < 32:
            raise ConfigurationError(
                "STUDIO_SESSION_SECRET must be at least 32 characters. It signs "
                "session cookies; a short one is forgeable."
            )

        # `localhost` and `127.0.0.1` are the same machine and different
        # origins. A dev server on one with the allow-list naming the other
        # produces a response the server logs as 200 and the browser refuses to
        # hand over — which reads as "backend unreachable" while the backend is
        # demonstrably answering.
        origins = tuple(
            origin.strip()
            for origin in env.get("STUDIO_CORS_ORIGINS", "").split(",")
            if origin.strip()
        )
        host = env.get("STUDIO_HOST", "127.0.0.1").strip()

        # Cookies are Secure unless a deployment says otherwise.
        #
        # This used to derive from the bind address — Secure unless bound to
        # loopback — and that is wrong for the shape we actually deploy. Behind
        # nginx the process binds to 127.0.0.1 while being served over HTTPS to
        # the internet, so the default turned the flag *off* on the one
        # deployment where it matters most. Same mistake as KAE-Memory's
        # F-001: the interface a process binds to is not the interface a user
        # reaches, and the process cannot tell.
        #
        # The failure is silent either way, which is the argument for defaulting
        # to the safe answer and making the unsafe one explicit.
        secure = env.get("STUDIO_SECURE_COOKIES", "").strip().lower()
        secure_cookies = secure not in {"0", "false", "no"} if secure else True

        # `none` needs `Secure`, and a browser rejects the pair without it.
        # Refusing here beats a deployment where sign-in silently does nothing.
        samesite = (env.get("STUDIO_COOKIE_SAMESITE", "").strip().lower() or "lax")
        if samesite not in {"lax", "strict", "none"}:
            raise ValueError("STUDIO_COOKIE_SAMESITE must be lax, strict, or none")
        if samesite == "none" and not secure_cookies:
            raise ValueError(
                "STUDIO_COOKIE_SAMESITE=none requires STUDIO_SECURE_COOKIES: a browser "
                "rejects SameSite=None without Secure, and the session would never persist"
            )

        return cls(
            cookie_samesite=samesite,
            memory_base_url=env.get("KAE_MEMORY_URL", "http://127.0.0.1:8000").rstrip("/"),
            memory_token=env["KAE_MEMORY_TOKEN"].strip(),
            session_secret=secret,
            operator_password=env["STUDIO_PASSWORD"],
            operator_name=env.get("STUDIO_OPERATOR", "operator").strip() or "operator",
            cors_origins=origins,
            host=host,
            port=int(env.get("STUDIO_PORT", "8100")),
            secure_cookies=secure_cookies,
        )

    def describe(self) -> dict[str, object]:
        """What a status endpoint may say. **Never a secret.**

        `memory_base_url` is included because an operator debugging a broken
        deployment needs to know which Memory this is talking to, and the URL
        carries no credential — the token travels in a header.
        """

        return {
            "memory_url": self.memory_base_url,
            "operator": self.operator_name,
            "secure_cookies": self.secure_cookies,
            "cookie_samesite": self.cookie_samesite,
            "cors_origins": list(self.cors_origins),
        }
