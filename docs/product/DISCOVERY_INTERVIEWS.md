# Discovery Interviews

Status: approved direction.

## Principle

The AI does not merely chat. It conducts **different kinds of engineering interviews**, and the questions change according to the subject under discussion. A generic requirements conversation produces generic requirements; a typed interview produces the specifics that determine whether a module can actually be implemented.

## Interview types

| Type | Establishes | Primarily populates |
| --- | --- | --- |
| Product discovery | Problem, value, outcomes, success measures | Objectives, scope |
| Customer requirements | Stated needs in the customer's own terms | `CR-` |
| User and stakeholder discovery | Who is affected, who decides, who operates | Stakeholders, actors |
| Business workflow analysis | How work is done today and should be done | Workflows, business rules |
| Module decomposition | System boundaries and responsibilities | Modules, dependencies |
| Integration requirements | System-to-system interaction contracts | Interfaces, `IR-` |
| Data requirements | Entities, ownership, retention, privacy | Data entities, `owns_data` |
| Security and compliance | AuthN/AuthZ, confidentiality, audit, regulation | `SR-` |
| Deployment and operations | Environments, availability, monitoring, recovery | `OR-` |
| Architecture decisions | Technology and structural choices with rationale | `ADR-`, constraints |
| Project constraints | Budget, timeline, team, legacy, mandated technology | Constraints, risks |
| UI definition | Screens, actions, states, permissions | `SCR-` |
| Testing and acceptance | How each requirement is proven | `AT-` |
| Delivery planning | Phases, sequencing, work packages, owners | Phases, work packages, action items |

## Selecting the next question

Studio chooses the next question from: the latest answer; the current project model and its gaps; the active interview type; readiness dimensions that block a target module; unresolved contradictions; open decisions blocking delivery; and what has already been answered, deferred, or rejected.

The user may always answer, correct the assistant, defer with a reason, ask why the question matters, or switch subject. Deferral is recorded, not forgotten — it reappears when it starts blocking something.

One useful question at a time remains the default rhythm. Studio may batch closely related questions when the user is clearly in a working session on a single subject, but must not present a form.

## Integration interview — normative question set

The clearest illustration of why typed interviews matter. For each interface:

- Which system initiates the transaction?
- What protocol and authentication mechanism are required?
- What is the expected request volume?
- Is the interaction synchronous or asynchronous?
- What happens if the receiving system is unavailable?
- Who owns retry behavior?
- Which system is authoritative for each field?
- What versioning guarantees exist?
- What are the timeout and recovery requirements?
- How will the integration be tested and accepted?

Answers populate `IF-` and `IR-` nodes and directly determine the module's failure-behavior section. An integration whose retry ownership and authority-per-field are unanswered is not implementation-ready, regardless of how complete its functional requirements look.

## Other interview question banks

Illustrative rather than exhaustive; question banks are versioned content and will grow. In the SaaS horizon these become reusable templates and industry-specific packs.

### Data requirements

Which module owns this entity? What is the natural key? What is the retention period? Is any field personal, financial, or regulated? Who may read it? What happens on delete — hard, soft, or anonymize? Is history required, and at what granularity?

### Security and compliance

Who authenticates, and against what? What are the roles and what can each do? Which operations must be audited? What must never appear in logs? Which regulation applies, and does it constrain data location? What is the consequence of unauthorized access to this data?

### Deployment and operations

Which environments exist? What availability is expected, and during which hours? What is the recovery point and recovery time objective? What must be monitored and who is alerted? How are secrets supplied? What is the rollback procedure?

### Testing and acceptance

What proves this requirement is met? What is the negative case? What is the boundary condition? Who signs off? Can it be tested without the external system, and if not, what fixture is acceptable?

## Handling material other than chat

Uploaded documents, transcripts, specifications, and diagrams enter as evidence exactly as messages do. Studio's job on ingest is to extract candidate model nodes, mark them `proposed`, and then interview to **confirm and fill gaps** — not to assume the document is authoritative or complete. A conflict between a document and a user statement is a `conflicts_with` edge and a Reviews item, not a silent overwrite.

## Guardrails

- Do not ask a question the project model already answers, unless explaining why it must be revisited.
- Do not ask for a decision the user has explicitly deferred until it blocks progress; then explain what it blocks.
- Do not resolve an open decision by AI preference. Propose options with trade-offs and leave it open.
- Do not present internal taxonomy — node types, edge names, readiness weights — as part of the question.
- Prefer the question that unblocks the most downstream work.
