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
 *
 * The date leaves the reader to work out whether anything has happened since.
 * KAE-Memory measures that directly and Studio dropped it, which is `D-278` —
 * so the sibling now has a sentence of its own, in the same tone, and it
 * appears only when the project has actually moved.
 */

import { Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/primitives'
import type { ClassificationState as Classification } from '@/domain/types'
import type { ClassificationRequestOutcome } from '@/services/interfaces'
import { formatDateTime, isKnownTimestamp } from '@/lib/format'
import { neverClassified } from './neverClassified'

/**
 * Queued is not done, and saying otherwise is the failure mode this whole
 * surface exists to prevent. A worker runs the pass; the numbers change on a
 * later read.
 */
function Queued({ warnings }: { warnings: string[] }) {
  return (
    <>
      <p className="mt-2 text-[12px] text-ink-muted">
        Queued. A worker is reading the project now — the areas below will change once it finishes.
      </p>
      {/* **What the pass will not see, in Memory's own words** (`D-276`).
          Review classifies what exists now, so a pass queued while extraction
          is still draining is short by whatever is still queued — and the
          sentence above, which is true, would otherwise be the whole of what a
          person is told.

          Verbatim and never summarised, the rule the projection already applies
          to `classification.note`. Nothing renders when there is nothing to
          say, so this is not a standing warning (`D-243`). */}
      {warnings.map((warning) => (
        <p key={warning} className="mt-1 text-[12px] leading-relaxed text-ink-subtle">
          {warning}
        </p>
      ))}
    </>
  )
}

/**
 * Pressed, and nothing was queued — because there was nothing to queue.
 *
 * **The state this exists for.** The backend refuses a classification that
 * already covers what the project holds, so that pressing twice does not buy a
 * second model pass over every statement (`D-271`). The refusal is answered
 * 200, and this surface used to render it with `Queued` — a person was told a
 * worker was reading their project, the areas then did not move, and nothing
 * ever said why (`D-275`).
 *
 * It is the ordinary answer for an up-to-date project rather than a failure, so
 * it is stated in the same subtle tone as the date above it and offers nothing
 * to do.
 */
function NothingToClassify() {
  return (
    <p className="mt-2 text-[12px] text-ink-muted">
      Nothing was queued — this classification already covers everything the project holds. The
      areas below will not change until the project does.
    </p>
  )
}

export function ClassificationState({
  classification,
  knowledgeIsStale,
  onClassify,
  pending,
  outcome,
}: {
  classification: Classification | undefined
  /**
   * Whether the project moved since the number below was measured (`D-278`).
   *
   * Its own prop rather than a field on `classification`, because KAE-Memory
   * holds it at the top of readiness and holds `engineIsCurrent` inside the
   * classification block, and they answer different questions: the project
   * changed, versus the judgement behind the number was replaced.
   */
  knowledgeIsStale?: boolean | null
  onClassify: () => void
  pending?: boolean
  /**
   * What the press in this session did, or `undefined` if nothing was pressed.
   *
   * Not a boolean: the request has two outcomes and one status code, and this
   * surface said the wrong one for the whole time it was a boolean (`D-275`).
   */
  outcome?: ClassificationRequestOutcome
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
        {/* No refusal arm here, and deliberately: the backend refuses only a
            classification that already exists, so a project nothing has
            classified cannot reach one. An unqueued answer re-offers the
            control rather than printing a sentence for a state that cannot
            happen (`D-45`). */}
        {outcome?.queued ? (
          <Queued warnings={outcome.warnings} />
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
      {/* **The second staleness, said rather than only acted on** (`D-277`).
          The date above answers *when*; this answers *by what*, and it is the
          one condition under which the control below changes anything —
          KAE-Memory refuses a re-classification while the reviewer and the
          knowledge both stand still (`D-271`).

          `=== false` and never falsy: `null` is nothing classified yet, or a
          `KAE_REVIEW` Memory does not recognise, or a backend too old to say.
          Unknown is not stale (`D-38`). */}
      {classification.engineIsCurrent === false ? (
        <p className="mt-1 text-[11.5px] leading-relaxed text-ink-subtle">
          This pass was made by a different reviewer from the one KAE uses now. Classifying again
          replaces it with what the current one decides.
        </p>
      ) : null}
      {/* **The first staleness**, and the one the docstring above calls harder
          to see than the zero (`D-278`). The date says when the pass ran and
          leaves a reader to work out whether anything has happened since;
          KAE-Memory measures that directly, against the project's revision
          rather than a clock.

          `null` is a backend that did not say and a readiness section that did
          not answer, and a notice built on our own ignorance is `D-38`. Unlike
          the `=== false` above, that discipline is **not** carried by this
          test: `null`, `undefined` and `false` are all falsy, so the explicit
          form here is symmetry with its sibling and nothing more. Where it is
          load-bearing is upstream, at `_stale` and the adapter — the two hops a
          non-boolean can arrive at — and that is where it is guarded.

          Rendered beside the reviewer sentence rather than instead of it: both
          can hold, they state different causes, and only the remedy is
          shared. */}
      {knowledgeIsStale === true ? (
        <p className="mt-1 text-[11.5px] leading-relaxed text-ink-subtle">
          The project has changed since this pass, and the areas below have not counted what came
          after it. Classifying again measures what the project holds now.
        </p>
      ) : null}
      {outcome ? (
        outcome.queued ? (
          <Queued warnings={outcome.warnings} />
        ) : (
          <NothingToClassify />
        )
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
