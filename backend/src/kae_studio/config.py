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

        # Cookies default to Secure unless we are demonstrably on loopback.
        # Getting this backwards means a session cookie travels in plaintext,
        # and the failure is silent because everything still works.
        secure = env.get("STUDIO_SECURE_COOKIES", "").strip().lower()
        secure_cookies = secure in {"1", "true", "yes"} if secure else host != "127.0.0.1"

        return cls(
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
            "cors_origins": list(self.cors_origins),
        }
