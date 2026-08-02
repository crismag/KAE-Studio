import { useState } from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { ChevronRight, Quote, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/format'
import { PageLayout } from '@/components/project/PageLayout'
import { StatusBadge } from '@/components/project/statusVocabulary'
import { CATEGORY_LABEL } from '@/components/project/labels'
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
import { useProjection } from '@/hooks/useProject'
import type { AcceptanceTest, ProjectModule, Requirement } from '@/domain/types'

const CATEGORY_ORDER: Requirement['category'][] = [
  'functional',
  'business_rule',
  'integration',
  'security',
  'quality',
  'operational',
]

function RequirementRow({
  requirement,
  modules,
  tests,
}: {
  requirement: Requirement
  modules: ProjectModule[]
  tests: AcceptanceTest[]
}) {
  const [open, setOpen] = useState(false)
  const module = modules.find((m) => m.id === requirement.moduleId)
  const verifying = tests.filter((t) => requirement.verifiedBy.includes(t.id))

  return (
    <li className="px-5 py-3.5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <Mono className="mt-0.5 shrink-0">{requirement.id}</Mono>
          <div className="min-w-0">
            <p className="text-[13.5px] leading-relaxed text-ink">{requirement.statement}</p>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-ink-subtle">
              {module ? (
                <span>
                  Implemented by <span className="text-ink-muted">{module.name}</span>
                </span>
              ) : (
                <span className="text-attention">No owning module</span>
              )}
              {verifying.length > 0 ? (
                <span>
                  Verified by{' '}
                  {verifying.map((t, i) => (
                    <span key={t.id} className="font-mono">
                      {i > 0 && ', '}
                      {t.id}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="text-attention">Not verified by any test</span>
              )}
              {requirement.satisfies.length > 0 && (
                <span>
                  Satisfies <span className="font-mono">{requirement.satisfies.join(', ')}</span>
                </span>
              )}
              <span>Updated {formatDateTime(requirement.updatedAt)}</span>
            </div>

            {requirement.clarificationNeeded && (
              <p className="mt-2 flex items-start gap-2 rounded-md border border-attention-line bg-attention-soft/50 px-3 py-2 text-[12.5px] leading-relaxed text-ink-muted">
                <TriangleAlert
                  className="mt-0.5 size-3.5 shrink-0 text-attention"
                  aria-hidden="true"
                />
                {requirement.clarificationNeeded}
              </p>
            )}

            <Collapsible.Root open={open} onOpenChange={setOpen}>
              <Collapsible.Trigger asChild>
                <button
                  type="button"
                  className="mt-2 inline-flex items-center gap-1 text-[12px] text-accent-ink underline-offset-2 hover:underline"
                >
                  <ChevronRight
                    className={cn('size-3.5 transition-transform', open && 'rotate-90')}
                    aria-hidden="true"
                  />
                  Why this is here
                </button>
              </Collapsible.Trigger>
              <Collapsible.Content>
                <div className="mt-2 space-y-2 rounded-md border border-line bg-surface-sunken/60 px-3.5 py-3">
                  {requirement.trace.map((t) => (
                    <figure key={t.evidenceId}>
                      <blockquote className="flex gap-2 text-[12.5px] leading-relaxed text-ink-muted">
                        <Quote
                          className="mt-0.5 size-3 shrink-0 text-ink-subtle"
                          aria-hidden="true"
                        />
                        <span>“{t.quotedText}”</span>
                      </blockquote>
                      <figcaption className="mt-1 pl-5 text-[11px] text-ink-subtle">
                        {t.sourceLabel} · evidence <span className="font-mono">{t.evidenceId}</span>
                      </figcaption>
                    </figure>
                  ))}
                  <p className="border-t border-line pt-2 text-[11px] text-ink-subtle">
                    Provenance is held by KAE-Memory. Studio displays it; it does not own it.
                  </p>
                </div>
              </Collapsible.Content>
            </Collapsible.Root>
          </div>
        </div>
        <div className="shrink-0">
          <StatusBadge status={requirement.status} />
        </div>
      </div>
    </li>
  )
}

export function Requirements() {
  const { data: projection, isLoading } = useProjection()
  const [filter, setFilter] = useState<'all' | 'confirmed' | 'proposed' | 'contested'>('all')

  if (isLoading || !projection) {
    return (
      <PageLayout title="Requirements">
        <Skeleton className="h-96" />
      </PageLayout>
    )
  }

  const filtered = projection.requirements.filter((r) => filter === 'all' || r.status === filter)
  const counts = {
    all: projection.requirements.length,
    confirmed: projection.requirements.filter((r) => r.status === 'confirmed').length,
    proposed: projection.requirements.filter((r) => r.status === 'proposed').length,
    contested: projection.requirements.filter((r) => r.status === 'contested').length,
  }

  return (
    <PageLayout
      title="Requirements"
      lead="What must be true for this project to be correct. Each requirement carries a stable identifier, the module that implements it, and the tests that verify it."
      actions={
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by status">
          {(['all', 'confirmed', 'proposed', 'contested'] as const).map((key) => (
            <Button
              key={key}
              variant={filter === key ? 'subtle' : 'ghost'}
              size="sm"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className="capitalize"
            >
              {key === 'contested' ? 'Needs clarification' : key}
              <span className="text-ink-subtle">{counts[key]}</span>
            </Button>
          ))}
        </div>
      }
    >
      <div className="space-y-6">
        {CATEGORY_ORDER.map((category) => {
          const items = filtered.filter((r) => r.category === category)
          if (items.length === 0) return null
          return (
            <Panel key={category}>
              <PanelHeader>
                <PanelTitle>{CATEGORY_LABEL[category]}</PanelTitle>
                <Badge tone="neutral">{items.length}</Badge>
              </PanelHeader>
              <PanelBody className="px-0 py-0">
                <ul className="divide-y divide-line">
                  {items.map((r) => (
                    <RequirementRow
                      key={r.id}
                      requirement={r}
                      modules={projection.modules}
                      tests={projection.acceptanceTests}
                    />
                  ))}
                </ul>
              </PanelBody>
            </Panel>
          )
        })}

        <Panel>
          <PanelHeader>
            <PanelTitle>Acceptance criteria</PanelTitle>
            <Badge tone="neutral">{projection.acceptanceTests.length}</Badge>
          </PanelHeader>
          <PanelBody className="px-0 py-0">
            <ul className="divide-y divide-line">
              {projection.acceptanceTests.map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-4 px-5 py-3">
                  <div className="flex min-w-0 gap-3">
                    <Mono className="mt-0.5 shrink-0">{t.id}</Mono>
                    <div>
                      <p className="text-[13.5px] leading-relaxed text-ink">{t.statement}</p>
                      <p className="mt-1 text-[11.5px] text-ink-subtle">
                        Verifies <span className="font-mono">{t.verifies.join(', ')}</span>
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <StatusBadge status={t.status} />
                  </div>
                </li>
              ))}
            </ul>
          </PanelBody>
        </Panel>
      </div>
    </PageLayout>
  )
}
