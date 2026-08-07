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
import {
  Badge,
  Button,
  Panel,
  PanelBody,
  PanelHeader,
  PanelTitle,
} from '@/components/ui/primitives'
import { StatusBadge } from '@/components/project/statusVocabulary'
import {
  useDeferDecision,
  useInterviewSession,
  useMessages,
  useProjection,
  useSendMessage,
} from '@/hooks/useProject'
import type { ConversationMessage, OpenDecision, ProjectProjection } from '@/domain/types'

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

function AssistantMessage({
  message,
  onSuggestion,
}: {
  message: ConversationMessage
  onSuggestion: (text: string) => void
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
          <p className="text-[14px] leading-relaxed text-ink">{message.body}</p>

          {message.understanding && (
            <div className="rounded-panel border border-line bg-surface-sunken/60 px-4 py-3">
              <h3 className="text-[12px] font-semibold text-ink">
                {message.understanding.heading}
              </h3>
              <ul className="mt-2 space-y-1.5">
                {message.understanding.points.map((point) => (
                  <li key={point} className="flex gap-2 text-[13px] leading-relaxed text-ink-muted">
                    <span
                      className="mt-[7px] size-1 shrink-0 rounded-full bg-ink-subtle"
                      aria-hidden="true"
                    />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
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

function UnderstandingSection({ projection }: { projection: ProjectProjection }) {
  const primaryUsers = projection.definition.stakeholders
    .filter((s) => s.status === 'confirmed')
    .map((s) => s.name)

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
          Problem
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
          {projection.definition.problem.split('. ').slice(0, 2).join('. ')}.
        </p>
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
          Primary users
        </p>
        <p className="mt-1 text-[13px] text-ink-muted">{primaryUsers.join(', ')}</p>
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
          Core workflow
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
          Draft → submit → approve or reject → publish
        </p>
      </div>
    </div>
  )
}

const COVERAGE_TONE = {
  strong: 'bg-confirmed',
  forming: 'bg-accent',
  thin: 'bg-attention',
  missing: 'bg-line-strong',
} as const

function CoverageSection({
  projection,
  onDiscuss,
}: {
  projection: ProjectProjection
  onDiscuss?: (area: string) => void
}) {
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
              <span className="ml-1.5 font-normal capitalize text-ink-subtle">{topic.state}</span>
            </p>
            <p className="text-[11.5px] leading-snug text-ink-subtle">{topic.detail}</p>
            {/* U4. Back into the conversation with the subject named, rather
                than a second editing surface beside the one that works. */}
            {onDiscuss && topic.state !== 'strong' && (
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
      <p className="mt-1 text-[11.5px] leading-snug text-ink-subtle">{decision.whyItMatters}</p>
      <div className="mt-2 flex items-center gap-3">
        <span className="font-mono text-[10.5px] text-ink-subtle">{decision.id}</span>
        <button
          type="button"
          onClick={() => defer.mutate({ decisionId: decision.id, deferred: !decision.deferred })}
          className="text-[11.5px] text-accent-ink underline-offset-2 hover:underline"
        >
          {decision.deferred ? 'Bring back' : 'Decide later'}
        </button>
      </div>
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
const WHY: Record<string, string> = {
  clarify: 'that answer could mean more than one thing',
  deepen: 'the answer is right but too thin to build from',
  separate_need_from_solution: 'a mechanism was described before the need behind it',
  identify_people: 'who this affects is still undefined',
  test_assumption: 'something is being treated as settled that has not been established',
  surface_exceptions: 'the happy path is clear and the exceptions are not',
  explore_constraints: 'the limits that bound this are not recorded',
  reconcile_contradiction: 'this conflicts with something already recorded',
  derive_acceptance: 'nothing yet says how you would know this was met',
  reflect_for_confirmation: 'enough has accumulated to be worth confirming',
  challenge_premature_design: 'the conversation moved to design before the problem was settled',
  handle_non_answer: 'the last reply did not answer the question',
  follow_thread: 'you raised something more important than the current subject',
  acknowledge_sufficiency: 'this subject is established well enough',
}

function areaLabel(subject: string): string {
  const key = subject.replace(/^area:/, '')
  return key ? key.replace(/_/g, ' ') : ''
}

function WhyThisQuestion({ points }: { points: string[] }) {
  // The turn carries `Interviewing skill: x` and optionally `Subject: y`.
  const skill = points.find((p) => p.startsWith('Interviewing skill:'))?.split(': ')[1] ?? ''
  const subject = points.find((p) => p.startsWith('Subject:'))?.split(': ')[1] ?? ''
  const reason = WHY[skill]
  if (!reason) return null

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

function ContextPanelContent({ onDiscuss }: { onDiscuss?: (area: string) => void }) {
  const { data: projection } = useProjection()
  if (!projection) return null

  const blocking = projection.openDecisions.filter((d) => !d.deferred)

  return (
    <div className="space-y-4 pb-6">
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

      <Panel>
        <PanelHeader>
          <PanelTitle>What can be generated now</PanelTitle>
        </PanelHeader>
        <PanelBody className="space-y-2.5">
          <p className="text-[12.5px] leading-relaxed text-ink-muted">
            The project context package and the Report Management module package can be generated.
            The Approval Workflow package can be generated, but it will carry{' '}
            {projection.openDecisions.filter((d) => d.blocks.includes('MOD-APR')).length} unresolved
            decisions.
          </p>
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

function Composer({
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
            <Button variant="ghost" size="icon" type="button" title="Attach a document">
              <Paperclip className="size-4" aria-hidden="true" />
              <span className="sr-only">Attach a document</span>
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

export function Workspace() {
  const { data: messages, isLoading } = useMessages()
  const { data: session } = useInterviewSession()
  const sendMessage = useSendMessage()
  const [draft, setDraft] = useState('')

  // The last turn, only when it produced no question. A question is written to
  // Memory and arrives through the transcript like any other message; a note is
  // not written at all, so this is the only place it can be seen.
  const lastTurn = sendMessage.data?.turn.assistantMessage
  const advisory = lastTurn && !lastTurn.question ? lastTurn.body : null

  // How the last turn was produced. The reply itself arrives through the
  // transcript, which is read back from Memory and carries no interviewing
  // metadata — so this is the only place it can be shown, and it is shown for
  // the latest turn only rather than pretending the whole history has it.
  const provenance = lastTurn?.understanding?.points ?? []
  const [contextOpen, setContextOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages?.length, sendMessage.isPending])

  const discuss = (area: string) => {
    setDraft(`Let's talk about ${area.toLowerCase()}.`)
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
                />
              ),
            )}
            {sendMessage.isPending && (
              <div className="flex items-center gap-2.5 text-[13px] text-ink-muted" role="status">
                <Loader2 className="size-3.5 animate-spin text-accent" aria-hidden="true" />
                Updating project understanding…
              </div>
            )}

            {/* A turn that produced no question is not stored, on purpose: a
                filler message per turn would put words in the evidence log that
                nobody said and no gap produced. But unstored meant unseen — the
                transcript renders only what Memory holds — so a message would
                send, the backend would answer 200, and the screen showed
                nothing at all. This says what happened without pretending to be
                part of the record. */}
            {!sendMessage.isPending && provenance.length > 0 && (
              <WhyThisQuestion points={provenance} />
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
              <p className="border-l-2 border-blocking-line pl-3 text-[12.5px] leading-relaxed text-ink-muted">
                That message did not go through: {(sendMessage.error as Error).message}. Nothing was
                recorded, so sending it again is safe.
              </p>
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
        <ContextPanelContent onDiscuss={discuss} />
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
            <ContextPanelContent onDiscuss={discuss} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
