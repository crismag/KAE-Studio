import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Check, ChevronRight, GitMerge, Info, Pencil, Split, TriangleAlert, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { plural } from '@/lib/plural'
import { PageLayout } from '@/components/project/PageLayout'
import { ReadinessBadge, StatusBadge } from '@/components/project/statusVocabulary'
import { DIMENSION_LABEL, readinessLabel } from '@/components/project/labels'
import { Badge, Button, Mono, Panel, Skeleton } from '@/components/ui/primitives'
import { useModuleDecision, useProjection } from '@/hooks/useProject'
import type { ModuleDecision } from '@/services/interfaces'
import type { OpenDecision, ProjectModule, Requirement } from '@/domain/types'

/* ------------------------------------------------------------ curation UI */

function RenameDialog({
  module,
  open,
  onOpenChange,
  onSubmit,
}: {
  module: ProjectModule
  open: boolean
  onOpenChange: (v: boolean) => void
  onSubmit: (name: string) => void
}) {
  const [name, setName] = useState(module.name)
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/25" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,26rem)] -translate-x-1/2 -translate-y-1/2 rounded-panel border border-line bg-surface p-5 shadow-raised outline-none">
          <Dialog.Title className="text-[14px] font-semibold text-ink">Rename module</Dialog.Title>
          <Dialog.Description className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
            Renaming is recorded as a versioned decision with provenance, not a silent edit.
          </Dialog.Description>
          <label htmlFor="module-name" className="mt-4 block text-[12px] font-medium text-ink">
            Module name
          </label>
          <input
            id="module-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1.5 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-[13.5px] text-ink outline-none focus:border-accent-line focus:ring-2 focus:ring-accent-soft"
          />
          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm">
                Cancel
              </Button>
            </Dialog.Close>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                onSubmit(name.trim() || module.name)
                onOpenChange(false)
              }}
            >
              Record rename
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function SplitDialog({
  module,
  open,
  onOpenChange,
  onSubmit,
}: {
  module: ProjectModule
  open: boolean
  onOpenChange: (v: boolean) => void
  onSubmit: (names: [string, string]) => void
}) {
  const [first, setFirst] = useState(module.name)
  const [second, setSecond] = useState('')
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/25" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,30rem)] -translate-x-1/2 -translate-y-1/2 rounded-panel border border-line bg-surface p-5 shadow-raised outline-none">
          <Dialog.Title className="text-[14px] font-semibold text-ink">Split module</Dialog.Title>
          <Dialog.Description className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
            {module.name} becomes two modules. Its requirements, interfaces, and data stay with the
            first; the second starts empty so nothing is silently discarded.
          </Dialog.Description>
          <div className="mt-4 space-y-3">
            <div>
              <label htmlFor="split-a" className="block text-[12px] font-medium text-ink">
                First module
              </label>
              <input
                id="split-a"
                value={first}
                onChange={(e) => setFirst(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-[13.5px] outline-none focus:border-accent-line focus:ring-2 focus:ring-accent-soft"
              />
            </div>
            <div>
              <label htmlFor="split-b" className="block text-[12px] font-medium text-ink">
                Second module
              </label>
              <input
                id="split-b"
                value={second}
                placeholder="e.g. Approval Authority"
                onChange={(e) => setSecond(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-[13.5px] outline-none placeholder:text-ink-subtle focus:border-accent-line focus:ring-2 focus:ring-accent-soft"
              />
            </div>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-md border border-attention-line bg-attention-soft/50 px-3 py-2.5">
            <Info className="mt-0.5 size-3.5 shrink-0 text-attention" aria-hidden="true" />
            <p className="text-[11.5px] leading-relaxed text-ink-muted">
              Full split semantics — how requirements, edges, and readiness divide — are an
              unresolved platform question. The prototype takes the conservative option.
            </p>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm">
                Cancel
              </Button>
            </Dialog.Close>
            <Button
              variant="primary"
              size="sm"
              disabled={!second.trim()}
              onClick={() => {
                onSubmit([first.trim() || module.name, second.trim()])
                onOpenChange(false)
              }}
            >
              Record split
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function MergeDialog({
  module,
  candidates,
  open,
  onOpenChange,
  onSubmit,
}: {
  module: ProjectModule
  candidates: ProjectModule[]
  open: boolean
  onOpenChange: (v: boolean) => void
  onSubmit: (withModuleId: string, name: string) => void
}) {
  const [target, setTarget] = useState(candidates[0]?.id ?? '')
  const [name, setName] = useState(module.name)
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/25" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,30rem)] -translate-x-1/2 -translate-y-1/2 rounded-panel border border-line bg-surface p-5 shadow-raised outline-none">
          <Dialog.Title className="text-[14px] font-semibold text-ink">Merge modules</Dialog.Title>
          <Dialog.Description className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
            Requirements, interfaces, data, and dependencies from both modules combine into one.
          </Dialog.Description>
          <div className="mt-4 space-y-3">
            <div>
              <label htmlFor="merge-with" className="block text-[12px] font-medium text-ink">
                Merge {module.name} with
              </label>
              <select
                id="merge-with"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-[13.5px] outline-none focus:border-accent-line focus:ring-2 focus:ring-accent-soft"
              >
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="merge-name" className="block text-[12px] font-medium text-ink">
                Resulting module name
              </label>
              <input
                id="merge-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-[13.5px] outline-none focus:border-accent-line focus:ring-2 focus:ring-accent-soft"
              />
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm">
                Cancel
              </Button>
            </Dialog.Close>
            <Button
              variant="primary"
              size="sm"
              disabled={!target}
              onClick={() => {
                onSubmit(target, name.trim() || module.name)
                onOpenChange(false)
              }}
            >
              Record merge
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function CurationBar({
  module,
  candidates,
  onDecide,
}: {
  module: ProjectModule
  candidates: ProjectModule[]
  onDecide: (decision: ModuleDecision) => void
}) {
  const [renameOpen, setRenameOpen] = useState(false)
  const [splitOpen, setSplitOpen] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)

  if (module.proposalState === 'accepted') {
    return (
      <div className="flex items-center gap-2">
        <Badge tone="confirmed">
          <Check className="size-3" aria-hidden="true" />
          Accepted
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDecide({ kind: 'reject', reason: 'Reverted' })}
        >
          Undo
        </Button>
      </div>
    )
  }

  if (module.proposalState === 'rejected') {
    return (
      <div className="flex items-center gap-2">
        <Badge tone="neutral">
          <X className="size-3" aria-hidden="true" />
          Rejected
        </Badge>
        <Button variant="ghost" size="sm" onClick={() => onDecide({ kind: 'accept' })}>
          Restore
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button variant="primary" size="sm" onClick={() => onDecide({ kind: 'accept' })}>
        <Check className="size-3.5" aria-hidden="true" />
        Accept
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setRenameOpen(true)}>
        <Pencil className="size-3.5" aria-hidden="true" />
        Rename
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setSplitOpen(true)}>
        <Split className="size-3.5" aria-hidden="true" />
        Split
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setMergeOpen(true)}
        disabled={candidates.length === 0}
      >
        <GitMerge className="size-3.5" aria-hidden="true" />
        Merge
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onDecide({ kind: 'reject', reason: 'Not a distinct boundary' })}
      >
        <X className="size-3.5" aria-hidden="true" />
        Reject
      </Button>

      <RenameDialog
        module={module}
        open={renameOpen}
        onOpenChange={setRenameOpen}
        onSubmit={(name) => onDecide({ kind: 'rename', name })}
      />
      <SplitDialog
        module={module}
        open={splitOpen}
        onOpenChange={setSplitOpen}
        onSubmit={(intoNames) => onDecide({ kind: 'split', intoNames })}
      />
      <MergeDialog
        module={module}
        candidates={candidates}
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        onSubmit={(withModuleId, name) => onDecide({ kind: 'merge', withModuleId, name })}
      />
    </div>
  )
}

/* -------------------------------------------------------- readiness strip */

function ReadinessStrip({ module }: { module: ProjectModule }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
      {module.readiness.map((entry) => (
        <div key={entry.dimension} className="min-w-0">
          <dt className="text-[11px] uppercase tracking-wider text-ink-subtle">
            {DIMENSION_LABEL[entry.dimension]}
          </dt>
          <dd className="mt-1">
            <ReadinessBadge value={entry.value} />
            {entry.note && (
              <p className="mt-1 text-[11px] leading-snug text-ink-subtle">{entry.note}</p>
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/* ------------------------------------------------------------ module card */

function ModuleCard({
  module,
  requirements,
  decisions,
  candidates,
  expanded,
  onToggle,
  onDecide,
}: {
  module: ProjectModule
  requirements: Requirement[]
  decisions: OpenDecision[]
  candidates: ProjectModule[]
  expanded: boolean
  onToggle: () => void
  onDecide: (decision: ModuleDecision) => void
}) {
  const blockingDeps = module.dependencies.filter((d) => d.blocking)
  const moduleDecisions = decisions.filter((d) => module.openDecisionIds.includes(d.id))
  const moduleRequirements = requirements.filter((r) => module.requirementIds.includes(r.id))
  const blockedDimensions = module.readiness.filter((r) => r.value === 'blocked')

  return (
    <Panel className={cn(module.proposalState === 'rejected' && 'opacity-60')}>
      <div className="px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[15px] font-semibold text-ink">{module.name}</h2>
              <Mono>{module.key}</Mono>
              {module.proposalState === 'proposed' && <StatusBadge status="proposed" />}
              {blockedDimensions.length > 0 && (
                <Badge tone="blocking">
                  <TriangleAlert className="size-3" aria-hidden="true" />
                  Blocked
                </Badge>
              )}
            </div>
            <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-ink-muted">
              {module.purpose}
            </p>
          </div>
          <CurationBar module={module} candidates={candidates} onDecide={onDecide} />
        </div>

        <div className="mt-4 rounded-md border border-line bg-surface-sunken/50 px-3.5 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
            Why this boundary
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">{module.rationale}</p>
        </div>

        <div className="mt-4">
          <ReadinessStrip module={module} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px] text-ink-muted">
          <span>{plural(moduleRequirements.length, 'requirement')}</span>
          <span>{plural(module.dependencies.length, 'dependency', 'dependencies')}</span>
          <span>{plural(module.interfaces.length, 'interface')}</span>
          {moduleDecisions.length > 0 && (
            <span className="text-attention">
              {plural(moduleDecisions.length, 'open decision')}
            </span>
          )}
          {blockingDeps.length > 0 && (
            <span className="text-blocking">
              {plural(blockingDeps.length, 'blocking dependency', 'blocking dependencies')}
            </span>
          )}
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="ml-auto inline-flex items-center gap-1 text-[12.5px] text-accent-ink underline-offset-2 hover:underline"
          >
            {expanded ? 'Hide specification' : 'Full specification'}
            <ChevronRight
              className={cn('size-3.5 transition-transform', expanded && 'rotate-90')}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {expanded && (
        <ModuleSpecification
          module={module}
          requirements={moduleRequirements}
          decisions={moduleDecisions}
        />
      )}
    </Panel>
  )
}

/* --------------------------------------------------- full specification */

function SpecSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
        {title}
      </h3>
      <div className="mt-2">{children}</div>
    </section>
  )
}

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="text-[12.5px] italic text-ink-subtle">Not yet defined.</p>
  }
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5 text-[13px] leading-relaxed text-ink-muted">
          <span
            className="mt-[7px] size-1 shrink-0 rounded-full bg-ink-subtle"
            aria-hidden="true"
          />
          {item}
        </li>
      ))}
    </ul>
  )
}

function ModuleSpecification({
  module,
  requirements,
  decisions,
}: {
  module: ProjectModule
  requirements: Requirement[]
  decisions: OpenDecision[]
}) {
  return (
    <div className="space-y-6 border-t border-line bg-surface-sunken/30 px-5 py-5">
      <div className="grid gap-6 lg:grid-cols-2">
        <SpecSection title="Responsibilities">
          <BulletList items={module.responsibilities} />
        </SpecSection>
        <SpecSection title="Not this module's responsibility">
          {module.nonResponsibilities.length === 0 ? (
            <p className="text-[12.5px] italic text-ink-subtle">None recorded.</p>
          ) : (
            <ul className="space-y-1.5">
              {module.nonResponsibilities.map((nr) => (
                <li
                  key={nr.text}
                  className="flex flex-wrap items-baseline gap-2 text-[13px] text-ink-muted"
                >
                  <span>{nr.text}</span>
                  <span className="text-ink-subtle">→</span>
                  <Mono>{nr.ownerModuleId}</Mono>
                </li>
              ))}
            </ul>
          )}
        </SpecSection>
        <SpecSection title="Inputs">
          <BulletList items={module.inputs} />
        </SpecSection>
        <SpecSection title="Outputs">
          <BulletList items={module.outputs} />
        </SpecSection>
      </div>

      <SpecSection title="Requirements">
        {requirements.length === 0 ? (
          <p className="text-[12.5px] italic text-ink-subtle">No requirements assigned yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-md border border-line bg-surface">
            {requirements.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-4 px-3.5 py-2.5">
                <div className="flex min-w-0 gap-3">
                  <Mono className="mt-0.5 shrink-0">{r.id}</Mono>
                  <p className="text-[13px] leading-relaxed text-ink">{r.statement}</p>
                </div>
                <div className="shrink-0">
                  <StatusBadge status={r.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </SpecSection>

      <div className="grid gap-6 lg:grid-cols-2">
        <SpecSection title="Interfaces">
          <ul className="space-y-2">
            {module.interfaces.map((iface) => (
              <li
                key={`${iface.id}-${iface.direction}`}
                className="rounded-md border border-line bg-surface px-3.5 py-2.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={iface.direction === 'exposes' ? 'accent' : 'neutral'}>
                    {iface.direction === 'exposes' ? 'Exposes' : 'Consumes'}
                  </Badge>
                  <span className="text-[13px] font-medium text-ink">{iface.name}</span>
                  <Mono>{iface.id}</Mono>
                </div>
                <p className="mt-1 text-[12px] text-ink-muted">
                  {iface.protocol} · {iface.synchronicity} · owner{' '}
                  <Mono>{iface.ownerModuleId}</Mono>
                </p>
                {iface.note && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-[11.5px] leading-snug text-attention">
                    <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                    {iface.note}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </SpecSection>

        <SpecSection title="Data">
          <ul className="space-y-1.5">
            {module.data.map((d) => (
              <li
                key={`${d.id}-${d.ownership}`}
                className="flex flex-wrap items-center gap-2 text-[13px]"
              >
                <Badge tone={d.ownership === 'owns' ? 'confirmed' : 'neutral'}>
                  {d.ownership === 'owns' ? 'Owns' : 'Reads'}
                </Badge>
                <span className="text-ink">{d.name}</span>
                <Mono>{d.id}</Mono>
                <span className="text-[11.5px] text-ink-subtle">{d.classification}</span>
              </li>
            ))}
          </ul>
        </SpecSection>
      </div>

      <SpecSection title="Dependencies">
        <ul className="space-y-2">
          {module.dependencies.map((dep) => (
            <li
              key={dep.moduleId}
              className={cn(
                'rounded-md border px-3.5 py-2.5',
                dep.blocking
                  ? 'border-blocking-line bg-blocking-soft/50'
                  : 'border-line bg-surface',
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Mono className="text-ink">{dep.moduleId}</Mono>
                <Badge tone="neutral">{dep.nature}</Badge>
                {dep.blocking && (
                  <Badge tone="blocking">
                    <TriangleAlert className="size-3" aria-hidden="true" />
                    Blocking
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">{dep.reason}</p>
              {dep.blockingReason && (
                <p className="mt-1 text-[12px] leading-relaxed text-blocking">
                  {dep.blockingReason}
                </p>
              )}
            </li>
          ))}
        </ul>
      </SpecSection>

      <SpecSection title="Failure behaviour">
        {module.failureBehaviour.length === 0 ? (
          <p className="text-[12.5px] italic text-ink-subtle">Not yet defined.</p>
        ) : (
          <ul className="space-y-2">
            {module.failureBehaviour.map((fb) => (
              <li key={fb.condition} className="text-[13px] leading-relaxed">
                <span className="font-medium text-ink">{fb.condition}</span>
                <span className="text-ink-subtle"> — </span>
                <span
                  className={cn(
                    'text-ink-muted',
                    fb.behaviour.startsWith('Undefined') && 'text-attention',
                  )}
                >
                  {fb.behaviour}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SpecSection>

      <SpecSection title="Acceptance criteria">
        {module.acceptanceTestIds.length === 0 ? (
          <p className="text-[12.5px] italic text-ink-subtle">No acceptance tests yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {module.acceptanceTestIds.map((id) => (
              <Badge key={id} tone="neutral">
                {id}
              </Badge>
            ))}
          </div>
        )}
      </SpecSection>

      {decisions.length > 0 && (
        <SpecSection title="Open decisions">
          <ul className="space-y-2">
            {decisions.map((d) => (
              <li
                key={d.id}
                className="rounded-md border border-attention-line bg-attention-soft/40 px-3.5 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Mono className="text-ink">{d.id}</Mono>
                  <p className="text-[13px] font-medium text-ink">{d.question}</p>
                  {d.deferred && <StatusBadge status="deferred" />}
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                  {d.whyItMatters}
                </p>
                <p className="mt-1.5 text-[11.5px] text-ink-subtle">
                  Suggested owner: {d.suggestedOwner}
                </p>
              </li>
            ))}
          </ul>
        </SpecSection>
      )}

      <div className="rounded-md border border-line bg-surface px-4 py-3">
        <p className="text-[12.5px] leading-relaxed text-ink-muted">
          <span className="font-medium text-ink">Implementation readiness:</span>{' '}
          {module.implementationReady
            ? 'Ready to implement.'
            : `Not ready. ${module.readiness
                .filter((r) => r.value !== 'complete' && r.value !== 'not_applicable')
                .map(
                  (r) =>
                    `${DIMENSION_LABEL[r.dimension].toLowerCase()} ${readinessLabel(r.value).toLowerCase()}`,
                )
                .join(', ')}.`}
        </p>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------- page */

export function Modules() {
  const { data: projection, isLoading } = useProjection()
  const decide = useModuleDecision()
  // Nothing expanded by default. This was 'MOD-APR', a fixture module key, so
  // the prototype opened on a module that exists in no real project.
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (isLoading || !projection) {
    return (
      <PageLayout title="Modules">
        <div className="space-y-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </PageLayout>
    )
  }

  const accepted = projection.modules.filter((m) => m.proposalState === 'accepted').length
  const proposed = projection.modules.filter((m) => m.proposalState === 'proposed').length

  return (
    <PageLayout
      title="Modules"
      wide
      lead="Studio proposes a decomposition; you decide it. Accepting, renaming, splitting, merging, or rejecting a module is recorded as a versioned decision with provenance — never applied silently."
      actions={
        <div className="flex items-center gap-2 text-[12.5px] text-ink-muted">
          <Badge tone="confirmed">{accepted} accepted</Badge>
          <Badge tone="pending">{proposed} proposed</Badge>
        </div>
      }
    >
      <div className="space-y-4">
        {projection.modules.map((module) => (
          <ModuleCard
            key={module.id}
            module={module}
            requirements={projection.requirements}
            decisions={projection.openDecisions}
            candidates={projection.modules.filter((m) => m.id !== module.id)}
            expanded={expandedId === module.id}
            onToggle={() => setExpandedId(expandedId === module.id ? null : module.id)}
            onDecide={(decision) => decide.mutate({ moduleId: module.id, decision })}
          />
        ))}
      </div>
    </PageLayout>
  )
}
