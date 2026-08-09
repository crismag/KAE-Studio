/**
 * Advice you can act on, and a conclusion you can see the weight of.
 *
 * ## Why a card and not another paragraph
 *
 * KAE can now advise (C-3) and conclude (C-4), and both arrived as prose — so
 * taking the advice meant retyping it into the conversation. This product
 * already measured that cost when "Discuss this" prefilled a box nobody sent.
 *
 * **The three dispositions cost the same.** If accepting were a click and
 * disagreeing a paragraph, the interface would have a thumb on the scale, and
 * the agreement it collected would mean less for it.
 *
 * ## Why the conclusion is shown at all
 *
 * `Consequence` decides whether a person is interrupted. If nothing renders it,
 * the grading was for the model's benefit only — and a threshold nobody can see
 * is a threshold nobody can check. A material conclusion invites disagreement;
 * a routine one is a quiet line, which is the whole point of grading them.
 *
 * ## What this must not become
 *
 * A turn that offers three buttons and no sentence is a wizard, which is what
 * the PPA reframe rejected. The contract keeps ordinary Markdown conversation
 * first-class: every disposition here can also be reached by typing, and the
 * card sits beneath the prose rather than replacing it.
 */

import { useState } from 'react'
import { Button } from '@/components/ui/primitives'

export interface Recommendation {
  advice: string
  reason: string
  consequence: string
}

export interface Concluded {
  statement: string
  consequence: string
  revisitWhen: string
  material: boolean
}

export type Disposition = 'accept' | 'modify' | 'keep_open'

/** How a revisit trigger reads to somebody who did not write the enum. */
const REVISIT: Record<string, string> = {
  never: 'not revisited',
  on_request: 'revisited if you ask',
  before_build: 'revisited before building',
  before_production: 'revisited before production',
  on_conflicting_evidence: 'revisited if something contradicts it',
}

export function RecommendationCard({
  recommendation,
  onDecide,
}: {
  recommendation: Recommendation
  onDecide: (disposition: Disposition, modifiedTo?: string) => Promise<void> | void
}) {
  const [state, setState] = useState<'idle' | 'editing' | 'saving' | 'done' | 'failed'>('idle')
  const [edited, setEdited] = useState(recommendation.advice)
  const [taken, setTaken] = useState<Disposition | null>(null)

  const decide = async (disposition: Disposition, modifiedTo?: string) => {
    setState('saving')
    try {
      await onDecide(disposition, modifiedTo)
      setTaken(disposition)
      setState('done')
    } catch {
      // Never reported as success. An interface that showed "recorded" after a
      // write that did not happen is the same lie as a sentence claiming a
      // confirmation it never made.
      setState('failed')
    }
  }

  if (state === 'done') {
    return (
      <p className="text-[12.5px] text-confirmed-ink">
        {taken === 'keep_open'
          ? 'Kept open — KAE will raise it again before building.'
          : 'Recorded as your decision, with KAE noted as having suggested it.'}
      </p>
    )
  }

  return (
    <section
      aria-label="KAE recommends"
      className="rounded-panel border border-line bg-surface-sunken/60 px-4 py-3"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
        KAE recommends
      </p>

      {state === 'editing' ? (
        <textarea
          aria-label="Edit the recommendation"
          value={edited}
          onChange={(e) => setEdited(e.target.value)}
          rows={2}
          className="mt-1.5 w-full resize-none rounded-md border border-line-strong bg-surface px-3 py-2 text-[13.5px] text-ink outline-none focus:border-accent"
        />
      ) : (
        <p className="mt-1 text-[14px] leading-snug text-ink">{recommendation.advice}</p>
      )}

      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
        {recommendation.reason}
      </p>
      {/* What accepting commits to. Advice whose cost is not stated asks for
          agreement rather than a decision. */}
      <p className="mt-1 text-[12px] leading-relaxed text-ink-subtle">
        If you accept: {recommendation.consequence}
      </p>

      <div className="mt-2.5 flex flex-wrap gap-2">
        {state === 'editing' ? (
          <>
            <Button size="sm" variant="secondary" onClick={() => decide('modify', edited)}>
              Save my wording
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setState('idle')}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="secondary" disabled={state === 'saving'}
              onClick={() => decide('accept')}>
              Accept
            </Button>
            <Button size="sm" variant="ghost" disabled={state === 'saving'}
              onClick={() => setState('editing')}>
              Modify
            </Button>
            <Button size="sm" variant="ghost" disabled={state === 'saving'}
              onClick={() => decide('keep_open')}>
              Keep open
            </Button>
          </>
        )}
      </div>

      {state === 'failed' && (
        <p className="mt-2 text-[12.5px] text-blocking">
          Not recorded — nothing was saved. Try again.
        </p>
      )}
    </section>
  )
}

/**
 * What a turn settled on its own account.
 *
 * Material ones are set apart and invite disagreement. Routine ones are a quiet
 * line — which is the point of the threshold: interrupting for everything is
 * what produced eighty-one review items on a first project.
 */
export function ConcludedList({ concluded }: { concluded: Concluded[] }) {
  if (concluded.length === 0) return null

  return (
    <ul className="space-y-1.5">
      {concluded.map((c) => (
        <li
          key={c.statement}
          className={
            c.material
              ? 'rounded-panel border-l-2 border-attention bg-attention-soft/40 px-3 py-2'
              : ''
          }
        >
          <p
            className={
              c.material
                ? 'text-[13px] leading-relaxed text-ink'
                : 'text-[12px] leading-relaxed text-ink-subtle'
            }
          >
            {c.material && (
              <span className="font-medium">Working assumption — say if you disagree: </span>
            )}
            {c.statement}
            <span className="text-ink-subtle">
              {' '}
              ({REVISIT[c.revisitWhen] ?? c.revisitWhen})
            </span>
          </p>
        </li>
      ))}
    </ul>
  )
}
