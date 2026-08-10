/**
 * Where a project's material comes from — and how far KAE has actually got with it.
 *
 * STI-1. The whole design problem on this screen is that four different facts
 * want to render as one green tick:
 *
 *   a credential works · a repository is readable · a revision is pinned ·
 *   **the repository has been analyzed**
 *
 * Only the first three are true today. A "Connected ✓" beside a repository name
 * is read by a user as *KAE has understood my project*, and they will expect the
 * next screen to know things about it. So the state label is never a tick: it
 * says what happened, and a standing notice says what has not.
 *
 * This is the constraint the whole component exists to satisfy — repository
 * selection must not be presented as repository analysis when it proves only
 * connectivity and configuration.
 */

import { useState } from 'react'
import { AlertCircle, GitBranch, Github, Loader2, Lock, Plug, ShieldCheck } from 'lucide-react'
import { plural } from '@/lib/plural'
import {
  Badge,
  Button,
  Mono,
  Panel,
  PanelBody,
  PanelHeader,
  PanelTitle,
} from '@/components/ui/primitives'
import {
  useAddConnection,
  useAddSource,
  useCheckConnectivity,
  useConnections,
  useIngestFiles,
  usePinSource,
  useSourceFiles,
  useSources,
} from '@/hooks/useProject'
import type { ProjectSource, SourceState } from '@/domain/types'

/**
 * What each state *means*, in a sentence.
 *
 * Not adjectives. "Connected" and "Ready" are the words that let a user believe
 * analysis has happened; each label here describes an action that took place and
 * stops there.
 */
const STATE: Record<
  SourceState,
  { label: string; tone: 'neutral' | 'accent' | 'confirmed' | 'attention'; means: string }
> = {
  configured: {
    label: 'Configured',
    tone: 'neutral',
    means: 'Saved. Nothing has been contacted.',
  },
  readable: {
    label: 'Readable',
    tone: 'accent',
    means: 'The provider returned file content. Nothing has been interpreted.',
  },
  pinned: {
    label: 'Pinned to a commit',
    tone: 'accent',
    means: 'We know exactly which files we would read. None of them have been read or interpreted.',
  },
  analyzed: {
    label: 'Analyzed',
    tone: 'confirmed',
    means: 'Findings have been proposed from this snapshot.',
  },
}

function bytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} kB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

/* --------------------------------------------------------------- one source */

function SourceRow({ source }: { source: ProjectSource }) {
  const pin = usePinSource()
  const meta = STATE[source.state]

  return (
    <li className="border-t border-line py-4 first:border-t-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Github className="size-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
            <Mono className="text-[13px]">{source.location}</Mono>
            <Badge tone={meta.tone}>{meta.label}</Badge>
          </div>
          {/* The state's meaning, next to the state. A badge alone is read as a
              score; this is what stops "Pinned" being heard as "done". */}
          <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">{meta.means}</p>
        </div>

        <Button
          size="sm"
          variant="secondary"
          disabled={pin.isPending}
          onClick={() => pin.mutate(source.sourceId)}
        >
          {pin.isPending ? (
            <>
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              Resolving
            </>
          ) : (
            <>
              <GitBranch className="size-3.5" aria-hidden="true" />
              {source.snapshot ? 'Re-pin' : 'Pin to a commit'}
            </>
          )}
        </Button>
      </div>

      {source.snapshot && (
        <dl className="mt-2.5 flex flex-wrap gap-x-6 gap-y-1 text-[12px]">
          <div className="flex gap-1.5">
            <dt className="text-ink-subtle">Commit</dt>
            <dd>
              <Mono>{source.snapshot.revision.slice(0, 12)}</Mono>
            </dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-ink-subtle">In scope</dt>
            <dd className="text-ink">
              {plural(source.snapshot.fileCount, 'file')} · {bytes(source.snapshot.totalBytes)}
            </dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-ink-subtle">Excluded</dt>
            {/* Shown rather than hidden. A user should be able to tell that
                secrets and build output were left out deliberately. */}
            <dd className="text-ink">{source.snapshot.excludedCount}</dd>
          </div>
        </dl>
      )}

      {source.lastError && (
        <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-relaxed text-attention">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {source.lastError}
        </p>
      )}

      {pin.isError && (
        <p className="mt-2 text-[12px] text-attention">
          {(pin.error as { message?: string })?.message ?? 'Could not resolve this source.'}
        </p>
      )}

      {source.snapshot && <IngestFiles source={source} />}
    </li>
  )
}

/**
 * Choose files from a pinned source and hand them to KAE-Memory.
 *
 * **This is where "connect it here" stops being a promise.** A user could pin a
 * repository, see that it held 412 files, and have no way to give KAE a single
 * one — so KAE asked them to paste the contents instead, which is GitHub issue
 * #3.
 *
 * ## Why the user picks
 *
 * There is no "ingest everything". Ingesting a repository unasked is the bulk
 * import the acquisition contract warns against, and choosing is how somebody
 * tells KAE which four files actually describe their project.
 *
 * ## Why it does not say "analyzed" afterwards
 *
 * Because it is not. The files become evidence, extraction proposes candidates
 * from their text, and a person confirms. Nothing derives structure, the
 * standing capability notice above stays true, and the wording here is the
 * backend's own: read and recorded, not understood.
 */
function IngestFiles({ source }: { source: ProjectSource }) {
  const files = useSourceFiles(source.sourceId)
  const ingest = useIngestFiles()
  const [chosen, setChosen] = useState<string[]>([])

  const toggle = (path: string) =>
    setChosen((current) =>
      current.includes(path) ? current.filter((p) => p !== path) : [...current, path],
    )

  if (files.isLoading) {
    return <p className="mt-3 text-[12px] text-ink-subtle">Reading the file list…</p>
  }
  if (files.isError || !files.data) {
    return (
      <p className="mt-3 text-[12px] text-ink-subtle">
        The file list could not be read. Nothing is being guessed in its place.
      </p>
    )
  }

  return (
    <div className="mt-3 rounded-md border border-line bg-surface-sunken px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
        Give KAE these files
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
        Chosen files are read at the pinned commit and recorded as evidence. KAE proposes what it
        finds; nothing is confirmed until you say so.
      </p>

      <ul className="mt-2 space-y-1">
        {files.data.files.map((file) => (
          <li key={file.path}>
            <label className="flex items-center gap-2 text-[12.5px] text-ink">
              <input
                type="checkbox"
                checked={chosen.includes(file.path)}
                onChange={() => toggle(file.path)}
              />
              <Mono className="text-[12px]">{file.path}</Mono>
              <span className="text-[11.5px] text-ink-subtle">{bytes(file.size)}</span>
            </label>
          </li>
        ))}
      </ul>

      {files.data.truncated && (
        // Said rather than swallowed: a partial list presented as a total is
        // what the snapshot digest exists to make impossible.
        <p className="mt-1.5 text-[11.5px] text-ink-subtle">
          This repository holds more files than are listed here.
        </p>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={chosen.length === 0 || ingest.isPending}
          onClick={() =>
            ingest.mutate(
              { sourceId: source.sourceId, paths: chosen },
              { onSuccess: () => setChosen([]) },
            )
          }
        >
          {ingest.isPending ? (
            <>
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              Reading
            </>
          ) : (
            `Read ${plural(chosen.length, 'file')} into the project`
          )}
        </Button>
        {ingest.isSuccess && (
          <span className="text-[12px] text-confirmed">
            Recorded as evidence. KAE is reading them now.
          </span>
        )}
      </div>

      {ingest.isError && (
        <p role="alert" className="mt-2 text-[12px] text-blocking">
          {(ingest.error as { message?: string })?.message ??
            'Those files were not read. Nothing was recorded.'}
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------- panel */

export function ProjectSources() {
  const connections = useConnections()
  const sources = useSources()
  const addConnection = useAddConnection()
  const check = useCheckConnectivity()
  const addSource = useAddSource()

  const [label, setLabel] = useState('')
  const [connectionRef, setConnectionRef] = useState('env:KAE_GITHUB_TOKEN')
  const [repository, setRepository] = useState('')
  const [reference, setReference] = useState('main')

  const all = connections.data ?? []
  // Checking access is what *produces* a verified connection, so the check
  // itself must not require one. Requiring it made the button permanently
  // disabled: you needed a verified connection to run the check that verifies
  // it. Adding a repository still requires verification, which is the real
  // gate.
  const verified = all.filter((c) => c.state === 'verified')
  const checkable = all[0]
  const gap = sources.data?.[0]?.analysis

  return (
    <Panel>
      <PanelHeader>
        <div>
          <PanelTitle className="text-[14px]">Sources</PanelTitle>
          <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-ink-muted">
            Where this project&rsquo;s existing material lives. Connecting a repository lets KAE
            read it; it does not read it.
          </p>
        </div>
      </PanelHeader>

      <PanelBody className="space-y-5">
        {/*
          The standing notice. Not an error, not dismissible, and above the
          controls rather than below them — a user should know what this screen
          cannot do before they spend time configuring it.
        */}
        <div className="flex items-start gap-2.5 rounded-panel border border-attention-line bg-attention-soft/40 px-4 py-3">
          <Lock className="mt-0.5 size-4 shrink-0 text-attention" aria-hidden="true" />
          <div className="text-[12.5px] leading-relaxed text-ink-muted">
            <p className="font-medium text-ink">Repository analysis is not built yet.</p>
            <p className="mt-1">
              {gap?.reason ??
                'A source can be connected, read and pinned to an exact commit. Nothing yet turns that snapshot into project knowledge.'}
            </p>
            {gap && (
              <p className="mt-1.5">
                What this screen does prove: <strong>{gap.provedInstead.join(', ')}</strong>.
              </p>
            )}
          </div>
        </div>

        {/* connections */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
            Connections
          </p>

          <ul className="mt-2">
            {(connections.data ?? []).map((connection) => (
              <li
                key={connection.connectionId}
                className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-2 first:border-t-0"
              >
                <span className="flex items-center gap-2">
                  <Plug className="size-3.5 text-ink-subtle" aria-hidden="true" />
                  <span className="text-[13px] text-ink">{connection.label}</span>
                  <Badge tone={connection.state === 'verified' ? 'accent' : 'neutral'}>
                    {connection.state}
                  </Badge>
                  {/* Read and write, separately. A single "verified" would
                      assert both on the evidence of whichever was checked. */}
                  {connection.state === 'verified' && (
                    <>
                      <Badge tone={connection.canRead ? 'confirmed' : 'neutral'}>
                        {connection.canRead ? 'can read' : 'no read'}
                      </Badge>
                      <Badge tone={connection.canWrite ? 'confirmed' : 'neutral'}>
                        {connection.canWrite ? 'can write' : 'no write'}
                      </Badge>
                    </>
                  )}
                </span>
                {connection.account && (
                  <Mono className="text-[11.5px] text-ink-subtle">{connection.account}</Mono>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="text-[11.5px] text-ink-subtle">
              Label
              <input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="personal GitHub"
                className="mt-1 block rounded border border-line bg-surface px-2 py-1 text-[12.5px] text-ink"
              />
            </label>
            <label className="text-[11.5px] text-ink-subtle">
              Credential reference
              <input
                value={connectionRef}
                onChange={(event) => setConnectionRef(event.target.value)}
                className="mt-1 block w-56 rounded border border-line bg-surface px-2 py-1 font-mono text-[12px] text-ink"
              />
            </label>
            <Button
              size="sm"
              variant="secondary"
              disabled={!label || !connectionRef || addConnection.isPending}
              onClick={() =>
                addConnection.mutate(
                  { provider: 'github', label, connectionRef },
                  { onSuccess: () => setLabel('') },
                )
              }
            >
              Add connection
            </Button>
          </div>
          {/* Said next to the field, where somebody is about to paste. */}
          <p className="mt-1.5 text-[11.5px] text-ink-subtle">
            A reference to where the credential lives — never the credential. The browser never
            holds one.
          </p>
          {/* Only `pin` reported failure. A connection or a repository that
              failed to save simply did not appear, which reads as a form that
              was not submitted (AUD-015). */}
          {addConnection.isError && (
            <p role="alert" className="mt-1.5 text-[11.5px] text-blocking">
              That connection was not saved. Nothing was recorded.
            </p>
          )}
          {check.isError && (
            <p role="alert" className="mt-1.5 text-[11.5px] text-blocking">
              The access check did not complete, so nothing is known about this credential yet.
            </p>
          )}
        </div>

        {/* sources */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
            Repositories
          </p>

          {sources.data && sources.data.length > 0 ? (
            <ul className="mt-1.5">
              {sources.data.map((source) => (
                <SourceRow key={source.sourceId} source={source} />
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[12.5px] text-ink-muted">No repositories are connected yet.</p>
          )}

          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-[11.5px] text-ink-subtle">
              Repository
              <input
                value={repository}
                onChange={(event) => setRepository(event.target.value)}
                placeholder="owner/repo"
                className="mt-1 block w-56 rounded border border-line bg-surface px-2 py-1 font-mono text-[12px] text-ink"
              />
            </label>
            <label className="text-[11.5px] text-ink-subtle">
              Branch
              <input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                className="mt-1 block w-28 rounded border border-line bg-surface px-2 py-1 font-mono text-[12px] text-ink"
              />
            </label>
            <Button
              size="sm"
              variant="secondary"
              disabled={!repository || !checkable || check.isPending}
              onClick={() =>
                check.mutate({ connectionId: checkable.connectionId, location: repository })
              }
            >
              {check.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  Checking
                </>
              ) : (
                <>
                  <ShieldCheck className="size-3.5" aria-hidden="true" />
                  Check access
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={!repository || verified.length === 0 || addSource.isPending}
              onClick={() =>
                addSource.mutate(
                  {
                    kind: 'github',
                    connectionId: verified[0].connectionId,
                    location: repository,
                    reference,
                  },
                  { onSuccess: () => setRepository('') },
                )
              }
            >
              Add repository
            </Button>
          </div>

          {addSource.isError && (
            <p role="alert" className="mt-1.5 text-[11.5px] text-blocking">
              That repository was not added. Nothing was recorded against this project.
            </p>
          )}

          {verified.length === 0 && (
            <p className="mt-1.5 text-[11.5px] text-attention">
              {all.length === 0
                ? 'Add a connection first.'
                : 'Check access before adding a repository. A repository cannot be added against a credential nobody has used.'}
            </p>
          )}

          {check.data && (
            <div className="mt-2 space-y-0.5 text-[12px] leading-relaxed text-ink-muted">
              <p>
                {check.data.canRead ? 'Readable' : 'Not readable'}
                {check.data.canWrite ? ' and writable' : ', not writable'}.
              </p>
              {/* Its own element, not spliced between expressions: the sentence
                  that says what this proves is the one that has to be readable
                  on its own. */}
              <p>{check.data.proves}</p>
            </div>
          )}
        </div>
      </PanelBody>
    </Panel>
  )
}
