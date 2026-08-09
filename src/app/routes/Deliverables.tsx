import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import {
  Check,
  CircleDashed,
  FileText,
  Lock,
  RefreshCw,
  TriangleAlert,
  X,
} from 'lucide-react'
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
import { useDeliverables, useProjection } from '@/hooks/useProject'
import { GeneratePackage } from '@/components/project/GeneratePackage'
import { ProjectSources } from '@/components/project/ProjectSources'
import type { Deliverable, DeliverableState } from '@/domain/types'

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

/* ------------------------------------------------------------ card */

function DeliverableCard({ deliverable }: { deliverable: Deliverable }) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const meta = STATE_META[deliverable.state]

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

        {deliverable.files.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <Button variant="ghost" size="sm" onClick={() => setPreviewOpen(true)}>
              <FileText className="size-3.5" aria-hidden="true" />
              Preview contents
            </Button>
          </div>
        )}
      </PanelBody>

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
      lead="Where this project's material comes from, and where generated packages go. Sources can be connected and pinned; analysing them is not built yet. Generation and publication are separate — the same package goes to GitHub or managed storage without changing."
    >
      <div className="space-y-6">
        <ProjectSources />

        <GeneratePackage />

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
