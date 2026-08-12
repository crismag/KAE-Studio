import { Link } from 'react-router-dom'
import { ArrowRight, Ban, Check } from 'lucide-react'
import { PreliminaryContextPanel } from '@/components/project/PreliminaryContextPanel'
import { PageLayout } from '@/components/project/PageLayout'
import { StatusBadge } from '@/components/project/statusVocabulary'
import { CapabilityNote } from '@/components/project/CapabilityNote'
import { unavailableReason } from '@/components/project/unavailableReason'
import {
  Mono,
  Panel,
  PanelBody,
  PanelHeader,
  PanelTitle,
  Skeleton,
} from '@/components/ui/primitives'
import { useProjection } from '@/hooks/useProject'
import type { DefinitionStatement } from '@/domain/types'

function StatementList({ items }: { items: DefinitionStatement[] }) {
  return (
    <ul className="divide-y divide-line">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
        >
          <div className="flex min-w-0 gap-3">
            <Mono className="mt-0.5 shrink-0">{item.id}</Mono>
            <p className="text-[13.5px] leading-relaxed text-ink">{item.text}</p>
          </div>
          <div className="shrink-0">
            <StatusBadge status={item.status} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function ProjectDefinition() {
  const { data: projection, isLoading } = useProjection()

  if (isLoading || !projection) {
    return (
      <PageLayout title="Project Definition">
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-48" />
        </div>
      </PageLayout>
    )
  }

  const { definition } = projection

  // Read per section rather than as a list, so each panel states its own limit
  // where the answer would have gone. `undefined` means the backend computed
  // that section fine — an empty result there is a fact about the project.
  //
  // **The `definition.` prefix is not decoration.** `build_definition` emits
  // `definition.value`, and these looked up a bare `value` — so from the moment
  // this was written until it was caught, every one of these returned
  // `undefined` and the panels rendered exactly as blankly as before. A repair
  // that looks right and does nothing is the same defect it was repairing.
  const valueGap = unavailableReason(projection.unavailable, 'definition.value')
  const inScopeGap = unavailableReason(projection.unavailable, 'definition.inScope')
  const outOfScopeGap = unavailableReason(projection.unavailable, 'definition.outOfScope')
  const workflowsGap = unavailableReason(projection.unavailable, 'definition.workflows')

  return (
    <PageLayout
      title="Project Definition"
      lead="What this project is, who it serves, and where its boundaries fall. Every statement here is a projection of current project knowledge held in KAE-Memory."
    >
      <div className="space-y-6">
        <Panel>
          <PanelHeader>
            <PanelTitle>Problem and value</PanelTitle>
          </PanelHeader>
          <PanelBody className="space-y-4">
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                The problem
              </h3>
              <p className="mt-1.5 max-w-3xl text-[13.5px] leading-relaxed text-ink">
                {definition.problem}
              </p>
            </div>
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                The value
              </h3>
              {valueGap ? (
                <CapabilityNote className="mt-1.5 max-w-3xl" reason={valueGap} />
              ) : (
                <p className="mt-1.5 max-w-3xl text-[13.5px] leading-relaxed text-ink">
                  {definition.value}
                </p>
              )}
            </div>
            <div>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                Objectives
              </h3>
              <StatementList items={definition.objectives} />
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Stakeholders and users</PanelTitle>
          </PanelHeader>
          <PanelBody className="px-0 py-0">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-wider text-ink-subtle">
                  <th scope="col" className="px-5 py-2.5 font-semibold">
                    Stakeholder
                  </th>
                  <th scope="col" className="hidden px-5 py-2.5 font-semibold sm:table-cell">
                    Role
                  </th>
                  <th scope="col" className="px-5 py-2.5 font-semibold">
                    Interest
                  </th>
                  <th scope="col" className="px-5 py-2.5 font-semibold">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {definition.stakeholders.map((s) => (
                  <tr key={s.id} className="align-top">
                    <td className="px-5 py-3">
                      <p className="text-[13.5px] font-medium text-ink">{s.name}</p>
                      <Mono>{s.id}</Mono>
                    </td>
                    {/* Absence renders as absence. KAE-Memory holds a
                        stakeholder as one `actor` statement with no separate
                        role or interest, so these are genuinely empty for a
                        real project — and a blank cell reads as "nobody filled
                        this in" rather than "this source does not carry it". */}
                    <td className="hidden px-5 py-3 text-[13px] text-ink-muted sm:table-cell">
                      {s.role || <span className="italic text-ink-subtle">Not recorded</span>}
                    </td>
                    <td className="px-5 py-3 text-[13px] leading-relaxed text-ink-muted">
                      {s.interest || <span className="italic text-ink-subtle">Not recorded</span>}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PanelBody>
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel>
            <PanelHeader>
              <PanelTitle>In scope</PanelTitle>
              <Check className="size-4 text-confirmed" aria-hidden="true" />
            </PanelHeader>
            <PanelBody>
              {inScopeGap ? (
                <CapabilityNote reason={inScopeGap} />
              ) : (
                <StatementList items={definition.inScope} />
              )}
            </PanelBody>
          </Panel>
          <Panel>
            <PanelHeader>
              <PanelTitle>Explicitly out of scope</PanelTitle>
              <Ban className="size-4 text-ink-subtle" aria-hidden="true" />
            </PanelHeader>
            <PanelBody>
              {outOfScopeGap ? (
                <CapabilityNote reason={outOfScopeGap} />
              ) : (
                <StatementList items={definition.outOfScope} />
              )}
            </PanelBody>
          </Panel>
        </div>

        <Panel>
          <PanelHeader>
            <PanelTitle>Business workflows</PanelTitle>
          </PanelHeader>
          <PanelBody className="space-y-6">
            {workflowsGap && <CapabilityNote reason={workflowsGap} />}
            {definition.workflows.map((wf) => (
              <div key={wf.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[13.5px] font-semibold text-ink">{wf.name}</h3>
                  <Mono>{wf.id}</Mono>
                  <StatusBadge status={wf.status} />
                </div>
                <ol className="mt-3 space-y-0">
                  {wf.steps.map((step, i) => (
                    <li key={`${wf.id}-${i}`} className="flex gap-3 pb-3 last:pb-0">
                      <div className="flex flex-col items-center">
                        <span className="grid size-5 shrink-0 place-items-center rounded-full border border-line-strong bg-surface font-mono text-[10px] text-ink-muted">
                          {i + 1}
                        </span>
                        {i < wf.steps.length - 1 && <span className="mt-1 w-px flex-1 bg-line" />}
                      </div>
                      <p className="pt-0.5 text-[13px] leading-relaxed text-ink-muted">
                        <span className="font-medium text-ink">{step.actor}</span> — {step.action}
                      </p>
                    </li>
                  ))}
                </ol>
                <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-ink-subtle">
                  Realised by
                  {wf.realizedBy.map((m) => (
                    <Link
                      key={m}
                      to="/modules"
                      className="font-mono text-[11px] text-accent-ink underline-offset-2 hover:underline"
                    >
                      {m}
                    </Link>
                  ))}
                </p>
              </div>
            ))}
          </PanelBody>
        </Panel>

        {/* Before the definition's own assumptions and constraints, because
            this is what those were derived *from*, and after the definition
            itself, because a reader arrives here asking what the project is
            rather than how sure KAE is about it (`D-18`). */}
        <PreliminaryContextPanel preliminary={projection.preliminary} />

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel>
            <PanelHeader>
              <PanelTitle>Assumptions</PanelTitle>
            </PanelHeader>
            <PanelBody>
              <StatementList items={definition.assumptions} />
              <p className="mt-3 text-[11.5px] leading-relaxed text-ink-subtle">
                Assumptions are unverified. Each becomes a risk if it turns out to be wrong.
              </p>
            </PanelBody>
          </Panel>
          <Panel>
            <PanelHeader>
              <PanelTitle>Constraints</PanelTitle>
            </PanelHeader>
            <PanelBody>
              <StatementList items={definition.constraints} />
            </PanelBody>
          </Panel>
        </div>

        <p className="flex items-center gap-1.5 text-[12.5px] text-ink-muted">
          Continue shaping this in the
          <Link
            to="/workspace"
            className="inline-flex items-center gap-1 text-accent-ink underline-offset-2 hover:underline"
          >
            Workspace
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </p>
      </div>
    </PageLayout>
  )
}
