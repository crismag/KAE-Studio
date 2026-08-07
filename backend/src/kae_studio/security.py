"""Who is using Studio, and what a browser is allowed to hold.

**Single operator, deliberately.** KAE has no user model — Memory has service
tokens and `actor` strings for provenance, and "a person confirmed this" is
currently an unvalidated string. Real accounts are weeks of work that would buy
nothing while one person uses this, and inventing a user model here would put
it in the wrong repository.

What this does provide is the property FR-005 actually needs: a confirmation
carries a name that someone authenticated for, rather than whatever string the
caller supplied.

The browser holds a **signed session cookie and nothing else**. No Memory token,
no provider key. That is the entire reason this backend exists rather than
letting the frontend call Memory directly.
"""

from __future__ import annotations

import hmac
from dataclasses import dataclass

from fastapi import HTTPException, Request, status
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

SESSION_COOKIE = "kae_studio_session"
SESSION_MAX_AGE = 60 * 60 * 12
"""Twelve hours. Long enough to work through a day without re-authenticating,
short enough that a forgotten browser is not indefinite access."""


@dataclass(frozen=True, slots=True)
class Operator:
    """The authenticated person. Their name reaches Memory as the actor."""

    name: str


class Sessions:
    """Issues and reads signed session cookies."""

    def __init__(self, secret: str, password: str, operator: str, required: bool = True) -> None:
        self._serializer = URLSafeTimedSerializer(secret, salt="kae-studio-session")
        self._password = password
        self._operator = operator
        self.required = required
        """False when `STUDIO_NO_AUTH` is set. Every route then runs as the
        configured operator without a cookie. See `require_operator`."""

    def anyone(self) -> Operator:
        """The operator every caller becomes when authentication is off."""

        return Operator(name=self._operator)

    def authenticate(self, password: str) -> Operator | None:
        """Check a password in constant time.

        `compare_digest` rather than `==`: a short-circuiting comparison leaks
        the length of the matching prefix through timing, and the fix costs one
        function call.
        """

        if hmac.compare_digest(password.encode(), self._password.encode()):
            return Operator(name=self._operator)
        return None

    def issue(self, operator: Operator) -> str:
        return self._serializer.dumps({"name": operator.name})

    def read(self, token: str) -> Operator | None:
        """Return the operator a cookie names, or `None` if it cannot be trusted.

        Expiry and tampering both return `None` rather than raising differently.
        A caller that could tell them apart would tell an attacker too, and
        neither case is one a browser should be given detail about.
        """

        try:
            payload = self._serializer.loads(token, max_age=SESSION_MAX_AGE)
        except (BadSignature, SignatureExpired):
            return None
        name = payload.get("name") if isinstance(payload, dict) else None
        return Operator(name=name) if isinstance(name, str) and name else None


def require_operator(request: Request) -> Operator:
    """FastAPI dependency: the signed-in operator, or 401.

    Reads the cookie rather than a header, because the browser is the only
    client and a cookie marked `HttpOnly` is unreadable by page JavaScript. A
    token in `localStorage` is one XSS away from being someone else's.
    """

    sessions: Sessions = request.app.state.sessions
    if not sessions.required:
        # `STUDIO_NO_AUTH`. Deliberately checked here rather than by omitting
        # the dependency: the routes keep declaring that they need an operator,
        # so turning authentication back on is one environment variable and not
        # a re-audit of every handler.
        #
        # What this costs, stated plainly because the flag is quiet otherwise:
        # every write route -- confirm, reject, answer -- and `/turn`, which
        # spends model tokens, are open to whoever can reach the port. The
        # `actor` recorded against a confirmation becomes a name nobody proved.
        return sessions.anyone()
    raw = request.cookies.get(SESSION_COOKIE)
    operator = sessions.read(raw) if raw else None
    if operator is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="not signed in",
        )
    return operator
