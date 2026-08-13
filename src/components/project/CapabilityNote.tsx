/**
 * What KAE cannot compute, said out loud, where the answer would have gone.
 *
 * ## The distinction this exists to keep
 *
 * An empty section means one of two opposite things:
 *
 * - **the project has none** — a prompt to do work;
 * - **KAE cannot derive it** — a limit of the product.
 *
 * Rendered identically they are indistinguishable, and the reader defaults to
 * the first, because a product that could not do something would surely say so.
 *
 * Studio's backend has always distinguished them. `projection.py` returns
 * `unavailable: [{section, reason}]` and `definition.py` states a reason for
 * every section it leaves empty. The live adapter used to fold all of it into
 * `health.recommendedNext`, a prose list nothing rendered — so every gap the
 * backend took care to report arrived as a blank panel. That is `AUD-002`, and
 * this component is the other half of its repair.
 *
 * ## Why it is quiet
 *
 * `Dependencies.tsx` established the pattern and it is deliberately low-key:
 * neutral tone, no warning colour. An unbuilt capability is not a defect in the
 * user's project, and styling it as attention makes it read as one — which is
 * the mistake `/requirements` currently makes on every row.
 *
 * ## What it must never become
 *
 * A placeholder for content. It states a limit; it does not stand in for an
 * answer, promise one is coming, or invite the user to supply what KAE cannot
 * derive. If a section is empty because nobody has done the work, that is not
 * this component — that is an `EmptyState`.
 */

import { ArrowRight, Lock } from 'lucide-react'
import { Link } from 'react-router-dom'

export function CapabilityNote({
  reason,
  proved,
  action,
  className,
}: {
  /** Why this cannot be computed, in the backend's own words. */
  reason: string
  /**
   * The one thing a person can do about it (`§16`, `D-41`).
   *
   * *"Each empty/degraded state must explain what belongs there, why it is
   * unavailable, and **one exact recovery/next action**."* Every note this
   * codebase shipped answered the first two clauses and none answered the
   * third — including one that named the exact fix in prose and did not offer
   * the link, on a page that had one two panels down.
   *
   * **Optional, and deliberately so.** A 503 from KAE-Memory has no user
   * action, and inventing *"try again"* for an outage somebody else must fix is
   * the same manufacture as inventing a reason. Omitting it is a designed
   * state; `§16` asks for the action to be *exact*, not for one to exist.
   *
   * **One, never a menu.** Two suggestions is a question, and a person reading
   * a degraded state is already stuck.
   */
  action?: { label: string; to: string }
  /**
   * What *was* established, when anything was. Shown so a reader can see how
   * far they actually got rather than only what stopped.
   */
  proved?: string[]
  className?: string
}) {
  return (
    <div
      role="note"
      className={`rounded-panel border border-line bg-surface-sunken px-3.5 py-3 ${className ?? ''}`}
    >
      <div className="flex items-start gap-2.5">
        <Lock className="mt-0.5 size-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-[12.5px] leading-relaxed text-ink-muted">{reason}</p>
          {action && (
            <Link
              to={action.to}
              className="mt-1.5 inline-flex items-center gap-1 text-[12px] text-accent-ink underline-offset-2 hover:underline"
            >
              {action.label}
              <ArrowRight className="size-3" aria-hidden="true" />
            </Link>
          )}
          {proved && proved.length > 0 && (
            <>
              {/* Named rather than implied. "Not available" alone reads as
                  nothing happened; the user usually got most of the way. */}
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                Established
              </p>
              <ul className="mt-1 space-y-0.5">
                {proved.map((item) => (
                  <li key={item} className="text-[12px] leading-relaxed text-ink-muted">
                    {item}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
