/**
 * The quality review KAE-Memory computes (`D-30`).
 *
 * `GET /v1/projects/{id}/review` returns eight kinds of finding — missing
 * areas, partial areas, unclassified and unconfirmed knowledge, open questions,
 * unresolved contradictions, duplicate knowledge, open blockers — each with a
 * severity and a sentence saying what would make it disappear. Studio's client
 * called a neighbouring route and never this one, and invented a ninth kind,
 * `agent_proposal`, that Memory's vocabulary does not contain.
 *
 * ## Why this sits beside the proposal list rather than inside it
 *
 * The proposal list is a **gesture** surface: a person agrees or refuses, and a
 * statement moves. This is a **diagnostic**. *"This area has nothing in it"* is
 * not something to click yes on, and giving it the same controls would promise
 * a gesture that does not exist.
 *
 * ## No identifiers, and nothing to dismiss
 *
 * `ADR-0015`: findings are derived from state on every request, not stored, so
 * there is nothing stable to address. *"Acting on one means changing that state
 * — confirm the knowledge, assign the area, resolve the contradiction — and the
 * finding disappears."* A dismiss control here would be a button that either
 * lies or writes something nobody asked for.
 */

import { Badge, Mono, Panel, PanelBody, PanelHeader, PanelTitle } from '@/components/ui/primitives'
import { CapabilityNote } from '@/components/project/CapabilityNote'
import { plural } from '@/lib/plural'
import type { ProjectReview } from '@/domain/types'

/**
 * How many statements a finding may name before the list stops helping.
 *
 * A contradiction names two. A coverage finding can name every candidate in the
 * project, and did.
 */
const NAMEABLE = 6

/** `critical` is the only grade that stops anything downstream. */
function tone(severity: string): 'blocking' | 'attention' | 'neutral' {
  if (severity === 'critical') return 'blocking'
  if (severity === 'major') return 'attention'
  return 'neutral'
}

/** `missing_area` → `missing area`. Memory's word, made readable, not renamed. */
function readable(kind: string): string {
  return kind.replace(/_/g, ' ')
}

export function QualityReview({ review }: { review: ProjectReview }) {
  if (!review.available) {
    return (
      <Panel>
        <PanelHeader>
          <PanelTitle>What a review of this project found</PanelTitle>
        </PanelHeader>
        <PanelBody>
          {/* Not an empty list. A review that could not be computed and a
              project with nothing wrong look identical rendered bare, and one
              of them is an all-clear nobody earned. */}
          <CapabilityNote reason={`The review could not be computed. ${review.reason}`} />
        </PanelBody>
      </Panel>
    )
  }

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>What a review of this project found</PanelTitle>
        <span className="text-[11.5px] text-ink-subtle">
          Computed by KAE-Memory on every read, so it cannot disagree with the project
        </span>
      </PanelHeader>
      <PanelBody>
        {review.findings.length === 0 ? (
          <p className="text-[12.5px] text-ink-muted">
            This review found nothing. It checks coverage, contradictions, duplicates, open
            questions and blockers — not whether the project is a good idea.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {byKind(review.findings).map((group) =>
              group.items.length === 1 ? (
                <Finding key={group.kind} finding={group.items[0]} />
              ) : (
                <li key={group.kind}>
                  <details className="rounded-md border border-line bg-surface-sunken">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-3 py-2.5">
                      <Badge tone={tone(group.items[0].severity)}>
                        {group.items[0].severity || 'ungraded'}
                      </Badge>
                      {/* The count lives in the sentence and nowhere else
                          (`D-192`). A chip repeating it is a second place that
                          has to agree about both the number and the noun, and
                          it did not: it said "areas" for every kind. */}
                      <span className="text-[13px] text-ink">{summarise(group)}</span>
                    </summary>
                    <ul className="space-y-2.5 px-3 pb-3">
                      {group.items.map((finding, index) => (
                        <Finding key={`${finding.subjectKey}-${index}`} finding={finding} />
                      ))}
                    </ul>
                  </details>
                </li>
              ),
            )}
          </ul>
        )}
      </PanelBody>
    </Panel>
  )
}

/**
 * One finding, whole.
 *
 * Extracted rather than duplicated when grouping arrived — a second copy of this
 * markup is how the collapsed and expanded views come to disagree about what a
 * finding shows.
 */
function Finding({ finding }: { finding: ProjectReview['findings'][number] }) {
  return (
    <li className="rounded-md border border-line bg-surface-sunken px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={tone(finding.severity)}>{finding.severity || 'ungraded'}</Badge>
        <span className="text-[11.5px] text-ink-subtle">{readable(finding.kind)}</span>
        {/* Memory's key, made readable (`NAV-01` N4). `problem_and_value`
            beside a sentence that already names the area is a machine word
            asking to be translated by the reader. */}
        {finding.areaKey && (
          <span className="text-[11.5px] text-ink-subtle">· {readable(finding.areaKey)}</span>
        )}
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-ink">{finding.summary}</p>
      {/* Memory's sentence, unedited. It says what would make this
                    disappear, and a paraphrase of an instruction is advice
                    nobody can follow. */}
      {finding.recommendedAction && (
        <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
          {finding.recommendedAction}
        </p>
      )}
      {/* Which statements this is about. A contradiction's action —
                    "supersede one item" — names nothing without them, and an
                    instruction a reader cannot locate is not advice (`D-37`). */}
      {/* **Named when naming helps** (`NAV-01` N4). `D-37` put these here so a
          contradiction's *"supersede one item"* names the two items — an
          instruction a reader cannot locate is not advice. A finding about 174
          statements names them all the same way, and on the live project that
          was 174 UUIDs in a chip cloud, longer than everything else on the page
          combined. Past a handful the count is the information and the list is
          noise; the statements themselves are grouped below. */}
      {finding.knowledgeItemIds.length > 0 && finding.knowledgeItemIds.length <= NAMEABLE && (
        <p className="mt-1 flex flex-wrap items-center gap-1.5">
          {finding.knowledgeItemIds.map((id) => (
            <Mono key={id} className="text-ink">
              {id}
            </Mono>
          ))}
        </p>
      )}
      {finding.knowledgeItemIds.length > NAMEABLE && (
        <p className="mt-1 text-[11.5px] text-ink-subtle">
          About {plural(finding.knowledgeItemIds.length, 'statement')}, listed below.
        </p>
      )}
    </li>
  )
}

/**
 * Findings of one kind together, in the order Memory returned them.
 *
 * Memory sorts most severe first and that order is kept — re-sorting here would
 * put Studio's judgement of severity above the one computing it.
 */
function byKind(findings: ProjectReview['findings']): {
  kind: string
  items: ProjectReview['findings']
}[] {
  const groups = new Map<string, ProjectReview['findings']>()
  for (const finding of findings) {
    groups.set(finding.kind, [...(groups.get(finding.kind) ?? []), finding])
  }
  return [...groups.entries()].map(([kind, items]) => ({ kind, items }))
}

/**
 * The unit KAE-Memory produced one finding *per*, for the kinds where that unit
 * is not the finding itself (`D-192`).
 *
 * Traced in `review_service.py` rather than guessed: one finding per area for
 * the two area kinds, one per contradicting pair, one per near-duplicate pair,
 * one per blocker. The other four kinds emit a single aggregate finding for the
 * whole project and so can never group.
 */
const GROUPED_NOUN: Record<string, string> = {
  unresolved_contradiction: 'unresolved contradiction',
  duplicate_knowledge: 'duplicated pair',
  open_blocker: 'open blocker',
}

/**
 * What a group of one kind says, in one line.
 *
 * Built from Memory's own word for the kind and the number of findings, never
 * from paraphrasing them — a summary that restates seven sentences as one is a
 * claim about all seven that nothing checked.
 *
 * **The noun is the whole of `D-192`.** This said `areas` for every kind, and
 * three of the five kinds that can group are not areas — an area is the unit
 * readiness is denominated in, so counting contradictions as areas reads as
 * coverage. Unrecognised kinds fall back to `finding`, which is a default and
 * not an invention: it is what all nine of them are, and the sentence names the
 * kind verbatim beside it.
 */
function summarise(group: { kind: string; items: ProjectReview['findings'] }): string {
  const count = group.items.length
  if (group.kind === 'partial_area') return `${count} areas need more confirmed evidence`
  if (group.kind === 'missing_area') return `${count} areas have no confirmed knowledge`
  const noun = GROUPED_NOUN[group.kind]
  if (noun) return plural(count, noun)
  return `${plural(count, 'finding')} of kind ${readable(group.kind)}`
}
