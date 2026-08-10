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

import { Lock } from 'lucide-react'

export function CapabilityNote({
  reason,
  proved,
  className,
}: {
  /** Why this cannot be computed, in the backend's own words. */
  reason: string
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
