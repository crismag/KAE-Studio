import { useState } from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { ArrowRight, ChevronRight, HelpCircle, Quote, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/format'
import { PageLayout } from '@/components/project/PageLayout'
import { StatusBadge } from '@/components/project/statusVocabulary'
import { CATEGORY_LABEL } from '@/components/project/labels'
import { useKnowledgeTrace } from '@/hooks/useProject'
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
  'quality',
  'constraint',
  'user_need',
  'integration',
  'security',
  'operational',
  'decision',
  'assumption',
  // Deliberately last. A question is not a requirement, and putting it among
  // them was the single most confusing thing on this page.
  'open_question',
]

/** Short labels for the leftmost column — what an item is, not where it is stored. */
const CATEGORY_SHORT: Record<string, string> = {
  functional: 'Requirement',
  business_rule: 'Rule',
  quality: 'Quality',
  constraint: 'Constraint',
  user_need: 'User',
  integration: 'Integration',
  security: 'Security',
  operational: 'Operational',
  decision: 'Decision',
  assumption: 'Assumption',
  open_question: 'Question',
}

/**
 * U3. Stored provenance, fetched from KAE-Memory's trace endpoint.
 *
 * **Not a model explaining itself.** The distinction matters more here than
 * anywhere else on the page: a generated rationale reads exactly like recorded
 * evidence, and a reader cannot tell them apart. Everything below came out of
 * the record.
 */
function Provenance({ knowledgeId, status }: { knowledgeId: string; status: string }) {
  const { data, isLoading, isError } = useKnowledgeTrace(knowledgeId)

  if (isLoading) return <p className="text-[12px] text-ink-subtle">Reading provenance…</p>
  if (isError || !data)
    return (
      <p className="text-[12px] text-ink-subtle">
        Provenance could not be read. Nothing is being guessed in its place.
      </p>
    )

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
      <dt className="text-ink-subtle">Recorded as</dt>
      <dd className="text-ink-muted">{data.kind}</dd>
      <dt className="text-ink-subtle">State</dt>
      <dd className="text-ink-muted">
        {status === 'confirmed' ? 'confirmed by a person' : status}
      </dd>
      <dt className="text-ink-subtle">Derived from</dt>
      <dd className="text-ink-muted">
        {data.source_message_ids?.length
          ? `${data.source_message_ids.length} message(s) in this project's conversation`
          : 'no recorded source message'}
      </dd>
      {data.produced_by_run_id && (
        <>
          <dt className="text-ink-subtle">By</dt>
          <dd className="text-ink-muted">an extraction run</dd>
        </>
      )}
    </dl>
  )
}

/**
 * U4. What a person can do about this row now.
 *
 * Derived from the item's own state, not planned. Studio has no planning engine
 * and must not grow one — where the domain has no next action, this renders
 * nothing rather than inventing advice.
 */
function NextAction({ status, category }: { status: string; category: string }) {
  const action =
    status === 'proposed'
      ? category === 'open_question'
        ? 'Answer this, or record it as an assumption — it is a gap KAE found, not a claim.'
        : 'Review this on the Reviews page: confirm it, correct it, or reject it.'
      : status === 'contested'
        ? 'Two statements disagree. Resolving it needs a person.'
        : null

  if (!action) return null

  return (
    <p className="mt-2 text-[12px] leading-relaxed text-accent-ink">
      <ArrowRight className="mr-1 inline size-3" aria-hidden="true" />
      {action}
    </p>
  )
}

/**
 * U8. The concepts this page assumes, for someone meeting them the first time.
 *
 * Collapsed, and short. A permanent instruction panel is read once and then
 * occupies the top of the page forever for everyone who already knows — which
 * is how explanation ends up costing more attention than it saves.
 */
function HowThisPageWorks() {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[12px] text-accent-ink underline-offset-2 hover:underline"
        >
          <HelpCircle className="size-3.5" aria-hidden="true" />
          How this page works
        </button>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <div className="mt-2 max-w-3xl space-y-2 rounded-md border border-line bg-surface-sunken/60 px-4 py-3 text-[12.5px] leading-relaxed text-ink-muted">
          <p>
            <strong className="text-ink">Nothing here is true because KAE said so.</strong>{' '}
            Everything derived from your conversation arrives <em>proposed</em>. It becomes part of
            what the project holds only when you confirm it, on the Reviews page.
          </p>
          <p>
            <strong className="text-ink">Type and status are separate.</strong> A row&rsquo;s label
            says what it <em>is</em> — a requirement, a rule, a constraint, an open question. Its
            badge says how firmly it is held. An open question is not a requirement KAE is proposing;
            it is something it could not determine and declined to guess.
          </p>
          <p>
            <strong className="text-ink">Rejected items stay.</strong> What a project decided against
            is part of what it knows, so a rejection is kept and filterable rather than deleted.
          </p>
          <p>
            <strong className="text-ink">Readiness measures agreement, not effort.</strong> It moves
            when you confirm things, not when you talk. A long conversation with nothing confirmed
            reads 0%, and that is the number working correctly.
          </p>
          <p className="text-ink-subtle">
            Expand <em>Source &amp; reasoning</em> on any row to see where it came from. That is
            recorded provenance from KAE-Memory, not an explanation generated after the fact.
          </p>
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}

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
          {/* U2. The storage id used to occupy the leftmost column, where a
              reader looks first, and told them nothing. What the item *is*
              belongs there; the id belongs under Source and reasoning, where
              someone debugging will go looking for it. */}
          <span className="mt-0.5 shrink-0 rounded bg-surface-sunken px-1.5 py-0.5 text-[11px] text-ink-subtle">
            {CATEGORY_SHORT[requirement.category] ?? 'Item'}
          </span>
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

            <NextAction status={requirement.status} category={requirement.category} />

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
                  Source &amp; reasoning
                </button>
              </Collapsible.Trigger>
              <Collapsible.Content>
                <div className="mt-2 space-y-2 rounded-md border border-line bg-surface-sunken/60 px-3.5 py-3">
                  <Provenance knowledgeId={requirement.id} status={requirement.status} />
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
                    Provenance is held by KAE-Memory. Studio displays it; it does not own it.{' '}
                    <span className="font-mono">{requirement.id}</span>
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
  const [filter, setFilter] = useState<
    'all' | 'confirmed' | 'proposed' | 'contested' | 'rejected'
  >('all')

  if (isLoading || !projection) {
    return (
      <PageLayout title="Requirements">
        <Skeleton className="h-96" />
      </PageLayout>
    )
  }

  const filtered = projection.requirements.filter((r) => filter === 'all' || r.status === filter)

  // Questions counted separately from requirements, on purpose. A summary that
  // says "6 requirements, 4 awaiting review" when two of them are things the
  // model could not determine is overstating what the project has established.
  const questions = projection.requirements.filter((r) => r.category === 'open_question')
  const requirements = projection.requirements.filter((r) => r.category !== 'open_question')
  const summary = [
    `${requirements.length} requirement${requirements.length === 1 ? '' : 's'}`,
    `${requirements.filter((r) => r.status === 'confirmed').length} confirmed`,
    `${requirements.filter((r) => r.status === 'proposed').length} awaiting review`,
    ...(questions.length > 0 ? [`${questions.length} open question${questions.length === 1 ? '' : 's'}`] : []),
    ...(requirements.filter((r) => r.verifiedBy.length === 0).length > 0
      ? [`${requirements.filter((r) => r.verifiedBy.length === 0).length} without verification`]
      : []),
  ].join(' · ')
  const counts = {
    all: projection.requirements.length,
    confirmed: projection.requirements.filter((r) => r.status === 'confirmed').length,
    proposed: projection.requirements.filter((r) => r.status === 'proposed').length,
    contested: projection.requirements.filter((r) => r.status === 'contested').length,
    rejected: projection.requirements.filter((r) => r.status === 'rejected').length,
  }

  return (
    <PageLayout
      title="Requirements"
      lead="What this project must do and the conditions it must satisfy. Review proposed items, resolve open questions, assign ownership, and define how each confirmed requirement will be verified."
      actions={
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by status">
          {(['all', 'confirmed', 'proposed', 'contested', 'rejected'] as const).map((key) => (
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
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-[12.5px] leading-relaxed text-ink-muted">{summary}</p>
          <HowThisPageWorks />
        </div>

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
