"""What this deployment is configured as.

Every value comes from the environment, and the two that are secrets have no
default — a backend that starts with a guessable session key or an empty Memory
token is one that looks configured and is not.
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass


def _is_true(value: str) -> bool:
    """Accept the spellings people actually write in a unit file or .env."""

    return value.strip().lower() in {"1", "true", "yes", "on"}


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
    #: Where KAE-Artifacts is, or empty when this deployment has none.
    #:
    #: Empty is a supported configuration rather than a broken one: Studio is
    #: useful without artifact generation, and a backend that refused to start
    #: without it would make every deployment depend on a service most of them
    #: do not yet run. The routes report the gap; the UI renders it.
    artifacts_base_url: str
    #: A bearer token for KAE-Artifacts, if it requires one. Never reaches a
    #: browser — like the Memory token, it lives on this side of the boundary.
    artifacts_token: str
    #: The **read-only** GitHub credential acquisition uses. Deliberately
    #: separate from any publishing credential: source access and destination
    #: access are separate grants, and sharing one token would mean connecting a
    #: source silently granted a destination.
    github_source_token: str
    #: A registered GitHub App, which is how somebody is *meant* to connect a
    #: repository (`D-56`): they install KAE against the repositories they
    #: choose, GitHub enforces the selection, and nothing long-lived sits here —
    #: the key mints a JWT, the JWT mints a token that expires in an hour.
    github_app_id: str
    github_app_private_key: str
    #: Which installation to read as. Optional: with one installation there is
    #: nothing to choose, and asking somebody for an id they would have to find
    #: in a URL is the kind of configuration an App exists to remove.
    github_app_installation_id: str
    session_secret: str
    operator_password: str
    operator_name: str
    #: False when `STUDIO_NO_AUTH` is set, which opens every route. Kept as a
    #: setting rather than read at the call site so `describe()` can report it:
    #: an unauthenticated deployment should be visible from `/api/status`, not
    #: discoverable only by trying it.
    authentication_required: bool
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

        # `STUDIO_NO_AUTH` exists for browser tooling that cannot sign in. It
        # drops the password requirement with it -- requiring a password that
        # is never checked would be a configuration step that teaches nothing.
        authentication_required = not _is_true(env.get("STUDIO_NO_AUTH", ""))

        required = ["KAE_MEMORY_TOKEN", "STUDIO_SESSION_SECRET"]
        if authentication_required:
            required.append("STUDIO_PASSWORD")
        missing = [name for name in required if not env.get(name, "").strip()]
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
            # No default. A guessed URL would make "artifacts unreachable" the
            # symptom of a deployment that never intended to run them, which is
            # a different problem wearing the same error message.
            artifacts_base_url=env.get("KAE_ARTIFACTS_URL", "").strip().rstrip("/"),
            artifacts_token=env.get("KAE_ARTIFACTS_TOKEN", "").strip(),
            github_source_token=env.get("STUDIO_GITHUB_SOURCE_TOKEN", "").strip(),
            github_app_id=env.get("STUDIO_GITHUB_APP_ID", "").strip(),
            # Not stripped: a PEM's trailing newline is part of it, and a key
            # that fails to parse for whitespace produces a 401 that reads as
            # "GitHub refused these credentials" and sends somebody to check the
            # wrong thing entirely.
            github_app_private_key=env.get("STUDIO_GITHUB_APP_PRIVATE_KEY", ""),
            github_app_installation_id=env.get("STUDIO_GITHUB_APP_INSTALLATION_ID", "").strip(),
            session_secret=secret,
            operator_password=env.get("STUDIO_PASSWORD", ""),
            authentication_required=authentication_required,
            operator_name=env.get("STUDIO_OPERATOR", "operator").strip() or "operator",
            cors_origins=origins,
            host=host,
            port=int(env.get("STUDIO_PORT", "8100")),
            secure_cookies=secure_cookies,
        )

    @property
    def github_app(self) -> bool:
        """Both halves, or neither. An id without a key authenticates nothing."""

        return bool(self.github_app_id and self.github_app_private_key.strip())

    @property
    def github_credential(self) -> str:
        """Which credential acquisition will actually use."""

        if self.github_app:
            return "app_installation"
        return "personal_token" if self.github_source_token else "none"

    def describe(self) -> dict[str, object]:
        """What a status endpoint may say. **Never a secret.**

        `memory_base_url` is included because an operator debugging a broken
        deployment needs to know which Memory this is talking to, and the URL
        carries no credential — the token travels in a header.
        """

        return {
            "authentication": "required" if self.authentication_required else "disabled",
            "memory_url": self.memory_base_url,
            "artifacts_url": self.artifacts_base_url,
            "artifacts": "configured" if self.artifacts_base_url else "not configured",
            # Whether, not what. An operator needs to know a source credential
            # exists; nobody needs it echoed back.
            "github_source": "configured" if self.github_source_token else "not configured",
            "github_app": "configured" if self.github_app else "not configured",
            # **Which** of the two is actually in use. Both configured is not an
            # error and the App wins; a deployment that silently preferred one
            # would be indistinguishable from one that ignored the other, and
            # the person debugging it has no way to tell from the outside.
            "github_credential": self.github_credential,
            # Stated at the status endpoint because the setup wizard offers a
            # Sources step, and a deployment where that step cannot lead
            # anywhere should say so somewhere an operator looks.
            "source_analysis": "planned",
            "operator": self.operator_name,
            "secure_cookies": self.secure_cookies,
            "cookie_samesite": self.cookie_samesite,
            "cors_origins": list(self.cors_origins),
        }
