# First Vertical Slice

Status: **stale in scope — re-scoping required.** Not implemented by this document.

> **Re-scoping notice.** This slice was written before ADR-0002 and ADR-0003. It terminates at a single Markdown context export and does not account for modules as first-class objects, typed discovery interviews, model relationships, the Reviews step, or publication through an artifact target. Its boundary rules and durability criteria (AC-03, AC-04, AC-06, AC-09) remain valid and should carry forward. The demonstration statement, in-scope list, and slice sequence must be rewritten against the current product definition and the demo date.

## Demonstration statement

> A user creates a software project, describes an incomplete idea, answers a focused AI interview, watches an evolving requirements summary form, exports an initial project context, leaves, and returns to continue without losing confirmed decisions.

## In scope

1. Minimal project creation.
2. Workspace with ordered chat messages.
3. One AI-provider adapter behind an interface.
4. Initial understanding summary and one-question-at-a-time interviewing.
5. Persistent Studio conversation.
6. Evidence submission and extraction through KAE-Memory.
7. Current requirements projection from Memory knowledge.
8. Minimal Project Health showing understood areas and blocking gaps.
9. Markdown initial-context artifact generation and download.
10. Resume behavior based on retained Memory briefing.

## Not in scope

- Full architecture or delivery planning.
- Coding-agent execution.
- Repository analysis.
- Complex organization/user administration.
- Voice input.
- Multiple simultaneous AI providers.
- General-purpose Memory administration in Studio.
- Polished implementation of every navigation destination.

## Walking-skeleton sequence

### Slice A: Product shell

- Project creation route.
- Workspace as default screen.
- Requirements and Deliverables navigation.
- Honest placeholders for deferred sections.

### Slice B: Real conversation

- Persist user/assistant messages.
- Call one provider through an adapter.
- Produce a useful summary and next question.
- Handle provider failure without losing the user's message.

### Slice C: Memory connection

- Create/link Memory project.
- Submit each user message as idempotent evidence.
- Observe extraction completion.
- Retrieve a compact briefing and structured knowledge.
- Clearly display pending synchronization when Memory is unavailable.

### Slice D: Evolving requirements

- Render current requirements sections from Memory knowledge.
- Reflect corrections and superseded knowledge.
- Show trace/source detail only on demand.

### Slice E: Export and resume

- Generate versioned Markdown from a fixed Memory revision.
- Download the artifact.
- Start a later session with a briefing and a non-repeated next question.

## Acceptance criteria

### AC-01: Understandable entry

Given a new project, when the Workspace opens, then the page clearly asks the user what they want to build and does not require knowledge classification.

### AC-02: Guided interview

Given an incomplete idea, when the provider responds, then Studio returns a concise understanding summary and one relevant clarification question.

### AC-03: Durable message

Given a submitted user message, when a provider or Memory call fails, then the message remains stored and the UI presents a retryable state without claiming success.

### AC-04: Idempotent memory submission

Given a retry for the same Studio message, when evidence is submitted again, then KAE-Memory does not create duplicate source evidence.

### AC-05: Evolving requirements

Given extracted project knowledge, when the Requirements view loads, then it presents readable project conclusions rather than raw run payloads or database taxonomy.

### AC-06: Correction

Given a user correction, when extraction completes, then the current projection reflects the revision while provenance retains both original and corrective evidence.

### AC-07: Traceable export

Given a context-generation request, when it succeeds, then the Markdown artifact records its Memory revision and every substantive generated section can be traced to knowledge/source references.

### AC-08: Resume

Given a later session, when the project opens, then Studio can summarize current understanding and choose a relevant next question without restarting discovery.

### AC-09: Database boundary

Given Studio runtime credentials, when attempting to write KAE-Memory tables directly, then database authorization denies the operation; ordinary memory work succeeds only through the Memory API.

## Demonstration scenario

Use a small reporting system example:

> Ministry leaders submit monthly reports. Reports require approval before publication, but the approver role is undecided.

The interview should naturally clarify users, editability, approval, publication, scope, and acceptance expectations. The export should explicitly preserve “approver role” as an open decision until the user resolves it.

## Definition of done

The vertical slice is done only when it runs end to end against the target CockroachDB-backed services with automated tests for key state transitions and a repeatable demonstration script. Mock provider behavior may be used in tests, but the demonstrated provider interaction must be identified honestly.

