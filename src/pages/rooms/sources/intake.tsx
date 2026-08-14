/**
 * Ingestion — the second way into a project, and the one that never had a page.
 *
 * The owner's sentence: **"Not all information intake are coming from an
 * interview. There are other input sources and controls that should take part
 * to build KAE."**
 *
 * `POST /v1/projects/{id}/documents` has been live in KAE-Memory the whole time.
 * It chunks text, stores it verbatim as evidence, and queues one extraction run
 * per chunk. Studio had no surface for it, so a person holding material already
 * written down was asked to retype it into a conversation — which is GitHub
 * issue #3 stated as a missing page rather than a bad answer.
 *
 * ## What is real here, and what is not
 *
 * **Paste is completely real** and rides a path that has been in production for
 * weeks. **Repository files are real** and reached from `/sources`. **Upload
 * is real for digital text** — PDF, Word, Excel, CSV, and plain text are
 * decoded on Studio's backend, previewed, then ingested through the same
 * path paste uses. Scanned PDFs, legacy `.doc`, images and zip are refused
 * rather than accepted and emptied. This is not analysis: extraction still
 * proposes, and a person still confirms.
 *
 * ## Why the runs are on this page
 *
 * Because otherwise a person presses *Read this* and watches nothing. Memory
 * records every run's status, attempt, error code and result, and no surface
 * read any of it (`VC-02`) — so a failed extraction looked identical to one
 * that never started. The failures are rendered in words (`VC-10`), because
 * `unverifiable_output` tells somebody that something is wrong and nothing
 * about whether it is theirs to fix.
 */

import { useState } from 'react'
import { AlertTriangle, FileText, FolderGit2, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'

import { plural } from '@/lib/plural'
import { PageLayout } from '@/components/project/PageLayout'
import { readFailure, readRole } from './runVocabulary'
import { Field, Input, Textarea } from '@/components/ui/form'
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
import { QueryState } from '@/components/ui/QueryState'
import { Tab, TabList, TabPanel, Tabs } from '@/components/ui/Tabs'
import {
  useDecodeUpload,
  useExtractionCoverage,
  useIngestText,
  useRuns,
  useSources,
  useSourcesOfKind,
  useSourcesUnavailable,
} from '@/hooks/useProject'
import type { AgentRunRecord, DocumentIngestOutcome } from '@/domain/types'

export function Intake() {
  return (
    <PageLayout
      title="Give KAE something to read"
      lead="Material you already have — notes, a brief, a specification, files from a connected repository — becomes proposed knowledge with provenance back to its source. Nothing here is confirmed on your behalf."
    >
      <div className="space-y-5">
        <Tabs defaultValue="paste">
          <TabList>
            <Tab value="paste">
              <FileText className="mr-1.5 inline size-3.5" aria-hidden="true" />
              Paste text
            </Tab>
            <Tab value="sources">
              <FolderGit2 className="mr-1.5 inline size-3.5" aria-hidden="true" />
              From a repository
            </Tab>
            <Tab value="upload">
              <Upload className="mr-1.5 inline size-3.5" aria-hidden="true" />
              Upload a file
            </Tab>
          </TabList>

          <TabPanel value="paste">
            <PasteDocument />
          </TabPanel>
          <TabPanel value="sources">
            <FromRepository />
          </TabPanel>
          <TabPanel value="upload">
            <UploadDocument />
          </TabPanel>
        </Tabs>

        <Coverage />
        <Activity />
      </div>
    </PageLayout>
  )
}

export function PasteDocument() {
  const ingest = useIngestText()
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const error = ingest.error instanceof Error ? ingest.error.message : null

  return (
    <Panel>
      <PanelBody className="space-y-4">
        <div className="max-w-2xl space-y-4">
          <Field
            label="What is this?"
            hint="Shown beside every statement KAE takes from it, so you can tell four pasted documents apart later."
            required
          >
            {(props) => (
              <Input
                {...props}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Product brief, March"
              />
            )}
          </Field>

          <Field
            label="The text"
            hint="Stored exactly as written. KAE never rewrites your words — extraction proposes statements, and each one keeps a quote back to this text."
            error={error}
            required
          >
            {(props) => (
              <Textarea
                {...props}
                rows={12}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Paste a brief, a set of notes, a specification…"
              />
            )}
          </Field>

          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              onClick={() => ingest.mutate({ title, text })}
              disabled={!title.trim() || !text.trim() || ingest.isPending}
            >
              {ingest.isPending ? 'Reading…' : 'Read this'}
            </Button>
            <span className="text-[11.5px] text-ink-subtle">
              {text.trim().length.toLocaleString()} characters
            </span>
          </div>
        </div>

        {ingest.data && <IngestResult outcome={ingest.data} />}

        <DocumentsGiven />
      </PanelBody>
    </Panel>
  )
}

/**
 * What this project has already been given in text (`D-24`).
 *
 * The paste path worked the whole time and recorded nothing that said intake
 * had happened, so a person who handed KAE their brief last week found no
 * trace of it on the page that takes documents — and the honest response to
 * that is to paste it again.
 */
function DocumentsGiven() {
  const documents = useSourcesOfKind(['paste', 'upload'])
  // The same illusion the Repositories tab had, one tab over, and found by
  // re-scanning this change rather than by anybody hitting it: if the record
  // cannot be read, this section is simply absent — and absent here reads as
  // *"nothing has been given"*, to somebody deciding whether to paste their
  // brief a second time.
  const unreadable = useSourcesUnavailable()

  if (unreadable.data) {
    // The next action `§16` asks for, and an honest one: the caller cannot fix
    // KAE-Memory, but they can act without risk. Idempotency is by document
    // title, chunk index and content, so the sentence holds only for the same
    // title — which is why it says so rather than promising more.
    return (
      <div className="border-t border-line pt-4">
        <p role="alert" className="text-[11.5px] leading-relaxed text-ink-muted">
          {unreadable.data} Anything given earlier is not listed here — this is not a statement that
          nothing was. If you are unsure whether something was received, giving it again under the
          same title is safe: identical text under an identical title is recorded once.
        </p>
      </div>
    )
  }

  if (!documents.data?.length) return null

  return (
    <div className="border-t border-line pt-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
        Already given
      </p>
      <ul className="mt-2 space-y-1.5">
        {documents.data.map((document) => (
          <li key={document.sourceId} className="flex flex-wrap items-center gap-2 text-[12.5px]">
            <FileText className="size-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
            <span className="text-ink">{document.location}</span>
          </li>
        ))}
      </ul>
      {/* Given, which is not the same as read. What each run made of it is
          below, and conflating the two here would let a document that failed
          extraction read as knowledge the project holds. */}
      <p className="mt-2 text-[11.5px] leading-relaxed text-ink-subtle">
        Handed to KAE. What each one produced is in the runs below.
      </p>
    </div>
  )
}

/**
 * What handing over the document actually did.
 *
 * **Queued is not read**, and saying otherwise here would be the same
 * substitution as a percentage that has not been recalculated. The runs below
 * are where the reading becomes visible.
 */
function IngestResult({ outcome }: { outcome: DocumentIngestOutcome }) {
  const lost = outcome.truncatedChunks > 0
  return (
    <div
      className={`rounded-panel border px-3.5 py-3 ${
        lost ? 'border-attention-line bg-attention-soft' : 'border-line bg-surface-sunken'
      }`}
      role={lost ? 'alert' : undefined}
    >
      <p className="text-[12.5px] font-medium text-ink">
        {outcome.document} — {plural(outcome.chunks, 'section')} stored and queued
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
        The text is saved. Reading it happens in the background — watch the activity below, and new
        statements appear on{' '}
        <Link to="/reviews" className="text-accent-ink underline-offset-2 hover:underline">
          Reviews
        </Link>{' '}
        for you to accept or refuse.
      </p>
      {lost && (
        // `AUD-024`. A document cut at a chunk limit used to report success
        // with most of itself unread.
        <p className="mt-2 text-[12px] font-medium text-ink">
          {plural(outcome.truncatedChunks, 'section was', 'sections were')} not stored, so part of
          this document has not been read.
        </p>
      )}
      {outcome.warnings.map((warning) => (
        // Memory's own words. It says what it could not do more precisely than
        // a paraphrase here would.
        <p key={warning} className="mt-1 text-[12px] leading-relaxed text-ink-muted">
          {warning}
        </p>
      ))}
    </div>
  )
}

function FromRepository() {
  const sources = useSources()

  return (
    <Panel>
      <PanelBody>
        <QueryState
          query={sources}
          of="Your connected repositories"
          skeleton={<Skeleton className="h-24" />}
          empty={
            <div className="space-y-3">
              <p className="text-meta text-ink-muted">
                Nothing to read from yet. Add a source above — a folder on this machine needs no
                account, and a GitHub repository needs one{' '}
                <Link className="underline" to="/settings/project">
                  connected in Settings
                </Link>
                .
              </p>
            </div>
          }
        >
          {(rows) => (
            <div className="space-y-3">
              <p className="text-[12.5px] leading-relaxed text-ink-muted">
                Choose which files KAE reads. It reads at a pinned commit, so every statement stays
                traceable to an exact revision.
              </p>
              <ul className="space-y-2">
                {rows.map((source) => (
                  <li
                    key={source.sourceId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-surface-sunken px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-medium text-ink">{source.location}</p>
                      <p className="mt-0.5 text-[11.5px] text-ink-subtle">
                        <Mono>{source.reference}</Mono>
                      </p>
                    </div>
                    <Button size="sm" asChild>
                      <Link to="/sources">Choose files</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </QueryState>
      </PanelBody>
    </Panel>
  )
}

/**
 * Decode on the trusted backend, preview, then ingest through the paste path.
 *
 * Types we cannot read are refused here, not accepted and emptied. A scanned
 * PDF that yields almost no text is a warning the person sees before they
 * confirm. Bytes never go to Memory; text does, as origin `upload`.
 */
export function UploadDocument() {
  const decode = useDecodeUpload()
  const ingest = useIngestText()
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])
  const decodeError = decode.error instanceof Error ? decode.error.message : null
  const ingestError = ingest.error instanceof Error ? ingest.error.message : null

  async function onFile(file: File | undefined) {
    ingest.reset()
    decode.reset()
    setTitle('')
    setText('')
    setWarnings([])
    if (!file) return
    try {
      const decoded = await decode.mutateAsync(file)
      setTitle(decoded.suggestedTitle)
      setText(decoded.text)
      setWarnings(decoded.warnings)
    } catch {
      /* surfaced via decode.error */
    }
  }

  return (
    <Panel>
      <PanelBody className="space-y-4">
        <div className="max-w-2xl space-y-4">
          <Field
            label="The file"
            hint="PDF, Word (.docx), Excel (.xlsx), CSV, or text. Scanned PDFs and legacy .doc are not read."
            required
          >
            {(props) => (
              <input
                id={props.id}
                aria-describedby={props['aria-describedby']}
                type="file"
                accept=".pdf,.docx,.xlsx,.csv,.txt,.md,.markdown,application/pdf,text/plain,text/csv,text/markdown"
                className="block w-full text-[13px] text-ink file:mr-3 file:rounded-md file:border file:border-line file:bg-surface file:px-2.5 file:py-1 file:text-[12.5px] file:text-ink"
                onChange={(event) => void onFile(event.target.files?.[0])}
              />
            )}
          </Field>

          {decode.isPending && (
            <p className="text-[12.5px] text-ink-muted">Reading the file on this Studio…</p>
          )}

          {decodeError && (
            <p role="alert" className="text-[12.5px] leading-relaxed text-blocking">
              {decodeError}
            </p>
          )}

          {warnings.map((warning) => (
            <p
              key={warning}
              role="status"
              className="rounded-panel border border-attention-line bg-attention-soft px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink"
            >
              {warning}
            </p>
          ))}

          {text ? (
            <>
              <Field
                label="What is this?"
                hint="Shown beside every statement KAE takes from it."
                required
              >
                {(props) => (
                  <Input
                    {...props}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Q3 brief"
                  />
                )}
              </Field>
              <Field
                label="What KAE will read"
                hint="Change this if the extraction missed something, or to drop pages that do not belong."
                required
              >
                {(props) => (
                  <Textarea
                    {...props}
                    rows={12}
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                  />
                )}
              </Field>
              <div className="flex items-center gap-3">
                <Button
                  variant="primary"
                  onClick={() => ingest.mutate({ title, text, origin: 'upload' })}
                  disabled={!title.trim() || !text.trim() || ingest.isPending}
                >
                  {ingest.isPending ? 'Reading…' : 'Read this'}
                </Button>
                <span className="text-[11.5px] text-ink-subtle">
                  {text.trim().length.toLocaleString()} characters
                </span>
              </div>
            </>
          ) : null}

          {ingestError && (
            <p role="alert" className="text-[12.5px] leading-relaxed text-blocking">
              {ingestError}
            </p>
          )}
        </div>

        {ingest.data && <IngestResult outcome={ingest.data} />}

        <DocumentsGiven />
      </PanelBody>
    </Panel>
  )
}

export function Coverage() {
  const coverage = useExtractionCoverage()

  return (
    <QueryState
      query={coverage}
      of="How much has been read"
      skeleton={<Skeleton className="h-20" />}
    >
      {(read) => (
        <Panel>
          <PanelHeader>
            <PanelTitle>How much has been read</PanelTitle>
            {read.complete ? (
              <Badge tone="confirmed">Nothing lost</Badge>
            ) : (
              <Badge tone="attention">Some content unread</Badge>
            )}
          </PanelHeader>
          <PanelBody>
            <p className="text-[12.5px] text-ink-muted">
              {plural(read.succeeded, 'section')} read
              {read.abandoned > 0 && `, ${read.abandoned} abandoned after repeated failures`}.
            </p>
            {!read.complete && (
              // Beside readiness, never inside it. A project that lost content
              // is not less *ready* — it is less **read**, and one number
              // cannot say both.
              <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
                Readiness is calculated over what was read. It is not lower because your project is
                thin — it is lower because part of what you gave KAE never became statements.
              </p>
            )}
          </PanelBody>
        </Panel>
      )}
    </QueryState>
  )
}

/** What KAE has actually done, and how each attempt ended. */
export function Activity() {
  const runs = useRuns()

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Activity</PanelTitle>
        <span className="text-[11.5px] text-ink-subtle">Newest first</span>
      </PanelHeader>
      <PanelBody>
        <QueryState
          query={runs}
          of="This project’s activity"
          skeleton={<Skeleton className="h-32" />}
          empty={
            <p className="text-[12.5px] italic text-ink-subtle">
              Nothing has run yet. KAE has not read anything for this project.
            </p>
          }
        >
          {(rows) => (
            <ul className="space-y-2">
              {rows.slice(0, 25).map((run) => (
                <RunRow key={run.id} run={run} />
              ))}
            </ul>
          )}
        </QueryState>
      </PanelBody>
    </Panel>
  )
}

const STATUS_TONE: Record<string, 'confirmed' | 'attention' | 'blocking' | 'pending' | 'neutral'> =
  {
    succeeded: 'confirmed',
    failed: 'blocking',
    abandoned: 'blocking',
    running: 'pending',
    pending: 'neutral',
  }

function RunRow({ run }: { run: AgentRunRecord }) {
  const failure = readFailure(run.errorCode)
  const written = run.outputSummary.items_written

  return (
    <li className="rounded-md border border-line bg-surface-sunken px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[run.status] ?? 'neutral'}>{run.status}</Badge>
        <p className="text-[12.5px] font-medium text-ink">{readRole(run.role)}</p>
        {run.attemptNumber > 1 && (
          <span className="text-[11.5px] text-ink-subtle">attempt {run.attemptNumber}</span>
        )}
        {typeof written === 'number' && written > 0 && (
          <span className="text-[11.5px] text-ink-subtle">· {plural(written, 'statement')}</span>
        )}
      </div>

      {failure && (
        <div className="mt-2 flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-attention" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[12px] leading-relaxed text-ink">{failure.meaning}</p>
            {failure.next && (
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-muted">{failure.next}</p>
            )}
          </div>
        </div>
      )}

      {/* An unknown code renders as itself rather than as an invented sentence.
          A newer Memory's new failure must read as less useful and still true. */}
      {!failure && run.errorCode && (
        <p className="mt-2 text-[12px] text-ink-muted">
          Failed with <Mono>{run.errorCode}</Mono>. This deployment has no plain-words reading for
          that yet.
        </p>
      )}

      {run.errorMessage && (
        // Verbatim, always, beside the reading. A summarised error is one a
        // person cannot search for.
        <p className="mt-1 break-words font-mono text-[11px] leading-relaxed text-ink-subtle">
          {run.errorMessage}
        </p>
      )}
    </li>
  )
}
