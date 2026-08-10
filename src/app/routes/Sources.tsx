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
 * Loading · empty · **inaccessible** · error. `ConnectionState` already
 * distinguishes `refused` from `unreachable`, and collapsing them loses the
 * only thing a person can act on: a refused credential is theirs to fix, and an
 * unreachable host is not.
 */

import { useState } from 'react'
import { FileCode, Lock, Search } from 'lucide-react'
import { Link } from 'react-router-dom'

import { CapabilityNote } from '@/components/project/CapabilityNote'
import { PageLayout } from '@/components/project/PageLayout'
import { Field, Input } from '@/components/ui/form'
import {
  Badge,
  Button,
  EmptyState,
  Mono,
  Panel,
  PanelBody,
  PanelHeader,
  PanelTitle,
  Skeleton,
} from '@/components/ui/primitives'
import { QueryState } from '@/components/ui/QueryState'
import { useIngestFiles, useSampleFile, useSourceFiles, useSources } from '@/hooks/useProject'
import type { ProjectSource } from '@/domain/types'

export function Sources() {
  const sources = useSources()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  return (
    <PageLayout
      title="Sources"
      lead="Repositories this project can read from. KAE reads at a pinned commit, so every statement it proposes stays traceable to an exact revision of an exact file."
      wide
      actions={
        <Button asChild variant="secondary">
          <Link to="/setup">Connect a repository</Link>
        </Button>
      }
    >
      <QueryState
        query={sources}
        of="Your sources"
        skeleton={<Skeleton className="h-48" />}
        empty={
          <EmptyState title="No repository connected yet">
            <p>
              KAE can read nothing outside this conversation until a repository is connected and
              pinned to a commit.
            </p>
            <Button asChild className="mt-3">
              <Link to="/setup">Connect one in Project setup</Link>
            </Button>
          </EmptyState>
        }
      >
        {(rows) => {
          const chosen = rows.find((s) => s.sourceId === selectedId) ?? rows[0]
          return (
            <div className="grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
              <SourceList sources={rows} selectedId={chosen?.sourceId} onSelect={setSelectedId} />
              {chosen ? <SourceDetail source={chosen} /> : null}
            </div>
          )
        }}
      </QueryState>
    </PageLayout>
  )
}

/**
 * What each state means, in a sentence.
 *
 * Never a tick. *"Connected ✓"* beside a repository is read as *KAE has
 * understood my project*, and the next screen then disappoints — which is the
 * constraint the original component was built around and is kept here.
 */
const STATE: Record<
  string,
  {
    label: string
    tone: 'neutral' | 'accent' | 'confirmed' | 'attention' | 'blocking'
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
  unreachable: {
    label: 'Unreachable',
    tone: 'attention',
    means: 'The host did not answer. Not something you can fix here.',
  },
  refused: {
    label: 'Refused',
    tone: 'blocking',
    means: 'The credential was rejected. This one is yours to fix.',
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
        <PanelTitle>Repositories</PanelTitle>
        <Badge tone="neutral">{sources.length}</Badge>
      </PanelHeader>
      <PanelBody className="space-y-1.5">
        {sources.map((source) => {
          const state = STATE[source.state] ?? {
            label: source.state,
            tone: 'neutral' as const,
            means: '',
          }
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
              <p className="truncate text-[12.5px] font-medium text-ink">{source.location}</p>
              <p className="mt-1 flex items-center gap-1.5">
                <Badge tone={state.tone}>{state.label}</Badge>
                <Mono>{source.reference}</Mono>
              </p>
              {/* The sentence, not just the word. "Refused" and "Unreachable"
                  call for opposite responses and look alike at a glance. */}
              {state.means && (
                <p className="mt-1 text-[11px] leading-snug text-ink-subtle">{state.means}</p>
              )}
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
