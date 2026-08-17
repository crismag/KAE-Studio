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
 * ## Which items the last run still stands behind (`D-193`)
 *
 * The queue accumulates: attention items are upserted on the theme's identity
 * key, so one an earlier run raised stays here whether or not the latest run
 * raised it again. Once a report is in hand, the ones it did **not** raise say
 * so. Only the negative is marked — the report already counts what was raised —
 * and only while a report exists, because an unmarked queue on arrival means
 * nobody has looked rather than everything being current.
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
import { attentionCounts, partitionAttention } from '@/lib/counts'
import { plural } from '@/lib/plural'
import type { AttentionItem, SynthesizedObject, UnknownSynthesisReport } from '@/domain/types'

/** `material_change` → `material change`. Memory's word, made readable. */
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
                const { waiting, postponed } = partitionAttention(items)
                // The join the report's identifiers exist for (`D-193`). `null`
                // until a run has happened on this page, because the report is
                // not stored and cannot be reconstructed later.
                const lastRunRaised = run.data
                  ? new Set(run.data.raised.map((raised) => raised.attentionItemId))
                  : null
                return (
                  <>
                    {/* Doc 01's page-level summary, counted by the one rule
                        (`SYN-4b`, `D-166`). Rendered only where something is
                        waiting: the nothing-waiting case is answered below in a
                        sentence that also accounts for the postponed
                        compartment, and two sentences claiming the same zero
                        is how one of them ends up wrong. */}
                    {waiting.length > 0 && <QueueSummary items={items} />}
                    {waiting.length > 0 && (
                      <ul className="space-y-2.5">
                        {waiting.map((item) => (
                          <Item
                            key={item.id}
                            item={item}
                            onDefer={() => defer.mutate(item.id)}
                            deferring={defer.isPending}
                            lastRunRaised={lastRunRaised}
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
                              lastRunRaised={lastRunRaised}
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
 * Doc 01's page-level summary — *"4 things need your attention"* (`SYN-4b`,
 * `D-166`).
 *
 * The one sentence of the three doc 01 asks for that this page can say
 * truthfully. **`1 decision blocks architecture` is refused**: the areas a
 * question blocks are structured in Memory and reach Studio only inside
 * `explanation`, already composed into prose, so counting items per area would
 * mean parsing a sentence written for a reader — and three qualifiers have been
 * added to that sentence in the last four increments. **`2 questions can wait
 * until implementation` is refused too**: *can wait* is urgency, the one
 * dimension `D-165` closed the ranking without, and a page claiming it would be
 * the interface asserting what the engine declines to compute.
 *
 * The kinds are named **only when the queue holds more than one**. Every item
 * the live system has produced comes from unknown synthesis and carries the same
 * kind, so *"4 things need your attention — 4 unknowns"* would be a clause that
 * repeats its own subject. Other producers exist, so it is real when it appears.
 */
function QueueSummary({ items }: { items: AttentionItem[] }) {
  const counts = attentionCounts(items)
  const kinds = Object.entries(counts.waitingByKind)
  // Memory's word, pluralised and not translated: `unknown` does not become
  // *question* here, for the reason an area is named by the template's own word
  // rather than its key (`D-151`).
  const breakdown = kinds.map(([kind, count]) => plural(count, readable(kind)))
  return (
    <p className="text-[13px] leading-relaxed text-ink">
      <span className="font-medium">
        {plural(counts.waiting, 'thing')} need{counts.waiting === 1 ? 's' : ''} your attention
      </span>
      {breakdown.length > 1 && <> — {sentenceList(breakdown)}</>}
      {/* Said here as well as below, because the summary is the number
          somebody quotes and one that silently omitted what they postponed
          would make Postpone a gesture that clears the page (`D-158`). */}
      {counts.postponed > 0 && <>, and {counts.postponed} you postponed</>}.
    </p>
  )
}

/** `a`, `b` and `c`. Two items take no comma. */
function sentenceList(parts: string[]): string {
  if (parts.length <= 1) return parts.join('')
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
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
            which was harmless only while it could not change.

            The blocking sentence names the weighing too (`D-152`): a question
            standing in front of one required area outranks one standing in
            front of two optional ones, which "ordered by what each question
            blocks" alone would not lead anybody to expect.

            And the tie-breaks under it (`D-154`/`D-155`, then `D-157`): equally
            weighted areas are separated by whether their statements already
            contradict each other, and below that by whether one more confirmed
            statement would meet the area's minimum. Which area is contested or
            nearly met belongs to the item's explanation, not here — this
            sentence states the rule the queue was ordered by. */}
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">
          {report.rankedByBlocking
            ? 'Ordered by what each question blocks: the discovery areas it names that this project has not covered yet, weighing the areas readiness requires above the ones it does not, putting the ones whose statements already contradict each other first among equally weighted areas, and then the ones a single confirmed statement short of what they ask for.'
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
  lastRunRaised,
}: {
  item: AttentionItem
  onDefer?: () => void
  onReopen?: () => void
  deferring?: boolean
  reopening?: boolean
  /**
   * The ids the run in hand raised, or `null` when no run has happened here.
   *
   * `null` and *empty* are different facts and the difference is the whole of
   * `D-193`: with no report, an unmarked item means nobody has looked, not that
   * everything is current. An absent badge must not become an assertion
   * (`D-38`).
   */
  lastRunRaised?: ReadonlySet<string> | null
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
      {/* `D-193`. `put_attention` upserts on the theme's identity key, so the
          queue accumulates across runs and an item an earlier run raised stays
          here whether or not the latest one raised it again. Stated as the
          absence it is, and nothing about the cause: the report does not say
          whether the theme fell below the bar or was answered elsewhere. Not
          a *new* badge either — a re-raised item is in `raised` too. */}
      {lastRunRaised && !lastRunRaised.has(item.id) && (
        <p className="mt-1 text-[11.5px] text-ink-subtle">The last run did not raise this again.</p>
      )}
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
function Evidence({
  objectId,
  count,
  summaryLabel,
}: {
  objectId: string
  count?: number
  summaryLabel?: string
}) {
  const [asked, setAsked] = useState(false)
  const object = useSynthesizedObject(objectId, asked)
  return (
    <details className="mt-2" onToggle={(event) => setAsked(event.currentTarget.open)}>
      <summary className="cursor-pointer list-none text-[11.5px] text-ink-subtle">
        {summaryLabel ??
          (count === undefined
            ? 'What this rests on'
            : `Drawn from ${plural(count, 'observation')}`)}
      </summary>
      {/* Rendered only once opened, not merely fetched then. A closed
          `<details>` keeps its children in the DOM, so an object drawn twice on
          this page — once behind an item and once in the model — would hold the
          same sentences twice over as soon as either was opened and the query
          cache answered the other for free.

          No `empty` prop: it fires on empty *arrays*, and this query answers
          with an object. The nothing-bound case is decided below, where the
          list it is about is in hand. */}
      {asked && (
        <QueryState
          query={object}
          of="the evidence behind this item"
          skeleton={<Skeleton className="mt-1.5 h-12" />}
        >
          {(detail) =>
            detail.evidence.length === 0 ? (
              <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted">
                Nothing is recorded as supporting this. The item was raised without evidence bound
                to it.
              </p>
            ) : (
              <>
                {/* Counted from the list below rather than carried separately, so
                  the sentence cannot claim more than it shows. Said only where
                  the closed summary did not already say it: a caller passing a
                  count has put the number on the line somebody clicked, and
                  repeating it underneath is the say-it-once failure `D-142`
                  named about a gesture. */}
                {count === undefined && (
                  <p className="mt-1.5 text-[11.5px] text-ink-subtle">
                    {plural(detail.evidence.length, 'observation')} KAE read
                  </p>
                )}
                {/* Why the list can be longer than the number above it
                    (`D-187`). Memory counts `supports` alone, because the count
                    is read under the words *drawn from*, and a row bound to
                    deny this object is not one of them — it is still evidence
                    about it, so it is listed and named rather than dropped. */}
                {count !== undefined && detail.evidence.length > count && (
                  <p className="mt-1.5 text-[11.5px] text-ink-subtle">
                    {plural(detail.evidence.length - count, 'observation')} here{' '}
                    {detail.evidence.length - count === 1 ? 'stands' : 'stand'} to this as something
                    other than support, and the count above leaves{' '}
                    {detail.evidence.length - count === 1 ? 'it' : 'them'} out.
                  </p>
                )}
                <ul className="mt-1 space-y-1">
                  {detail.evidence.map((row) => (
                    <li key={row.id} className="text-[12px] leading-relaxed text-ink-muted">
                      {row.statement}{' '}
                      <span className="text-ink-subtle">
                        {/* Memory's own relation word, and only when it is not
                            support: labelling every row `supports` would make
                            the ordinary case noisy and the exception quiet. */}
                        {row.kind !== 'supports' && <>· {readable(row.kind)} </>}·{' '}
                        {readable(row.knowledgeKind)} · {readable(row.lifecycle)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )
          }
        </QueryState>
      )}
    </details>
  )
}

/**
 * One object in the model, with how much of the project stands behind it
 * (`SYN-4b`, `D-167`).
 *
 * Doc 01's aggregation is a count and a disclosure together: *one item with 73
 * expandable evidence instances*. The attention card above says its count in
 * `explanation` because Memory composes that sentence; this panel said nothing
 * at all, so a goal drawn from 47 observations was drawn exactly like one drawn
 * from 1.
 *
 * The number comes with the list — one grouped count in Memory — and the
 * sentences come only when somebody opens them.
 */
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
      {/* Zero is said rather than left blank: an object KAE minted with nothing
          bound to it is a different fact from one whose evidence nobody has
          asked for.

          The disclosure is offered at zero as well (`D-187`). The count is
          `supports` alone, so zero no longer means nothing is bound — an object
          with two contradicting rows and no supporting one reads zero here, and
          suppressing the way in would make the evidence against it the only
          evidence a person cannot reach. */}
      {object.supportingEvidence === 0 ? (
        <>
          <p className="mt-1.5 text-[11.5px] text-ink-subtle">
            Nothing is recorded as supporting this
          </p>
          <Evidence objectId={object.id} summaryLabel="What is bound to this" />
        </>
      ) : (
        <Evidence objectId={object.id} count={object.supportingEvidence} />
      )}
    </li>
  )
}
