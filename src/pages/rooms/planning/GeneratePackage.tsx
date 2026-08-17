/**
 * The artifact pipeline, as five things a person does in order.
 *
 * STI-5 and STI-6. Each step is separate on screen because each is a place
 * somebody decides something:
 *
 *   choose a shape → argue with the plan → generate → see what would change → approve
 *
 * **Studio decides none of it.** Whether an entry can be generated, whether a
 * package is publishable, whether an approval still holds — every one of those
 * answers arrives from KAE-Artifacts and is rendered as given. The temptation
 * this component exists to resist is computing any of them locally to make the
 * interface feel faster.
 *
 * The two states that matter most here are the ones a happy path would never
 * show: a **blocked** plan entry, which names a decision nobody has made, and a
 * **modify** outcome in a preview, which means an existing file would be
 * overwritten. Both are easy to leave out and both are the point.
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  Check,
  CircleDashed,
  FileText,
  Loader2,
  Lock,
  Pencil,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import { useServices } from '@/hooks/useServices'
import { useProjection } from '@/hooks/useProject'
import { FitFor } from './FitFor'
import { readHandle, writeHandle } from './pipelineHandle'
import { cn } from '@/lib/cn'
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
  useApprovePreview,
  useArtifactProfiles,
  useArtifactPublishers,
  useCreateArtifactPlan,
  useEditArtifactPlan,
  useGenerateArtifacts,
  usePreviewPublication,
  usePublicationStatus,
  usePublishPackage,
  useValidatePackage,
} from '@/hooks/useProject'
import type {
  ArtifactApproval,
  ArtifactDestination,
  ArtifactPlan,
  ArtifactPlanEntry,
  ArtifactPreview,
  ArtifactPublication,
  ArtifactReadiness,
  FileOutcome,
  GenerationRun,
} from '@/domain/types'

const READINESS: Record<
  ArtifactReadiness,
  { label: string; tone: 'confirmed' | 'attention' | 'pending' }
> = {
  ready: { label: 'Ready', tone: 'confirmed' },
  needs_review: { label: 'Needs review', tone: 'pending' },
  blocked: { label: 'Blocked', tone: 'attention' },
}

const OUTCOME: Record<FileOutcome, { label: string; tone: 'accent' | 'attention' | 'neutral' }> = {
  add: { label: 'add', tone: 'accent' },
  modify: { label: 'overwrites', tone: 'attention' },
  unchanged: { label: 'unchanged', tone: 'neutral' },
  conflict: { label: 'conflict', tone: 'attention' },
}

/**
 * What a run that neither succeeded nor failed says for itself (`D-203`).
 *
 * Indexed, not defaulted: a `Record` over exactly the three remaining states of
 * KAE-Artifacts' run lifecycle, so a sixth word arriving in that vocabulary is
 * a compile error here rather than a page that goes quiet again. Each sentence
 * says what happened **and** what it means for the files, because *Running* on
 * its own leaves a reader deciding whether to press Generate a second time.
 */
const UNFINISHED_RUN_SENTENCE: Record<
  Exclude<GenerationRun['status'], 'succeeded' | 'failed'>,
  string
> = {
  accepted: 'Generation was accepted and has not finished. No files exist yet.',
  running: 'Generation is still running. No files exist yet.',
  cancelled: 'Generation was cancelled before it finished. Nothing was produced.',
}

/**
 * A fresh key per attempt.
 *
 * Generated when the user acts, not during a render: a key derived from render
 * state would differ between a double-click's two calls, producing two runs —
 * which is the exact failure an idempotency key exists to prevent.
 */
function idempotencyKey(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

/** What went wrong, in the words KAE-Artifacts used, with its remedy. */
function Refusal({ error }: { error: unknown }) {
  const typed = error as { code?: string; message?: string; remedy?: string; retryable?: boolean }
  return (
    <div
      role="alert"
      title={typed?.code}
      className="flex items-start gap-2.5 rounded-panel border border-attention-line bg-attention-soft/40 px-4 py-3"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-attention" aria-hidden="true" />
      <div className="min-w-0 text-[12.5px] leading-relaxed">
        <p className="text-ink">{typed?.message ?? String(error)}</p>
        {typed?.remedy && <p className="mt-1 text-ink-muted">{typed.remedy}</p>}
        {/* **Not as a third line** (`NAV-01` N4). `artifacts_not_configured`
            sat under a sentence and a remedy that already said everything it
            says, in a vocabulary belonging to the backend. It is worth keeping
            for anybody quoting this to somebody else, and it is not worth a
            line of its own. */}
        {typed?.code && <span className="sr-only">Error code {typed.code}</span>}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- plan entry */

function PlanRow({
  entry,
  onMove,
  onToggle,
  busy,
}: {
  entry: ArtifactPlanEntry
  onMove: (path: string) => void
  onToggle: (selected: boolean) => void
  busy: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(entry.logicalPath)
  const readiness = READINESS[entry.readiness]

  return (
    <li className="border-t border-line py-3 first:border-t-0">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={entry.selected}
          disabled={busy || entry.readiness === 'blocked'}
          onChange={(event) => onToggle(event.target.checked)}
          aria-label={`Include ${entry.type}`}
          className="mt-1 size-3.5 shrink-0 accent-accent disabled:opacity-40"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium text-ink">{entry.purpose}</span>
            <Badge tone={readiness.tone}>
              {entry.readiness === 'blocked' && <Lock className="size-3" aria-hidden="true" />}
              {readiness.label}
            </Badge>
          </div>

          {editing ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                aria-label={`Path for ${entry.type}`}
                className="min-w-0 flex-1 rounded border border-line bg-surface px-2 py-1 font-mono text-[12px] text-ink"
              />
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  onMove(draft)
                  setEditing(false)
                }}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraft(entry.logicalPath)
                  setEditing(false)
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing(true)}
              className="mt-1 flex items-center gap-1.5 text-left font-mono text-[12px] text-ink-muted hover:text-ink disabled:opacity-50"
            >
              {entry.logicalPath}
              <Pencil className="size-3 opacity-60" aria-hidden="true" />
            </button>
          )}

          {entry.readiness === 'blocked' && (
            /*
             * The most important row on this screen. KAE-Artifacts declined to
             * write a document with a plausible guess where a real decision
             * belongs — so the reason is shown as the next action, not hidden
             * as an error.
             */
            <p className="mt-1.5 text-[12px] leading-relaxed text-attention">
              {entry.blockedReason} Nothing will be generated for this file until that is decided.
            </p>
          )}
        </div>
      </div>
    </li>
  )
}

/* --------------------------------------------------------------- the flow */

/**
 * Read back a publication this tab started and then lost.
 *
 * Only the publication: a plan or a preview that never reached approval is
 * cheap to redo and confusing to resurrect, while a publication may already
 * have opened a pull request — which is the one thing a user must not be left
 * unaware of after a refresh (AUD-017).
 */
function useResumedPublication(
  projectId: string,
  current: ArtifactPublication | null,
): ArtifactPublication | undefined {
  const { pipeline } = useServices()
  const stored = readHandle(projectId).publicationId

  const { data } = useQuery({
    queryKey: ['artifact-publication', stored],
    queryFn: () => pipeline.getPublication(stored!),
    enabled: Boolean(stored) && !current,
  })

  return data
}

export function GeneratePackage() {
  const { projectId } = useServices()
  const projection = useProjection()
  const profiles = useArtifactProfiles()
  const publishers = useArtifactPublishers()
  const createPlan = useCreateArtifactPlan()
  const editPlan = useEditArtifactPlan()
  const generate = useGenerateArtifacts()
  const preview = usePreviewPublication()
  const approve = useApprovePreview()
  const publish = usePublishPackage()

  const [profile, setProfile] = useState('')
  const [plan, setPlan] = useState<ArtifactPlan | null>(null)
  const [run, setRun] = useState<GenerationRun | null>(null)
  const [destinationType, setDestinationType] = useState<ArtifactDestination['type']>('download')
  // `target` and `targetPath` were hardcoded empty strings behind a button that
  // read "Approve & create pull request", with no input for either anywhere in
  // the UI (AUD-019). A destination nobody can name is not a destination.
  const [target, setTarget] = useState('')
  const [targetPath, setTargetPath] = useState('')
  const [proposed, setProposed] = useState<ArtifactPreview | null>(null)
  const [approval, setApproval] = useState<ArtifactApproval | null>(null)
  const [published, setPublished] = useState<ArtifactPublication | null>(null)

  const validation = useValidatePackage(run?.packageId)
  // The 202 is a receipt, not an outcome. `published` holds what the POST
  // returned; this holds what the publication has since become (AUD-018).
  // Recover work in flight after a refresh. The identifiers are the only thing
  // the tab held that nothing else did; the state behind them is read back from
  // KAE-Artifacts, which owns it (AUD-017).
  const resumed = useResumedPublication(projectId, published)
  const settling = usePublicationStatus(published ?? resumed ?? null)
  const outcome = settling.data ?? published ?? resumed
  const available = publishers.data ?? []
  const chosenProfile = profile || profiles.data?.[0]?.id || ''

  const destination: ArtifactDestination = {
    type: destinationType,
    mode: destinationType === 'github' ? 'pull_request' : 'object_write',
    target: target.trim(),
    targetPath: targetPath.trim(),
    baseBranch: destinationType === 'github' ? 'main' : '',
  }

  /**
   * Download writes nothing anybody has to name; the other two do.
   *
   * Checked here rather than left to a refusal from KAE-Artifacts, because a
   * user who has clicked Approve has already committed to something by then —
   * and the refusal would name a field the form never offered.
   */
  const destinationNeedsATarget = destinationType !== 'download'
  const destinationIsNamed = !destinationNeedsATarget || destination.target.length > 0

  /**
   * Anything that changes the package invalidates what came after it.
   *
   * An approval names one package and one preview. Leaving a stale approval on
   * screen after regenerating would offer a publish button that KAE-Artifacts
   * would refuse — correctly, and confusingly.
   */
  function resetDownstream() {
    setProposed(null)
    setApproval(null)
    setPublished(null)
  }

  const generatable = plan?.entries.filter((e) => e.generatable) ?? []
  const blocked = plan?.entries.filter((e) => e.readiness === 'blocked') ?? []

  return (
    <Panel>
      <PanelHeader>
        <div>
          <PanelTitle className="text-[14px]">Generate a package</PanelTitle>
          <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-ink-muted">
            Documents are generated from what the project currently knows, pinned to that exact
            revision. Nothing is written anywhere until you have seen what would change and approved
            it.
          </p>
        </div>
      </PanelHeader>

      <PanelBody className="space-y-5">
        {/* Before the first control, because it is what a person needs in order
            to decide whether to use the controls at all (`D-33`). It stops
            nothing — nothing in the estate refuses on these flags. */}
        {projection.data && <FitFor health={projection.data.health} />}

        {/* 1 — choose a shape */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
            1 · Shape
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              value={chosenProfile}
              disabled={profiles.isLoading || createPlan.isPending}
              onChange={(event) => setProfile(event.target.value)}
              aria-label="Package profile"
              className="rounded border border-line bg-surface px-2 py-1.5 text-[12.5px] text-ink"
            >
              {(profiles.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} — {plural(p.artifactCount, 'file')}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="secondary"
              disabled={!chosenProfile || createPlan.isPending}
              onClick={() =>
                createPlan.mutate(chosenProfile, {
                  onSuccess: (result) => {
                    setPlan(result)
                    setRun(null)
                    resetDownstream()
                  },
                })
              }
            >
              {createPlan.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  Planning
                </>
              ) : (
                'Propose a plan'
              )}
            </Button>
            <span className="text-[11.5px] text-ink-subtle">Proposing generates nothing.</span>
          </div>
          {profiles.isError && (
            <div className="mt-2">
              <Refusal error={profiles.error} />
            </div>
          )}
          {createPlan.isError && (
            <div className="mt-2">
              <Refusal error={createPlan.error} />
            </div>
          )}
        </div>

        {/* 2 — argue with the plan */}
        {plan && (
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                2 · Plan
              </p>
              <p className="text-[11.5px] text-ink-subtle">
                From <Mono>{plan.inputRevision}</Mono>
              </p>
            </div>

            <ul className="mt-1.5">
              {plan.entries.map((entry) => (
                <PlanRow
                  key={entry.type}
                  entry={entry}
                  busy={editPlan.isPending || generate.isPending}
                  onMove={(path) =>
                    editPlan.mutate(
                      { planId: plan.planId, edits: [{ type: entry.type, logicalPath: path }] },
                      {
                        onSuccess: (result) => {
                          setPlan(result)
                          resetDownstream()
                        },
                      },
                    )
                  }
                  onToggle={(selected) =>
                    editPlan.mutate(
                      { planId: plan.planId, edits: [{ type: entry.type, selected }] },
                      {
                        onSuccess: (result) => {
                          setPlan(result)
                          resetDownstream()
                        },
                      },
                    )
                  }
                />
              ))}
            </ul>

            {editPlan.isError && (
              <div className="mt-2">
                <Refusal error={editPlan.error} />
              </div>
            )}

            {blocked.length > 0 && (
              <div className="mt-3 flex items-start gap-2.5 rounded-panel border border-attention-line bg-attention-soft/40 px-4 py-3">
                <TriangleAlert
                  className="mt-0.5 size-4 shrink-0 text-attention"
                  aria-hidden="true"
                />
                <p className="text-[12.5px] leading-relaxed text-ink-muted">
                  {plural(blocked.length, 'file is', 'files are')} waiting on a decision. They will
                  be left out rather than written with a guess in place of the answer.
                </p>
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="primary"
                disabled={generatable.length === 0 || generate.isPending}
                onClick={() =>
                  generate.mutate(
                    { planId: plan.planId, idempotencyKey: idempotencyKey('gen') },
                    {
                      onSuccess: (result) => {
                        setRun(result)
                        resetDownstream()
                      },
                    },
                  )
                }
              >
                {generate.isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    Generating
                  </>
                ) : (
                  `Generate ${plural(generatable.length, 'file')}`
                )}
              </Button>
              {generatable.length === 0 && (
                <span className="text-[11.5px] text-attention">
                  Nothing in this plan can be generated yet.
                </span>
              )}
            </div>
            {generate.isError && (
              <div className="mt-2">
                <Refusal error={generate.error} />
              </div>
            )}
          </div>
        )}

        {/* 3 — what was generated */}
        {run && run.status === 'succeeded' && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
              3 · Package
            </p>
            <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[12px]">
              <div className="flex gap-1.5">
                <dt className="text-ink-subtle">Package</dt>
                <dd>
                  <Mono>{run.packageId}</Mono>
                </dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-ink-subtle">From revision</dt>
                <dd>
                  <Mono>{run.inputRevision}</Mono>
                </dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-ink-subtle">Files</dt>
                <dd className="text-ink">{run.artifactIds.length}</dd>
              </div>
            </dl>

            {validation.data && (
              <div className="mt-2 space-y-1.5">
                <p
                  className={cn(
                    'flex items-center gap-1.5 text-[12.5px]',
                    validation.data.publishable ? 'text-confirmed' : 'text-attention',
                  )}
                >
                  {validation.data.publishable ? (
                    <Check className="size-3.5" aria-hidden="true" />
                  ) : (
                    <TriangleAlert className="size-3.5" aria-hidden="true" />
                  )}
                  {validation.data.publishable
                    ? 'Validated and publishable.'
                    : 'This package cannot be published as it stands.'}
                </p>
                {validation.data.findings.map((finding, index) => (
                  <p
                    key={`${finding.check}-${index}`}
                    className="pl-5 text-[12px] leading-relaxed text-ink-muted"
                  >
                    <Mono className="text-[11px]">{finding.severity}</Mono> {finding.message}{' '}
                    {finding.remedy}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {run && run.status === 'failed' && (
          <Refusal error={{ code: run.errorCode, message: run.errorMessage }} />
        )}

        {/* A run that neither succeeded nor failed used to render nothing at
            all — steps 1 and 2, a Generate button already pressed, and no
            third step (`D-203`). One arm rather than three: the states have no
            producer, so what is owed is a sentence, not a feature. */}
        {run && run.status !== 'succeeded' && run.status !== 'failed' && (
          <p className="text-[12.5px] leading-relaxed text-ink-muted">
            {UNFINISHED_RUN_SENTENCE[run.status]}
          </p>
        )}

        {/* 4 — what would change */}
        {run?.packageId && validation.data?.publishable && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
              4 · Destination
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                value={destinationType}
                onChange={(event) => {
                  setDestinationType(event.target.value as ArtifactDestination['type'])
                  resetDownstream()
                }}
                aria-label="Destination"
                className="rounded border border-line bg-surface px-2 py-1.5 text-[12.5px] text-ink"
              >
                {available.map((p) => (
                  <option key={p.type} value={p.type} disabled={!p.available}>
                    {p.type}
                    {p.available ? '' : ` — ${p.reason}`}
                  </option>
                ))}
              </select>
              {/* Named, not assumed. Both fields were hardcoded empty and the
                  button still said "create pull request" (AUD-019). */}
              {destinationNeedsATarget && (
                <>
                  <input
                    value={target}
                    onChange={(event) => {
                      setTarget(event.target.value)
                      resetDownstream()
                    }}
                    placeholder={destinationType === 'github' ? 'owner/repo' : 'bucket'}
                    aria-label={destinationType === 'github' ? 'Repository' : 'Bucket'}
                    className="w-52 rounded border border-line bg-surface px-2 py-1.5 text-[12.5px] text-ink"
                  />
                  <input
                    value={targetPath}
                    onChange={(event) => {
                      setTargetPath(event.target.value)
                      resetDownstream()
                    }}
                    placeholder={
                      destinationType === 'github' ? 'docs/ (optional)' : 'prefix/ (optional)'
                    }
                    aria-label="Path"
                    className="w-52 rounded border border-line bg-surface px-2 py-1.5 text-[12.5px] text-ink"
                  />
                </>
              )}
              <Button
                size="sm"
                variant="secondary"
                disabled={preview.isPending || !destinationIsNamed}
                onClick={() =>
                  preview.mutate(
                    { packageId: run.packageId, destination },
                    {
                      onSuccess: (result) => {
                        setProposed(result)
                        setApproval(null)
                        setPublished(null)
                        writeHandle(projectId, {
                          packageId: result.packageId,
                          previewId: result.previewId,
                        })
                      },
                    },
                  )
                }
              >
                {preview.isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    Reading destination
                  </>
                ) : (
                  'See what would change'
                )}
              </Button>
              {destinationNeedsATarget && !destinationIsNamed && (
                <p className="w-full text-[11.5px] text-ink-subtle">
                  Name the {destinationType === 'github' ? 'repository' : 'bucket'} to preview what
                  would be written there.
                </p>
              )}
            </div>
            {preview.isError && (
              <div className="mt-2">
                <Refusal error={preview.error} />
              </div>
            )}

            {proposed && (
              <div className="mt-3">
                {proposed.hasChanges ? (
                  <>
                    <ul className="rounded-panel border border-line">
                      {proposed.changes.map((change) => (
                        <li
                          key={change.path}
                          className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2 first:border-t-0"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <FileText
                              className="size-3.5 shrink-0 text-ink-subtle"
                              aria-hidden="true"
                            />
                            <Mono className="truncate text-[12px]">{change.path}</Mono>
                          </span>
                          <Badge tone={OUTCOME[change.outcome].tone}>
                            {OUTCOME[change.outcome].label}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                    {proposed.changes.some((c) => c.outcome === 'modify') && (
                      /*
                       * Said in words as well as in a badge. "Approve" against
                       * a list of filenames is agreement to something the user
                       * was never told: that existing content goes away.
                       */
                      <p className="mt-2 text-[12.5px] leading-relaxed text-attention">
                        Some of these replace files that already exist at the destination. Their
                        current content will be overwritten.
                      </p>
                    )}
                    {proposed.baseToken && (
                      <p className="mt-2 text-[11.5px] text-ink-subtle">
                        Reviewed against <Mono>{proposed.baseToken.slice(0, 12)}</Mono>. If the
                        destination moves before you publish, this approval stops being valid and
                        nothing is written.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-[12.5px] text-ink-muted">
                    Every file already matches the destination. There is nothing to publish.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* 5 — approve, then publish */}
        {proposed?.hasChanges && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
              5 · Approve
            </p>

            {!approval ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  disabled={approve.isPending}
                  onClick={() =>
                    approve.mutate(proposed.previewId, {
                      onSuccess: (result) => {
                        setApproval(result)
                        writeHandle(projectId, { approvalId: result.approvalId })
                      },
                    })
                  }
                >
                  {approve.isPending ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                      Approving
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="size-3.5" aria-hidden="true" />
                      Approve these {plural(proposed.changes.length, 'change')}
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                <p className="flex items-center gap-1.5 text-[12.5px] text-confirmed">
                  <Check className="size-3.5" aria-hidden="true" />
                  Approved by <Mono>{approval.approverRef}</Mono>
                </p>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={publish.isPending || Boolean(published)}
                  onClick={() =>
                    publish.mutate(
                      {
                        packageId: proposed.packageId,
                        destination: proposed.destination,
                        approvalId: approval.approvalId,
                        idempotencyKey: idempotencyKey('pub'),
                      },
                      {
                        onSuccess: (result) => {
                          setPublished(result)
                          writeHandle(projectId, { publicationId: result.publicationId })
                        },
                      },
                    )
                  }
                >
                  {publish.isPending ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                      Publishing
                    </>
                  ) : destinationType === 'github' ? (
                    'Approve & create pull request'
                  ) : (
                    'Publish'
                  )}
                </Button>
              </div>
            )}
            {approve.isError && (
              <div className="mt-2">
                <Refusal error={approve.error} />
              </div>
            )}
            {publish.isError && (
              <div className="mt-2">
                <Refusal error={publish.error} />
              </div>
            )}
          </div>
        )}

        {/* the result */}
        {outcome && (
          <div
            className={cn(
              'rounded-panel border px-4 py-3',
              outcome.status === 'succeeded'
                ? 'border-confirmed-line bg-confirmed-soft/30'
                : outcome.status === 'failed'
                  ? 'border-blocking-line bg-blocking-soft/30'
                  : 'border-line bg-surface-sunken',
            )}
          >
            {/* Three outcomes, not two. `accepted` and `running` mean the
                publication is in flight, and rendering either as "Not
                published" invites a retry of something still happening. */}
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
              {outcome.status === 'succeeded' ? (
                <Check className="size-3.5 text-confirmed" aria-hidden="true" />
              ) : outcome.status === 'failed' ? (
                <CircleDashed className="size-3.5 text-blocking" aria-hidden="true" />
              ) : (
                <Loader2 className="size-3.5 animate-spin text-ink-muted" aria-hidden="true" />
              )}
              {outcome.status === 'succeeded'
                ? 'Published'
                : outcome.status === 'failed'
                  ? 'Not published'
                  : 'Publishing — waiting for this to finish'}
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">{outcome.detail}</p>
            {outcome.externalReference && (
              <p className="mt-1.5 text-[12px]">
                <span className="text-ink-subtle">Reference </span>
                <Mono>{outcome.externalReference}</Mono>
              </p>
            )}
            {/* What the publication actually wrote, which is not what step 4
                previewed (`D-207`). GitHub drops every `unchanged` file before
                committing, the download archive carries a `manifest.json` that
                appears in no change row, and both publishers succeed with an
                empty list when everything already matched. The publisher's own
                paths — for S3 these are object keys with the destination prefix
                applied, and shortening them here would name a path that does
                not exist.

                Only on a succeeded publication: a failure raises before
                returning, so the field is absent rather than empty, and a
                heading with nothing under it would suggest the partial write
                §11 forbids reporting. */}
            {outcome.status === 'succeeded' && (
              <div className="mt-2">
                {outcome.filesWritten.length === 0 ? (
                  <p className="text-[12px] text-ink-subtle">No files were written.</p>
                ) : (
                  <>
                    <p className="text-[12px] text-ink-subtle">
                      {plural(outcome.filesWritten.length, 'file')} written
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {outcome.filesWritten.map((path) => (
                        <li key={path} className="text-[12px]">
                          <Mono>{path}</Mono>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
            {outcome.reviewUrl && (
              <a
                href={outcome.reviewUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 inline-block text-[12.5px] text-accent underline"
              >
                Open the pull request for review
              </a>
            )}
          </div>
        )}
      </PanelBody>
    </Panel>
  )
}
