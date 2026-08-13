/**
 * What this project is fit for, before somebody generates from it (`D-33`).
 *
 * KAE-Memory computes two facts — `draft_eligible` and
 * `implementation_eligible` — and Studio carried neither, while the Dashboard
 * pointed at one of them in a sentence. So the one honest thing about
 * generating early, *the output will say what it is*, had never been visible to
 * the person deciding whether to generate.
 *
 * ## Two facts, never one score
 *
 * *Is there enough here to draft from* and *is this safe to build from* are
 * different questions with different answers, and most projects sit between
 * them for a long time. A single "ready" collapses the distinction the whole
 * readiness model exists to draw, and a percentage over two booleans says less
 * than the booleans — `ADR-0003`, for the same reason it ruled setup.
 *
 * ## What it does not do
 *
 * It does not stop anything. Nothing in the estate refuses to generate on these
 * flags (`D-32`): `implementation_eligible` travels into the package as a
 * marking. Saying *"you cannot"* here would be the claim `D-32` had to
 * withdraw, made a second time.
 */

import { Check, CircleDashed } from 'lucide-react'

import type { ProjectHealth } from '@/domain/types'

export function FitFor({ health }: { health: ProjectHealth }) {
  return (
    <div className="rounded-md border border-line bg-surface-sunken px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
        What this project is fit for
      </p>
      <ul className="mt-2 space-y-1.5">
        <Fit
          met={health.draftEligible}
          met_text="Enough is established to draft from."
          unmet_text="Not enough is established to draft from yet."
        />
        <Fit
          met={health.implementationEligible}
          met_text="Safe to build from — every mandatory area is covered and nothing critical is open."
          unmet_text="Not safe to build from. A package generated now is marked accordingly and can still be produced."
        />
      </ul>
    </div>
  )
}

function Fit({
  met,
  met_text,
  unmet_text,
}: {
  met: boolean
  met_text: string
  unmet_text: string
}) {
  const Icon = met ? Check : CircleDashed
  return (
    <li className="flex items-start gap-2 text-[12px] leading-relaxed">
      {/* Never colour alone: the icon differs in shape as well as tone, and the
          sentence says which state it is in without either. */}
      <Icon
        className={`mt-0.5 size-3.5 shrink-0 ${met ? 'text-confirmed' : 'text-ink-subtle'}`}
        aria-hidden="true"
      />
      <span className={met ? 'text-ink' : 'text-ink-muted'}>{met ? met_text : unmet_text}</span>
    </li>
  )
}
