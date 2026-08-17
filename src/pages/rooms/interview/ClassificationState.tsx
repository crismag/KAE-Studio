/**
 * Whether anything has classified this project, said beside the number.
 *
 * ## The state this exists for
 *
 * Readiness counts statements per discovery area. A statement reaches an area
 * only when a review run classifies it. **If no review has run, every area is
 * empty and readiness is 0 — whatever the project holds.**
 *
 * `EM-5` found the review capability had no caller outside a unit test and
 * exposed it over HTTP and MCP. Studio, the only interface a person uses, still
 * did not call it. Measured on the deployed system: the acceptance project held
 * five successful extraction runs, **zero review runs**, and `0% ·
 * not_started` that no amount of confirming could move (`AUD-041`).
 *
 * So a person did the work, watched nothing happen, and had no way to find out
 * why — because a 0 that means *nobody looked* renders identically to a 0 that
 * means *there is nothing here*.
 *
 * ## Why the action is a button rather than automatic
 *
 * Review is a model call over every statement the project holds. Running it
 * after each turn changes what the product costs to operate, and that belongs
 * to whoever pays for it. Making the capability reachable does not, so it is
 * reachable now and the automatic version is recorded as a decision waiting on
 * an owner rather than taken quietly here.
 *
 * ## The zero has a sibling, and it is harder to see
 *
 * A project that *has* been reviewed carries the date of the pass, and the same
 * control (`D-243`). A review runs once; the conversation continues; the
 * percentage keeps describing the project as it was. **A plausible number
 * invites no question at all**, which is what makes it worse than the zero.
 *
 * It is a date in the subtle tone and not a notice. The judgement below — that
 * a standing warning on every project is a warning nobody reads — is why there
 * is no amber here and no sentence claiming the number is wrong. What is said
 * is when the pass ran, which is a fact, and what is offered is the pass again.
 */

import { Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/primitives'
import type { ClassificationState as Classification } from '@/domain/types'
import { formatDateTime, isKnownTimestamp } from '@/lib/format'
import { neverClassified } from './neverClassified'

/**
 * Queued is not done, and saying otherwise is the failure mode this whole
 * surface exists to prevent. A worker runs the pass; the numbers change on a
 * later read.
 */
function Queued() {
  return (
    <p className="mt-2 text-[12px] text-ink-muted">
      Queued. A worker is reading the project now — the areas below will change once it finishes.
    </p>
  )
}

export function ClassificationState({
  classification,
  onClassify,
  pending,
  queued,
}: {
  classification: Classification | undefined
  onClassify: () => void
  pending?: boolean
  /** A run has been queued in this session. The numbers have not moved yet. */
  queued?: boolean
}) {
  if (!classification || classification.engine === 'unknown') return null

  if (neverClassified(classification)) {
    return (
      <div className="mt-3 rounded-panel border border-line bg-surface-sunken px-3.5 py-3">
        <p className="text-[12.5px] font-medium text-ink">
          Nothing has classified this project yet
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
          Areas fill when a review pass reads what the project holds and decides which area each
          statement belongs to. Until then every area is empty and the percentage is 0 — which is
          about the review, not about your project.
        </p>
        {queued ? (
          <Queued />
        ) : (
          <Button className="mt-2.5" onClick={onClassify} disabled={pending}>
            <Sparkles className="size-3.5" aria-hidden="true" />
            {pending ? 'Asking…' : 'Classify what the project holds'}
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="mt-3">
      {classification.degraded ? (
        <p className="text-[11.5px] leading-relaxed text-ink-subtle">
          {/* Memory's own sentence. It names its limits precisely and says the
              cause is not the project, which is the part a person needs. */}
          {classification.note}
        </p>
      ) : null}
      <p className="mt-1 text-[11.5px] leading-relaxed text-ink-subtle">
        {/* A missing date renders as no date rather than as `formatDateTime`'s
            em dash. An em dash sits exactly where a date is expected and only
            invites somebody to wonder what is missing (`D-241`). */}
        {classification.reviewedAt && isKnownTimestamp(classification.reviewedAt)
          ? `Areas reflect a review pass on ${formatDateTime(classification.reviewedAt)}.`
          : 'Areas reflect a review pass, which did not record when it ran.'}
      </p>
      {queued ? (
        <Queued />
      ) : (
        <Button
          className="mt-1.5 -ml-3"
          variant="ghost"
          size="sm"
          onClick={onClassify}
          disabled={pending}
        >
          <Sparkles className="size-3.5" aria-hidden="true" />
          {pending ? 'Asking…' : 'Classify again'}
        </Button>
      )}
    </div>
  )
}
