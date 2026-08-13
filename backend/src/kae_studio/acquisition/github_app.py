"""A GitHub App installation as a source credential (`D-56`, `D-57`).

**Why an App rather than a personal token.** A PAT asks somebody to understand
scopes, expiry and secret handling, and then grants whatever they happened to
tick — usually everything. An App is installed *against selected repositories*
by GitHub's own UI, so "what may KAE read" stops being a promise a settings page
makes and becomes something GitHub enforces. Nothing long-lived sits on the
host: the private key mints a JWT, the JWT mints an installation token, and that
token expires in an hour.

**Why `githubkit` and not our own.** That chain — JWT, installation token,
refresh before expiry, installation listing — is exactly the machinery this
module exists not to write. `githubkit` is `httpx`- and `pydantic`-based, which
the backend already depends on, so it costs one dependency and no runtime.

**What is deliberately not here.** No `commit`, no `branch`, no
`pull_request`. Publishing belongs to KAE-Artifacts and is off by decision
(`D-8`); an App that could write, reachable from acquisition code, would make
that decision a convention rather than a fact about the code. The read client
this hands a token to has no mutating method on it at all, and that stays true.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from .github_source import GitHubSourceClient, SourceReadError

if TYPE_CHECKING:  # pragma: no cover - typing only
    import httpx


class AppUnavailable(RuntimeError):
    """The App is configured and could not be used, in one sentence."""


class GitHubApp:
    """Mint installation tokens for a registered GitHub App.

    Constructed only where an App id and private key are both configured. A
    deployment with neither builds nothing and says so — an App object holding
    no credential would push the "is this configured?" question out to every
    call site, and one of them would eventually forget to ask.
    """

    def __init__(
        self,
        app_id: str,
        private_key: str,
        *,
        api_base: str = "https://api.github.com",
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        if not app_id.strip() or not private_key.strip():
            raise ValueError("a GitHub App needs both an id and a private key")
        self._app_id = app_id.strip()
        self._private_key = private_key
        self._api_base = api_base.rstrip("/")
        self._transport = transport

    def _github(self, installation_id: int | None = None) -> Any:
        # Imported here rather than at module scope. The import is what turns a
        # missing dependency into an error, and a deployment that has never
        # configured an App should not fail to start over a library it will
        # never call.
        try:
            from githubkit import AppAuthStrategy, GitHub
        except ImportError as error:  # pragma: no cover - the dependency is declared
            raise AppUnavailable(
                "githubkit is not installed, so GitHub App authentication is unavailable"
            ) from error

        auth = AppAuthStrategy(self._app_id, self._private_key)
        if installation_id is not None:
            auth = auth.as_installation(installation_id)
        # Body validation off, deliberately. `githubkit` is here for the auth
        # chain — the hard, protocol-shaped part — and not to become Studio's
        # data model. Validated, GitHub adding or renaming a field on an
        # unrelated part of the installation schema raises a pydantic error on a
        # read of three fields we take defensively anyway.
        return GitHub(
            auth,
            base_url=self._api_base,
            transport=self._transport,
            rest_api_validate_body=False,
        )

    def installations(self) -> list[dict[str, Any]]:
        """Where this App has been installed, and how widely.

        `repository_selection` is carried through unchanged. *All repositories*
        and *only selected ones* are a different answer to "what may KAE read",
        and collapsing them to a count would lose the distinction a person made
        deliberately at install time.
        """

        try:
            # Held in a local, not chained. `githubkit`'s REST namespaces keep
            # their client by **weak** reference, so
            # `self._github().rest.apps...` lets it be collected inside the
            # expression and raises *"GitHub client has already been
            # collected"*. The auth flow holds its client strongly, which is why
            # `source_client` needs no such care — checked, not assumed.
            github = self._github()
            rows = github.rest.apps.list_installations().json()
        except Exception as error:  # noqa: BLE001 - one answer for any failure
            raise AppUnavailable(_why(error)) from None

        found = []
        for row in rows if isinstance(rows, list) else []:
            if not isinstance(row, dict) or not row.get("id"):
                continue
            account = row.get("account") or {}
            found.append(
                {
                    "installation_id": int(row["id"]),
                    # An installation belongs to a user or an organisation, and
                    # the account is how somebody recognises which of theirs it
                    # is. Absent stays empty rather than becoming "unknown".
                    "account": str(account.get("login", "") or ""),
                    "repository_selection": str(row.get("repository_selection", "") or ""),
                }
            )
        return found

    def source_client(self, installation_id: int) -> GitHubSourceClient:
        """A read-only client authenticated as this installation.

        No token is extracted. `githubkit`'s strategy **is** an `httpx.Auth`: it
        signs a JWT with the private key, exchanges it at
        `/app/installations/{id}/access_tokens`, caches the result until expiry
        and renews it. Reading a token out of it once and holding it in a header
        would reintroduce exactly the hour-long expiry problem the strategy
        exists to solve (`D-57`).
        """

        try:
            from githubkit import AppAuthStrategy
        except ImportError as error:  # pragma: no cover - the dependency is declared
            raise AppUnavailable(
                "githubkit is not installed, so GitHub App authentication is unavailable"
            ) from error

        strategy = AppAuthStrategy(self._app_id, self._private_key).as_installation(
            installation_id
        )
        return GitHubSourceClient(
            strategy.get_auth_flow(self._github(installation_id)),
            api_base=self._api_base,
            transport=self._transport,
            installation=True,
        )


def _why(error: Exception) -> str:
    """GitHub's failure in terms an operator can act on.

    A 401 from the App endpoints means the key and the id disagree — which is
    the mistake somebody actually makes, and it is worth naming rather than
    reporting the status code back.
    """

    status = getattr(getattr(error, "response", None), "status_code", None)
    if status in (401, 403):
        return (
            "GitHub refused this App's credentials. The App id and the private key "
            "must belong to the same App, and the key must be the full PEM."
        )
    if status == 404:
        return "This App has no installation GitHub will report."
    if isinstance(error, SourceReadError):  # pragma: no cover - defensive
        return str(error)
    return f"GitHub App authentication failed: {type(error).__name__}"
