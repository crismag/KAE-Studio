import {
  Bot,
  Check,
  CircleHelp,
  GitCompareArrows,
  HelpCircle,
  ShieldQuestion,
  X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { PageLayout } from '@/components/project/PageLayout'
import {
  Badge,
  Button,
  Mono,
  Panel,
  PanelBody,
  PanelHeader,
  PanelTitle,
  Skeleton,
} from '@/components/ui/primitives'
import { EmptyState } from '@/components/ui/primitives'
import { useConfirmFinding, useProjection } from '@/hooks/useProject'
import type { FindingKind, ReviewFinding } from '@/domain/types'

const GROUPS: { kind: FindingKind; title: string; description: string; icon: typeof CircleHelp }[] =
  [
    {
      kind: 'open_decision',
      title: 'Unresolved decisions',
      description:
        'Questions that must be answered by a person. Studio will not answer them for you.',
      icon: HelpCircle,
    },
    {
      kind: 'contradiction',
      title: 'Contradictions',
      description: 'Two recorded statements that cannot both hold. Both sources are preserved.',
      icon: GitCompareArrows,
    },
    {
      kind: 'requirement_gap',
      title: 'Gaps',
      description: 'Something the definition needs that nothing currently provides.',
      icon: CircleHelp,
    },
    {
      kind: 'unverified_requirement',
      title: 'Unverified requirements',
      description: 'Requirements with no acceptance test. They cannot be shown to be met.',
      icon: ShieldQuestion,
    },
    {
      kind: 'agent_proposal',
      title: 'Agent-proposed knowledge',
      description:
        'Discovered by a coding agent during implementation and submitted through KAE MCP. Proposed until a person confirms it.',
      icon: Bot,
    },
  ]

const SEVERITY_TONE = {
  critical: 'blocking',
  major: 'attention',
  minor: 'neutral',
} as const

function FindingCard({ finding }: { finding: ReviewFinding }) {
  const confirm = useConfirmFinding()

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={SEVERITY_TONE[finding.severity]} className="capitalize">
              {finding.severity}
            </Badge>
            <p className="text-[13.5px] font-medium leading-snug text-ink">{finding.summary}</p>
          </div>
          <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-ink-muted">
            {finding.detail}
          </p>

          {finding.competingStatements && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {finding.competingStatements.map((s, i) => (
                <div
                  key={s.text}
                  className={cn(
                    'rounded-md border px-3 py-2.5',
                    i === 0
                      ? 'border-line bg-surface-sunken/60'
                      : 'border-attention-line bg-attention-soft/40',
                  )}
                >
                  <p className="text-[12.5px] leading-relaxed text-ink">“{s.text}”</p>
                  <p className="mt-1 text-[11px] text-ink-subtle">{s.sourceLabel}</p>
                </div>
              ))}
            </div>
          )}

          {finding.agentOrigin && (
            <div className="mt-3 rounded-md border border-line bg-surface-sunken/60 px-3.5 py-2.5">
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-subtle">
                <span className="inline-flex items-center gap-1.5 text-ink-muted">
                  <Bot className="size-3.5" aria-hidden="true" />
                  {finding.agentOrigin.agent}
                </span>
                <span className="font-mono">{finding.agentOrigin.repository}</span>
                <span className="font-mono">@{finding.agentOrigin.commit}</span>
                <span>from revision {finding.agentOrigin.memoryRevision}</span>
              </p>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-subtle">
                Recorded as evidence, not instruction. An agent cannot change the project
                definition.
              </p>
            </div>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {finding.subjectIds.map((id) => (
              <Mono key={id}>{id}</Mono>
            ))}
          </div>
        </div>

        {finding.kind === 'agent_proposal' && (
          <div className="flex shrink-0 gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => confirm.mutate(finding.id)}
              disabled={confirm.isPending}
            >
              <Check className="size-3.5" aria-hidden="true" />
              Confirm
            </Button>
            <Button variant="ghost" size="sm" onClick={() => confirm.mutate(finding.id)}>
              <X className="size-3.5" aria-hidden="true" />
              Reject
            </Button>
          </div>
        )}
      </div>
    </li>
  )
}

export function Reviews() {
  const { data: projection, isLoading } = useProjection()

  if (isLoading || !projection) {
    return (
      <PageLayout title="Reviews">
        <Skeleton className="h-96" />
      </PageLayout>
    )
  }

  const critical = projection.findings.filter((f) => f.severity === 'critical').length

  return (
    <PageLayout
      title="Reviews"
      lead="What the definition is missing, where it contradicts itself, and what is waiting on a person. This is the screen that decides whether a module is safe to hand to implementation."
      actions={
        <div className="flex gap-2">
          <Badge tone={critical > 0 ? 'blocking' : 'confirmed'}>{critical} critical</Badge>
          <Badge tone="neutral">{projection.findings.length} total</Badge>
        </div>
      }
    >
      <div className="space-y-6">
        {GROUPS.map((group) => {
          const items = projection.findings.filter((f) => f.kind === group.kind)
          const Icon = group.icon
          return (
            <Panel key={group.kind}>
              <PanelHeader>
                <div className="flex min-w-0 items-start gap-2.5">
                  <Icon className="mt-0.5 size-4 shrink-0 text-ink-subtle" aria-hidden="true" />
                  <div>
                    <PanelTitle>{group.title}</PanelTitle>
                    <p className="mt-0.5 max-w-2xl text-[12px] leading-relaxed text-ink-muted">
                      {group.description}
                    </p>
                  </div>
                </div>
                <Badge tone={items.length > 0 ? 'attention' : 'confirmed'}>{items.length}</Badge>
              </PanelHeader>
              <PanelBody className="px-0 py-0">
                {items.length === 0 ? (
                  <div className="px-5 py-4">
                    <p className="text-[12.5px] text-ink-subtle">Nothing outstanding here.</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-line">
                    {items.map((f) => (
                      <FindingCard key={f.id} finding={f} />
                    ))}
                  </ul>
                )}
              </PanelBody>
            </Panel>
          )
        })}

        {projection.findings.length === 0 && (
          <EmptyState title="No outstanding findings">
            Everything recorded so far is confirmed, verified, and internally consistent.
          </EmptyState>
        )}
      </div>
    </PageLayout>
  )
}
