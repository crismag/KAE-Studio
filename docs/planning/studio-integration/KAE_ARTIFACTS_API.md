# The actual KAE-Artifacts API

Status: **resolved.** `ARCHITECTURE_AND_CONTRACTS.md` sketched an `ArtifactClient`
and said *"adapt names to the actual KAE-Artifacts API"*. This is that API. It is
implemented, covered by 244 offline tests plus a live GitHub proof, and callable
both over HTTP and in process.

Date: 2026-08-08

Everything the rest of this package specifies about approval binding, preview
concurrency, idempotency and provenance turned out to be right. What follows is
the concrete surface, so STI-5 through STI-7 can be built against names rather
than against a sketch.

## The sketch, resolved

| `ArtifactClient` method | Actual route |
| --- | --- |
| `listProfiles()` | `GET /v1/profiles`, `GET /v1/profiles/{id}` |
| — | `GET /v1/artifact-types` |
| `createPlan(input)` | `POST /v1/artifact-plans` |
| — | `GET /v1/artifact-plans/{id}`, `PATCH /v1/artifact-plans/{id}` |
| `startGeneration(input, key)` | `POST /v1/generation-runs` |
| `getGenerationRun(runId)` | `GET /v1/generation-runs/{id}` |
| — | `GET /v1/artifacts/{id}` — descriptor **and content** |
| `getPackage(packageId)` | `GET /v1/packages/{id}`; `POST /v1/packages` assembles one |
| — | `POST /v1/validations` |
| `previewPublication(input)` | `POST /v1/previews`, `GET /v1/previews/{id}` |
| `approvePublication(input, key)` | `POST /v1/approvals`, `GET /v1/approvals/{id}` |
| `publish(input, key)` | `POST /v1/publications` |
| `getPublication(publicationId)` | `GET /v1/publications/{id}` |
| — | `GET /v1/publications/{id}/provenance` |
| — | `GET /v1/publishers` |

Three additions worth noting, because they change what a Studio screen can do:

**Plans are readable and editable resources.** `PATCH` accepts changes to
`logical_path`, `selected` and `options` per artifact type. Generation takes a
`plan_id`, **not** a list of artifact types — which is what makes STI-5's
"allow supported plan edits without losing logical paths" true rather than
aspirational. An earlier build reduced the plan to types and recomputed default
paths, so a user who moved a file got it back where it started, silently.

**Artifacts return their content.** A user can read a generated document before
agreeing to publish it, without downloading a package.

**Packaging is its own capability.** `POST /v1/packages` assembles from chosen
artifact ids, so publishing a subset or combining two runs into one review does
not require regenerating.

## Plan readiness — the three states STI-5 must render

Each plan entry carries one:

| Readiness | Generatable | What the UI must do |
| --- | --- | --- |
| `ready` | yes | selected by default, editable |
| `needs_review` | yes | selected, flagged — producible from unconfirmed material |
| `blocked` | **no** | show the reason, and make resolving it the next action |

**A blocked entry is not an error.** `github.md — No repository has been chosen
for this project.` is the system declining to write a document with a plausible
guess where the repository goes. Selecting it does not override this: the entry
carries `generatable: false` and generation skips it.

This is the single most product-relevant behaviour in the whole API. It is what
makes a plan an argument the user can have *before* generation rather than after
reading ten wrong files, and a UI that hides blocked rows discards it.

## Preview — what STI-6 receives

`POST /v1/previews` reads the destination and mutates nothing. Every field
`ARCHITECTURE_AND_CONTRACTS.md` asked for is present:

```json
{
  "preview_id": "prv_…",
  "package_id": "pkg_…",
  "package_checksum": "sha256:…",
  "checksum": "sha256:…",
  "destination": {"type": "github", "target": "owner/repo",
                  "target_path": "docs/generated", "mode": "pull_request",
                  "base_branch": "main"},
  "base_token": "<resolved base SHA>",
  "has_changes": true,
  "changes": [
    {"path": "docs/generated/AGENTS.md", "outcome": "add",
     "existing_identity": "", "new_checksum": "sha256:…", "size_bytes": 812},
    {"path": "docs/generated/REQUIREMENTS.md", "outcome": "modify",
     "existing_identity": "<blob sha>", "new_checksum": "sha256:…",
     "size_bytes": 1904}
  ]
}
```

`outcome` is `add`, `modify`, `unchanged` or `conflict`. Render the distinction:
a user approving four modifications is agreeing to overwrite four files, and a
list of filenames never told them so.

When `has_changes` is false, show "nothing to publish" and offer no publish
action. The publisher declines to open an empty pull request regardless — an
empty PR is noise, and noise teaches reviewers to stop reading pull requests.

**Deletion is not supported.** No `outcome` produces one. The earlier document
allowed for "files added/modified/deleted where deletion is permitted"; it is not
permitted, and inferring a deletion from a path's absence is exactly how
unrelated work gets destroyed.

## Approval — evidence, not a flag

`POST /v1/approvals` takes `{preview_id, approver_ref}` and returns an approval
binding the package checksum, the preview checksum, the destination, the mode and
the base token, with a **twelve-hour expiry**.

`POST /v1/publications` takes `{package_id, destination, approval_id,
idempotency_key}`. There is no `approved` boolean to set.

**Studio must not keep its own approval state.** A Studio-side "the user clicked
approve" flag is precisely the model this replaced: it says somebody agreed and
nothing about what they agreed to.

Authorization is separate and evaluated first, exactly as this package requires —
a user may approve something the deployment is not permitted to publish, and that
fails with `403` rather than being silently allowed by the approval.

## Failure states, mapped to the UI vocabulary

The package lists the states the UI should render. Here is which code produces
each. Every body is
`{"error": {"code", "message", "remedy", "retryable"}}` — branch on `code`,
render `message` and `remedy`, and use `retryable` to decide whether a retry
control appears at all.

| UI state | Code | Status |
| --- | --- | --- |
| stale publication preview | `stale_base`, `stale_preview` | 409 |
| approval required | `approval_required` | 409 |
| approval mismatch | `package_mismatch`, `preview_mismatch`, `destination_mismatch` | 409 |
| approval expired | `expired` | 409 |
| authorization required | `not_authorized` | 403 |
| validation blocked | `publishable: false` with findings | 200 |
| provider conflict | `provider_rejected` | 502 |
| provider rate limit | `rate_limited` | **429**, `retryable: true` |
| destination unconfigured | `publisher_not_configured` | **501** |
| retryable failure | any body with `retryable: true` | — |
| idempotency conflict | `idempotency_conflict` | 409 |

Two that need care:

**`provider_unavailable` (502) is `retryable: false`.** A 5xx after a mutation
request may mean the write landed and the response was lost. The UI must offer
*re-preview*, not *retry* — this is the package's "never collapse partial states
into success", enforced at the API.

**501 is not a failure.** `publisher_not_configured` means an operator has not
supplied a connection. Send them to settings, not to an incident.

## Provenance

`GET /v1/publications/{id}/provenance` returns one record spanning input revision
and digest, generation run, artifact ids with logical paths and checksums,
package id and checksum, manifest version, preview id and checksum, base token,
approval id with approver and policy version, publication id, destination, and
the provider result — commit SHA and PR URL for GitHub, object keys and version
ids for S3.

It contains **no credential and no presigned URL**, and a test asserts a
destination's `connection_ref` never reaches it.

This covers the artifact half of this package's provenance chain. The intake half
— source SHA → acquisition run → evidence → confirmed knowledge → Memory revision
— is Memory's, and joins at `input_revision`.

## What is not yet available — *updated 2026-08-09*

~~**No HTTP client adapter for GitHub or S3 exists inside KAE-Artifacts.**~~
**Both exist** (`8fb6f1c`). GitHub has a live proof: seven draft pull requests on
`crismag/kae-artifacts-proof`, branch → commit → draft PR, run end to end.

~~**Studio does not call KAE-Artifacts at all yet.**~~ **STI-5, STI-6 and STI-7
shipped** (`6548c36`), and the service is deployed on loopback `8300` with
`KAE_ARTIFACTS_URL` set in Studio's environment.

**What is genuinely outstanding:**

- **S3 has no live proof.** The adapter and its tests are complete; the live half
  skips because the workstation's `aws-compute-lab-admin` key is invalid.
- **Five registered generators are reachable by no request any caller can make** —
  they appear in no profile and `Plan.edit()` cannot add them. Pinned by
  `test_every_generator_is_reachable.py` (`350a2c6`). Twelve of thirteen types
  have generators; twelve are not all *offered*.
- **Model-assisted synthesis.** Generation is deterministic today.
