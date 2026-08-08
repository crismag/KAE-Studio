# Integrating KAE-Artifacts into Studio

Status: **plan, not implementation.** Nothing described here is built in Studio yet.

KAE-Artifacts is implemented: plan → generate → validate → package → preview →
approve → publish → provenance, all callable over HTTP, with GitHub and S3
publishers behind injectable client protocols. What is missing is a Studio
surface, and this is what it needs to be.

## The shape of the thing

Two directions, and they are not symmetric.

**Output** — knowledge becomes files. This is what KAE-Artifacts does today.

**Intake** — an existing repository becomes knowledge. This is a Memory
acquisition concern, not a publisher one, and is deliberately separate below. The
temptation to build them as one "sync" feature should be resisted: a two-way sync
has to decide what wins in a conflict, and neither system has been given an
answer to that question.

## Output: five screens, and why each exists

### 1. Choose a profile

`GET /v1/profiles` returns each profile with the files it would propose. Show the
files, not the names — a user choosing between `minimal-agent-context` and
`full-project-foundation` cannot choose from two slugs.

### 2. Read and edit the plan

`POST /v1/artifact-plans` proposes; **it generates nothing**, so this screen is
free to re-render as often as a user wants.

The plan is the argument, and it happens before generation rather than after
somebody reads ten wrong files. Each entry carries a readiness:

| Readiness | Show as | Because |
| --- | --- | --- |
| `ready` | selected, editable | its inputs exist |
| `needs_review` | selected, flagged | producible from unconfirmed material |
| `blocked` | **not generatable, with the reason** | it is waiting on a decision nobody has made |

**The blocked row is the most important thing on this screen.** `github.md —
missing repository choice` is not an error; it is the system declining to write a
document with a plausible guess where the repository goes. The UI should make
resolving that decision the obvious next action, not hide the row.

`PATCH /v1/artifact-plans/{id}` applies edits to paths, selection and options. An
unsafe path returns `422 plan_invalid` with a reason — show the reason.

### 3. Generate and read the output

`POST /v1/generation-runs` takes the **plan id**, not a list of types, so the
user's edits survive. `GET /v1/artifacts/{id}` returns content, so a user can
read a document before agreeing to publish it.

### 4. Preview against the real destination

`POST /v1/previews` reads the destination and returns a per-file outcome. This
is the screen that has to be right:

```text
docs/generated/AGENTS.md            add
docs/generated/REQUIREMENTS.md      modify      ← overwrites existing content
docs/generated/ROADMAP.md           unchanged
```

A user approving four modifications is agreeing to overwrite four files.
Rendering that as a list of filenames — which is what the earlier design implied
— tells them nothing.

If `has_changes` is false, say "nothing to publish" and offer no publish button.
KAE-Artifacts will decline to open an empty pull request anyway.

### 5. Approve, then publish

`POST /v1/approvals` takes the **preview id** and an approver reference. The
approval is evidence bound to the package checksum, the preview checksum, the
destination and the destination's state at review time.

`POST /v1/publications` takes the approval id and an idempotency key.

**Studio must not hold its own "approved" boolean.** That is precisely the model
KAE-Artifacts replaced: a flag anything can set says somebody agreed, and nothing
about what they agreed to.

## The failure states the UI must handle

Not exceptional. Each is an ordinary outcome of a system where other people are
also working:

| Code | Status | What the user should see |
| --- | --- | --- |
| `stale_base` | 409 | "The branch moved since you reviewed this. Nothing was written." Offer re-preview. |
| `package_mismatch` | 409 | The approval was for a different package. Re-approve. |
| `expired` | 409 | Approvals last twelve hours. Re-approve. |
| `not_authorized` | 403 | The deployment is not permitted to write there. An operator action. |
| `rate_limited` | 429 | Retryable. Back off; do not hammer. |
| `publisher_not_configured` | 501 | Not a failure — a missing setting. Say so. |
| `provider_unavailable` | 502 | **Not retryable.** The write may have landed. Offer re-preview, not retry. |

Every error body is `{"error": {"code", "message", "remedy", "retryable"}}`.
Branch on `code`; render `message` and `remedy`; use `retryable` to decide
whether a retry button appears at all.

## Intake: reading a repository into knowledge

Separate work, and Memory's rather than Artifacts'. Sketched here only so the two
are not conflated:

1. a user names a repository and a subtree;
2. something reads it — a local agent for a workspace, or a server-side clone for
   a hosted repository;
3. files become **evidence** submitted to KAE-Memory, not knowledge;
4. extraction proposes knowledge from that evidence;
5. a person confirms, exactly as with any other evidence.

Step 3 is the boundary that matters. A repository read directly into confirmed
knowledge would make whatever a previous team wrote into project truth, which is
the one thing KAE-Memory's whole lifecycle exists to prevent.

`kae_ingest_document` already accepts documents. Repository *traversal* — which
files, how large, which to skip — is the missing piece, and it does not belong in
the browser.

## What to build first

The output path, end to end, against the download destination.

It needs no credentials, no GitHub adapter and no live repository, and it
exercises every screen above. When an HTTP client adapter exists, the same five
screens work against GitHub with no Studio change — which is the whole reason the
publisher abstraction is shaped as it is.
