/**
 * One recommended next action, always present, with its reason.
 *
 * R12: the user never wonders what to do now. Guidance, not a gate — nothing
 * here prevents doing something else, and the reason is what makes it possible
 * to disagree.
 *
 * ## Where the recommendation comes from
 *
 * CIE ranks it, per ADR-0002. Not Memory, whose `subjects` are documented as
 * "a stable order, not a recommended one" — it refuses to rank by design. And
 * not this component: a ranking Studio invented would recreate that same
 * running order where no rubric evaluates it, and would then disagree on screen
 * with the move CIE had just chosen.
 *
 * ## Why there is a floor
 *
 * A recommendation arrives with a turn. Before anyone has spoken there is none,
 * and R12 asks for one *always*. So this falls back to a stage-derived action —
 * read from the project's own state, labelled as such — rather than either
 * showing nothing or calling a model to fill a panel.
 *
 * **Rendering must cost no model call.** That is what lets the recommendation be
 * always-present instead of present-after-a-spinner, and it is why the floor is
 * computed from the projection rather than requested.
 */

import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/primitives'
import type { RecommendedAction } from './nextActionFloor'

export function NextAction({
  action,
  derived,
  onAct,
}: {
  action: RecommendedAction
  /** True when this came from the floor rather than from a ranked turn. */
  derived?: boolean
  onAct?: (action: RecommendedAction) => void
}) {
  return (
    <section
      aria-label="Recommended next action"
      className="rounded-panel border border-accent-line bg-accent-soft/40 px-4 py-3"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-accent-ink">Next</p>
      <p className="mt-1 text-[14px] font-medium leading-snug text-ink">{action.label}</p>
      {/* The reason, always. An instruction a person cannot evaluate is one
          they either obey or ignore, and both are worse than being persuaded. */}
      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">{action.reason}</p>
      {derived && (
        // Said out loud rather than blended in. A stage-derived suggestion and
        // a reasoned recommendation are different claims, and a reader who
        // cannot tell them apart will over-trust the weaker one.
        <p className="mt-1.5 text-[11.5px] italic text-ink-subtle">
          Suggested from where this project has got to — KAE has not weighed it against anything
          else yet.
        </p>
      )}
      {onAct && (
        <Button variant="secondary" size="sm" className="mt-2.5" onClick={() => onAct(action)}>
          {action.label}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Button>
      )}
    </section>
  )
}
