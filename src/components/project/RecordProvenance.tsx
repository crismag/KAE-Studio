import { Quote } from 'lucide-react'
import { useKnowledgeTrace } from '@/hooks/useProject'
import { Mono } from '@/components/ui/primitives'
import type { TraceStep } from '@/services/interfaces'

/**
 * One record's provenance, read on demand.
 *
 * **Not a model explaining itself.** The distinction matters more here than
 * anywhere else in the product: a generated rationale reads exactly like
 * recorded evidence, and a reader cannot tell them apart. Everything below came
 * out of KAE-Memory's record.
 *
 * The query is scoped to a row somebody has actually opened — a project holds
 * hundreds of records, and reading provenance for all of them on page load
 * would replace a dishonest surface with a slow one.
 *
 * A failure says so. Provenance that could not be read must never render as
 * provenance that does not exist, because here the difference is the point.
 *
 * One component and not two: `/memory` and `/requirements` ask the same
 * question of the same endpoint, and two copies of the answer are one concept
 * in two renderings (`D-125`).
 */
export function RecordProvenance({ knowledgeId, status }: { knowledgeId: string; status: string }) {
  const { data, isLoading, isError } = useKnowledgeTrace(knowledgeId)

  if (isLoading) return <p className="text-[12px] text-ink-subtle">Reading provenance…</p>
  if (isError || !data)
    return (
      <p className="text-[12px] text-ink-subtle">
        Provenance could not be read. Nothing is being guessed in its place.
      </p>
    )

  const quoted = quotedMessages(data.steps)

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
        {quoted.length > 0 && (
          <div className="mt-1.5 space-y-2">
            {quoted.map((step) => (
              <figure key={step.reference}>
                <blockquote className="flex gap-2 text-[12.5px] leading-relaxed text-ink-muted">
                  <Quote className="mt-0.5 size-3 shrink-0 text-ink-subtle" aria-hidden="true" />
                  <span className="whitespace-pre-wrap">“{step.detail}”</span>
                </blockquote>
                <figcaption className="mt-1 pl-5 text-[11px] text-ink-subtle">
                  message <Mono>{step.reference}</Mono>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </dd>
      {data.produced_by_run_id && (
        <>
          <dt className="text-ink-subtle">By</dt>
          <dd className="text-ink-muted">
            extraction run <Mono>{data.produced_by_run_id}</Mono>
          </dd>
        </>
      )}
    </dl>
  )
}

/**
 * The source messages whose text the trace actually carries.
 *
 * A `source_message` step with no `detail` is counted by the sentence above and
 * not quoted: KAE-Memory leaves the field empty when nothing was recorded, and
 * an empty blockquote asserts *the evidence is empty* rather than *not
 * recorded* (`D-38`).
 */
function quotedMessages(steps: TraceStep[] | undefined): TraceStep[] {
  return (steps ?? []).filter((step) => step.relation === 'source_message' && step.detail?.trim())
}
