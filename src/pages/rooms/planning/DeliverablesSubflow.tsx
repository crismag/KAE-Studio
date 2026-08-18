import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import {
  Check,
  CircleDashed,
  FileText,
  Lock,
  MinusCircle,
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
import { GeneratePackage } from './GeneratePackage'
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
  superseded: { label: 'Superseded', tone: 'neutral' },
  withdrawn: { label: 'Withdrawn', tone: 'attention' },
}

/* ------------------------------------------------------------ card */

function DeliverableCard({
  deliverable,
  replacedBy,
}: {
  deliverable: Deliverable
  /** The replacement's name, where it is among the packages on this page. */
  replacedBy?: string
}) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const meta = STATE_META[deliverable.state]
  const u = deliverable.assembledUnderUncertainty
  // Memory can rest a package on an unresolved gap area alone, in which case
  // all four counts are zero and the sentence has to stand without a list.
  const unsettled = u
    ? [
        [u.proposed, 'proposed statement'],
        [u.contested, 'contested statement'],
        [u.openAssumptions, 'open assumption'],
        [u.openQuestions, 'open question'],
      ]
        .filter(([n]) => (n as number) > 0)
        .map(([n, noun]) => plural(n as number, noun as string))
        .join(', ')
    : ''

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
              {deliverable.state === 'superseded' && (
                <MinusCircle className="size-3" aria-hidden="true" />
              )}
              {deliverable.state === 'withdrawn' && <X className="size-3" aria-hidden="true" />}
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

        {/* Not the `outdated` sentence: regenerating is not what either of
            these asks for, and telling somebody to regenerate a package the
            project has disowned is a wrong instruction rather than a thin one. */}
        {deliverable.state === 'superseded' && (
          <p className="flex items-start gap-2 rounded-md border border-line bg-surface-sunken/60 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink-muted">
            <MinusCircle className="mt-0.5 size-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
            <span>
              A later package replaced this one
              {replacedBy ? (
                <>
                  {' — '}
                  <span className="text-ink">{replacedBy}</span>
                </>
              ) : (
                ''
              )}
              . It stays readable as what was produced.
            </span>
          </p>
        )}

        {deliverable.state === 'withdrawn' && (
          <p className="flex items-start gap-2 rounded-md border border-attention-line bg-attention-soft/50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink-muted">
            <X className="mt-0.5 size-3.5 shrink-0 text-attention" aria-hidden="true" />
            <span>
              The project no longer stands behind this package
              {deliverable.withdrawnReason ? `: ${deliverable.withdrawnReason}` : '.'}
            </span>
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

        {deliverable.unresolvedGaps.length > 0 && (
          <div className="rounded-md border border-attention-line bg-attention-soft/40 px-3.5 py-2.5">
            <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-muted">
              <TriangleAlert
                className="mt-0.5 size-3.5 shrink-0 text-attention"
                aria-hidden="true"
              />
              Assembled with {plural(deliverable.unresolvedGaps.length, 'critical gap')} still open.
              Whoever implements this inherits the question, not an answer.
            </p>
            <ul className="mt-1.5 space-y-1 pl-[22px] text-[12.5px] leading-relaxed text-ink-muted">
              {deliverable.unresolvedGaps.map((gap) => (
                <li key={gap.areaKey}>{gap.summary}</li>
              ))}
            </ul>
          </div>
        )}

        {deliverable.qualifications && deliverable.qualifications.length > 0 && (
          <ul className="space-y-1 text-[12.5px] leading-relaxed text-ink-muted">
            {deliverable.qualifications.map((sentence) => (
              <li key={sentence} className="flex items-start gap-2">
                <TriangleAlert
                  className="mt-0.5 size-3.5 shrink-0 text-attention"
                  aria-hidden="true"
                />
                {sentence}
              </li>
            ))}
          </ul>
        )}

        {deliverable.assembledUnderUncertainty && (
          <p className="flex items-start gap-2 rounded-md border border-attention-line bg-attention-soft/40 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink-muted">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-attention" aria-hidden="true" />
            <span>
              Assembled while things were unsettled{unsettled ? ` — ${unsettled}` : ''}. These words
              say something weaker than the same words will once those are settled.
            </span>
          </p>
        )}

        {deliverable.unreproducibleReason && (
          <p className="flex items-start gap-2 rounded-md border border-line bg-surface-sunken/60 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink-muted">
            <Lock className="mt-0.5 size-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
            <span>
              This record cannot be re-rendered: {deliverable.unreproducibleReason}. It stays
              readable.
            </span>
          </p>
        )}

        {deliverable.unreproducibleClaimReason && (
          <p className="flex items-start gap-2 rounded-md border border-line bg-surface-sunken/60 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink-muted">
            <Lock className="mt-0.5 size-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
            <span>
              This package cannot be reproduced as the claim it was:{' '}
              {deliverable.unreproducibleClaimReason}.
            </span>
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
  const { data: listing, isLoading } = useDeliverables()
  const { data: projection } = useProjection()

  if (isLoading || !listing) {
    return (
      <PageLayout title="Deliverables">
        <div className="space-y-4">
          <Skeleton className="h-52" />
          <Skeleton className="h-52" />
        </div>
      </PageLayout>
    )
  }

  const deliverables = listing.deliverables
  const projectPackages = deliverables.filter((d) => d.scope === 'project')
  const modulePackages = deliverables.filter((d) => d.scope === 'module')
  // Memory names the replacement by identifier. A person reads names, so it is
  // resolved against what this page already holds; a replacement outside that
  // set leaves the sentence unnamed rather than printing a UUID (`D-199`).
  const nameById = new Map(deliverables.map((d) => [d.id, d.name]))
  const replacementFor = (d: Deliverable) =>
    d.supersededById ? nameById.get(d.supersededById) : undefined
  const openDecisions = projection?.openDecisions.length ?? 0
  // KAE-Memory answers this route with a ceiling and orders by recording time
  // descending, so what a limit cuts is the oldest packages (`D-280`). Said
  // only where something was cut: `omitted` is `null` from a deployment that
  // claimed nothing about completeness, and `0` where the list is whole.
  const omitted = listing.omitted ?? 0

  return (
    <PageLayout
      title="Deliverables"
      lead="Where generated packages go. Generation and publication are separate — the same package reaches GitHub or managed storage without changing."
    >
      <div className="space-y-6">
        {/* `ProjectSources` used to render here, on a page about output, under a
            banner announcing that the whole thing was not built. It is
            `/sources` now: repositories are an input, and burying the input
            surface inside the output page is most of why repository ingestion
            read as absent. */}
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

        {omitted > 0 && (
          <p className="text-[13px] leading-relaxed text-ink-muted">
            {/* A statement about the list, not about the project, so it carries
                no next action and none of the attention styling beside it. */}
            {plural(listing.total ?? deliverables.length + omitted, 'package')} recorded, showing
            the most recent {deliverables.length.toLocaleString()}. The{' '}
            {plural(omitted, 'older package is', 'older packages are')} not on this page.
          </p>
        )}

        <section>
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-subtle">
            Module context packages
          </h2>
          <div className="space-y-4">
            {modulePackages.map((d) => (
              <DeliverableCard key={d.id} deliverable={d} replacedBy={replacementFor(d)} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-subtle">
            Whole-project packages
          </h2>
          <div className="space-y-4">
            {projectPackages.map((d) => (
              <DeliverableCard key={d.id} deliverable={d} replacedBy={replacementFor(d)} />
            ))}
          </div>
        </section>
      </div>
    </PageLayout>
  )
}
