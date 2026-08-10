/**
 * The parts of this project Studio could not read, said where they are missed.
 *
 * ## Not the same thing as a `CapabilityNote`
 *
 * A capability note says *KAE cannot derive this* — a stable limit of the
 * product, stated quietly because it is not a defect in the user's project.
 * This says *we could not read this, this time*. It is transient, it may
 * resolve on a reload, and the number beside it is wrong rather than low.
 *
 * ## Why it exists
 *
 * `projection.py` wraps every Memory call in `_safe`, and a failure becomes an
 * entry in `unavailable[]` with a default substituted for the section — `{}`
 * for readiness, which `_health` turns into `percentage: 0`, `status:
 * "unknown"` and no areas at all.
 *
 * So a project whose readiness call failed rendered as **`0% understood` with
 * every area missing**: a confident statement about a project nobody had read.
 * The reason was on the wire the whole time. `AUD-002` fixed the four
 * `definition.*` gaps, which are looked up by name — and the seven section
 * names that carry a *failure* had no reader at all (`AUD-040`).
 *
 * ## Why it is a catch-all rather than seven named lookups
 *
 * A named lookup only shows what someone remembered to ask for, and the backend
 * adds sections faster than the UI adds lookups — which is exactly how the
 * original finding survived. This renders **everything not claimed by an inline
 * surface**, so a section added to `projection.py` tomorrow appears here
 * without a change on this side. Ugly beats invisible.
 */

import { AlertTriangle } from 'lucide-react'

import type { SectionUnavailable } from '@/domain/types'
import { sectionsNotRead } from './sectionsNotRead'

/** How each section reads to somebody who does not know the backend's names. */
const SECTION_LABEL: Record<string, string> = {
  project: 'the project record',
  readiness: 'readiness',
  knowledge: 'what the project holds',
  clarifications: 'open questions',
  blockers: 'blockers',
  preliminary_context: 'preliminary context',
  extraction_coverage: 'how much was read',
}

export function SectionsNotRead({
  unavailable,
}: {
  unavailable: SectionUnavailable[] | undefined
}) {
  const entries = sectionsNotRead(unavailable)
  // Nothing standing when nothing failed. A panel that is always present is a
  // panel nobody reads, and this one has to be believed the once it appears.
  if (entries.length === 0) return null

  return (
    <div
      role="alert"
      className="rounded-panel border border-attention-line bg-attention-soft px-3.5 py-3"
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-attention" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold text-ink">
            Some of this project could not be read
          </p>
          {/* The consequence, before the causes. A reader who stops after one
              sentence must still come away knowing not to trust the numbers. */}
          <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
            What is shown below is missing these parts, so counts and percentages are lower than the
            project's own.
          </p>
          <ul className="mt-2 space-y-1.5">
            {entries.map((entry) => (
              <li key={entry.section} className="text-[12px] leading-relaxed text-ink-muted">
                {/* The backend's own words, unparaphrased — they name the
                    failure, and a summary of an error is not one. */}
                <span className="font-medium text-ink">
                  {SECTION_LABEL[entry.section] ?? entry.section}
                </span>{' '}
                — {entry.reason}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
