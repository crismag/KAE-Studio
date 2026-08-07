import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'
import {
  ArrowRight,
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

function CoverageSection({ projection }: { projection: ProjectProjection }) {
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

function ContextPanelContent() {
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
          <CoverageSection projection={projection} />
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
  const [contextOpen, setContextOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages?.length, sendMessage.isPending])

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
        <ContextPanelContent />
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
            <ContextPanelContent />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
