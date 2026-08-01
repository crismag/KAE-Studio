# KAE-Studio UI Generation Context

Status: approved UI direction; no implementation is implied.

Repository: `crismag/KAE-Studio`

## Instruction to Claude

Design and implement the first KAE-Studio product interface from the end-user experience outward.

Do not recreate the current KAE-Memory interface. Its Discovery, Knowledge, Readiness, Review, Runs, and Blueprint tabs expose memory-engine internals and remain useful as diagnostic tooling, but they do not represent the intended customer workflow.

KAE-Studio should feel like an AI software-definition workspace inspired by the clarity of tools such as Kiro and modern AI workspaces, without copying their branding or exact layouts.

The interface must make this product promise understandable within seconds:

> Talk through a software idea with an AI analyst and architect. As the conversation develops, KAE-Studio builds the requirements, decisions, project health, and implementation context while KAE-Memory preserves continuity and traceability behind the scenes.

## Current repository state

At the time this brief was created, the GitHub repository contains only:

```text
README.md
```

Its README states:

> Guide a user from an incomplete idea to an implementation-ready project definition.

There is no committed application stack or UI implementation yet. Do not claim otherwise. First inspect the local clone in case it contains uncommitted scaffolding that is newer than GitHub.

## Primary UI objective

Create a polished, credible product shell and one convincing interactive workflow:

```text
Create/open project
-> describe an idea in chat
-> receive an understanding summary
-> answer focused interview questions
-> see requirements and project progress update
-> generate an initial context deliverable
```

The UI prototype may use deterministic local mock data and simulated assistant responses for the first pass. Keep all mock behavior behind clear interfaces so it can later be replaced by real AI-provider and KAE-Memory clients.

Do not present mock data, simulated extraction, or unavailable backend behavior as implemented production functionality.

## Experience model

KAE-Studio has two layers:

### Work layer

This is where ordinary users spend their time:

- Workspace
- Requirements
- Architecture
- Plan
- Deliverables
- Project Health

### System layer

This is secondary and intended for advanced users or diagnostics:

- Memory Explorer
- Agent Runs
- Diagnostics
- Provider and project settings

The work layer must dominate the product navigation and visual hierarchy.

## Application shell

Use a desktop-first three-region layout that remains responsive:

```text
+----------------+--------------------------------------+----------------------+
| Product/project| Main work surface                    | Project context      |
| navigation     |                                      | and progress         |
|                | Workspace conversation by default    |                      |
|                |                                      |                      |
+----------------+--------------------------------------+----------------------+
| Optional status bar: provider, memory sync, saved state, context revision   |
+----------------------------------------------------------------------------+
```

### Left navigation

The left rail establishes product identity and project structure.

Include:

- KAE-Studio wordmark.
- Project switcher or current project card.
- Primary navigation:
  - Workspace
  - Requirements
  - Architecture
  - Plan
  - Deliverables
  - Project Health
- A separated advanced section:
  - Memory
  - Activity/Runs
- Settings near the bottom.

Show small progress/status indicators only when they add meaning. Do not decorate every item with percentages.

### Main workspace

The center is a conversation-led work area, not a generic chatbot transcript.

It should include:

- Project title and current discovery phase.
- A compact session header showing the present objective.
- Natural user and assistant messages.
- Structured assistant response cards when the AI summarizes understanding, identifies decisions, or asks a focused question.
- A comfortable composer with attachment affordance, multiline input, send action, and optional future voice affordance.
- Suggested response chips only when they are genuinely useful, such as “Decide later,” “Show why this matters,” or a short set of role options.

The assistant should ask one primary question at a time. Avoid turning the chat into a long questionnaire.

### Right context panel

The right panel proves that the conversation is producing software-development context.

Recommended sections:

1. **Current understanding**
   - Problem
   - Primary users
   - Core workflow
2. **Discovery progress**
   - Goals and value
   - Users and roles
   - Workflow
   - Requirements
   - Constraints
   - Acceptance
3. **Open decisions**
   - Short, actionable uncertainties
4. **Recent changes**
   - Requirements or decisions updated by the latest turns
5. **Deliverable readiness**
   - Explain what can be generated now and what remains incomplete

The panel may collapse on narrower screens into a drawer or top summary.

## Default first-run experience

When there is no project, do not show an empty enterprise dashboard.

Show a calm onboarding state:

- “What would you like to define?”
- Short explanation: “KAE-Studio will interview you, organize the requirements, and prepare context for development.”
- Primary action: **Start a project**
- Optional secondary action: **Open an existing project**
- A few realistic starting prompts, not generic marketing cards.

Example starters:

- “A reporting and approval system for a ministry team.”
- “An internal automation service that monitors scheduled jobs.”
- “A mobile app for booking local services.”

## Demonstration project

Use one consistent sample project throughout the interface. Do not fill the prototype with unrelated dashboard data.

### Project

**Ministry Reporting Workspace**

### Initial user input

> We need a way for ministry leaders to submit monthly reports. Reports should be approved before publication, but we have not decided who approves them.

### Assistant response pattern

The assistant should respond approximately like this, using natural prose and structured support:

**What I understand**

- Ministry leaders submit reports each month.
- Reports follow an approval step before publication.
- The approver role is still an open decision.

**Next question**

> Who needs to read the published reports: ministry staff only, church leadership, members, or the public?

Do not show raw labels such as `proposed`, `unknown`, `requirements.v1`, `schema_version`, or `items_written` in this primary response.

### Later sample answers

Use these to exercise progressive UI changes:

- Only ministry leaders can submit.
- Staff can edit a draft until it is submitted.
- A report cannot be edited after approval.
- Pastors and administrators can view published reports.
- The approver role is intentionally undecided.

The Requirements view and context panel should update as these answers are applied.

## Requirements view

The Requirements view is the readable project definition produced by discovery.

Use sectioned content rather than a dense table of extracted sentences.

Recommended structure:

- Project objective
- Users and roles
- In-scope workflows
- Functional requirements
- Business rules
- Quality expectations
- Constraints and assumptions
- Open decisions
- Acceptance criteria

Each requirement can show:

- Stable human-readable ID such as `FR-01`.
- Clear statement.
- Status such as Draft, Confirmed, or Needs clarification.
- Optional “Why/source” disclosure.
- Last updated indicator.

Do not require the user to manually assign every item to a knowledge area. Advanced trace detail should open in a drawer or expandable panel.

## Architecture view

For the initial UI pass, this may be a designed empty/future state rather than fake architecture generation.

Show:

- What this section will contain: system context, components, data, integrations, deployment, decisions.
- Why it is not ready yet: the requirements interview has not reached the appropriate stage.
- A clear prerequisite or next action.

Never populate a generic architecture diagram merely to make the page look complete.

## Plan view

For the initial pass, show an honest future state with proposed eventual content:

- Delivery phases
- Epics or modules
- Dependencies
- Milestones
- Implementation risks

Tie availability to sufficient requirements and architecture context.

## Deliverables view

This is a primary value screen even in the first prototype.

Display deliverable cards for:

- Initial Project Context — available in first slice.
- Requirements Specification — preview or planned depending on implementation.
- Architecture Context — not ready.
- Implementation Plan — not ready.
- Coding Agent Context Package — planned.

Each card should clearly show:

- status;
- last generated time/version when applicable;
- what information it includes;
- generate/regenerate/download action;
- incompleteness warning when generated before all blocking decisions are resolved.

The initial Markdown export should remain possible with open decisions clearly listed. “Incomplete” should not mean “useless.”

## Project Health view

Replace the unexplained readiness table with a human-readable health view.

Include:

- Overall phase: Early discovery, Requirements forming, Ready for architecture, and similar meaningful language.
- Coverage grouped by understandable topics.
- Blocking decisions.
- Contradictions or risks.
- Recommended next conversations.
- A compact numeric indicator only as supporting information.

Example:

```text
Requirements forming

Strong: problem, primary users, monthly submission workflow
Needs work: approval authority, notifications, retention, acceptance tests
Blocking architecture: expected number of ministries and external integrations
```

Do not show a large `0%` as the main value proposition to a new user.

## Memory and diagnostics

Memory is a trust and continuity feature, not the home page.

If included in the first prototype, Memory Explorer should explain:

- what Studio currently remembers;
- whether an item is confirmed, tentative, contradicted, or superseded;
- which conversation evidence supports it;
- when it changed.

Agent Runs/Activity should be visibly marked as advanced. Raw JSON belongs behind a technical detail disclosure, never in the primary project workflow.

## Important interaction states

Design these states explicitly:

### Ready

Composer available; latest project briefing and progress visible.

### Assistant thinking

Show a restrained progress state describing the current activity, for example “Updating project understanding…” Avoid fake step-by-step chain-of-thought.

### Memory synchronization pending

The message is safely stored, but KAE-Memory has not processed it. Show a small non-alarming status with retry behavior.

### Provider unavailable

Retain the user message. Explain that the response could not be generated and offer retry/change-provider actions.

### Conflicting information

Surface the conflict conversationally and present the competing conclusions with their sources. Ask the user to clarify.

### Deferred decision

Allow the user to deliberately defer a question. Preserve it in Open decisions and do not repeatedly ask it unless it becomes blocking.

### Early export

Allow context generation while clearly marking open decisions and incomplete areas.

## Visual direction

Aim for a professional engineering workspace, not a marketing landing page and not a database admin console.

### Character

- Calm, focused, intelligent, and trustworthy.
- Dense enough for professional work but with clear hierarchy and breathing room.
- Dark and light themes are welcome; implement one theme well before adding both.
- Avoid excessive gradients, glassmorphism, glowing borders, animated decorations, and “AI magic” clichés.
- Avoid emoji as the primary icon system.

### Typography

- Use a highly readable UI sans-serif.
- Reserve monospaced type for IDs, filenames, code, and technical trace details.
- Keep chat and document content comfortable for long reading.

### Color

- Use a restrained neutral foundation.
- Choose one primary accent for interactive focus.
- Use semantic colors sparingly for confirmed, warning, blocking, error, and pending states.
- Never rely on color alone to communicate state.

### Components

Prioritize consistency for:

- navigation items;
- message blocks;
- assistant insight cards;
- progress/topic rows;
- decision callouts;
- requirement cards;
- deliverable cards;
- source/trace drawers;
- empty, loading, error, and disabled states.

## Responsive behavior

- Desktop: persistent left rail and optional right context panel.
- Tablet: compact left rail; right panel becomes a drawer.
- Mobile: conversation first; navigation and context become sheets/drawers; composer remains usable above the keyboard.
- Do not simply shrink the three-column desktop layout until it becomes unreadable.

## Accessibility

- Full keyboard navigation for primary flows.
- Visible focus states.
- Semantic headings, buttons, forms, and landmarks.
- Sufficient text and state contrast.
- Accessible labels for icons and composer controls.
- Screen-reader announcements for message submission, response completion, sync failure, and artifact completion.
- Respect reduced-motion preferences.

## Prototype architecture

Keep initial UI behavior replaceable:

```text
UI components
-> Studio application services/hooks
-> ConversationProvider interface
-> ProjectMemoryClient interface
-> ArtifactService interface
```

Provide deterministic mock implementations for the prototype if real services are not yet ready. Components must not import mock fixtures directly.

The future real flow is:

```text
User message
-> Studio conversation persistence
-> AI interview orchestration
-> KAE-Memory evidence/extraction
-> current project briefing
-> updated UI projections
```

## Suggested front-end domain model

Keep UI types product-oriented:

```text
Project
ConversationSession
ConversationMessage
AssistantInsight
InterviewQuestion
ProjectBriefing
RequirementSection
RequirementItem
OpenDecision
ProjectHealth
Deliverable
SyncStatus
```

Do not leak KAE-Memory database row shapes into presentation components.

## Implementation approach

### Step 1: Inspect before scaffolding

- Inspect the local clone for uncommitted files and existing stack decisions.
- Read repository instructions and document set.
- If no stack exists, record the chosen stack and rationale before generating broad scaffolding.
- Keep the first run command and developer setup simple.

### Step 2: Build the design system and shell

- Establish tokens for spacing, typography, color, radius, elevation, and motion.
- Build accessible primitives and the responsive application shell.
- Add the product navigation and realistic project header.

### Step 3: Build the complete Workspace route

- Implement the sample conversation.
- Add the composer and important states.
- Add the current-understanding and progress panel.
- Make interactions update deterministic local state.

### Step 4: Build Requirements and Deliverables

- Render requirements from the shared product state.
- Show open decisions distinctly.
- Implement initial-context preview/generation behavior using the mock service boundary.

### Step 5: Add Project Health and honest future states

- Translate discovery gaps into useful language.
- Add Architecture and Plan placeholders that explain prerequisites.
- Add Memory/Activity only after the primary story is coherent.

### Step 6: Verify

- Run formatting, linting, type checks, tests, and production build appropriate to the chosen stack.
- Exercise the primary workflow at desktop and mobile widths.
- Verify keyboard navigation and critical empty/error/loading states.
- Capture screenshots of the main Workspace, Requirements, Deliverables, and mobile Workspace views.

## Minimum prototype acceptance criteria

### UI-AC-01: Product intent

A first-time user can identify that Studio helps define software through conversation without being told what evidence, knowledge areas, or agent runs are.

### UI-AC-02: Workspace priority

Workspace is the default project screen and the conversation is visually primary.

### UI-AC-03: Visible output

Answering a sample interview question visibly updates at least one requirement/current-understanding item and project progress.

### UI-AC-04: Focused questioning

The assistant presents one primary next question and supports defer/correction behavior.

### UI-AC-05: Requirements readability

Requirements are organized as a software definition with readable statements and open decisions, not raw extracted sentence records.

### UI-AC-06: Deliverable value

The user can preview or generate an initial project-context artifact, with incomplete areas clearly identified.

### UI-AC-07: Honest functionality

Mocked and future behavior is clearly separated from working behavior. No screen claims backend integration that is not present.

### UI-AC-08: Responsive and accessible

The primary flow is usable with keyboard navigation and at representative desktop and mobile widths.

### UI-AC-09: Replaceable adapters

The UI uses provider/memory/artifact interfaces, allowing deterministic mocks to be replaced without rewriting presentation components.

## Required completion report

After generating the UI, Claude must report:

1. The stack and key dependencies chosen.
2. Routes and components created.
3. Which interactions are real, mocked, or placeholders.
4. How local state and service interfaces are separated.
5. Validation commands and results.
6. Screenshots or preview instructions.
7. Remaining work required for AI-provider and KAE-Memory integration.
8. Any deviations from this brief and the reason.

## Final guardrail

The UI should tell one unmistakable story:

> A conversation becomes a software definition, the definition becomes a usable development package, and KAE remembers how every important conclusion was reached.

If a screen or component does not strengthen that story, it should not dominate the first version.

