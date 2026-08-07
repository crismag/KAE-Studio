# Requirements page — usability targets

From Cris's review of the live page, 2026-08-07. His framing is the standard
these are measured against: every item should immediately answer four questions.

> **What is it? What state is it in? Where did it come from? What should I do
> next?**

The page answered the second well, partly answered the third, and left the
first and fourth unclear.

---

## Done

### U1 — separate type from status ✅ `cca368b`

The one that mattered most, and the one that was a defect rather than a
refinement. KAE-Memory types its knowledge — `actor`, `goal`, `rule`,
`constraint`, `requirement`, `decision`, `assumption`, `unknown` — and Studio's
adapter stamped `functional` on all of it. A persona, a performance target and
a question the model could not answer rendered identically as "proposed
functional requirement".

Type and status are now independent, as they already were in Memory. Open
questions are labelled as questions and ordered last. An unrecognised kind
falls through to `functional` rather than vanishing, so a new Memory kind looks
mislabelled instead of disappearing.

### U5 — a summary that does not overstate ✅ `cca368b`

`6 requirements · 1 confirmed · 4 awaiting review · 2 open questions`

Questions counted apart from requirements deliberately. Reporting them together
claims the project has established things it has not, which is the specific
claim this product exists not to make.

### U7 — page lead ✅ `cca368b`

Now says what to *do*, not only what the page contains.

---

## Open

### U2 — hide internal UUIDs

The UUID takes the most prominent column and carries almost no value to a
reader. Wanted: a short human identifier (`REQ-004`, `QUESTION-002`) with the
UUID under technical details on expansion.

**Not trivial, and worth saying why.** Memory's id is the real identity and the
only thing that survives a rename or a rewording; a display id must be derived
and stable, and a counter that renumbers when an item is rejected would be
worse than the UUID it replaced. Needs a decision on where that number lives —
almost certainly Memory, not Studio, since Studio owns no durable project state
(ADR-0006).

### U3 — "Why this is here" → "Source & reasoning"

Rename, and make the expansion earn it: source (conversation, document, manual,
extraction), supporting evidence, why KAE classified it as this type,
confirmation history, related module, related questions and tests.

Memory holds most of this already — `/v1/knowledge/{id}/trace` exists and
Studio does not call it.

### U4 — a next action on every row

Confirm, edit/correct, reject, answer clarification, assign module, add
acceptance criterion, link or create a test — offered according to status.
"No owning module" should be a link, not an orange warning that leads nowhere.

Confirm and reject exist on Reviews. The rest are not wired, and two of them
(module assignment, acceptance criteria) touch capabilities Memory exposes over
MCP only — so this overlaps the unreconciled Studio curation contract (N12).

### U6 — acceptance criteria under their requirement

`Acceptance criteria — 0` at the foot of the page reads as a separate thing a
reader must go and create somewhere else. Better under the owning requirement,
with a project-wide view retained as a summary.

### U8 — a collapsible "How this page works"

Not a permanent panel. A `?` that opens: the requirement types, what each
status means, how requirements are discovered, what module ownership means, why
verification matters.

Deliberately last. An explainer that compensates for ambiguous classification
is a worse fix than classifying correctly — which is why U1 went first.
