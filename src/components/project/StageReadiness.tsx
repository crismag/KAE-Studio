/**
 * A stage that cannot do its work yet says what it is waiting for.
 *
 * R9. Four pages — Architecture, Plan, Interfaces, Dependencies — described
 * what they *would* contain and then explained, in fixed prose, why they could
 * not. The prose was fiction about a project that does not exist, and deleting
 * it (S-1) left them with nothing true to say.
 *
 * An empty page is not a defect. A page that cannot say what it is waiting for
 * is. So each one now reads the project and reports which of its prerequisites
 * are met, developing, or absent:
 *
 *     Architecture — not ready to develop yet
 *       ✓ Product problem understood      ◐ Functional scope developing
 *       ✓ Initial users understood        ○ Data requirements incomplete
 *
 * This costs nothing to build and is more useful than any of the four features
 * would be before its inputs exist: it converts a placeholder into part of the
 * progress model.
 *
 * ## Where the states come from
 *
 * The projection, and only the projection. A prerequisite is `met` when the
 * project holds confirmed knowledge of the right sort, `developing` when it
 * holds some, and `absent` otherwise — the same evidence Definition renders,
 * read through a different question.
 *
 * **It does not rank them.** Which prerequisite matters most is a judgement,
 * and judgement is CIE's (ADR-0002). This lists; the navigator recommends.
 */

import { Check, Circle, CircleDot } from 'lucide-react'
import type { Prerequisite, PrerequisiteState } from './stagePrerequisites'

const MARK: Record<PrerequisiteState, { icon: typeof Check; className: string }> = {
  met: { icon: Check, className: 'text-confirmed' },
  developing: { icon: CircleDot, className: 'text-attention' },
  absent: { icon: Circle, className: 'text-ink-subtle' },
}

export function StageReadiness({
  stage,
  prerequisites,
}: {
  stage: string
  prerequisites: Prerequisite[]
}) {
  const met = prerequisites.filter((p) => p.state === 'met').length

  return (
    <section
      aria-label={`${stage} readiness`}
      className="rounded-panel border border-line bg-surface px-6 py-5 shadow-panel"
    >
      <h2 className="text-[13px] font-semibold text-ink">
        {stage} — not ready yet
      </h2>
      <p className="mt-1 text-[12.5px] text-ink-muted">
        {met} of {prerequisites.length} prerequisites met. This page fills in as they are.
      </p>
      <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
        {prerequisites.map((prerequisite) => {
          const { icon: Icon, className } = MARK[prerequisite.state]
          return (
            <li key={prerequisite.label} className="flex gap-2.5">
              <Icon className={`mt-[3px] size-3.5 shrink-0 ${className}`} aria-hidden="true" />
              <span className="min-w-0">
                <span className="text-[13px] text-ink">{prerequisite.label}</span>
                {prerequisite.detail && (
                  <span className="mt-0.5 block text-[12px] leading-relaxed text-ink-subtle">
                    {prerequisite.detail}
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
