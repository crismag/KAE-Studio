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
 * ## Which gestures are controls, and which are still words (`SYN-4`, `D-142`)
 *
 * The item names its own gestures and Studio may draw only the ones the backend
 * can perform. **Defer** can be performed, so it is a button, and **Reopen** is
 * beside it because a queue that shrinks only by hiding is the queue this page
 * replaced. **Discuss** stays a word: it means putting the question into the
 * Workspace conversation, and nothing carries a question across a route boundary
 * into that conversation yet. **Answer** stays a word because no route answers —
 * `resolve` closes the item and leaves the question open, which is doc 01's
 * opening complaint rather than its remedy.
 *
 * ## What supports an item, and what it affects (`D-145`)
 *
 * Each card can answer **what evidence supports this** with the observations the
 * theme was drawn from, fetched when the disclosure is opened rather than with
 * the queue. **What it affects** is not answered and is not guessed: Memory now
 * ranks a run by what its questions block where readiness has been measured
 * (`ranked_by_blocking`, said out loud in the run report), but the attention row
 * carries no areas over the wire, so drawing consequences on a card would be
 * inventing a field. That half is the next increment.
 *
 * ## What this page does not do
 *
 * Close an item. `POST /attention/{id}/resolve` exists in Memory and no item
 * names that gesture, so nothing here calls it.
 */

import { useState } from 'react'

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
  Skeleton,
} from '@/components/ui/primitives'
import {
  useAttention,
  useAttentionDeferral,
  useRunUnknownSynthesis,
  useSynthesizedModel,
  useSynthesizedObject,
} from '@/hooks/useProject'
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
  const { defer, reopen } = useAttentionDeferral()

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
              {(items) => {
                const waiting = items.filter((item) => item.status !== 'deferred')
                const postponed = items.filter((item) => item.status === 'deferred')
                return (
                  <>
                    {waiting.length > 0 && (
                      <ul className="space-y-2.5">
                        {waiting.map((item) => (
                          <Item
                            key={item.id}
                            item={item}
                            onDefer={() => defer.mutate(item.id)}
                            deferring={defer.isPending}
                          />
                        ))}
                      </ul>
                    )}
                    {/* Nothing waiting is only good news if nothing was
                        postponed either — otherwise the queue was emptied by
                        hiding and this panel would be saying so falsely. */}
                    {waiting.length === 0 && postponed.length > 0 && (
                      <p className="text-[12.5px] leading-relaxed text-ink-muted">
                        Nothing is waiting on you. {plural(postponed.length, 'item')} below{' '}
                        {postponed.length === 1 ? 'is' : 'are'} postponed and still owed.
                      </p>
                    )}
                    {postponed.length > 0 && (
                      <details className="mt-2.5 rounded-md border border-line bg-surface-sunken px-3 py-2.5">
                        <summary className="cursor-pointer list-none text-[12.5px] text-ink">
                          {plural(postponed.length, 'item')} you postponed — still owed, no longer
                          suggested
                        </summary>
                        <ul className="mt-2 space-y-2.5">
                          {postponed.map((item) => (
                            <Item
                              key={item.id}
                              item={item}
                              onReopen={() => reopen.mutate(item.id)}
                              reopening={reopen.isPending}
                            />
                          ))}
                        </ul>
                      </details>
                    )}
                  </>
                )
              }}
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
        {/* Which of the two orderings a run performed (`D-150`). The field has
            crossed the wire since the queue existed and was read by nothing,
            which was harmless only while it could not change. */}
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">
          {report.rankedByBlocking
            ? 'Ordered by what each question blocks: the discovery areas it names that this project has not covered yet.'
            : 'Ordered by how often the project returned to each question, not by what it blocks — readiness has not been measured here, so KAE has no coverage to rank against.'}
        </p>
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

/** The gestures the item names that Studio can actually perform (`D-142`). */
const PERFORMABLE = ['defer']

function Item({
  item,
  onDefer,
  onReopen,
  deferring,
  reopening,
}: {
  item: AttentionItem
  onDefer?: () => void
  onReopen?: () => void
  deferring?: boolean
  reopening?: boolean
}) {
  // Named as words only where no control exists for them. Listing a gesture
  // under "what can be done" *and* offering it as a button says it twice.
  const stillWords = item.actions.filter((action) => !PERFORMABLE.includes(action))
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
      {stillWords.length > 0 && (
        <p className="mt-1.5 text-[11.5px] text-ink-subtle">
          What can be done with this: {stillWords.map(readable).join(', ')}
        </p>
      )}
      {item.synthesizedObjectId && <Evidence objectId={item.synthesizedObjectId} />}
      {/* Doc 01's sixth question — what happens if you choose this — beside the
          control rather than in a tooltip nobody opens. */}
      {onDefer && item.actions.includes('defer') && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={onDefer} disabled={deferring}>
            Postpone
          </Button>
          <span className="text-[11.5px] text-ink-subtle">
            Stops KAE suggesting this. It stays owed, and you can bring it back.
          </span>
        </div>
      )}
      {onReopen && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={onReopen} disabled={reopening}>
            Bring back
          </Button>
          <span className="text-[11.5px] text-ink-subtle">Returns this to what needs you.</span>
        </div>
      )}
    </li>
  )
}

/**
 * What supports this item — the observations the theme was drawn from (`D-145`).
 *
 * Read when opened, not with the queue: eight items would be eight requests for
 * a page whose point is brevity, and the answer is only wanted for the item
 * somebody stopped at.
 *
 * *What does it affect* is **not** here and is not guessed at. The theme's
 * members are observations, not the things a decision would change, and the item
 * carries no area of its own — what a run ranked by is reported once, on the run
 * panel, rather than restated per card as a consequence it does not hold.
 */
function Evidence({ objectId }: { objectId: string }) {
  const [asked, setAsked] = useState(false)
  const object = useSynthesizedObject(objectId, asked)
  return (
    <details className="mt-2" onToggle={(event) => setAsked(event.currentTarget.open)}>
      <summary className="cursor-pointer list-none text-[11.5px] text-ink-subtle">
        What this rests on
      </summary>
      {/* No `empty` prop: it fires on empty *arrays*, and this query answers
          with an object. The nothing-bound case is decided below, where the
          list it is about is in hand. */}
      <QueryState
        query={object}
        of="the evidence behind this item"
        skeleton={<Skeleton className="mt-1.5 h-12" />}
      >
        {(detail) =>
          detail.evidence.length === 0 ? (
            <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted">
              Nothing is recorded as supporting this. The item was raised without evidence bound to
              it.
            </p>
          ) : (
            <>
              {/* Counted from the list below rather than carried separately, so
                  the sentence cannot claim more than it shows. */}
              <p className="mt-1.5 text-[11.5px] text-ink-subtle">
                {plural(detail.evidence.length, 'observation')} KAE read
              </p>
              <ul className="mt-1 space-y-1">
                {detail.evidence.map((row) => (
                  <li key={row.id} className="text-[12px] leading-relaxed text-ink-muted">
                    {row.statement}{' '}
                    <span className="text-ink-subtle">
                      · {readable(row.knowledgeKind)} · {readable(row.lifecycle)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )
        }
      </QueryState>
    </details>
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
