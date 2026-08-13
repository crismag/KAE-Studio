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

import { Badge, Panel, PanelBody, PanelHeader, PanelTitle } from '@/components/ui/primitives'
import { CapabilityNote } from '@/components/project/CapabilityNote'
import type { ProjectReview } from '@/domain/types'

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
            {review.findings.map((finding, index) => (
              // Index in the key because a finding has no identifier by
              // design, and inventing one here would be the first step toward
              // a control that addresses it.
              <li
                key={`${finding.kind}-${finding.subjectKey}-${index}`}
                className="rounded-md border border-line bg-surface-sunken px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={tone(finding.severity)}>{finding.severity || 'ungraded'}</Badge>
                  <span className="text-[11.5px] text-ink-subtle">{readable(finding.kind)}</span>
                  {finding.areaKey && (
                    <span className="text-[11.5px] text-ink-subtle">· {finding.areaKey}</span>
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
              </li>
            ))}
          </ul>
        )}
      </PanelBody>
    </Panel>
  )
}
