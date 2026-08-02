import { Database, Quote } from 'lucide-react'
import { PageLayout } from '@/components/project/PageLayout'
import { StatusBadge } from '@/components/project/statusVocabulary'
import { formatDateTime } from '@/lib/format'
import {
  Badge,
  Mono,
  Panel,
  PanelBody,
  PanelHeader,
  PanelTitle,
  Skeleton,
} from '@/components/ui/primitives'
import { useProject, useProjection } from '@/hooks/useProject'

/**
 * Memory is a trust and continuity surface, not the primary workflow. It shows
 * what the system believes, how sure it is, and where each belief came from.
 */
export function Memory() {
  const { data: projection, isLoading } = useProjection()
  const { data: project } = useProject()

  if (isLoading || !projection) {
    return (
      <PageLayout title="Memory">
        <Skeleton className="h-80" />
      </PageLayout>
    )
  }

  const traced = projection.requirements.filter((r) => r.trace.length > 0)

  return (
    <PageLayout
      title="Memory"
      lead="Why the system believes what it believes. KAE-Memory is authoritative for all of this; Studio only displays it."
      actions={
        <Badge tone="neutral">
          <Database className="size-3" aria-hidden="true" />
          revision {project?.memoryRevision ?? '—'}
        </Badge>
      }
    >
      <div className="space-y-6">
        <Panel>
          <PanelHeader>
            <PanelTitle>What Studio currently remembers</PanelTitle>
          </PanelHeader>
          <PanelBody>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: 'Requirements', value: projection.requirements.length },
                { label: 'Modules', value: projection.modules.length },
                { label: 'Open decisions', value: projection.openDecisions.length },
                { label: 'Findings', value: projection.findings.length },
              ].map((stat) => (
                <div key={stat.label}>
                  <dt className="text-[11px] uppercase tracking-wider text-ink-subtle">
                    {stat.label}
                  </dt>
                  <dd className="mt-0.5 text-[20px] font-semibold tabular-nums text-ink">
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 max-w-3xl text-[12.5px] leading-relaxed text-ink-muted">
              Every item below is versioned and traceable to the evidence that produced it. A
              correction never erases the original statement — it supersedes it, and both remain in
              the record.
            </p>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Knowledge and its evidence</PanelTitle>
            <Badge tone="neutral">{traced.length}</Badge>
          </PanelHeader>
          <PanelBody className="px-0 py-0">
            <ul className="divide-y divide-line">
              {traced.map((r) => (
                <li key={r.id} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      <Mono className="mt-0.5 shrink-0">{r.id}</Mono>
                      <div className="min-w-0">
                        <p className="text-[13.5px] leading-relaxed text-ink">{r.statement}</p>
                        {r.trace.map((t) => (
                          <figure key={t.evidenceId} className="mt-2">
                            <blockquote className="flex gap-2 text-[12.5px] leading-relaxed text-ink-muted">
                              <Quote
                                className="mt-0.5 size-3 shrink-0 text-ink-subtle"
                                aria-hidden="true"
                              />
                              <span>“{t.quotedText}”</span>
                            </blockquote>
                            <figcaption className="mt-1 pl-5 text-[11px] text-ink-subtle">
                              {t.sourceLabel} · evidence{' '}
                              <span className="font-mono">{t.evidenceId}</span> ·{' '}
                              {formatDateTime(t.recordedAt)}
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                </li>
              ))}
            </ul>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Agent activity</PanelTitle>
            <Badge tone="neutral">Advanced</Badge>
          </PanelHeader>
          <PanelBody>
            <p className="max-w-3xl text-[13px] leading-relaxed text-ink-muted">
              Extraction runs, review runs, and agent submissions through KAE MCP would be listed
              here with their state, attempt count, and the knowledge each produced. Raw payloads
              stay behind a technical disclosure and never appear in the project workflow.
            </p>
            <p className="mt-3 text-[12.5px] text-ink-subtle">
              Not implemented in this prototype. Run state is owned by KAE-Memory.
            </p>
          </PanelBody>
        </Panel>
      </div>
    </PageLayout>
  )
}
