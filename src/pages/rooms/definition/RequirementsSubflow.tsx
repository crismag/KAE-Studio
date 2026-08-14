import { useState } from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { ArrowRight, ChevronRight, HelpCircle, Quote, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/format'
import { PageLayout } from '@/components/project/PageLayout'
import { StatusBadge } from '@/components/project/statusVocabulary'
import { CATEGORY_LABEL } from '@/components/project/labels'
import { CapabilityNote } from '@/components/project/CapabilityNote'
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
import { projectCounts } from '@/lib/counts'
import { plural } from '@/lib/plural'
import type { AcceptanceTest, ProjectModule, Requirement } from '@/domain/types'

//: Above this, a group arrives closed.
//
// Eight because a reader can hold that many in view and decide; forty they
// scroll past. The number is a judgement rather than a measurement, and it is
// named here so changing it is one edit rather than a hunt.
const LARGE_GROUP = 8

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
      {data.produced_by && (
        <>
          <dt className="text-ink-subtle">Produced by</dt>
          <dd className="text-ink-muted">
            {data.produced_by === 'deterministic-fixture'
              ? 'the offline fixture — sentences split on punctuation, not a model reading'
              : data.produced_by}
          </dd>
        </>
      )}
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
            badge says how firmly it is held. An open question is not a requirement KAE is
            proposing; it is something it could not determine and declined to guess.
          </p>
          <p>
            <strong className="text-ink">Rejected items stay.</strong> What a project decided
            against is part of what it knows, so a rejection is kept and filterable rather than
            deleted.
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

/**
 * Statements that say adjacent things, next to each other.
 *
 * `PPA-15`: *"KAE generated 70 things I don't know how to organise."* The
 * grouping Memory computes is useless if the rows still arrive in extraction
 * order — a person scanning a list cannot see that rows 3 and 27 are two
 * wordings of one obligation.
 *
 * **Reordering, never folding.** Every statement keeps its own row, its own
 * badge and its own controls; the group is a heading and an indent. `EM-3`'s
 * ruling on unattended merging is untouched, and would be broken the moment
 * this rendered one member and hid the rest.
 *
 * Grouped rows come first because they are the ones carrying a decision — *are
 * these two the same thing?* — and ungrouped rows need no decision at all.
 */
type Entry =
  | { kind: 'divider'; key: string; count: number }
  | { kind: 'row'; requirement: Requirement; grouped: boolean }

function orderedByGroup(items: Requirement[]): Entry[] {
  const groups = new Map<number, Requirement[]>()
  const alone: Requirement[] = []
  for (const item of items) {
    if (item.relatedGroup === null || item.relatedGroup === undefined) {
      alone.push(item)
      continue
    }
    const existing = groups.get(item.relatedGroup)
    if (existing) existing.push(item)
    else groups.set(item.relatedGroup, [item])
  }

  const entries: Entry[] = []
  for (const [id, members] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
    // A group of one is not a group. Memory does not send them; this guards
    // against a filtered view splitting one — a lone row under a "2 related"
    // heading claims something that is no longer true.
    if (members.length < 2) {
      alone.push(...members)
      continue
    }
    entries.push({ kind: 'divider', key: `group-${id}`, count: members.length })
    entries.push(
      ...members.map((requirement) => ({ kind: 'row' as const, requirement, grouped: true })),
    )
  }
  entries.push(
    ...alone.map((requirement) => ({ kind: 'row' as const, requirement, grouped: false })),
  )
  return entries
}

function RelatedHeading({ count }: { count: number }) {
  return (
    <li className="bg-surface-sunken px-5 py-1.5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
        {count} related statements
      </p>
      {/* Said once, here, rather than implied by the indent. A reader who takes
          "related" to mean "KAE merged these" would stop checking them. */}
      <p className="mt-0.5 text-[11px] text-ink-subtle">
        These say adjacent things. Each is still separate, and confirming one confirms only it.
      </p>
    </li>
  )
}

function RequirementRow({
  requirement,
  modules,
  tests,
  grouped = false,
}: {
  requirement: Requirement
  modules: ProjectModule[]
  tests: AcceptanceTest[]
  grouped?: boolean
}) {
  const [open, setOpen] = useState(false)
  const module = modules.find((m) => m.id === requirement.moduleId)
  const verifying = tests.filter((t) => requirement.verifiedBy.includes(t.id))

  return (
    <li
      className={
        grouped ? 'border-l-2 border-accent-line bg-surface px-5 py-3.5 pl-6' : 'px-5 py-3.5'
      }
    >
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
              {/* Absence is stated only when KAE could have known.
                  These two read "No owning module" and "Not verified by any
                  test" in the attention tone on *every* row, always — because
                  the live adapter has no module derivation and no concept of
                  test verification, so `moduleId` and `verifiedBy` are empty
                  for structural reasons rather than because of anything about
                  the user's project (AUD-009).

                  Rendering a product limit as a per-row warning tells someone
                  their requirements are defective. The limit is stated once,
                  on the page, in the capability note above. */}
              {module && (
                <span>
                  Implemented by <span className="text-ink-muted">{module.name}</span>
                </span>
              )}
              {verifying.length > 0 && (
                <span>
                  Verified by{' '}
                  {verifying.map((t, i) => (
                    <span key={t.id} className="font-mono">
                      {i > 0 && ', '}
                      {t.id}
                    </span>
                  ))}
                </span>
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
  // `superseded` sits beside `rejected` because they are siblings in
  // `STUDIO_ORCHESTRATION_CONTRACT`'s required semantics, and because both
  // answer a question about what the project decided: one *what did we decide
  // against*, the other *what did we replace* (`D-34`).
  const [filter, setFilter] = useState<
    'all' | 'confirmed' | 'proposed' | 'contested' | 'rejected' | 'superseded'
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
  //
  // From `projectCounts` (`D-96`). This page recomputed them, and the tab strip
  // beside it recomputed them differently — **All 180** over a summary reading
  // **120 requirements**, because the tabs counted questions and the summary
  // did not. Both were defensible and together they read as a broken product.
  const counts = projectCounts(projection)
  const summary = [
    plural(counts.requirements, 'requirement'),
    `${counts.confirmedRequirements} confirmed`,
    `${counts.requirementsAwaitingReview} awaiting review`,
    ...(counts.openQuestions > 0 ? [plural(counts.openQuestions, 'open question')] : []),
    // "N without verification" is structurally always the total, because KAE
    // records no tests. A count that cannot vary is not information.
  ].join(' · ')
  const byStatus = {
    all: counts.statements,
    confirmed: projection.requirements.filter((r) => r.status === 'confirmed').length,
    proposed: projection.requirements.filter((r) => r.status === 'proposed').length,
    contested: projection.requirements.filter((r) => r.status === 'contested').length,
    rejected: projection.requirements.filter((r) => r.status === 'rejected').length,
    superseded: projection.requirements.filter((r) => r.status === 'superseded').length,
  }

  return (
    <PageLayout
      title="Requirements"
      lead="What this project must do and the conditions it must satisfy. Review proposed items, resolve open questions, assign ownership, and define how each confirmed requirement will be verified."
      actions={
        <div
          className="flex flex-wrap items-center gap-1"
          role="group"
          aria-label="Filter by status"
        >
          {/* **What the tabs count, said once** (`D-96`). They total every
              statement; the summary line below totals requirements only, which
              excludes open questions. Two honest numbers that looked like a
              contradiction because neither said what it was counting. */}
          <span className="pr-1 text-[11.5px] text-ink-subtle">Statements</span>
          {/* `contested` is omitted. The live adapter maps every statement to
              confirmed, proposed or rejected, so the count behind a "Needs
              clarification" filter is structurally always zero — a control
              indistinguishable from the working ones beside it that can never
              return a row (AUD-022). It returns when a statement can actually
              hold that state. */}
          {/* `superseded` is here and `contested` is not, and the difference is
              whether the state can hold a row. Superseded statements reach the
              projection since `D-34`; a contested one cannot exist, because the
              adapter has no lifecycle that maps to it. */}
          {(['all', 'confirmed', 'proposed', 'rejected', 'superseded'] as const).map((key) => (
            <Button
              key={key}
              variant={filter === key ? 'subtle' : 'ghost'}
              size="sm"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className="capitalize"
            >
              {key}
              <span className="text-ink-subtle">{byStatus[key]}</span>
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

        {/* Said once, here, instead of as a warning on every row. Two things
            this page cannot show, stated as limits of the product rather than
            as findings about the project (AUD-009). */}
        <CapabilityNote reason="KAE does not yet derive module ownership or record acceptance tests, so no requirement here shows which module implements it or which test verifies it. That is a gap in the product, not in this project." />

        {CATEGORY_ORDER.map((category) => {
          const items = filtered.filter((r) => r.category === category)
          if (items.length === 0) return null
          // R13: a badge means attention, not a count. "12" beside a heading is
          // ambiguous — twelve what? — while "3 need review" is something a
          // person can act on and drive to zero.
          const awaiting = items.filter(
            (r) => r.status === 'proposed' || r.status === 'contested',
          ).length
          // R10: KAE does not hand its organisational burden back. A group of
          // forty derived items is the customer's original problem restated, so
          // a large one arrives closed with its heading readable — the reader
          // chooses what to open rather than scrolling past what they did not.
          const large = items.length > LARGE_GROUP
          return (
            <Panel key={category}>
              <details open={!large}>
                <summary className="cursor-pointer list-none">
                  <PanelHeader>
                    <PanelTitle>{CATEGORY_LABEL[category]}</PanelTitle>
                    {awaiting > 0 ? (
                      <Badge tone="attention">{awaiting} need review</Badge>
                    ) : (
                      <Badge tone="confirmed">{items.length} settled</Badge>
                    )}
                  </PanelHeader>
                </summary>
                <PanelBody className="px-0 py-0">
                  <ul className="divide-y divide-line">
                    {orderedByGroup(items).map((entry) =>
                      entry.kind === 'divider' ? (
                        <RelatedHeading key={entry.key} count={entry.count} />
                      ) : (
                        <RequirementRow
                          key={entry.requirement.id}
                          requirement={entry.requirement}
                          modules={projection.modules}
                          tests={projection.acceptanceTests}
                          grouped={entry.grouped}
                        />
                      ),
                    )}
                  </ul>
                </PanelBody>
              </details>
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
