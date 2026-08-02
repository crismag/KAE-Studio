import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as RadioGroup from '@radix-ui/react-radio-group'
import {
  Check,
  CircleDashed,
  FileText,
  Github,
  HardDrive,
  Loader2,
  Lock,
  RefreshCw,
  TriangleAlert,
  Upload,
  X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { plural } from '@/lib/plural'
import { formatDateTime } from '@/lib/format'
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
import {
  useDeliverables,
  useGenerateDeliverable,
  useProjection,
  usePublishDeliverable,
  usePublishTargets,
} from '@/hooks/useProject'
import type { Deliverable, DeliverableState, PublishTargetKind } from '@/domain/types'

const STATE_META: Record<
  DeliverableState,
  { label: string; tone: 'neutral' | 'accent' | 'confirmed' | 'attention' | 'pending' }
> = {
  not_generated: { label: 'Not generated', tone: 'neutral' },
  generated: { label: 'Generated', tone: 'accent' },
  reviewed: { label: 'Reviewed', tone: 'accent' },
  published: { label: 'Published', tone: 'confirmed' },
  outdated: { label: 'Outdated', tone: 'attention' },
}

const TARGET_ICON: Record<PublishTargetKind, typeof Github> = {
  github: Github,
  local: HardDrive,
  s3: Upload,
}

/* --------------------------------------------------------- publish dialog */

function PublishDialog({
  deliverable,
  open,
  onOpenChange,
}: {
  deliverable: Deliverable
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { data: targets } = usePublishTargets()
  const publish = usePublishDeliverable()
  const [target, setTarget] = useState<PublishTargetKind>('github')

  const available = targets?.filter((t) => t.available) ?? []

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/25" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[min(94vw,38rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-panel border border-line bg-surface p-5 shadow-raised outline-none kae-scrollbar">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-[15px] font-semibold text-ink">
                Publish {deliverable.name}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                The destination does not change the package. The same bundle, pinned to memory
                revision {deliverable.sourceMemoryRevision ?? '—'}, is written wherever you send it.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon">
                <X className="size-4" aria-hidden="true" />
                <span className="sr-only">Close</span>
              </Button>
            </Dialog.Close>
          </div>

          <div className="mt-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
              Destination
            </p>
            <RadioGroup.Root
              value={target}
              onValueChange={(v) => setTarget(v as PublishTargetKind)}
              className="mt-2 space-y-2"
            >
              {targets?.map((t) => {
                const Icon = TARGET_ICON[t.kind]
                return (
                  <label
                    key={t.kind}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-md border px-3.5 py-3',
                      !t.available && 'cursor-not-allowed opacity-60',
                      target === t.kind && t.available
                        ? 'border-accent bg-accent-soft'
                        : 'border-line',
                    )}
                  >
                    <RadioGroup.Item
                      value={t.kind}
                      disabled={!t.available}
                      className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border border-line-strong bg-surface data-[state=checked]:border-accent"
                    >
                      <RadioGroup.Indicator className="size-2 rounded-full bg-accent" />
                    </RadioGroup.Item>
                    <Icon className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-ink">{t.label}</p>
                      <p className="text-[12px] text-ink-muted">{t.detail}</p>
                      {!t.available && t.unavailableReason && (
                        <p className="mt-1 flex items-start gap-1.5 text-[11.5px] text-ink-subtle">
                          <Lock className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                          {t.unavailableReason}
                        </p>
                      )}
                    </div>
                  </label>
                )
              })}
            </RadioGroup.Root>
          </div>

          <div className="mt-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
              Proposed changes ({deliverable.files.length} files)
            </p>
            <ul className="mt-2 divide-y divide-line rounded-md border border-line">
              {deliverable.files.map((f) => (
                <li key={f.path} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="truncate font-mono text-[11.5px] text-ink">{f.path}</span>
                  <Badge tone="confirmed">add</Badge>
                </li>
              ))}
            </ul>
          </div>

          {deliverable.unresolvedDecisionIds.length > 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-attention-line bg-attention-soft/50 px-3.5 py-3">
              <TriangleAlert
                className="mt-0.5 size-3.5 shrink-0 text-attention"
                aria-hidden="true"
              />
              <p className="text-[12.5px] leading-relaxed text-ink-muted">
                This package carries{' '}
                {plural(deliverable.unresolvedDecisionIds.length, 'unresolved decision')} (
                {deliverable.unresolvedDecisionIds.join(', ')}). They are published as open, not
                resolved. Incomplete does not mean useless — but an implementer must not treat these
                as settled.
              </p>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="text-[11.5px] text-attention">
              Prototype — nothing is written to any repository, filesystem, or bucket.
            </p>
            <div className="flex gap-2">
              <Dialog.Close asChild>
                <Button variant="ghost" size="sm">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button
                variant="primary"
                size="sm"
                disabled={available.length === 0 || publish.isPending}
                onClick={() =>
                  publish.mutate(
                    { deliverableId: deliverable.id, target },
                    { onSuccess: () => onOpenChange(false) },
                  )
                }
              >
                {publish.isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    Publishing
                  </>
                ) : (
                  'Publish'
                )}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/* ------------------------------------------------------------ card */

function DeliverableCard({ deliverable }: { deliverable: Deliverable }) {
  const generate = useGenerateDeliverable()
  const [publishOpen, setPublishOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const meta = STATE_META[deliverable.state]
  const canGenerate = !deliverable.blockedReason

  return (
    <Panel>
      <PanelHeader>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <PanelTitle className="text-[14px]">{deliverable.name}</PanelTitle>
            <Badge tone={meta.tone}>
              {deliverable.state === 'published' && <Check className="size-3" aria-hidden="true" />}
              {deliverable.state === 'outdated' && (
                <RefreshCw className="size-3" aria-hidden="true" />
              )}
              {deliverable.state === 'not_generated' && (
                <CircleDashed className="size-3" aria-hidden="true" />
              )}
              {meta.label}
            </Badge>
            {deliverable.scope === 'module' && <Badge tone="neutral">Module scope</Badge>}
          </div>
          <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-ink-muted">
            {deliverable.description}
          </p>
        </div>
      </PanelHeader>
      <PanelBody className="space-y-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
            Includes
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {deliverable.includes.map((item) => (
              <Badge key={item} tone="neutral">
                {item}
              </Badge>
            ))}
          </div>
        </div>

        {deliverable.version && (
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-[12px]">
            <div className="flex gap-1.5">
              <dt className="text-ink-subtle">Version</dt>
              <dd className="font-mono text-ink">{deliverable.version}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-ink-subtle">From revision</dt>
              <dd className="font-mono text-ink">{deliverable.sourceMemoryRevision}</dd>
            </div>
            {deliverable.generatedAt && (
              <div className="flex gap-1.5">
                <dt className="text-ink-subtle">Generated</dt>
                <dd className="text-ink">{formatDateTime(deliverable.generatedAt)}</dd>
              </div>
            )}
            {deliverable.contentHash && (
              <div className="flex gap-1.5">
                <dt className="text-ink-subtle">Hash</dt>
                <dd className="font-mono text-ink-muted">{deliverable.contentHash}</dd>
              </div>
            )}
          </dl>
        )}

        {deliverable.state === 'outdated' && (
          <p className="flex items-start gap-2 rounded-md border border-attention-line bg-attention-soft/50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink-muted">
            <RefreshCw className="mt-0.5 size-3.5 shrink-0 text-attention" aria-hidden="true" />
            Project knowledge changed after this version was generated. Regenerate to pick up the
            current revision.
          </p>
        )}

        {deliverable.publishedTo && (
          <p className="flex items-center gap-2 text-[12px] text-ink-muted">
            <Check className="size-3.5 text-confirmed" aria-hidden="true" />
            Published to <Mono className="text-ink">
              {deliverable.publishedTo.reference}
            </Mono> on {formatDateTime(deliverable.publishedTo.at)}
          </p>
        )}

        {deliverable.unresolvedDecisionIds.length > 0 && (
          <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-muted">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-attention" aria-hidden="true" />
            Carries {plural(deliverable.unresolvedDecisionIds.length, 'unresolved decision')} (
            {deliverable.unresolvedDecisionIds.join(', ')}), published as open.
          </p>
        )}

        {deliverable.blockedReason && (
          <p className="flex items-start gap-2 rounded-md border border-line bg-surface-sunken/60 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink-muted">
            <Lock className="mt-0.5 size-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
            {deliverable.blockedReason}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <Button
            variant={deliverable.state === 'not_generated' ? 'primary' : 'secondary'}
            size="sm"
            disabled={!canGenerate || generate.isPending}
            onClick={() => generate.mutate(deliverable.id)}
          >
            {generate.isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                Generating
              </>
            ) : deliverable.state === 'not_generated' ? (
              'Generate'
            ) : (
              <>
                <RefreshCw className="size-3.5" aria-hidden="true" />
                Regenerate
              </>
            )}
          </Button>
          {deliverable.files.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setPreviewOpen(true)}>
              <FileText className="size-3.5" aria-hidden="true" />
              Preview contents
            </Button>
          )}
          {deliverable.state !== 'not_generated' && (
            <Button variant="secondary" size="sm" onClick={() => setPublishOpen(true)}>
              <Upload className="size-3.5" aria-hidden="true" />
              Publish
            </Button>
          )}
        </div>
      </PanelBody>

      <PublishDialog deliverable={deliverable} open={publishOpen} onOpenChange={setPublishOpen} />

      <Dialog.Root open={previewOpen} onOpenChange={setPreviewOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/25" />
          <Dialog.Content className="fixed left-1/2 top-1/2 max-h-[85vh] w-[min(94vw,44rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-panel border border-line bg-surface p-5 shadow-raised outline-none kae-scrollbar">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-[15px] font-semibold text-ink">
                  {deliverable.name} — contents
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-[12.5px] text-ink-muted">
                  Every substantive statement traces to project knowledge and its source evidence.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon">
                  <X className="size-4" aria-hidden="true" />
                  <span className="sr-only">Close</span>
                </Button>
              </Dialog.Close>
            </div>
            <ul className="mt-4 divide-y divide-line rounded-md border border-line">
              {deliverable.files.map((f) => (
                <li key={f.path} className="px-3.5 py-2.5">
                  <p className="font-mono text-[12px] text-ink">{f.path}</p>
                  <p className="mt-0.5 text-[12px] text-ink-muted">{f.summary}</p>
                  <p className="mt-0.5 text-[11px] text-ink-subtle">
                    {f.tracedStatements} traced statements
                  </p>
                </li>
              ))}
            </ul>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Panel>
  )
}

export function Deliverables() {
  const { data: deliverables, isLoading } = useDeliverables()
  const { data: projection } = useProjection()

  if (isLoading || !deliverables) {
    return (
      <PageLayout title="Deliverables">
        <div className="space-y-4">
          <Skeleton className="h-52" />
          <Skeleton className="h-52" />
        </div>
      </PageLayout>
    )
  }

  const projectPackages = deliverables.filter((d) => d.scope === 'project')
  const modulePackages = deliverables.filter((d) => d.scope === 'module')
  const openDecisions = projection?.openDecisions.length ?? 0

  return (
    <PageLayout
      title="Deliverables"
      lead="Generated context packages, pinned to an exact memory revision. Generation and publication are separate: the same bundle goes to GitHub, a local workspace, or managed storage without changing."
    >
      <div className="space-y-6">
        {openDecisions > 0 && (
          <div className="flex items-start gap-2.5 rounded-panel border border-attention-line bg-attention-soft/40 px-4 py-3">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-attention" aria-hidden="true" />
            <p className="text-[13px] leading-relaxed text-ink-muted">
              {plural(openDecisions, 'decision is', 'decisions are')} unresolved. Packages can still
              be generated — open decisions travel with them, clearly marked, so an implementer
              knows what has not been settled rather than inheriting an invented answer.
            </p>
          </div>
        )}

        <section>
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-subtle">
            Module context packages
          </h2>
          <div className="space-y-4">
            {modulePackages.map((d) => (
              <DeliverableCard key={d.id} deliverable={d} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-subtle">
            Whole-project packages
          </h2>
          <div className="space-y-4">
            {projectPackages.map((d) => (
              <DeliverableCard key={d.id} deliverable={d} />
            ))}
          </div>
        </section>
      </div>
    </PageLayout>
  )
}
