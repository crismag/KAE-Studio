/**
 * Gaps somebody owns and must close (`D-29`).
 *
 * KAE-Memory models blockers deliberately outside the knowledge lifecycle:
 * *"an `unknown` knowledge item is a gap in what we know; a blocker is a gap
 * someone owns and must close."* It has routes to raise and resolve them, and
 * `readiness_service` gates on them — **only `critical` stops generation**.
 *
 * Studio's backend carried them faithfully. The adapter typed them `unknown[]`
 * and mapped them nowhere, so the only place a person met a blocker was that
 * gate: a refusal at the moment they tried to produce a package, with no
 * earlier sign that anything stood in the way.
 *
 * ## Listed, never counted
 *
 * *"2 blockers"* is the shape that hides which one is critical, and only one
 * severity stops anything. Each is named, with who owns closing it, because a
 * gap with no owner named is a gap that stays open.
 *
 * ## Nothing here closes one
 *
 * Resolving a blocker is somebody taking responsibility for a gap. The route
 * exists; this surface does not call it, for the same reason `REV-AUTO` is
 * still open — a decision recorded on a person's behalf is not their decision.
 */

import { TriangleAlert } from 'lucide-react'

import { Badge, Panel, PanelBody, PanelHeader, PanelTitle } from '@/components/ui/primitives'
import { openBlockers } from '@/components/project/openBlockers'
import type { ProjectBlocker } from '@/domain/types'

export function Blockers({ blockers }: { blockers: ProjectBlocker[] }) {
  const standing = openBlockers(blockers)
  const closed = blockers.filter((blocker) => blocker.status === 'resolved')
  if (standing.length === 0 && closed.length === 0) return null

  const critical = standing.filter((blocker) => blocker.severity === 'critical')

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Blocked on someone</PanelTitle>
      </PanelHeader>
      <PanelBody className="space-y-4">
        {critical.length > 0 && (
          // The consequence, before the list, and **stated accurately** — the
          // first version of this said KAE "will not generate a development
          // package while it stands", which is not true (`D-32`).
          //
          // `readiness_service` computes `implementation_eligible = … and not
          // blocked`, `assembly_service` passes that flag into the blueprint,
          // and **nothing refuses**. A critical blocker marks the result; it
          // does not withhold it. Telling somebody they are stopped when they
          // are not is worse than the defects that sentence was written to
          // replace, because they will not try what the product allows.
          <p role="alert" className="text-[12.5px] leading-relaxed text-blocking">
            {critical.length === 1 ? 'A critical blocker is' : 'Critical blockers are'} standing. A
            development package generated now will be marked{' '}
            <strong>not ready for implementation</strong>.
          </p>
        )}

        {standing.length > 0 ? (
          <ul className="space-y-2.5">
            {standing.map((blocker) => (
              <li
                key={blocker.id}
                className="rounded-md border border-line bg-surface-sunken px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <TriangleAlert
                    className={`size-3.5 shrink-0 ${
                      blocker.severity === 'critical' ? 'text-blocking' : 'text-attention'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="text-[13px] font-medium text-ink">{blocker.summary}</span>
                  {/* Memory's grade, shown as a grade. `D-17`: a field that
                      renames a severity into a reason keeps neither. */}
                  <Badge tone={blocker.severity === 'critical' ? 'blocking' : 'attention'}>
                    {blocker.severity || 'ungraded'}
                  </Badge>
                </div>
                <p className="mt-1 text-[11.5px] text-ink-subtle">
                  {blocker.owner
                    ? `${blocker.owner} owns closing this`
                    : 'Nobody has been named to close this'}
                  {blocker.areaKey && ` · ${blocker.areaKey.replace(/_/g, ' ')}`}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12.5px] text-ink-muted">Nothing is blocking this project.</p>
        )}

        {closed.length > 0 && (
          <details className="border-t border-line pt-3">
            {/* Kept rather than dropped. Memory retains a resolved blocker
                because *"this was dealt with"* is a different fact from *"this
                was wrong"*, and a list that discarded them would make "what was
                blocking us, and who closed it?" unanswerable from the product. */}
            <summary className="cursor-pointer text-[11.5px] text-ink-subtle">
              {closed.length === 1
                ? '1 blocker was closed'
                : `${closed.length} blockers were closed`}
            </summary>
            <ul className="mt-2 space-y-2">
              {closed.map((blocker) => (
                <li key={blocker.id} className="text-[12px] leading-relaxed text-ink-muted">
                  <span className="text-ink">{blocker.summary}</span>
                  {blocker.resolutionNote && (
                    <span className="block text-[11.5px] text-ink-subtle">
                      {blocker.resolutionNote}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </PanelBody>
    </Panel>
  )
}
