/**
 * The short list, and the model it was drawn from (`SYN-3e`, `ADR-0007`).
 *
 * `/reviews` shows extracted evidence: every sentence KAE read, awaiting a
 * decision. On the owner's own project that is 803 rows. This page shows what
 * synthesis concluded from them — 15 goals, 36 themes — and the few things it
 * decided are worth a person's time, which is 8 items.
 *
 * ## Why a separate page and not a restyled queue
 *
 * `ADR-0007` marks the proposed-row queue transitional and `OD-SYN-3` keeps it
 * until equivalence is shown on live data plus one working session. Renaming
 * Confirm to Accept on the same 174-row list is the failure the package exists
 * to avoid, so `/reviews` is untouched and this stands beside it.
 *
 * ## Why the exclusions are on the page
 *
 * A run reports what it **withheld** as well as what it raised, and the first
 * question anybody asks of a queue of 8 drawn from 36 themes is what the other
 * 28 were. Rendering only the 8 would make that unanswerable from the interface,
 * which is the conservation defect this estate has closed twice already.
 *
 * ## What this page does not do
 *
 * Close an item. Memory has `POST /attention/{id}/resolve`, and which gestures
 * an item accepts is carried on the item itself — so the actions are shown as
 * the words the item names, not as buttons Studio chose. Turning them into
 * controls is `SYN-4`.
 */

import { PageLayout } from '@/components/project/PageLayout'
import { QueryState } from '@/components/ui/QueryState'
import {
  Badge,
  Button,
  EmptyState,
  Panel,
  PanelBody,
  PanelHeader,
  PanelTitle,
} from '@/components/ui/primitives'
import { useAttention, useRunUnknownSynthesis, useSynthesizedModel } from '@/hooks/useProject'
import { plural } from '@/lib/plural'
import type { AttentionItem, SynthesizedObject, UnknownSynthesisReport } from '@/domain/types'

/** `material_unknown` → `material unknown`. Memory's word, made readable. */
function readable(value: string): string {
  return value.replace(/_/g, ' ')
}

export function AttentionRoom() {
  const attention = useAttention()
  const model = useSynthesizedModel()
  const run = useRunUnknownSynthesis()

  return (
    <PageLayout
      title="What needs you"
      lead="What synthesis concluded from the evidence, and the few things it decided are worth your time. Every sentence KAE read is on Reviews; this is what it made of them."
      actions={
        <Button onClick={() => run.mutate()} disabled={run.isPending}>
          {run.isPending ? 'Working…' : 'Look again'}
        </Button>
      }
    >
      <div className="mt-6 space-y-5">
        {/* The report, once a run has happened. Not stored anywhere, so it is
            shown while it is in hand rather than reconstructed later. */}
        {run.isError && (
          <p className="text-[12.5px] text-danger">
            The run did not finish: {String(run.error)}. Nothing was written, and the queue below is
            unchanged.
          </p>
        )}
        {run.data && <RunReport report={run.data} />}

        <Panel>
          <PanelHeader>
            <PanelTitle>Things that need a person</PanelTitle>
            <span className="text-[11.5px] text-ink-subtle">
              Raised by synthesis, not by the number of statements awaiting a decision
            </span>
          </PanelHeader>
          <PanelBody>
            <QueryState
              query={attention}
              of="the attention queue"
              empty={
                /* Distinguished from *not yet produced*, which is a different
                   fact and the likelier one. An empty queue rendered as an
                   all-clear is an all-clear nobody earned. */
                <EmptyState title="Nothing is waiting">
                  Either synthesis found nothing material, or it has not run on the project&rsquo;s
                  current state. Look again to find out which.
                </EmptyState>
              }
            >
              {(items) =>
                items.length === 0 ? null : (
                  <ul className="space-y-2.5">
                    {items.map((item) => (
                      <Item key={item.id} item={item} />
                    ))}
                  </ul>
                )
              }
            </QueryState>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>What KAE understands the project to be</PanelTitle>
            <span className="text-[11.5px] text-ink-subtle">
              The synthesized model — goals and themes, not the sentences behind them
            </span>
          </PanelHeader>
          <PanelBody>
            <QueryState
              query={model}
              of="the synthesized model"
              empty={
                <EmptyState title="No model yet">
                  Nothing has been synthesized from this project&rsquo;s evidence. The evidence
                  itself is on Reviews.
                </EmptyState>
              }
            >
              {(objects) =>
                objects.length === 0 ? null : (
                  <ul className="space-y-2.5">
                    {objects.map((object) => (
                      <ModelObject key={object.id} object={object} />
                    ))}
                  </ul>
                )
              }
            </QueryState>
          </PanelBody>
        </Panel>
      </div>
    </PageLayout>
  )
}

/**
 * What the last run concluded, **including what it left out**.
 *
 * `withheld` names themes that were real and deliberately unraised. Memory
 * reports them for exactly this: a queue this short makes its own exclusions the
 * first question, and a surface that dropped them could not answer it.
 */
function RunReport({ report }: { report: UnknownSynthesisReport }) {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>What that run concluded</PanelTitle>
      </PanelHeader>
      <PanelBody>
        <p className="text-[13px] leading-relaxed text-ink">
          {plural(report.considered, 'unknown')} considered, {report.resolved} already answered
          elsewhere, grouped into {plural(report.themes, 'theme')}, of which{' '}
          {plural(report.raised.length, 'was', 'were')} raised.
        </p>
        {/* A run that could not compare its unknowns produces themes of one,
            and a reader has to be able to tell that from real compaction. */}
        {!report.clustered && (
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">
            Nothing was compared: no vectors were available, so every unknown stood alone and each
            theme holds exactly one.
          </p>
        )}
        {report.withheld.length > 0 && (
          <details className="mt-2.5 rounded-md border border-line bg-surface-sunken px-3 py-2.5">
            <summary className="cursor-pointer list-none text-[12.5px] text-ink">
              {plural(report.withheld.length, 'theme')} below the bar, and deliberately not raised
            </summary>
            <ul className="mt-2 space-y-1">
              {report.withheld.map((theme) => (
                <li key={theme} className="text-[12.5px] leading-relaxed text-ink-muted">
                  {theme}
                </li>
              ))}
            </ul>
          </details>
        )}
      </PanelBody>
    </Panel>
  )
}

function Item({ item }: { item: AttentionItem }) {
  return (
    <li className="rounded-md border border-line bg-surface-sunken px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={item.priority <= 1 ? 'attention' : 'neutral'}>{readable(item.kind)}</Badge>
        <span className="text-[13px] text-ink">{item.title}</span>
      </div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">{item.explanation}</p>
      {/* KAE's own sentence. A paraphrase of an instruction is advice nobody
          can follow, which is `D-37`'s finding on the neighbouring page. */}
      {item.recommendation && (
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink">{item.recommendation}</p>
      )}
      {/* The gestures the **item** names, as words rather than buttons. A
          control Studio invented here would be one the backend refuses
          (`SYN-4` owns turning these into controls). */}
      {item.actions.length > 0 && (
        <p className="mt-1.5 text-[11.5px] text-ink-subtle">
          What can be done with this: {item.actions.map(readable).join(', ')}
        </p>
      )}
    </li>
  )
}

function ModelObject({ object }: { object: SynthesizedObject }) {
  return (
    <li className="rounded-md border border-line bg-surface-sunken px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral">{readable(object.domain)}</Badge>
        <span className="text-[13px] text-ink">{object.title}</span>
        {/* Memory's own words for how settled this is and who settled it.
            Rendered rather than translated: `synthesized` and `human` are
            different facts about the same object and collapsing them would
            make KAE's reading indistinguishable from a person's. */}
        <span className="text-[11.5px] text-ink-subtle">
          · {readable(object.lifecycle)} · {readable(object.authority)}
        </span>
      </div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">{object.statement}</p>
    </li>
  )
}
