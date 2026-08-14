/**
 * Sources — the acquisition surface, out of the drawer it was hidden in.
 *
 * ## Why repository ingestion read as absent when most of it worked
 *
 * `ProjectSources` was 530 lines rendered in exactly one place: partway down
 * `/deliverables`, a page about generated output. Above it sat a permanent,
 * non-dismissible banner — *"Repository analysis is not built yet"* — stated
 * over four controls that **do** work: connect, verify, pin to a commit, and
 * read chosen files into the project.
 *
 * That banner is true and it was in the wrong place. Scoping it to the analyze
 * action is most of what makes this page feel like a feature rather than an
 * apology.
 *
 * ## What was built and unreachable
 *
 * `GitHubSourceClient.tree()` returns a full recursive listing with a
 * truncation flag, and was used **only to count files** — a person saw *"412
 * files"* and not one of their names. `POST /api/sources/{id}/sample` returns a
 * file excerpt and was **on no port**, so nothing in the frontend could call
 * it. Both are rendered here for the first time.
 *
 * ## Four states, not three
 *
 * Loading · empty · **inaccessible** · error. The fourth is the one usually
 * missed: a source that exists and cannot be reached right now is neither an
 * empty list nor a failed page load, and rendering it as either loses what a
 * person can do about it. Here it is `lastError` on the source, shown on the
 * source rather than over the page.
 *
 * ## One Source abstraction, not two pages
 *
 * `§7`: *"Treat repository, uploaded document, pasted note, URL, interview
 * transcript, existing context package, and imported specification as **Project
 * Sources** rather than unrelated fields."*
 *
 * Studio split them — repositories here, text and files on `/ingestion` — so
 * *"give KAE something to read"* meant two different navigation items depending
 * on where the material happened to live. That is the product's own idea
 * rendered as two ideas, and a person with a brief in one hand and a repository
 * in the other had to know which page KAE files each under.
 *
 * The tabs are the merge. `/ingestion` redirects rather than disappearing,
 * because the composer's Paperclip points at it and the directive forbids
 * removing a route before its replacement is verified.
 *
 * ## The two vocabularies, kept apart
 *
 * `SourceState` is `configured · readable · pinned · analyzed`, and `analyzed`
 * **is not reachable** — it is declared so `pinned` cannot quietly stand in for
 * it. `refused` and `unreachable` belong to `ConnectionState` and describe a
 * *credential*, not a source. Rendering them here would be a state map with two
 * branches nothing can ever produce.
 */

import { useState } from 'react'
import { ChevronRight, FileCode, Lock, Search } from 'lucide-react'
import { Link } from 'react-router-dom'

import { PageLayout } from '@/components/project/PageLayout'
import { Field, Input } from '@/components/ui/form'
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
import { Activity as RunActivity, Coverage, PasteDocument } from './intake'
import { AddSource, type Branch } from './AddSource'
import { plural } from '@/lib/plural'
import { CloneRepository } from './CloneRepository'
import { PickRepository } from './PickRepository'
import {
  useIngestFiles,
  useSampleFile,
  useSourceFiles,
  useAvailableRepositories,
  useHasConnection,
  useProjection,
  useSourcesOfKind,
  useSourcesUnavailable,
} from '@/hooks/useProject'
import { CapabilityNote } from '@/components/project/CapabilityNote'
import type { ProjectSource, SourceState } from '@/domain/types'

export function SourcesRoom() {
  // Whether this room has anything to show a detail panel for. The run log is
  // evidence about sources; with none, it is not the page (`D-89`).
  const sources = useSourcesOfKind()
  const hasSources = (sources.data?.length ?? 0) > 0

  return (
    <PageLayout
      title="Sources"
      lead="Everything this project reads from — repositories, text you paste, files you have. KAE reads at a pinned revision, so every statement it proposes stays traceable to an exact version of an exact thing."
      wide
      actions={
        <Button asChild variant="secondary">
          <Link to="/settings/project">Manage connections</Link>
        </Button>
      }
    >
      {/* One list, not four tabs (`D-80`). Splitting sources by kind asked a
          person to know which tab a thing was in before they could see whether
          they had added it — and the owner's model is an accumulating list. */}
      <div className="space-y-5">
        <Repositories />
        {/* **Secondary when there is nothing to select** (`D-89`). On a
            first-run project the run log was the page: a wall of *succeeded ·
            Reading a document* beneath one small Add-a-source block. Selection
            is the job here; the log is evidence about it. */}
        {hasSources ? (
          <div className="space-y-5">
            <Coverage />
            <RunActivity />
          </div>
        ) : (
          <details className="group rounded-lg border border-line bg-surface">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-body font-medium text-ink hover:bg-surface-sunken">
              <span className="flex items-center gap-2">
                <ChevronRight
                  className="size-3.5 text-ink-subtle transition-transform group-open:rotate-90"
                  aria-hidden="true"
                />
                What KAE has read so far
              </span>
              <span className="text-meta font-normal text-ink-muted">Coverage and run history</span>
            </summary>
            <div className="space-y-5 border-t border-line px-4 py-4">
              <Coverage />
              <RunActivity />
            </div>
          </details>
        )}
      </div>
    </PageLayout>
  )
}

/** The repositories tab — what this page was before the merge. */
/**
 * What the Repositories tab is about.
 *
 * A list, rather than "not paste", so a kind added later has to be placed
 * deliberately instead of arriving here by default — which is how a pasted
 * document would have been labelled a repository by its surroundings.
 */

function Repositories() {
  // Repositories, not every source. A pasted brief listed here would be
  // labelled a repository by its surroundings — a claim the list makes without
  // saying a word — and `§7`'s point is that one abstraction covers several
  // kinds, not that they all read the same (`D-24`).
  // **Every kind**, not only repositories (`D-80`). The list a person keeps is
  // the list of what this project reads from; splitting it by kind was the tab
  // model, and it asked them to know where a thing was filed before they could
  // see whether they had added it.
  const sources = useSourcesOfKind()
  // Whether the list above is complete. Sources became durable (`D-21`), so
  // reading them can fail, and the empty state below would otherwise announce
  // "no repository connected yet" about a request that did not finish — to a
  // person who connected one an hour ago.
  const unreadable = useSourcesUnavailable()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [branch, setBranch] = useState<Branch | null>(null)
  // **Repositories, not roots.** `local_sources` on `/api/status` counts
  // configured directories — one — and the menu said "1 available" over 29
  // readable repositories. The listing knows the real number, and it is the
  // number a person is choosing from.
  const available = useAvailableRepositories()
  const reachable = available.data?.repositories ?? []
  const localRoots = reachable.filter((r) => r.kind === 'local').length
  const githubCount = reachable.filter((r) => r.kind === 'github').length
  const connected = useHasConnection()
  // Whether this project knows anything at all, which is a different question
  // from whether it has sources. A project built entirely from conversation has
  // knowledge and no sources, and saying "nothing to read from yet" to it is
  // false in the way that matters (`D-89`).
  const projection = useProjection()
  // `requirements` is the projection's list of statements — proposed and
  // confirmed alike — which is what *has KAE learned anything* means here.
  const derived = projection.data?.requirements.length ?? 0

  return (
    <>
      {unreadable.data ? (
        // No action offered. The record could not be read because KAE-Memory
        // did not answer, and there is nothing a person can do about that from
        // here — inventing "try again" for somebody else's outage is the same
        // manufacture as inventing a reason (`§16`, `D-41`).
        <CapabilityNote reason={unreadable.data} />
      ) : null}
      <QueryState
        query={sources}
        of="Your sources"
        skeleton={<Skeleton className="h-48" />}
        empty={
          // **Carries the control that fixes it** (`D-85`), and distinguishes
          // two states this collapsed into one (`D-89`).
          //
          // *Nothing to read from yet* was shown to a project with 174 proposed
          // statements and 29 messages read. Its knowledge came from the
          // **interview**, which is not a Source and should not be listed as
          // one — `§7`'s kinds are repository, folder, paste, upload, and a
          // conversation turn is deliberately none of them. So the count was
          // right and the sentence was wrong.
          unreadable.data ? null : (
            <div className="max-w-lg space-y-4">
              <div>
                <h2 className="text-lead font-semibold text-ink">
                  {derived > 0 ? 'Built from conversation so far' : 'Nothing to read from yet'}
                </h2>
                <p className="mt-1 text-body text-ink-muted">
                  {derived > 0
                    ? `KAE has ${plural(derived, 'statement')} from this project's conversation. Add a source to read code or documents as well.`
                    : 'KAE reads repositories, folders and documents you give it. A folder on this machine needs no account.'}
                </p>
                {/* Keyed off what is actually true of this deployment, rather
                    than always telling somebody to connect (`D-89`). */}
                {!connected && (
                  <p className="mt-2 text-meta text-ink-subtle">
                    To read a repository on GitHub,{' '}
                    <Link className="underline" to="/settings/project">
                      connect an account in Settings
                    </Link>{' '}
                    first.
                  </p>
                )}
              </div>
              <AddSource
                localRoots={localRoots}
                connected={connected}
                githubCount={githubCount}
                chosen={branch}
                onChoose={setBranch}
              />
              {branch === 'paste' ? (
                <PasteDocument />
              ) : branch === 'clone' ? (
                <CloneRepository onDone={() => setBranch(null)} />
              ) : branch === 'folder' || branch === 'github' ? (
                <PickRepository
                  kind={branch === 'folder' ? 'local' : 'github'}
                  onDone={() => setBranch(null)}
                />
              ) : null}
            </div>
          )
        }
      >
        {(rows) => {
          const chosen = rows.find((s) => s.sourceId === selectedId) ?? rows[0]
          return (
            <div className="grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
              <div className="space-y-3">
                <SourceList sources={rows} selectedId={chosen?.sourceId} onSelect={setSelectedId} />
                <AddSource
                  localRoots={localRoots}
                  connected={connected}
                  githubCount={githubCount}
                  chosen={branch}
                  onChoose={setBranch}
                />
              </div>
              {branch === 'paste' ? (
                <PasteDocument />
              ) : branch === 'clone' ? (
                <CloneRepository onDone={() => setBranch(null)} />
              ) : branch === 'folder' || branch === 'github' ? (
                <PickRepository
                  kind={branch === 'folder' ? 'local' : 'github'}
                  onDone={() => setBranch(null)}
                />
              ) : chosen ? (
                <SourceDetail source={chosen} />
              ) : null}
            </div>
          )
        }}
      </QueryState>
    </>
  )
}

/**
 * What each state means, in a sentence.
 *
 * Never a tick. *"Connected ✓"* beside a repository is read as *KAE has
 * understood my project*, and the next screen then disappoints — which is the
 * constraint the original component was built around and is kept here.
 */

/**
 * What a person calls each kind, and what they recognise a source by.
 *
 * `location` is `owner/name` for GitHub and an absolute path for a folder, so
 * showing it raw made the picker read as developer output (`D-78`). The name
 * leads; the path is still there, one line down.
 */
const KIND: Record<string, string> = {
  github: 'GitHub',
  local: 'Folder',
  paste: 'Pasted',
  upload: 'File',
  s3: 'S3',
}

function label(source: ProjectSource): string {
  if (source.kind !== 'local') return source.location
  const name = source.location.split('/').filter(Boolean).pop()
  return name || source.location
}

const STATE: Record<
  SourceState,
  {
    label: string
    tone: 'neutral' | 'accent' | 'confirmed' | 'attention'
    means: string
  }
> = {
  configured: { label: 'Configured', tone: 'neutral', means: 'Saved. Nothing has been contacted.' },
  readable: {
    label: 'Readable',
    tone: 'accent',
    means: 'The credential reached it. No content has been read.',
  },
  pinned: { label: 'Pinned', tone: 'confirmed', means: 'Fixed to one commit. Reads happen there.' },
  // Unreachable by design, and rendered anyway. `analyzed` exists so that
  // `pinned` cannot silently become the finish line, and a map that omitted it
  // would fall through to a bare state name the first time anything set it.
  analyzed: {
    label: 'Analyzed',
    tone: 'confirmed',
    means: 'Read into findings. Nothing can set this yet.',
  },
}

function SourceList({
  sources,
  selectedId,
  onSelect,
}: {
  sources: ProjectSource[]
  selectedId: string | undefined
  onSelect: (id: string) => void
}) {
  return (
    <Panel className="h-fit">
      <PanelHeader>
        <PanelTitle>What this project reads from</PanelTitle>
        <Badge tone="neutral">{sources.length}</Badge>
      </PanelHeader>
      <PanelBody className="space-y-1.5">
        {sources.map((source) => {
          const state = STATE[source.state]
          // The fourth state. A source that exists and could not be reached is
          // neither absent nor a failed page — and the reason is the only part
          // a person can act on.
          const inaccessible = Boolean(source.lastError)
          const active = source.sourceId === selectedId
          return (
            <button
              key={source.sourceId}
              type="button"
              onClick={() => onSelect(source.sourceId)}
              aria-current={active ? 'true' : undefined}
              className={`w-full rounded-md border px-3 py-2.5 text-left transition-colors ${
                active
                  ? 'border-accent-line bg-accent-soft'
                  : 'border-line bg-surface hover:bg-surface-sunken'
              }`}
            >
              <p className="flex items-center gap-1.5">
                <Badge tone="neutral">{KIND[source.kind] ?? source.kind}</Badge>
                <span className="truncate text-[12.5px] font-medium text-ink">{label(source)}</span>
              </p>
              <p className="mt-1 flex items-center gap-1.5">
                <Badge tone={inaccessible ? 'attention' : state.tone}>
                  {inaccessible ? 'Unreachable' : state.label}
                </Badge>
                <Mono>{source.reference}</Mono>
              </p>
              {/* The sentence, not just the word. A badge reading "Pinned" and
                  one reading "Unreachable" call for opposite responses and are
                  the same shape at a glance. */}
              <p className="mt-1 text-[11px] leading-snug text-ink-subtle">
                {inaccessible ? source.lastError : state.means}
              </p>
            </button>
          )
        })}
      </PanelBody>
    </Panel>
  )
}

function SourceDetail({ source }: { source: ProjectSource }) {
  const pinned = Boolean(source.snapshot)

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader>
          <PanelTitle>{source.location}</PanelTitle>
          <Mono>{source.snapshot?.revision.slice(0, 12) ?? source.reference}</Mono>
        </PanelHeader>
        <PanelBody className="space-y-3">
          {source.snapshot ? (
            <p className="text-[12.5px] text-ink-muted">
              {source.snapshot.fileCount.toLocaleString()} files in scope
              {source.snapshot.excludedCount > 0 &&
                `, ${source.snapshot.excludedCount.toLocaleString()} excluded by this source’s rules`}
              .
            </p>
          ) : (
            <p className="text-[12.5px] text-ink-muted">
              Not pinned to a commit yet, so there is nothing to list. Pinning fixes what KAE reads
              to one revision.
            </p>
          )}

          {source.lastError && (
            <p role="alert" className="text-[12px] text-blocking">
              {source.lastError}
            </p>
          )}

          {/* Scoped to the action, which is the whole change. The old banner
              condemned four working controls along with the one that does not
              exist. */}
          <CapabilityNote reason="KAE does not analyse a repository. It reads the files you choose and proposes statements from their text — it does not infer structure, detect a framework, or map a codebase. Connecting and reading are not analysis, and this page will not call them that." />
        </PanelBody>
      </Panel>

      {pinned && <FileBrowser source={source} />}
    </div>
  )
}

function FileBrowser({ source }: { source: ProjectSource }) {
  const files = useSourceFiles(source.sourceId, 200)
  const ingest = useIngestFiles()
  const [chosen, setChosen] = useState<string[]>([])
  const [filter, setFilter] = useState('')
  const [preview, setPreview] = useState<string | null>(null)

  const toggle = (path: string) =>
    setChosen((current) =>
      current.includes(path) ? current.filter((p) => p !== path) : [...current, path],
    )

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Files at this revision</PanelTitle>
        {chosen.length > 0 && <Badge tone="accent">{chosen.length} chosen</Badge>}
      </PanelHeader>
      <PanelBody className="space-y-3">
        <QueryState
          query={files}
          of="This repository’s files"
          skeleton={<Skeleton className="h-40" />}
        >
          {(listing) => {
            const visible = listing.files.filter((file) =>
              file.path.toLowerCase().includes(filter.toLowerCase()),
            )
            return (
              <>
                <Field label="Find a file" hint="Filters the list below. Matching is on the path.">
                  {(props) => (
                    <div className="relative">
                      <Search
                        className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-subtle"
                        aria-hidden="true"
                      />
                      <Input
                        {...props}
                        mono
                        value={filter}
                        onChange={(event) => setFilter(event.target.value)}
                        placeholder="docs/"
                        className="pl-8"
                      />
                    </div>
                  )}
                </Field>

                {listing.truncated && (
                  // Surfaced rather than swallowed. A partial set presented as
                  // a total is what the snapshot digest exists to prevent.
                  <p className="text-[11.5px] text-ink-muted">
                    This repository is larger than one listing. What you see here is part of it.
                  </p>
                )}

                {visible.length === 0 ? (
                  <p className="text-[12.5px] italic text-ink-subtle">
                    {filter ? `No file path contains “${filter}”.` : 'No files in scope.'}
                  </p>
                ) : (
                  <ul className="max-h-[24rem] space-y-1 overflow-y-auto kae-scrollbar">
                    {visible.map((file) => (
                      <li
                        key={file.path}
                        className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-surface-sunken"
                      >
                        <input
                          type="checkbox"
                          id={`file-${file.path}`}
                          checked={chosen.includes(file.path)}
                          onChange={() => toggle(file.path)}
                          className="size-3.5 shrink-0 rounded border-line accent-accent"
                        />
                        <label
                          htmlFor={`file-${file.path}`}
                          className="min-w-0 flex-1 cursor-pointer truncate font-mono text-[12px] text-ink"
                        >
                          {file.path}
                        </label>
                        <span className="shrink-0 text-[11px] text-ink-subtle">
                          {Math.round(file.size / 102.4) / 10} KB
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setPreview(file.path)}
                          aria-label={`Preview ${file.path}`}
                        >
                          <FileCode className="size-3.5" aria-hidden="true" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
                  <Button
                    variant="primary"
                    disabled={chosen.length === 0 || ingest.isPending}
                    onClick={() => ingest.mutate({ sourceId: source.sourceId, paths: chosen })}
                  >
                    {ingest.isPending
                      ? 'Reading…'
                      : `Read ${chosen.length || ''} ${chosen.length === 1 ? 'file' : 'files'}`.trim()}
                  </Button>
                  <span className="text-[11.5px] text-ink-subtle">
                    Chosen files become proposed statements with provenance to this revision.
                  </span>
                </div>

                {ingest.error instanceof Error && (
                  <p role="alert" className="text-[12px] text-blocking">
                    {ingest.error.message}
                  </p>
                )}

                {ingest.data && (
                  <p className="text-[12.5px] text-ink-muted">
                    {ingest.data.ingested.length} file
                    {ingest.data.ingested.length === 1 ? '' : 's'} read at{' '}
                    <Mono>{ingest.data.revision.slice(0, 12)}</Mono>. Watch progress on{' '}
                    <Link
                      to="/ingestion"
                      className="text-accent-ink underline-offset-2 hover:underline"
                    >
                      Ingestion
                    </Link>
                    .
                  </p>
                )}
              </>
            )
          }}
        </QueryState>

        {preview && (
          <FilePreview sourceId={source.sourceId} path={preview} onClose={() => setPreview(null)} />
        )}
      </PanelBody>
    </Panel>
  )
}

/**
 * The excerpt endpoint, reachable from the product for the first time.
 *
 * It proves something a connectivity check cannot: a token with metadata-only
 * scope passes the check and fails this.
 */
function FilePreview({
  sourceId,
  path,
  onClose,
}: {
  sourceId: string
  path: string
  onClose: () => void
}) {
  const excerpt = useSampleFile(sourceId, path)

  return (
    <div className="rounded-panel border border-line bg-surface-sunken">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <p className="truncate font-mono text-[12px] text-ink">{path}</p>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className="p-3">
        <QueryState
          query={excerpt}
          of={`The first part of ${path}`}
          skeleton={<Skeleton className="h-24" />}
        >
          {(file) => (
            <>
              <pre className="max-h-64 overflow-auto kae-scrollbar whitespace-pre-wrap break-words font-mono text-[11.5px] leading-relaxed text-ink-muted">
                {file.excerpt}
              </pre>
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-subtle">
                <Lock className="size-3" aria-hidden="true" />
                {file.proves} Showing the first {file.excerpt.length.toLocaleString()} of{' '}
                {file.bytes.toLocaleString()} characters.
              </p>
            </>
          )}
        </QueryState>
      </div>
    </div>
  )
}
