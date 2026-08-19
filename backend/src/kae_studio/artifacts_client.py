"""The only thing in Studio that talks to KAE-Artifacts.

Same shape as `memory_client.py`, and for the same reason: one place that knows
where the service is and how it authenticates, one place to look when a call is
refused.

**Studio does not reimplement generation, approval or publication rules.** It
does not decide whether a plan entry is generatable, whether an approval is
stale, or whether a branch moved. Those are KAE-Artifacts' answers, and this
carries them to the UI unchanged. A Studio-side approval flag would be exactly
the model KAE-Artifacts was built to replace: a boolean anything can set, saying
somebody agreed and nothing about what they agreed to.

## Errors are carried, not flattened

KAE-Artifacts returns `{"error": {"code", "message", "remedy", "retryable"}}`.
That envelope reaches the browser intact, because the UI branches on `code` —
`stale_base` means "preview again", `rate_limited` means "wait", and
`publisher_not_configured` means "an operator has a setting to fill in". Flatten
them all to 500 and the interface can only apologise.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx


class ArtifactsUnavailable(RuntimeError):
    """KAE-Artifacts could not be reached.

    Distinct from a refusal: nothing is known about the request's outcome, so
    the UI must not report success or failure of the underlying action — only
    that the service could not be asked.
    """


@dataclass(frozen=True, slots=True)
class ArtifactsRefused(RuntimeError):
    """KAE-Artifacts refused, and the refusal is the answer.

    Carries the whole typed body. A 409 `stale_base` and a 409
    `package_mismatch` are both conflicts and have different remedies, and a
    client that only saw "409" would have to guess which.
    """

    status_code: int
    code: str
    message: str
    remedy: str = ""
    retryable: bool = False

    def __str__(self) -> str:
        return self.message

    @property
    def body(self) -> dict[str, Any]:
        return {
            "error": {
                "code": self.code,
                "message": self.message,
                "remedy": self.remedy,
                "retryable": self.retryable,
            }
        }


class ArtifactsClient:
    """A bounded client over the KAE-Artifacts v1 API."""

    def __init__(self, base_url: str, token: str = "", timeout: float = 30.0) -> None:
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        self._client = httpx.AsyncClient(base_url=base_url, timeout=timeout, headers=headers)

    async def aclose(self) -> None:
        await self._client.aclose()

    async def _send(self, method: str, path: str, **kwargs: Any) -> httpx.Response:
        """Reach KAE-Artifacts and map its refusals, without reading the body.

        Split out of `_request` for the one route that does not answer JSON
        (`download_archive`). A second client for it would be a second copy of
        the refusal mapping, and a refusal that lost its code on one route is
        exactly what the typed envelope exists to prevent.
        """

        try:
            response = await self._client.request(method, path, **kwargs)
        except httpx.HTTPError as error:
            raise ArtifactsUnavailable(
                f"KAE-Artifacts at {self._client.base_url} could not be reached: {error}"
            ) from error

        if response.status_code >= 400:
            raise _refusal(response)
        return response

    async def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        response = await self._send(method, path, **kwargs)
        if not response.content:
            return None
        try:
            return response.json()
        except ValueError as error:
            raise ArtifactsUnavailable(
                "KAE-Artifacts returned a body that is not JSON"
            ) from error

    # -- discovery ---------------------------------------------------------

    async def health(self) -> Any:
        """Whether the service answers, for `/api/status` to report (`D-334`).

        Configured and reachable are different states, and Studio could only
        report the first: `artifacts` in the status body is a URL string being
        non-empty, while `memory_reachable` beside it is the answer to a call.
        A panel read the weaker one and promised a package on a deployment whose
        KAE-Artifacts was stopped.
        """

        return await self._request("GET", "/health")

    async def profiles(self) -> Any:
        return await self._request("GET", "/v1/profiles")

    async def artifact_types(self) -> Any:
        return await self._request("GET", "/v1/artifact-types")

    async def publishers(self) -> Any:
        """What this deployment can publish to, asked of the adapters.

        Reported to the UI rather than hard-coded there. A destination that is
        merely unconfigured must not look like a destination that does not
        exist — one sends an operator to their settings, the other to an issue
        tracker.
        """

        return await self._request("GET", "/v1/publishers")

    # -- planning ----------------------------------------------------------

    async def create_plan(self, generation_input: dict[str, Any], profile: str) -> Any:
        return await self._request(
            "POST", "/v1/artifact-plans", json={"input": generation_input, "profile": profile}
        )

    async def plan(self, plan_id: str) -> Any:
        return await self._request("GET", f"/v1/artifact-plans/{plan_id}")

    async def edit_plan(self, plan_id: str, edits: list[dict[str, Any]]) -> Any:
        return await self._request(
            "PATCH", f"/v1/artifact-plans/{plan_id}", json={"edits": edits}
        )

    # -- generation --------------------------------------------------------

    async def generate(
        self, generation_input: dict[str, Any], plan_id: str, idempotency_key: str
    ) -> Any:
        return await self._request(
            "POST",
            "/v1/generation-runs",
            json={
                "input": generation_input,
                "plan_id": plan_id,
                "idempotency_key": idempotency_key,
            },
        )

    async def run(self, run_id: str) -> Any:
        return await self._request("GET", f"/v1/generation-runs/{run_id}")

    async def artifact(self, artifact_id: str) -> Any:
        return await self._request("GET", f"/v1/artifacts/{artifact_id}")

    async def package(self, package_id: str) -> Any:
        return await self._request("GET", f"/v1/packages/{package_id}")

    async def download_archive(self, package_id: str) -> bytes:
        """The bytes a `download` publication produced.

        **Not durable.** KAE-Artifacts holds the archive on the publisher
        instance for the life of its process, so this answers until a restart
        and then refuses with `download_not_available` — a hand-back, not a
        record. The record is the publication.
        """

        response = await self._send("GET", f"/v1/packages/{package_id}/download")
        return response.content

    async def validate(self, package_id: str) -> Any:
        return await self._request("POST", "/v1/validations", json={"package_id": package_id})

    # -- preview, approval, publication ------------------------------------

    async def preview(self, package_id: str, destination: dict[str, Any]) -> Any:
        return await self._request(
            "POST", "/v1/previews", json={"package_id": package_id, "destination": destination}
        )

    async def approve(self, preview_id: str, approver_ref: str) -> Any:
        return await self._request(
            "POST", "/v1/approvals", json={"preview_id": preview_id, "approver_ref": approver_ref}
        )

    async def publish(
        self,
        package_id: str,
        destination: dict[str, Any],
        approval_id: str,
        idempotency_key: str,
        caller: str,
    ) -> Any:
        return await self._request(
            "POST",
            "/v1/publications",
            json={
                "package_id": package_id,
                "destination": destination,
                "approval_id": approval_id,
                "idempotency_key": idempotency_key,
                "caller": caller,
            },
        )

    async def publication(self, publication_id: str) -> Any:
        return await self._request("GET", f"/v1/publications/{publication_id}")

    async def provenance(self, publication_id: str) -> Any:
        return await self._request("GET", f"/v1/publications/{publication_id}/provenance")


def _refusal(response: httpx.Response) -> ArtifactsRefused:
    """Read the typed body, and cope when there isn't one.

    A 422 from FastAPI's own validation has `detail`, not `error` — so a
    malformed request would otherwise arrive as a refusal with an empty code,
    and the UI would have nothing to say.
    """

    try:
        body = response.json()
    except ValueError:
        body = {}

    error = body.get("error") if isinstance(body, dict) else None
    if isinstance(error, dict):
        return ArtifactsRefused(
            status_code=response.status_code,
            code=str(error.get("code", "unknown")),
            message=str(error.get("message", "")),
            remedy=str(error.get("remedy", "")),
            retryable=bool(error.get("retryable", False)),
        )

    detail = body.get("detail") if isinstance(body, dict) else None
    return ArtifactsRefused(
        status_code=response.status_code,
        code="invalid_request" if response.status_code < 500 else "artifacts_error",
        message=str(detail) if detail else f"KAE-Artifacts returned {response.status_code}",
        remedy="Check the request against the KAE-Artifacts API." if detail else "",
    )


__all__ = ["ArtifactsClient", "ArtifactsRefused", "ArtifactsUnavailable"]
