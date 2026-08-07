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

## Done in this pass

### U2 — hide internal UUIDs ✅

The leftmost column now says what an item **is** — Requirement, Rule, Question,
Constraint — instead of a UUID. The id moves into *Source & reasoning*, where
someone debugging goes looking for it.

**No display-identifier subsystem was built.** The earlier note argued a stable
`REQ-004` needs a durable home in Memory, which is true — and it turned out not
to be needed. Nothing on this page required an identifier; it required not
leading with one.


### U3 — "Why this is here" → "Source & reasoning" ✅

Renamed, and it now shows recorded provenance from `/v1/knowledge/{id}/trace`,
which existed and was unused: the kind Memory assigned, the lifecycle state, how
many source messages it came from, and whether an extraction run produced it.

Fetched on expand, not per row on load — a trace request per requirement would
be a request storm for something almost nobody opens.

**Only stored provenance.** No generated rationale: on screen the two are
indistinguishable, and a model's account of why it believes something is not
evidence. Where the trace cannot be read, the row says so rather than
substituting an explanation.


### U4 — a next action on every row ✅ *(partial, by design)*

Rows now say what a person can do: review a proposal, answer an open question or
record it as an assumption, resolve a contested pair.

Derived from the item's own state — **Studio has no planning engine and did not
grow one.** Where the domain supplies no next action, the row renders nothing
rather than inventing advice.

*"No owning module" is still not actionable.* Making it so needs module
assignment over HTTP, which is `agent_only` by decision (N12,
[#85](https://github.com/crismag/KAE-Memory/issues/85)). Recorded rather than
faked client-side.


### U6 — acceptance criteria under their requirement ❌ **blocked — missing contract**

**KAE-Memory has no acceptance-criteria model.** A knowledge item carries `id`,
`kind`, `lifecycle`, `text`, `version` and nothing else; readiness areas carry
counts and state. There is no relationship linking a criterion to a requirement.

The prototype's `acceptanceTests` came from a fixture. Rendering them from live
data would mean inventing criteria the project does not hold, which is the one
thing this page must not do.

**Needs a Memory capability first** — an acceptance-criterion kind, or a
relationship type binding one statement to another as its verification. Not
built here: that is a domain decision, not a UI change.


### U8 — a collapsible "How this page works" ✅

Collapsed by default, next to the summary. Covers the four things a first-time
reader gets wrong: nothing is true because KAE said so, type and status are
separate, rejected items are kept deliberately, and readiness measures agreement
rather than effort.

A browser test asserts it is **not** visible until opened — an instruction panel
read once occupies the top of the page forever for everyone who already knows.


---

## The same targets on the workspace

Cris's follow-up: the structured workspace and the CIE conversation *"should
feel like two views of the same project intelligence, not two independent
products"*. So U2/U3/U4/U6/U8 were carried across. `e1e4722`.

**What the contract actually offers, checked first.** `/turn` returns
`{move, skill, subject, source}`. There is no `intent`, `reasoning`,
`next_action` or `acceptance_criteria` — the brief anticipated richer fields and
they do not exist. Nothing below invents them.

### U3 on the workspace — why KAE asked ✅

The skill CIE selected **is** the reason; it is simply not written for a reader.
`handle_non_answer` becomes *"KAE asked this because the last reply did not
answer the question"*. Fourteen skills, fourteen sentences.

**Translated, not generated.** No model is asked to explain the choice: an
account a model produces of its own reasoning is a second guess wearing the
clothes of a record. The map is disposable the day CIE returns its own reasoning.

### U4 on the workspace — return to the conversation ✅

Each coverage area carries *Discuss this*, which **fills the composer rather
than sending it**. Sending on the operator's behalf would put words in their
mouth and record them in Memory as evidence they never wrote.

### U6 on the workspace — what "enough" means ✅ *(and a defect)*

Areas now read `0 of 1 confirmed` instead of merely looking incomplete.

This needed a bug fixed first: the projection read `area_key` and `satisfied`,
which appear in **neither** Memory payload — the fields are `key` and `state`.
Every area arrived with an empty key and was permanently unsatisfied, and
nothing noticed, because an empty string and a `false` render exactly as
plausibly as real values. That is the failure mode worth remembering from this
pass: wrong field names do not throw, they just quietly agree with you.

Still not acceptance criteria — see U6 above. These are readiness counts, which
is a different and weaker thing, and the page does not pretend otherwise.

### U8 on the workspace — what do these mean? ✅

Collapsed, defining the four terms a first-time reader has to guess at, ending
on the one that matters most: nothing here blocks you.

### Not done

**Browser coverage for the workspace states.** The brief asked for the resolved
item, the incomplete item, the assumption, and the CIE-selected focus. The
workspace has two tests — a reply arrives, and it says why it was asked. The
coverage panel, *Discuss this*, and the explainer are unproven in a browser.
