import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as Collapsible from '@radix-ui/react-collapsible'
import * as Dialog from '@radix-ui/react-dialog'
import {
  ArrowRight,
  HelpCircle,
  Clock,
  CornerDownLeft,
  Loader2,
  Paperclip,
  PanelRightOpen,
  Sparkle,
  TriangleAlert,
  X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/format'
import { plural } from '@/lib/plural'
import { SKILL_SENTENCES } from './skillSentences'
import {
  Badge,
  Button,
  Panel,
  PanelBody,
  PanelHeader,
  PanelTitle,
} from '@/components/ui/primitives'
import { SeverityBadge } from '@/components/project/SeverityBadge'
import { StatusBadge } from '@/components/project/statusVocabulary'
import {
  ConcludedList,
  RecommendationCard,
  type Disposition,
  type Recommendation,
} from './RecommendationCard'
import { AssistantProse } from './AssistantProse'
import { NextAction } from '@/components/project/NextAction'
import { CapabilityNote } from '@/components/project/CapabilityNote'
import { SectionsNotRead } from '@/components/project/SectionsNotRead'
import { ClassificationState } from './ClassificationState'
import { sectionsNotRead } from '@/components/project/sectionsNotRead'
import { floorAction, type RecommendedAction } from '@/components/project/nextActionFloor'
import {
  useClassify,
  useConfirmReading,
  useDecideRecommendation,
  useDeferDecision,
  useInterviewSession,
  useMessages,
  useProjection,
  useSendMessage,
} from '@/hooks/useProject'
import { ActionFailed } from '@/components/project/ActionFailed'
import { blockedBy } from './blockedBy'
import type {
  ConversationMessage,
  CoverageTopic,
  OpenDecision,
  ProjectProjection,
} from '@/domain/types'
import { useDeploymentStatus } from '@/app/shell/useDeploymentStatus'

/* ------------------------------------------------------------- transcript */

function SyncIndicator({ message }: { message: ConversationMessage }) {
  if (message.syncState === 'acknowledged') return null
  if (message.syncState === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 text-[11.5px] text-ink-subtle">
        <Clock className="size-3" aria-hidden="true" />
        Saving to project memory…
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11.5px] text-blocking">
      <TriangleAlert className="size-3" aria-hidden="true" />
      Not yet saved — retry
    </span>
  )
}

function UserMessage({ message }: { message: ConversationMessage }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="max-w-[46rem] rounded-panel rounded-br-sm bg-accent-soft px-4 py-3 text-[14px] leading-relaxed text-ink">
        {message.body}
      </div>
      <div className="flex items-center gap-2 pr-1">
        <SyncIndicator message={message} />
        <time className="text-[11px] text-ink-subtle" dateTime={message.createdAt}>
          {formatDateTime(message.createdAt)}
        </time>
      </div>
    </div>
  )
}

/**
 * Agreeing with a reading, in one click.
 *
 * **The action is the confirmation.** A turn that reflected statements back
 * carries their ids; clicking Yes confirms exactly those, and nothing asks
 * afterwards whether the person meant it.
 *
 * Shown only when the turn actually reflected something. A question that asks
 * something new has nothing to agree with, and offering "yes, that holds"
 * against it would invite agreement with an empty set.
 */
function ConfirmReading({
  ids,
  onConfirm,
}: {
  ids: string[]
  onConfirm: (ids: string[]) => Promise<void> | void
}) {
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'failed'>('idle')

  if (state === 'done') {
    return (
      <p className="text-[12.5px] text-confirmed-ink">
        Confirmed — {plural(ids.length, 'statement', 'statements')} now part of what this project
        holds.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[12.5px] text-ink-muted">Does that hold?</span>
      <Button
        variant="secondary"
        size="sm"
        disabled={state === 'saving'}
        onClick={async () => {
          setState('saving')
          try {
            await onConfirm(ids)
            setState('done')
          } catch {
            // Reported, never swallowed into a success state. An interface that
            // showed "Confirmed" after a failed write would be the same lie as
            // the sentence that said it before this existed.
            setState('failed')
          }
        }}
      >
        {state === 'saving' ? 'Confirming…' : `Yes — confirm ${ids.length}`}
      </Button>
      {state === 'failed' && (
        <span className="text-[12.5px] text-blocking">
          Not confirmed — nothing was recorded. Try again.
        </span>
      )}
    </div>
  )
}

export function AssistantMessage({
  message,
  onSuggestion,
  onConfirmReading,
  onDecideRecommendation,
}: {
  message: ConversationMessage
  onSuggestion: (text: string) => void
  onConfirmReading?: (ids: string[]) => Promise<void> | void
  onDecideRecommendation?: (
    recommendation: Recommendation,
    disposition: Disposition,
    modifiedTo?: string,
  ) => Promise<void> | void
}) {
  return (
    <article className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 grid size-6 shrink-0 place-items-center rounded bg-surface-sunken text-ink-muted"
          aria-hidden="true"
        >
          <Sparkle className="size-3.5" />
        </div>
        <div className="min-w-0 max-w-[52rem] space-y-3">
          {/* `VC-03/E`. CIE has specified rich Markdown since the first slice
              and this was a bare `<p>`, so a reply comparing three options
              arrived as one paragraph with literal pipe characters in it. */}
          <AssistantProse>{message.body}</AssistantProse>

          {/* Explanation is on demand — R2's third channel.

              This was an always-open panel listing "Interviewing skill: x" and
              "Subject: y", and the same two facts were rendered again at the
              foot of the transcript as a sentence (PPA-04). Two renderings of
              one source, both inline, in a conversation where roughly a quarter
              of the text was already machine-facing.

              One disclosure now, closed by default, carrying the sentence
              rather than the raw fields. WhyThisQuestion was always the better
              of the two — right idea, wrong position. */}
          {message.understanding && (
            <details>
              <summary className="cursor-pointer list-none text-[11.5px] text-ink-subtle underline-offset-2 hover:text-ink-muted hover:underline">
                Why this?
              </summary>
              <div className="mt-1.5">
                <WhyThisQuestion points={message.understanding.points} />
              </div>
            </details>
          )}

          {message.concluded && message.concluded.length > 0 && (
            <ConcludedList concluded={message.concluded} />
          )}

          {onDecideRecommendation && message.recommendation && (
            <RecommendationCard
              recommendation={message.recommendation}
              onDecide={(disposition, modifiedTo) =>
                onDecideRecommendation(message.recommendation!, disposition, modifiedTo)
              }
            />
          )}

          {onConfirmReading && message.provenance && message.provenance.length > 0 && (
            <ConfirmReading ids={message.provenance} onConfirm={onConfirmReading} />
          )}

          {message.question && (
            <div className="rounded-panel border-l-2 border-accent bg-accent-soft/40 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-accent-ink">
                Next question
              </p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ink">{message.question}</p>
            </div>
          )}

          {message.suggestions && message.suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {message.suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSuggestion(s)}
                  className="rounded-full border border-line-strong bg-surface px-3 py-1 text-[12.5px] text-ink-muted transition-colors hover:border-accent-line hover:bg-accent-soft hover:text-accent-ink"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {message.resultingChanges && message.resultingChanges.length > 0 && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-ink-subtle">
              {message.resultingChanges.map((change, i) => (
                <span key={change} className="inline-flex items-center gap-2">
                  {i > 0 && <span aria-hidden="true">·</span>}
                  {change}
                </span>
              ))}
            </p>
          )}
        </div>
      </div>
    </article>
  )
}

/* ---------------------------------------------------------- context panel */

/**
 * What KAE currently understands — and, where it understands nothing, that.
 *
 * Every field here is read from the projection. Nothing is hard-coded, and that
 * is the point rather than a style preference: this panel used to state a Core
 * workflow of "Draft → submit → approve or reject → publish" for *every*
 * project, because it was written against a fixture. A reader had no way to
 * tell that sentence from one KAE had derived, so the product asserted a
 * workflow no project had described. The founding rule is that inference must
 * never pass as fact; a fixture passing as fact is the same failure with less
 * excuse.
 *
 * An empty field renders as absence, never as an artefact. `problem` was
 * previously split on ". " and rejoined with a trailing period, so a project
 * with no problem statement displayed a lone "." — which reads as content.
 */
function UnderstandingSection({ projection }: { projection: ProjectProjection }) {
  const { problem, stakeholders, workflows } = projection.definition
  const primaryUsers = stakeholders.filter((s) => s.status === 'confirmed').map((s) => s.name)
  // Two sentences, and only if there are two. Trimmed first so a value that is
  // whitespace is treated as the absence it is.
  const summary = problem
    .trim()
    .split(/(?<=\.)\s+/)
    .slice(0, 2)
    .join(' ')

  return (
    <div className="space-y-3">
      <UnderstandingField label="Problem" absent="Not established yet.">
        {summary}
      </UnderstandingField>
      <UnderstandingField label="Primary users" absent="None confirmed yet.">
        {primaryUsers.join(', ')}
      </UnderstandingField>
      <UnderstandingField label="Core workflow" absent="None described yet.">
        {workflows.map((w) => w.name).join(' · ')}
      </UnderstandingField>
    </div>
  )
}

/**
 * Which packages this project could generate now, and what they would carry.
 *
 * The previous version named "Report Management" and "Approval Workflow" and
 * counted decisions blocking the module key `MOD-APR` — all three from the
 * prototype fixture. The count was genuine, which made it worse: real derived
 * data wrapped around invented names reads as though KAE had worked it out.
 */
function GenerableNow({ projection }: { projection: ProjectProjection }) {
  const deployment = useDeploymentStatus()
  const blocked = (moduleKey: string) =>
    projection.openDecisions.filter((d) => !d.deferred && d.blocks.includes(moduleKey)).length

  // "Can be generated" is a claim about the deployment, not about the project.
  // `/api/status` has reported whether KAE-Artifacts is configured since the
  // artifact routes existed, and nothing read it — so this panel promised a
  // package on deployments where every artifact route answers
  // `501 artifacts_not_configured`.
  if (deployment.state === 'ready' && deployment.status.artifactsConfigured === false) {
    return (
      <p className="text-[12.5px] leading-relaxed text-ink-muted">
        Package generation is not configured on this deployment, so nothing can be generated here
        yet. The project knowledge above is unaffected.
      </p>
    )
  }

  if (projection.modules.length === 0) {
    return (
      <p className="text-[12.5px] leading-relaxed text-ink-muted">
        The project context package can be generated. No modules have been proposed yet, so there
        are no module packages.
      </p>
    )
  }

  return (
    <ul className="space-y-1.5 text-[12.5px] leading-relaxed text-ink-muted">
      <li>The project context package can be generated.</li>
      {projection.modules.map((module) => {
        const unresolved = blocked(module.key)
        return (
          <li key={module.id}>
            {module.name} can be generated
            {unresolved > 0
              ? `, but it will carry ${unresolved} unresolved decision${unresolved === 1 ? '' : 's'}.`
              : '.'}
          </li>
        )
      })}
    </ul>
  )
}

function UnderstandingField({
  label,
  absent,
  children,
}: {
  label: string
  absent: string
  children: string
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">{label}</p>
      {children ? (
        <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{children}</p>
      ) : (
        <p className="mt-1 text-[13px] italic text-ink-subtle">{absent}</p>
      )}
    </div>
  )
}

const COVERAGE_TONE: Record<CoverageTopic['state'], string> = {
  strong: 'bg-confirmed',
  forming: 'bg-accent',
  thin: 'bg-attention',
  missing: 'bg-line-strong',
  // Not a gap and not progress. The quietest mark available, because an area
  // that does not apply to this project should not draw attention on a panel
  // about what is missing from it (`D-27`).
  notApplicable: 'bg-line',
}

/** What each coverage state is called on screen. */
const COVERAGE_WORD: Record<CoverageTopic['state'], string> = {
  strong: 'strong',
  forming: 'forming',
  thin: 'thin',
  missing: 'missing',
  // `capitalize` on the raw key would render "notapplicable".
  notApplicable: 'not applicable',
}

export function CoverageSection({
  projection,
  onDiscuss,
}: {
  projection: ProjectProjection
  onDiscuss?: (area: string) => void
}) {
  // An empty coverage list has two opposite causes, and one of them is us.
  // When the readiness call failed the backend substitutes `{}`, which becomes
  // no areas at all — rendered bare, that reads as a project with nothing in
  // any area rather than as a project nobody could read (`AUD-040`).
  const notRead = sectionsNotRead(projection.unavailable).find((e) => e.section === 'readiness')
  if (notRead) return <CapabilityNote reason={notRead.reason} />

  return (
    <ul className="space-y-2">
      {projection.health.coverage.map((topic) => (
        <li key={topic.key} className="flex items-start gap-2.5">
          <span
            className={cn('mt-1.5 h-1.5 w-6 shrink-0 rounded-full', COVERAGE_TONE[topic.state])}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-[12.5px] font-medium text-ink">
              {topic.name}
              <span className="ml-1.5 font-normal text-ink-subtle">
                {COVERAGE_WORD[topic.state]}
              </span>
            </p>
            <p className="text-[11.5px] leading-snug text-ink-subtle">{topic.detail}</p>
            {/* `PLANNING_MODEL`'s `blocked`: *"another decision is required
                first — dimmed, states the blocker"*. Beside the state rather
                than as a sixth state, because Memory's `AreaState` cannot
                produce one and a vocabulary this page invented alone would be
                a fourth for one concept (`D-31`). */}
            {blockedBy(topic.key, projection.blockers).map((blocker) => (
              <p key={blocker.id} className="text-[11.5px] leading-snug text-blocking">
                Blocked: {blocker.summary}
              </p>
            ))}
            {/* U4. Back into the conversation with the subject named, rather
                than a second editing surface beside the one that works. */}
            {/* Nothing to discuss about an area that does not apply, and
                offering it would invite somebody to fill a gap KAE does not
                think exists. */}
            {onDiscuss && topic.state !== 'strong' && topic.state !== 'notApplicable' && (
              <button
                type="button"
                onClick={() => onDiscuss(topic.name)}
                className="mt-0.5 text-[11.5px] text-accent-ink underline-offset-2 hover:underline"
              >
                Discuss this
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

function OpenDecisionRow({ decision }: { decision: OpenDecision }) {
  const defer = useDeferDecision()
  return (
    <li className="rounded-md border border-line bg-surface px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12.5px] font-medium leading-snug text-ink">{decision.question}</p>
        {decision.deferred && <StatusBadge status="deferred" />}
      </div>
      {/* A grade, shown as a grade. There is no "why" behind an open question
          — Memory grades clarification candidates and does not explain them —
          and a sentence here would have to be invented to exist. */}
      <p className="mt-1">
        <SeverityBadge severity={decision.severity} />
      </p>
      <div className="mt-2 flex items-center gap-3">
        <span className="font-mono text-[10.5px] text-ink-subtle">{decision.id}</span>
        {/* Only for a question somebody has actually been asked.
            Deferring needs a message id, and a candidate has none — offering
            the control for one would either fail or ask the question in order
            to defer it, which is the defect that put ten machine-generated
            questions in a transcript wearing a different hat. */}
        {decision.asked ? (
          <button
            type="button"
            onClick={() => defer.mutate({ decisionId: decision.id, deferred: !decision.deferred })}
            className="text-[11.5px] text-accent-ink underline-offset-2 hover:underline"
          >
            {decision.deferred ? 'Bring back' : 'Decide later'}
          </button>
        ) : (
          <span className="text-[11.5px] text-ink-subtle">Not asked yet</span>
        )}
      </div>
      {/* Deferral is a durable disposition, and this control read no error —
          so a failed write left the row exactly as it was, which is also what
          a successful no-op looks like (AUD-015). */}
      {defer.isError && (
        <p role="alert" className="mt-1.5 text-[11.5px] leading-relaxed text-blocking">
          That was not recorded. The decision is still as it was.
        </p>
      )}
    </li>
  )
}

/**
 * U3 — why KAE asked what it asked, in a person's words.
 *
 * CIE returns the interviewing skill it chose (`handle_non_answer`,
 * `follow_thread`) and the subject it chose (`area:users_and_stakeholders`).
 * Those are the reason; they are just not written for a reader. This translates
 * them and does not invent anything — no rationale is generated here, because a
 * generated explanation of a model's choice is a second guess presented as an
 * account.
 *
 * If CIE later returns prose reasoning of its own, this is where it goes and
 * this map disappears.
 */
function areaLabel(subject: string): string {
  const key = subject.replace(/^area:/, '')
  return key ? key.replace(/_/g, ' ') : ''
}

function WhyThisQuestion({ points }: { points: string[] }) {
  // The turn carries `Interviewing skill: x` and optionally `Subject: y`.
  const skill = points.find((p) => p.startsWith('Interviewing skill:'))?.split(': ')[1] ?? ''
  const subject = points.find((p) => p.startsWith('Subject:'))?.split(': ')[1] ?? ''
  if (!skill) return null

  // An unmapped skill still gets a sentence. CIE chooses its skills freely --
  // that is the point of skills-not-scripts -- so this table will fall behind
  // it, and returning null meant the explanation vanished entirely the moment
  // it did. A reader would see no reason and conclude there was none.
  //
  // Naming the raw skill is worse prose and better information, and it makes
  // the gap visible to whoever has to add the missing line.
  const reason = SKILL_SENTENCES[skill] ?? `it is working through ${skill.replace(/_/g, ' ')}`

  const area = areaLabel(subject)

  return (
    <p className="text-[11.5px] leading-relaxed text-ink-subtle">
      KAE asked this because {reason}
      {area && (
        <>
          {' '}
          — it is working on <span className="text-ink-muted">{area}</span>
        </>
      )}
      .
    </p>
  )
}

/**
 * U8 — the four words a first-time reader has to guess at, explained on demand.
 *
 * Collapsed. A permanent panel of definitions is read once and then occupies
 * the sidebar forever for everyone who already knows.
 */
function WhatTheseMean() {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[11.5px] text-accent-ink underline-offset-2 hover:underline"
        >
          <HelpCircle className="size-3" aria-hidden="true" />
          What do these mean?
        </button>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <div className="mt-2 space-y-1.5 text-[11.5px] leading-relaxed text-ink-muted">
          <p>
            <strong className="text-ink">Confirmed</strong> — you agreed to it. Only confirmed
            knowledge counts here.
          </p>
          <p>
            <strong className="text-ink">Awaiting review</strong> — KAE derived it from what you
            said. It is a candidate until you accept it.
          </p>
          <p>
            <strong className="text-ink">0 of 1 confirmed</strong> — how many agreed statements this
            area needs before it is defined enough to build from.
          </p>
          <p>
            Nothing here blocks you. Sparse answers and open questions are fine — this is a picture
            of what is known, not a form to complete.
          </p>
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}

/**
 * What the coverage figure above was computed over.
 *
 * `PLANNING_MODEL.md`: *"Content loss is reported separately and never folded
 * in."* F-018 abandons 29–65% of chunks on real corpora, every one after
 * `verify_quotes` rejected a citation that was a directory tree or a code
 * fence — and what survives looks exactly like a complete project.
 *
 * **Silent when there is nothing to say.** A banner on every project warning
 * that something might be missing is a banner nobody reads, and the point of
 * the previous slice was not handing people more to sort out. It appears only
 * when a run was actually abandoned.
 */
export function ContentLoss({ coverage }: { coverage?: ProjectProjection['extractionCoverage'] }) {
  if (!coverage || coverage.complete) return null

  const { abandoned, succeeded } = coverage
  return (
    <p className="mt-3 flex gap-2 border-t border-attention-line pt-2.5 text-[11.5px] leading-relaxed text-ink-muted">
      <TriangleAlert className="mt-[3px] size-3 shrink-0 text-attention" aria-hidden="true" />
      <span>
        {abandoned} of {abandoned + succeeded} submissions could not be fully read, so the figures
        above describe less than this project actually said.
      </span>
    </p>
  )
}

function ContextPanelContent({
  onDiscuss,
  recommended,
}: {
  onDiscuss?: (area: string) => void
  /** The latest turn's ranking, if a turn has happened in this session. */
  recommended?: RecommendedAction
}) {
  const { data: projection } = useProjection()
  const classify = useClassify()
  if (!projection) return null

  const blocking = projection.openDecisions.filter((d) => !d.deferred)
  // The floor, when nothing has been ranked yet. R12 asks for a recommendation
  // *always*, and rendering must cost no model call — so this is derived from
  // the projection already in hand rather than requested.
  const action = recommended ?? floorAction(projection)

  return (
    <div className="space-y-4 pb-6">
      {/* Above the recommendation, deliberately. A next action derived from a
          projection with a section missing is a recommendation made on partial
          information, and the reader has to know that before they act on it. */}
      <SectionsNotRead unavailable={projection.unavailable} />

      <NextAction action={action} derived={recommended === undefined} />

      <Panel>
        <PanelHeader>
          <PanelTitle>Current understanding</PanelTitle>
        </PanelHeader>
        <PanelBody>
          <UnderstandingSection projection={projection} />
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Discovery progress</PanelTitle>
          <span className="text-[11.5px] text-ink-subtle">{projection.health.phase}</span>
        </PanelHeader>
        <PanelBody>
          <CoverageSection projection={projection} onDiscuss={onDiscuss} />
          {/* Beside the areas, because it is the reason they are empty. A
              person reading "0 of 1 confirmed" ten times over needs to know
              whether anything has looked. */}
          <ClassificationState
            classification={projection.classification}
            onClassify={() => classify.mutate()}
            pending={classify.isPending}
            queued={classify.isSuccess}
          />
          <ContentLoss coverage={projection.extractionCoverage} />
          <div className="mt-3 border-t border-line pt-2">
            <WhatTheseMean />
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Open decisions</PanelTitle>
          <Badge tone={blocking.length ? 'attention' : 'neutral'}>{blocking.length} open</Badge>
        </PanelHeader>
        <PanelBody className="px-3">
          <ul className="space-y-2">
            {projection.openDecisions.map((d) => (
              <OpenDecisionRow key={d.id} decision={d} />
            ))}
          </ul>
        </PanelBody>
      </Panel>

      {/* Rendered only when there is something to render.
          `recentChanges` is hardcoded `[]` in the live adapter — nothing in
          Memory produces a change feed — so this panel was a permanent empty
          heading with no explanation, which reads as "this project has changed
          nothing". It is a capability Studio does not have, not a fact about
          the project, and an absent panel claims less than an empty one. */}
      {projection.recentChanges.length > 0 && (
        <Panel>
          <PanelHeader>
            <PanelTitle>Recent changes</PanelTitle>
          </PanelHeader>
          <PanelBody>
            <ul className="space-y-2.5">
              {projection.recentChanges.map((change) => (
                <li key={change.id} className="flex flex-col gap-0.5">
                  <span className="text-[12.5px] leading-snug text-ink-muted">{change.text}</span>
                  <time className="text-[11px] text-ink-subtle" dateTime={change.at}>
                    {formatDateTime(change.at)}
                  </time>
                </li>
              ))}
            </ul>
          </PanelBody>
        </Panel>
      )}

      <Panel>
        <PanelHeader>
          <PanelTitle>What can be generated now</PanelTitle>
        </PanelHeader>
        <PanelBody className="space-y-2.5">
          <GenerableNow projection={projection} />
          <Button variant="secondary" size="sm" asChild>
            <Link to="/deliverables">
              Open Deliverables
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </Button>
        </PanelBody>
      </Panel>
    </div>
  )
}

/* ---------------------------------------------------------------- composer */

export function Composer({
  onSend,
  pending,
  draft,
  setDraft,
}: {
  onSend: (text: string) => void
  pending: boolean
  draft: string
  setDraft: (v: string) => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const submit = () => {
    const trimmed = draft.trim()
    if (!trimmed || pending) return
    onSend(trimmed)
    setDraft('')
  }

  return (
    <div className="border-t border-line bg-surface px-4 py-3 sm:px-6">
      <div className="mx-auto max-w-[56rem]">
        <div className="rounded-panel border border-line-strong bg-surface focus-within:border-accent-line focus-within:ring-2 focus-within:ring-accent-soft">
          <label htmlFor="composer" className="sr-only">
            Message
          </label>
          <textarea
            id="composer"
            ref={textareaRef}
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            placeholder="Answer, correct me, or ask why a question matters…"
            className="block w-full resize-none bg-transparent px-4 pt-3 text-[14px] leading-relaxed text-ink outline-none placeholder:text-ink-subtle"
          />
          <div className="flex items-center justify-between gap-3 px-3 pb-2.5 pt-1">
            {/* Wired, at last. This button had no `onClick` for the whole life
                of the product — the most prominent dead control in Studio, in
                its main surface, and `AUD-022`'s remaining half.

                It goes to `/ingestion` rather than opening a file picker,
                because KAE still cannot read files: there is no bytes path or
                decode anywhere in the estate. Sending somebody to the page that
                *can* take their document is the honest version of this
                affordance, and it is why the page had to exist first. */}
            <Button variant="ghost" size="icon" asChild title="Give KAE a document to read">
              <Link to="/ingestion">
                <Paperclip className="size-4" aria-hidden="true" />
                <span className="sr-only">Give KAE a document to read</span>
              </Link>
            </Button>
            <div className="flex items-center gap-3">
              <span className="hidden items-center gap-1 text-[11px] text-ink-subtle sm:flex">
                <CornerDownLeft className="size-3" aria-hidden="true" /> to send
              </span>
              <Button
                variant="primary"
                size="sm"
                onClick={submit}
                disabled={!draft.trim() || pending}
              >
                {pending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    Sending
                  </>
                ) : (
                  'Send'
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------- page */

export function InterviewRoom() {
  const { data: messages, isLoading } = useMessages()
  const { data: session } = useInterviewSession()
  const sendMessage = useSendMessage()
  const confirmReading = useConfirmReading()
  const decideRecommendation = useDecideRecommendation()
  // The most recent turn that recommended anything. Read from the transcript
  // already loaded, so showing it costs nothing — which is what lets the panel
  // be always-present rather than present-after-a-request.
  const recommended = [...(messages ?? [])]
    .reverse()
    .flatMap((m) => m.nextAction ?? [])
    .at(0) as RecommendedAction | undefined
  const [draft, setDraft] = useState('')

  // The last turn, only when it produced no question. A question is written to
  // Memory and arrives through the transcript like any other message; a note is
  // not written at all, so this is the only place it can be seen.
  const lastTurn = sendMessage.data?.turn.assistantMessage
  const advisory = lastTurn && !lastTurn.question ? lastTurn.body : null

  const [contextOpen, setContextOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages?.length, sendMessage.isPending])

  /**
   * Begin work on an area, from what the project already holds.
   *
   * PPA-20. This used to prefill the composer: the user had to notice the text
   * had appeared, send it, answer, and the card still read
   * `missing · 0 of 1 confirmed`. Three deliberate acts to start one, and the
   * first two did nothing.
   *
   * It sends. And what it sends asks CIE to **continue** rather than restart —
   * to read what the area already holds, work out what is genuinely missing,
   * and ask only if a person is actually needed. "Let's talk about scope"
   * invites the interview to begin that subject from nothing, which on a
   * project that has been running for forty messages is the version of
   * unhelpful that feels like being unheard.
   */
  const discuss = (area: string) => {
    sendMessage.mutate(
      `Continue with ${area.toLowerCase()}. Start from what the project already ` +
        `holds there, say what is actually missing, and ask me only if you need ` +
        `something I have not said.`,
    )
  }

  const handleSuggestion = (text: string) => {
    if (text.endsWith('?')) {
      setDraft(text)
      return
    }
    sendMessage.mutate(text)
  }

  return (
    <div className="flex h-full min-w-0">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Session header */}
        <header className="border-b border-line bg-surface px-4 py-3 sm:px-6">
          <div className="mx-auto flex max-w-[56rem] items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[15px] font-semibold text-ink">Discovery</h1>
                <Badge tone="accent">{session?.interviewType ?? '—'}</Badge>
              </div>
              <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-ink-muted">
                {session?.objective}
              </p>
            </div>
            <div className="hidden shrink-0 text-right xl:block">
              <p className="text-[11.5px] text-ink-subtle">
                {session?.questionsAnswered ?? 0} answered · {session?.questionsDeferred ?? 0}{' '}
                deferred
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="shrink-0 xl:hidden"
              onClick={() => setContextOpen(true)}
            >
              <PanelRightOpen className="size-3.5" aria-hidden="true" />
              Context
            </Button>
          </div>
        </header>

        {/* Transcript */}
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto kae-scrollbar px-4 py-6 sm:px-6"
        >
          <div className="mx-auto flex max-w-[56rem] flex-col gap-7">
            {isLoading && <p className="text-[13px] text-ink-subtle">Loading conversation…</p>}
            {messages?.map((message) =>
              message.author === 'user' ? (
                <UserMessage key={message.id} message={message} />
              ) : (
                <AssistantMessage
                  key={message.id}
                  message={message}
                  onSuggestion={handleSuggestion}
                  onConfirmReading={(ids) => confirmReading.mutateAsync(ids)}
                  onDecideRecommendation={(recommendation, disposition, modifiedTo) =>
                    decideRecommendation.mutateAsync({
                      recommendation,
                      disposition,
                      modifiedTo,
                      subject: '',
                    })
                  }
                />
              ),
            )}
            {sendMessage.isPending && (
              <div className="flex items-center gap-2.5 text-[13px] text-ink-muted" role="status">
                <Loader2 className="size-3.5 animate-spin text-accent" aria-hidden="true" />
                Updating project understanding…
              </div>
            )}

            {!sendMessage.isPending && advisory && (
              <p
                className="border-l-2 border-line pl-3 text-[12.5px] leading-relaxed text-ink-muted"
                role="status"
              >
                {advisory}
              </p>
            )}

            {!sendMessage.isPending && sendMessage.isError && (
              // Announced, which it was not (`§17`, `D-42`). The sentence says
              // what happened, what it cost and exactly what to do — and
              // somebody using a screen reader was told none of it, on the one
              // action this room exists for.
              <ActionFailed className="border-l-2 border-blocking-line pl-3">
                That message did not go through: {(sendMessage.error as Error).message}. Nothing was
                recorded, so sending it again is safe.
              </ActionFailed>
            )}
          </div>
        </div>

        <Composer
          onSend={(text) => sendMessage.mutate(text)}
          pending={sendMessage.isPending}
          draft={draft}
          setDraft={setDraft}
        />
      </div>

      {/* Desktop context panel */}
      <aside className="hidden w-[352px] shrink-0 overflow-y-auto border-l border-line bg-canvas px-4 py-4 kae-scrollbar xl:block">
        <ContextPanelContent onDiscuss={discuss} recommended={recommended} />
      </aside>

      {/* Context drawer below xl */}
      <Dialog.Root open={contextOpen} onOpenChange={setContextOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/25 xl:hidden" />
          <Dialog.Content
            className="fixed inset-y-0 right-0 z-50 w-[min(92vw,380px)] overflow-y-auto border-l border-line bg-canvas px-4 py-4 shadow-raised outline-none kae-scrollbar xl:hidden"
            aria-describedby={undefined}
          >
            <div className="mb-3 flex items-center justify-between">
              <Dialog.Title className="text-[13px] font-semibold text-ink">
                Project context
              </Dialog.Title>
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon">
                  <X className="size-4" aria-hidden="true" />
                  <span className="sr-only">Close context panel</span>
                </Button>
              </Dialog.Close>
            </div>
            <ContextPanelContent onDiscuss={discuss} recommended={recommended} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
