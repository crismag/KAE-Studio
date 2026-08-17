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
import { useKnowledgeTrace, useProject, useProjection } from '@/hooks/useProject'
import { projectCounts } from '@/lib/counts'

/**
 * Memory is a trust and continuity surface, not the primary workflow. It shows
 * what the system believes, how sure it is, and where each belief came from.
 */
/**
 * One record's provenance, read on demand.
 *
 * The same question `/requirements` asks, against the same endpoint. It lives
 * here as its own component so the query is scoped to a row that has actually
 * been opened — a project holds hundreds of records, and reading provenance for
 * all of them on page load would replace a dishonest page with a slow one.
 *
 * A failure says so. Provenance that could not be read must never render as
 * provenance that does not exist, because on this page the difference is the
 * entire point.
 */
function RecordProvenance({ knowledgeId, status }: { knowledgeId: string; status: string }) {
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

  // **Every record, not only those carrying an inline trace.**
  //
  // This used to be `requirements.filter((r) => r.trace.length > 0)`, and the
  // live adapter sets `trace: []` on every requirement — so the page whose
  // whole job is provenance rendered a heading, a badge reading `0`, and an
  // empty list, directly beneath "Every item below is versioned and traceable
  // to the evidence that produced it" (AUD-004).
  //
  // The endpoint was there the entire time. `/requirements` has been calling
  // `GET /knowledge/{id}/trace` successfully, per row, on demand. This page
  // now asks the same question — lazily, because a project holds hundreds of
  // records and reading provenance for all of them on load would trade one
  // dishonesty for a slow page.
  const counts = projectCounts(projection)
  const records = projection.requirements

  return (
    <PageLayout
      title="Memory"
      lead="Why the system believes what it believes. KAE-Memory is authoritative for all of this; Studio only displays it."
      actions={
        <Badge tone="neutral">
          <Database className="size-3" aria-hidden="true" />
          {/* The same words the footer uses (`NAV-01` N4). Two spellings of one
              unknown — `revision —` here and `revision unreported` below — read
              as two different facts about the same missing number. */}
          {project?.memoryRevision === undefined
            ? 'revision unreported'
            : `revision ${project.memoryRevision}`}
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
                { label: 'Statements', value: counts.statements },
                // **Not a zero** (`D-184`). The adapter cannot read modules on any
                // live deployment, so the count is `0` for a project with twenty
                // of them and for a project with none alike — and on a page whose
                // subject is what the record holds, a number reads as having
                // asked. The gap carries the reason and is rendered under the row.
                {
                  label: 'Modules',
                  value: projection.modulesGap ? 'not readable' : projection.modules.length,
                },
                { label: 'Open decisions', value: counts.openDecisions },
                // **Not "Findings"** (`D-96`). This labelled 174 proposed statements as
                // findings, which are a different set of a different size — there
                // are seven of those, and they are what a review produced.
                { label: 'Awaiting your decision', value: counts.awaitingDecision },
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
            {projection.modulesGap && (
              <p className="mt-3 max-w-3xl text-[12.5px] leading-relaxed text-ink-muted">
                Modules are not counted here: {projection.modulesGap.reason}
              </p>
            )}
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
            <Badge tone="neutral">{records.length}</Badge>
          </PanelHeader>
          <PanelBody className="px-0 py-0">
            {records.length === 0 && (
              <div className="px-5 py-4">
                <p className="text-[12.5px] text-ink-subtle">
                  This project holds no knowledge records yet. Nothing has been derived to trace.
                </p>
              </div>
            )}
            <ul className="divide-y divide-line">
              {records.map((r) => (
                <li key={r.id} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      {/* **The statement first** (`NAV-01` N4). The identifier
                          led every one of 180 rows, in the widest column, so
                          the page that answers *why does KAE believe this*
                          opened with a UUID rather than a belief. It belongs
                          with the provenance — which is the one place somebody
                          wants it, and where a disclosure already existed. */}
                      <div className="min-w-0">
                        <p className="text-[13.5px] leading-relaxed text-ink">{r.statement}</p>
                        <details className="mt-1.5 group">
                          <summary className="cursor-pointer list-none text-[12px] text-accent-ink hover:underline">
                            Where this came from
                          </summary>
                          <div className="mt-2 border-l border-line pl-3">
                            <p className="mb-2 text-[11.5px] text-ink-subtle">
                              Statement <Mono className="text-ink">{r.id}</Mono>
                            </p>
                            <RecordProvenance knowledgeId={r.id} status={r.status} />
                          </div>
                        </details>
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
