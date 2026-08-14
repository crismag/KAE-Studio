/**
 * The live service implementation: Studio's backend instead of fixtures.
 *
 * Every call goes to the trusted Studio API on the same origin (or the origin
 * named by `VITE_STUDIO_API`), which holds the KAE-Memory credential. **The
 * browser holds only a session cookie**, which is why `credentials: 'include'`
 * appears on every request and why no token appears anywhere in this file.
 *
 * Where KAE-Memory has no capability, this surfaces the gap rather than
 * returning a plausible empty value. A `modules: []` would render "no modules
 * yet" about a question that was never asked; the UI should say what is
 * genuinely unavailable and why.
 */

import type {
  BusinessWorkflow,
  ConversationMessage,
  DefinitionStatement,
  Deliverable,
  ExtractionCoverage,
  InterviewSession,
  ArchitectureGraph,
  CoverageTopic,
  MemoryConnection,
  PreliminaryContext,
  ProjectBlocker,
  ProjectReview,
  Project,
  PublicationTarget,
  SetupGap,
  SetupState,
  UnknownEntry,
  ArtifactDestination,
  ArtifactPlan,
  ArtifactPreview,
  ArtifactPublication,
  ArtifactReadiness,
  FileOutcome,
  GenerationRun,
  ProjectProjection,
  ProjectSource,
  ProviderConnection,
  Requirement,
  StakeholderEntry,
  ValidationResult,
} from '@/domain/types'
import type {
  AcquisitionPort,
  ArtifactPipeline,
  ArtifactService,
  InterviewProvider,
  InterviewTurn,
  MemoryWriteResult,
  ModuleDecision,
  ProjectMemoryClient,
  FileExcerpt,
  IngestionPort,
  ProjectProjectionService,
  SetupPort,
  StudioServices,
} from '@/services/interfaces'

const API = (import.meta.env.VITE_STUDIO_API as string | undefined) ?? 'http://127.0.0.1:8100'

/** A capability this deployment does not have. Thrown, never faked. */
export class CapabilityUnavailable extends Error {
  constructor(
    readonly capability: string,
    reason: string,
  ) {
    super(reason)
    this.name = 'CapabilityUnavailable'
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    // The session is a cookie, so every request must carry it. Without this the
    // backend sees an anonymous caller and answers 401 — which looks like a
    // broken login rather than a missing option.
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (response.status === 401) throw new Error('not signed in')
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`${response.status}: ${body.slice(0, 200)}`)
  }
  return (await response.json()) as T
}

/**
 * A refusal from KAE-Artifacts, with its code intact.
 *
 * The UI branches on `code`: `stale_base` offers to preview again,
 * `rate_limited` backs off, `publisher_not_configured` points at a setting. A
 * plain `Error` carrying "409: {...}" would force every caller to match on
 * English, which breaks the first time anyone improves the wording.
 */
export class ArtifactError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly remedy: string,
    readonly retryable: boolean,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ArtifactError'
  }
}

/** Like `call`, but reads the typed error envelope KAE-Artifacts returns. */
async function callArtifacts<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (response.status === 401) throw new Error('not signed in')
  if (!response.ok) {
    let body: unknown = null
    try {
      body = await response.json()
    } catch {
      // A proxy or a gateway can answer with HTML. Falling through leaves the
      // status, which is still more than "something went wrong".
    }
    // FastAPI nests `HTTPException(detail=...)` under `detail`; our own
    // handlers return the envelope at the top level. Both shapes occur, and a
    // client that understood only one would lose the code exactly when a
    // deployment is misconfigured.
    const envelope =
      (body as { error?: unknown })?.error ??
      ((body as { detail?: { error?: unknown } })?.detail as { error?: unknown })?.error
    const error = envelope as
      { code?: string; message?: string; remedy?: string; retryable?: boolean } | undefined
    throw new ArtifactError(
      error?.code ?? 'unknown',
      error?.message ?? `Request failed with ${response.status}.`,
      error?.remedy ?? '',
      error?.retryable ?? false,
      response.status,
    )
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

/* ------------------------------------------- KAE-Artifacts wire shapes */

/*
 * Snake_case is KAE-Artifacts' vocabulary; camelCase is the UI's. Mapping
 * happens here, once, rather than leaving components to read `logical_path` in
 * one place and `logicalPath` in another.
 *
 * These are declared rather than inferred so a field KAE-Artifacts renames
 * fails at the type level here, in the one file that knows about the wire —
 * instead of arriving as `undefined` in a component that renders a blank.
 */

interface WireProfile {
  id: string
  artifact_count: number
  artifacts: { type: string; default_path: string; purpose: string; inputs: string[] }[]
}

interface WirePublisher {
  type: string
  available: boolean
  reason?: string
}

interface WirePlanEntry {
  type: string
  logical_path: string
  purpose: string
  inputs: string[]
  readiness: ArtifactReadiness
  blocked_reason: string
  selected: boolean
  generatable: boolean
  options: Record<string, string>
}

interface WirePlan {
  plan_id: string
  subject_id: string
  input_revision: string
  input_digest: string
  profile: string
  checksum: string
  actionable: boolean
  entries: WirePlanEntry[]
}

interface WireRun {
  run_id: string
  status: GenerationRun['status']
  input_revision: string
  artifact_ids: string[]
  package_id: string
  error_code: string
  error_message: string
}

interface WirePackage {
  package_id: string
  subject_id: string
  input_revision: string
  run_id: string
  package_checksum: string
  manifest_version: string
  created_at: string
  artifacts: {
    artifact_id: string
    type: string
    logical_path: string
    checksum: string
    size_bytes: number
    generator_version: string
  }[]
}

interface WireArtifact {
  artifact_id: string
  type: string
  logical_path: string
  media_type: string
  checksum: string
  size_bytes: number
  input_revision: string
  generator_version: string
  content: string
}

interface WireDestination {
  type: ArtifactDestination['type']
  mode: ArtifactDestination['mode']
  target: string
  target_path: string
  base_branch?: string
}

interface WirePreview {
  preview_id: string
  package_id: string
  package_checksum: string
  checksum: string
  destination: WireDestination
  base_token: string
  has_changes: boolean
  changes: {
    path: string
    outcome: FileOutcome
    existing_identity: string
    new_checksum: string
    size_bytes: number
    detail: string
  }[]
}

interface WireApproval {
  approval_id: string
  package_id: string
  package_checksum: string
  preview_id: string
  preview_checksum: string
  destination: WireDestination
  base_token: string
  approver_ref: string
  approved_at: string
  expires_at: string
  policy_version: string
}

interface WirePublication {
  publication_id: string
  package_id: string
  approval_id: string
  destination: WireDestination
  status: ArtifactPublication['status']
  external_reference: string
  review_url: string
  files_written: string[]
  detail: string
}

function destination(wire: WireDestination): ArtifactDestination {
  return {
    type: wire.type,
    mode: wire.mode,
    target: wire.target,
    targetPath: wire.target_path,
    baseBranch: wire.base_branch ?? '',
  }
}

function wireDestination(value: ArtifactDestination): WireDestination {
  return {
    type: value.type,
    mode: value.mode,
    target: value.target,
    target_path: value.targetPath,
    base_branch: value.baseBranch,
  }
}

function plan(wire: WirePlan): ArtifactPlan {
  return {
    planId: wire.plan_id,
    subjectId: wire.subject_id,
    inputRevision: wire.input_revision,
    inputDigest: wire.input_digest,
    profile: wire.profile,
    checksum: wire.checksum,
    actionable: wire.actionable,
    entries: wire.entries.map((e) => ({
      type: e.type,
      logicalPath: e.logical_path,
      purpose: e.purpose,
      inputs: e.inputs,
      readiness: e.readiness,
      blockedReason: e.blocked_reason,
      selected: e.selected,
      generatable: e.generatable,
      options: e.options,
    })),
  }
}

function preview(wire: WirePreview): ArtifactPreview {
  return {
    previewId: wire.preview_id,
    packageId: wire.package_id,
    packageChecksum: wire.package_checksum,
    checksum: wire.checksum,
    destination: destination(wire.destination),
    baseToken: wire.base_token,
    hasChanges: wire.has_changes,
    changes: wire.changes.map((c) => ({
      path: c.path,
      outcome: c.outcome,
      existingIdentity: c.existing_identity,
      newChecksum: c.new_checksum,
      sizeBytes: c.size_bytes,
      detail: c.detail,
    })),
  }
}

function publication(wire: WirePublication): ArtifactPublication {
  return {
    publicationId: wire.publication_id,
    packageId: wire.package_id,
    approvalId: wire.approval_id,
    destination: destination(wire.destination),
    status: wire.status,
    externalReference: wire.external_reference,
    reviewUrl: wire.review_url,
    filesWritten: wire.files_written,
    detail: wire.detail,
  }
}

interface WireConnection {
  connection_id: string
  provider: string
  label: string
  state: ProviderConnection['state']
  can_read: boolean
  can_write: boolean
  account: string
  verified_at: string
  detail: string
}

interface WireConnectivity {
  ok: boolean
  provider: string
  account: string
  can_read: boolean
  can_write: boolean
  detail: string
  checked_at: string
  proves: string
}

interface WireSource {
  source_id: string
  project_id: string
  kind: ProjectSource['kind']
  connection_id: string
  location: string
  reference: string
  state: ProjectSource['state']
  snapshot: {
    revision: string
    resolved_at: string
    file_count: number
    total_bytes: number
    excluded_count: number
    content_digest: string
  } | null
  last_error: string
  analysis: { capability: string; reason: string; state: 'planned'; proved_instead: string[] }
}

function connection(wire: WireConnection): ProviderConnection {
  return {
    connectionId: wire.connection_id,
    provider: wire.provider,
    label: wire.label,
    state: wire.state,
    canRead: wire.can_read,
    canWrite: wire.can_write,
    account: wire.account,
    verifiedAt: wire.verified_at,
    detail: wire.detail,
  }
}

function projectSource(wire: WireSource): ProjectSource {
  return {
    sourceId: wire.source_id,
    projectId: wire.project_id,
    kind: wire.kind,
    connectionId: wire.connection_id,
    location: wire.location,
    reference: wire.reference,
    state: wire.state,
    snapshot: wire.snapshot
      ? {
          revision: wire.snapshot.revision,
          resolvedAt: wire.snapshot.resolved_at,
          fileCount: wire.snapshot.file_count,
          totalBytes: wire.snapshot.total_bytes,
          excludedCount: wire.snapshot.excluded_count,
          contentDigest: wire.snapshot.content_digest,
        }
      : null,
    lastError: wire.last_error,
    analysis: {
      capability: wire.analysis.capability,
      reason: wire.analysis.reason,
      state: wire.analysis.state,
      provedInstead: wire.analysis.proved_instead,
    },
  }
}

interface BackendStatement {
  id: string
  text: string
  /** Memory's optimistic-concurrency token. Carried to the review page so a
   *  rejection names the wording the reviewer actually read. */
  version: number
  /** goal | rule | actor | constraint | entity | unknown — Memory types these,
   *  and the distinction survives to the review page even though the
   *  requirements list still flattens them. */
  kind: string
  lifecycle: string
  updatedAt: string
  /** Which statements say adjacent things (`ES-5`). `null` when this resembles
   *  nothing else — and also on a project too large to group, which a reader
   *  must not take as "nothing here resembles anything". */
  related_group?: number | null
}

/** Shape of the backend's projection. Deliberately not the UI's own type. */
interface BackendProjection {
  project: { id: string; name: string; phase: string; memoryRevision: number; createdAt: string }
  confirmed: BackendStatement[]
  proposed: BackendStatement[]
  rejected: BackendStatement[]
  /** Carried since `D-34`; absent on an older Studio backend. */
  superseded?: BackendStatement[]
  health: {
    percentage: number
    advisory: boolean
    status: string
    draftEligible?: boolean
    implementationEligible?: boolean
    areas: {
      key: string
      name: string
      confirmed: number
      proposed: number
      required: number
      state: string
      mandatory: boolean
      contradicted: boolean
    }[]
  }
  /** Absent on a backend older than the Definition block. */
  definition?: {
    problem: string
    value: string
    objectives: { id: string; text: string; status: string }[]
    stakeholders: { id: string; name: string; status: string }[]
    inScope: { id: string; text: string; status: string }[]
    outOfScope: { id: string; text: string; status: string }[]
    workflows: {
      id: string
      name: string
      status: string
      steps: unknown[]
      realizedBy: string[]
    }[]
    assumptions: { id: string; text: string; status: string }[]
    constraints: { id: string; text: string; status: string }[]
    mappingVersion: number
  }
  extractionCoverage?: { succeeded: number; abandoned: number; complete: boolean }
  openQuestions: {
    id: string
    question: string
    severity: string
    disposition: string
    /** Absent on a backend that only materialises. */
    asked?: boolean
  }[]
  blockers: unknown[]
  contradictions: { count: number; listable: boolean; reason: string }
  preliminary: {
    composed?: boolean
    isPreliminary?: boolean | null
    statedVerbatim?: unknown[]
    assumed?: unknown[]
    materialUnknowns?: unknown[]
    deferrableUnknowns?: unknown[]
    warnings: string[]
  }
  modules: { available: boolean; gap: { capability: string; reason: string } }
  review?: {
    available?: boolean
    reason?: string
    findings?: unknown[]
  }
  architecture?: {
    available?: boolean
    reason?: string
    modules?: unknown[]
    edges?: unknown[]
    buildOrder?: unknown[]
    note?: string
  }
  unavailable: { section: string; reason: string }[]
  classification?: {
    engine: string | null
    degraded: boolean
    note: string
    reviewedAt: string | null
  }
}

export function toProjection(raw: BackendProjection): ProjectProjection {
  // Rejected last: the list reads top-down from settled, to open, to declined,
  // and a decision already taken should not sit above one still waiting.
  // Superseded last, and included at all (`D-34`). It reached none of the three
  // collections, so a statement the project corrected simply vanished — and
  // `STUDIO_ORCHESTRATION_CONTRACT` requires the lifecycle survive
  // presentation, which a statement that disappears has not done.
  const statements = [
    ...raw.confirmed,
    ...raw.proposed,
    ...(raw.rejected ?? []),
    ...(raw.superseded ?? []),
  ]

  return {
    project: {
      id: raw.project.id,
      name: raw.project.name,
      phase: raw.project.phase,
      memoryRevision: raw.project.memoryRevision,
      createdAt: raw.project.createdAt,
    },
    // What the project holds, from confirmed knowledge, in the shape a person
    // reads it in. This was hard-coded empty (DEF-1.3), so Definition rendered
    // blank for every project regardless of what Memory held.
    //
    // Sections that stay empty stay empty for a *stated* reason — the backend
    // reports them under `unavailable`, and the page distinguishes "your
    // project has none" from "we cannot tell". The fallbacks below are for a
    // backend older than this block, not for a project without one.
    definition: {
      problem: raw.definition?.problem ?? '',
      value: raw.definition?.value ?? '',
      objectives: (raw.definition?.objectives ?? []) as DefinitionStatement[],
      stakeholders: (raw.definition?.stakeholders ?? []) as StakeholderEntry[],
      inScope: (raw.definition?.inScope ?? []) as DefinitionStatement[],
      outOfScope: (raw.definition?.outOfScope ?? []) as DefinitionStatement[],
      workflows: (raw.definition?.workflows ?? []) as BusinessWorkflow[],
      assumptions: (raw.definition?.assumptions ?? []) as DefinitionStatement[],
      constraints: (raw.definition?.constraints ?? []) as DefinitionStatement[],
    },
    requirements: statements.map((s) => ({
      id: s.id,
      // Carried through. A grouping the backend computed and the adapter
      // dropped is `AUD-002` again, and this estate has found that shape
      // enough times to check for it on the way past.
      relatedGroup: s.related_group ?? null,
      // Unrecognised kinds land in `functional` rather than being dropped: a
      // new Memory kind should look mislabelled, not disappear.
      category: CATEGORY_FOR_KIND[s.kind] ?? 'functional',
      statement: s.text,
      // `validated` is Memory's word for confirmed by a person. Anything else
      // is a candidate, and the distinction must survive into the UI.
      status: lifecycleStatus(s.lifecycle),
      satisfies: [],
      verifiedBy: [],
      updatedAt: s.updatedAt,
      trace: [],
    })),
    acceptanceTests: [],
    modules: [],
    // Carried through untouched. What was lost is a fact about the project, and
    // a client that summarised it would be deciding how alarmed to be.
    extractionCoverage: raw.extractionCoverage,
    openDecisions: raw.openQuestions.map((q) => ({
      id: q.id,
      question: q.question,
      // Carried as what it is. It used to arrive as `whyItMatters`, which
      // promised a reason and delivered a grade (`D-17`).
      severity: q.severity,
      blocks: [],
      suggestedOwner: 'you',
      deferred: q.disposition !== 'open',
      // Absent on a backend older than the candidates listing, where every
      // question in a projection had been materialised to get there — so the
      // safe reading of a missing field is that it *was* asked.
      asked: q.asked ?? true,
    })),
    // Every proposed statement is something a person has not yet agreed to, so
    // it belongs on the review surface. Without this the page rendered nothing
    // and the only visible control was a status filter that looks like a
    // disabled button — Memory had derived six candidates and there was
    // nowhere to accept or refuse a single one.
    findings: raw.proposed.map((s) => ({
      id: s.id,
      kind: 'agent_proposal' as const,
      // Severity here is about review effort, not danger. An unknown is the
      // model saying it could not determine something, which is worth a
      // person's attention before a rule it read straight off the sentence.
      // A material unknown is exactly what R5 says may interrupt: KAE recorded
      // that it could not determine this rather than guessing. Graded `major`,
      // it was invisible to every rule that counts `critical` — including the
      // navigation badge, which could therefore never appear (AUD-012).
      severity: (s.kind === 'unknown' ? 'critical' : 'minor') as never,
      summary: s.text,
      detail:
        s.kind === 'unknown'
          ? 'Recorded as a material unknown: the model could not determine this and did not guess.'
          : `Derived from conversation as ${KIND_LABEL[s.kind] ?? s.kind}. Proposed, not confirmed.`,
      subjectIds: [s.kind, `v${s.version}`],
      version: s.version,
    })),
    health: {
      // Absent reads as not eligible, never as eligible (`D-33`).
      draftEligible: raw.health.draftEligible === true,
      implementationEligible: raw.health.implementationEligible === true,
      phase: raw.project.phase,
      // Where the project has got to, which is readiness's word and not the
      // project's status. Carried at last: the adapter dropped it, so the
      // journey strip had only `active` to compare against stage names.
      stage: raw.health.status,
      // Readiness is advisory in KAE and the wording says so. A bare percentage
      // gets read as a gate, which is the one thing it is built not to be.
      summary: `${raw.health.percentage}% understood (advisory — never a gate). ${raw.contradictions.count} unresolved contradiction(s).`,
      // What "sufficiently defined" means for each area, in the terms Memory
      // uses: how many confirmed items it holds against how many it needs.
      // A state alone ('missing', 'partial') colours a row; the counts let a
      // person act on it.
      coverage: (raw.health.areas ?? []).map((a) => ({
        key: a.key,
        name: a.name,
        state: coverageState(a),
        detail: coverageDetail(a),
      })),
      blockingDecisionIds: [],
      // Warnings only. The capability gaps that used to be flattened into this
      // list now travel as `unavailable` and `modulesGap` on the projection,
      // because a surface has to find *its own* section and cannot do that in a
      // list of sentences nothing renders (AUD-002).
      recommendedNext: [...raw.preliminary.warnings],
    },
    recentChanges: [],
    // Carried through structurally, not flattened. This is the whole of AUD-002:
    // the backend computes these reasons carefully and the adapter used to
    // discard them into a field with no reader.
    unavailable: raw.unavailable.map((u) => ({ section: u.section, reason: u.reason })),
    // Carried, not summarised. Whether a number came from a model, from the
    // offline rule, or from no review at all is the reader's judgement to make
    // and Memory already wrote the sentence for it.
    classification: raw.classification
      ? {
          engine: raw.classification.engine,
          degraded: raw.classification.degraded,
          note: raw.classification.note,
          reviewedAt: raw.classification.reviewedAt,
        }
      : undefined,
    contradictions: {
      count: raw.contradictions.count,
      listable: raw.contradictions.listable,
      reason: raw.contradictions.reason,
    },
    modulesGap: raw.modules.available
      ? null
      : {
          capability: raw.modules.gap.capability,
          reason: raw.modules.gap.reason,
          state: 'planned',
          provedInstead: [],
        },
    preliminary: toPreliminary(raw.preliminary),
    architecture: toArchitecture(raw.architecture),
    blockers: toBlockers(raw.blockers),
    review: toReview(raw.review),
  }
}

/**
 * The quality review KAE-Memory computes (`D-30`).
 *
 * Absent on a Studio backend older than this, and that reads as **not
 * available** rather than as a project with nothing wrong — an empty findings
 * list is a claim, and one that would be made on the strength of a call that
 * never happened.
 */
function toReview(raw: BackendProjection['review']): ProjectReview {
  if (!raw) {
    return {
      available: false,
      reason: 'This Studio deployment cannot read the project review yet.',
      findings: [],
    }
  }

  const text = (entry: Record<string, unknown>, key: string): string =>
    typeof entry[key] === 'string' ? (entry[key] as string) : ''

  return {
    available: raw.available === true,
    reason: typeof raw.reason === 'string' ? raw.reason : '',
    // Memory's order, kept. It sorts most severe first and that is the reason
    // it bothers to sort.
    findings: (raw.findings ?? [])
      .filter(
        (entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null,
      )
      .map((entry) => ({
        kind: text(entry, 'kind'),
        severity: text(entry, 'severity'),
        summary: text(entry, 'summary'),
        // Verbatim. Memory writes what would make the finding disappear, and a
        // paraphrase of an instruction is advice nobody can follow.
        recommendedAction: text(entry, 'recommendedAction'),
        areaKey: typeof entry.areaKey === 'string' ? entry.areaKey : null,
        subjectKey: text(entry, 'subjectKey'),
        knowledgeItemIds: Array.isArray(entry.knowledgeItemIds)
          ? entry.knowledgeItemIds.filter((id): id is string => typeof id === 'string')
          : [],
      })),
  }
}

/**
 * Gaps somebody owns and must close (`D-29`).
 *
 * These were typed `unknown[]` and mapped nowhere, while a `critical` one
 * already stopped generation — so the only place a person met a blocker was a
 * refusal at the moment they tried to produce a package.
 *
 * Resolved ones are carried. *"This was dealt with"* is a different fact from
 * *"this was wrong"*, which is why Memory keeps them, and a mapper that dropped
 * them would make *"what was blocking us, and who closed it?"* unanswerable
 * from the product.
 */
function toBlockers(raw: unknown[]): ProjectBlocker[] {
  return raw
    .filter(
      (entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null,
    )
    .map((entry) => ({
      id: typeof entry.id === 'string' ? entry.id : '',
      summary: typeof entry.summary === 'string' ? entry.summary : '',
      // Never defaulted to a grade. A blocker whose severity did not arrive is
      // not a minor one, and guessing downwards is the direction that costs a
      // person the thing they needed to see.
      severity: typeof entry.severity === 'string' ? entry.severity : '',
      status: typeof entry.status === 'string' ? entry.status : '',
      areaKey: typeof entry.area_key === 'string' ? entry.area_key : null,
      owner: typeof entry.owner === 'string' ? entry.owner : null,
      resolutionNote: typeof entry.resolution_note === 'string' ? entry.resolution_note : null,
    }))
}

/** One area as KAE-Memory reports it, before Studio's vocabulary is applied. */
interface WireArea {
  state: string
  confirmed: number
  proposed: number
  required: number
}

/**
 * KAE-Memory's lifecycle, in Studio's words (`D-34`).
 *
 * Exhaustive over `LifecycleState`'s four members. This was a ternary ending in
 * `: 'proposed'` behind an `as never` cast — the same shape as `D-27`, and the
 * same cast that hid it — so anything Memory added would arrive as a candidate
 * awaiting somebody's agreement.
 *
 * `superseded` reaches this only now that the backend carries it; before, it
 * was dropped a layer earlier and this branch was unreachable. Both halves had
 * to move, because either alone leaves the statement invisible.
 */
function lifecycleStatus(lifecycle: string): Requirement['status'] {
  switch (lifecycle) {
    case 'validated':
      return 'confirmed'
    case 'rejected':
      return 'rejected'
    case 'superseded':
      return 'superseded'
    case 'proposed':
      return 'proposed'
    default:
      // A word this build does not know. `proposed` claims only that nobody has
      // agreed to it, which is the least wrong reading — and it is a reading,
      // which is why the guard beside this asserts every state Memory has is
      // named above.
      return 'proposed'
  }
}

/**
 * KAE-Memory's coverage state, in Studio's words (`D-27`).
 *
 * This read `a.state === 'satisfied'`, and **`satisfied` is not one of Memory's
 * states** — its `AreaState` is `missing`, `partial`, `sufficient`,
 * `not_applicable`. The comparison had never once been true, so a fully covered
 * area fell through to `missing` on the panel a person reads to learn what KAE
 * understands about their project.
 *
 * The same word, in the same mistake, was fixed in Studio's backend twenty
 * lines from a comment recording the lesson. A fix that does not check for
 * siblings is half a fix.
 *
 * Exhaustive over Memory's vocabulary on purpose: an unknown state returns
 * `missing` **only** because there is nothing else honest to say about a word
 * this build does not know, and the guard beside it asserts that every state
 * Memory actually has is named here.
 */
function coverageState(area: WireArea): CoverageTopic['state'] {
  switch (area.state) {
    case 'sufficient':
      return 'strong'
    case 'partial':
      return 'forming'
    case 'not_applicable':
      // Not a degree of coverage. Memory means this area does not apply here,
      // and `missing` would claim a gap where there is none.
      return 'notApplicable'
    case 'missing':
      return area.proposed > 0 ? 'thin' : 'missing'
    default:
      return area.proposed > 0 ? 'thin' : 'missing'
  }
}

/** The counts behind the colour. A state alone cannot be acted on. */
function coverageDetail(area: WireArea): string {
  if (area.state === 'sufficient') return `${area.confirmed} confirmed — enough for now`
  if (area.state === 'not_applicable') return 'Not applicable to this project.'
  if (area.proposed > 0) {
    return `${area.confirmed} of ${area.required} confirmed · ${area.proposed} awaiting review`
  }
  return `${area.confirmed} of ${area.required} confirmed`
}

/**
 * The architecture as KAE-Memory holds it (`D-19`).
 *
 * Absent on a Studio backend older than the module routes, and that reads as
 * **not available** rather than as a project with no modules — the distinction
 * the whole capability turns on.
 */
function toArchitecture(raw: BackendProjection['architecture']): ArchitectureGraph {
  const text = (entry: Record<string, unknown>, key: string): string =>
    typeof entry[key] === 'string' ? (entry[key] as string) : ''
  const entries = (value: unknown[] | undefined): Record<string, unknown>[] =>
    (value ?? []).filter(
      (entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null,
    )

  if (!raw) {
    return {
      available: false,
      reason: 'This Studio deployment cannot read the module graph yet.',
      modules: [],
      edges: [],
      buildOrder: [],
      note: '',
    }
  }

  return {
    available: raw.available === true,
    reason: typeof raw.reason === 'string' ? raw.reason : '',
    modules: entries(raw.modules).map((module) => ({
      key: text(module, 'key'),
      name: text(module, 'name'),
      summary: text(module, 'summary'),
      status: text(module, 'status'),
    })),
    edges: entries(raw.edges).map((edge) => ({
      source: text(edge, 'source'),
      relation: text(edge, 'relation'),
      targetModule: typeof edge.targetModule === 'string' ? edge.targetModule : null,
      targetKnowledge: typeof edge.targetKnowledge === 'string' ? edge.targetKnowledge : null,
    })),
    // Memory's order, not one recomputed here. Two orders that disagree is a
    // question nobody can answer from the screen.
    buildOrder: (raw.buildOrder ?? []).filter((key): key is string => typeof key === 'string'),
    note: typeof raw.note === 'string' ? raw.note : '',
  }
}

/**
 * Memory's preliminary view, carried entry by entry (`D-18`).
 *
 * Nothing here counts, merges, or summarises. The whole point of the section
 * is that a person can tell what was *said* from what KAE *inferred* from what
 * nobody has decided, and every one of those distinctions dies in a total.
 */
function toPreliminary(raw: BackendProjection['preliminary']): PreliminaryContext {
  const entries = (value: unknown[] | undefined): Record<string, unknown>[] =>
    (value ?? []).filter(
      (entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null,
    )
  const text = (entry: Record<string, unknown>, key: string): string =>
    typeof entry[key] === 'string' ? (entry[key] as string) : ''

  const unknowns = (value: unknown[] | undefined): UnknownEntry[] =>
    entries(value).map((entry) => ({
      clarificationId: text(entry, 'clarification_id'),
      question: text(entry, 'question'),
      areaKey: typeof entry.area_key === 'string' ? entry.area_key : null,
      severity: text(entry, 'severity'),
      findingKind: text(entry, 'finding_kind'),
      material: entry.material === true,
      // Never defaulted to `open`. "Nobody was asked" and "someone was asked
      // and did not decide" are different states (N36), and a default that
      // renders identically to a fact is how a wrong reading survives.
      disposition: text(entry, 'disposition'),
    }))

  return {
    composed: raw.composed === true,
    isPreliminary: raw.isPreliminary === true,
    statedVerbatim: entries(raw.statedVerbatim).map((entry) => ({
      messageId: text(entry, 'message_id'),
      // Unedited, untrimmed of meaning, never summarised. This is the one
      // field in the projection that is somebody's own sentence.
      text: text(entry, 'text'),
      actorType: text(entry, 'actor_type'),
      messageType: text(entry, 'message_type'),
    })),
    assumed: entries(raw.assumed).map((entry) => ({
      assumptionId: text(entry, 'assumption_id'),
      subject: text(entry, 'subject'),
      assumedValue: text(entry, 'assumed_value'),
      reason: text(entry, 'reason'),
      origin: text(entry, 'origin'),
      consequence: text(entry, 'consequence'),
      state: text(entry, 'state'),
      // Absent reads as *not* reversible and *not* material — the reading that
      // costs a person attention rather than the one that costs them a
      // decision they did not know they were making.
      reversible: entry.reversible === true,
      material: entry.material === true,
      acceptedBy: typeof entry.accepted_by === 'string' ? entry.accepted_by : null,
      disclosure: text(entry, 'disclosure'),
    })),
    materialUnknowns: unknowns(raw.materialUnknowns),
    deferrableUnknowns: unknowns(raw.deferrableUnknowns),
    warnings: [...raw.warnings],
  }
}

/**
 * Memory's knowledge kind → what this interface calls the record's type.
 *
 * The distinction was being thrown away: every derived item arrived as
 * `functional`, so a persona, a performance target and a question the model
 * could not answer all rendered as "proposed functional requirement". The page
 * then asked the reader to reclassify each row before acting on any of it.
 *
 * Memory already types these correctly. Nothing here decides anything — it
 * translates a vocabulary the product owns into one the page can label.
 */
const CATEGORY_FOR_KIND: Record<string, Requirement['category']> = {
  requirement: 'functional',
  goal: 'functional',
  rule: 'business_rule',
  constraint: 'constraint',
  actor: 'user_need',
  decision: 'decision',
  assumption: 'assumption',
  unknown: 'open_question',
}

/** Memory's knowledge kinds, in words a reader of the review page can use. */
const KIND_LABEL: Record<string, string> = {
  goal: 'a goal',
  rule: 'a rule',
  actor: 'an actor',
  constraint: 'a constraint',
  entity: 'an entity',
  unknown: 'a material unknown',
}

/**
 * Acknowledge a write with whatever revision the response actually carried.
 *
 * This returned a hard-coded `{accepted: true, memoryRevision: 0}` and threw
 * the response body away, so every write claimed revision zero (AUD-014). The
 * writes themselves were real — this was a fabricated *envelope*, not fabricated
 * persistence — but a caller reading the number had no way to know it was
 * invented.
 */
function accepted(response?: unknown): MemoryWriteResult {
  const body = (response ?? {}) as Record<string, unknown>
  const revision = body.knowledge_revision ?? body.memory_revision ?? body.revision
  return {
    accepted: true,
    memoryRevision: typeof revision === 'number' ? revision : null,
  }
}

/** Memory's deliverable, as it arrives. Snake case, and its own vocabulary. */
interface WireDeliverable {
  deliverable_id: string
  purpose: string
  scope: string
  module: string | null
  state: string
  knowledge_revision: number
  content_hash: string
  stale: boolean
  artifacts: { logical_path?: string; path?: string }[]
  source_knowledge: string[]
  manifest: Record<string, unknown>
  recorded_by: string | null
  superseded_by: string | null
}

/**
 * Memory's deliverable states are not Studio's, and pretending otherwise crashed.
 *
 * `AUD-023`. This was the one adapter method in the file with no mapping —
 * `return items as Deliverable[]` — while every other Memory and Artifacts
 * payload gets an explicit snake→camel mapper. The cast produced objects whose
 * `state` was `recorded`, `superseded` or `withdrawn`, and `Deliverables.tsx`
 * looks that up in a `STATE_META` keyed on `not_generated`, `generated`,
 * `reviewed`, `published`, `outdated`. Every one missed, `meta.label` threw, and
 * the page died in `RouteError` — for any project that actually held one.
 *
 * The audit classified this `I` because nobody had run it against such a
 * project. It is a crash.
 *
 * The states mean different things and the mapping says which. Memory records
 * that an output *existed*; it deliberately performs no rendering or
 * publication, so nothing it returns can mean `published`.
 */
const DELIVERABLE_STATE: Record<string, Deliverable['state']> = {
  recorded: 'generated',
  superseded: 'outdated',
  withdrawn: 'outdated',
}

function deliverable(wire: WireDeliverable): Deliverable {
  return {
    id: wire.deliverable_id,
    name: wire.purpose,
    description: '',
    // Memory scopes a deliverable to a module by naming one, not by a keyword.
    scope: wire.module ? 'module' : 'project',
    moduleId: wire.module ?? undefined,
    // `stale` outranks the recorded state: an output whose knowledge has moved
    // on is outdated whatever it was recorded as.
    state: wire.stale ? 'outdated' : (DELIVERABLE_STATE[wire.state] ?? 'not_generated'),
    sourceMemoryRevision: wire.knowledge_revision,
    contentHash: wire.content_hash,
    includes: wire.artifacts.map((a) => a.logical_path ?? a.path ?? '').filter(Boolean),
    files: [],
    // Memory returns the ids it pinned; the questions themselves live elsewhere.
    unresolvedDecisionIds: [],
    generatedAt: undefined,
  }
}

export function createLiveServices(projectIdOverride?: string): StudioServices {
  const resolve = (given: string) => projectIdOverride ?? given

  const memory: ProjectMemoryClient = {
    listProjects: () => call<Project[]>('/api/projects'),
    getProject: (id) => call<Project>(`/api/projects/${resolve(id)}`),

    listMessages: async (id) => {
      const raw = await call<
        {
          id: string
          content: string
          actor_type: string
          created_at: string
          metadata?: {
            skill?: string
            subject?: string
            provenance?: string[]
            next_action?: { kind: string; label: string; reason: string }[]
            concluded?: {
              statement: string
              consequence: string
              revisit_when: string
              material: boolean
            }[]
            recommendation?: { advice: string; reason: string; consequence: string } | null
          }
        }[]
      >(`/api/projects/${resolve(id)}/messages`)
      return raw.map((m) => ({
        id: m.id,
        author: m.actor_type === 'user' ? 'user' : 'assistant',
        body: m.content,
        createdAt: m.created_at,
        // Read back from Memory, so it is durable by definition. A message the
        // browser can see here is one Memory already accepted.
        syncState: 'acknowledged',
        // And so is what the turn reflected and recommended. Both were reasoned
        // once from that turn's projection; before this they lived only in the
        // reply, so a refresh either lost them or would have had to pay a model
        // call to decide them again.
        provenance: m.metadata?.provenance ?? [],
        nextAction: m.metadata?.next_action ?? [],
        // Rebuilt too. Both were persisted or persistable and neither was read
        // back, so a refresh silently erased every recorded conclusion and
        // every advice card from the transcript (AUD-013) — while the
        // provenance beside them survived, which made the loss look deliberate.
        concluded: (m.metadata?.concluded ?? []).map((c) => ({
          statement: c.statement,
          consequence: c.consequence,
          revisitWhen: c.revisit_when,
          material: c.material,
        })),
        recommendation: m.metadata?.recommendation ?? null,
        // Rebuilt from metadata, so every turn can explain itself rather than
        // only the most recent one. Absent for messages recorded before this
        // existed, and for anything a person wrote.
        understanding: m.metadata?.skill
          ? {
              heading: 'How this reply was produced',
              points: [
                `Interviewing skill: ${m.metadata.skill}`,
                ...(m.metadata.subject ? [`Subject: ${m.metadata.subject}`] : []),
              ],
            }
          : undefined,
      })) as ConversationMessage[]
    },

    // Records only. The reply is `interview.respondTo`, and the hook calls
    // both — when this also produced a turn, every user message was written to
    // Memory twice.
    submitMessage: async (id, body) => {
      await call(`/api/projects/${resolve(id)}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      })
      const message: ConversationMessage = {
        id: `local-${Date.now()}`,
        author: 'user',
        body,
        createdAt: new Date().toISOString(),
        syncState: 'acknowledged',
      }
      return { message, result: accepted() }
    },

    getInterviewSession: async (id) => {
      const raw = await call<BackendProjection>(`/api/projects/${resolve(id)}/projection`)
      // Answered and deferred are different dispositions and were being
      // conflated: everything not `open` counted as answered, and the deferred
      // counter was a hardcoded `0` beside a "Decide later" button that writes
      // a durable `deferred` disposition. So the count never moved no matter
      // how many times somebody used the control next to it.
      const deferred = raw.openQuestions.filter((q) => q.disposition === 'deferred').length
      const answered = raw.openQuestions.filter(
        (q) => q.disposition !== 'open' && q.disposition !== 'deferred',
      ).length
      return {
        interviewType: 'Clarification queue',
        objective: 'Resolve the gaps this project actually has.',
        questionsAsked: raw.openQuestions.length,
        questionsAnswered: answered,
        questionsDeferred: deferred,
      } as InterviewSession
    },

    recordModuleDecision: async (_id, _moduleId, _decision: ModuleDecision) => {
      throw new CapabilityUnavailable(
        'modules',
        'KAE-Memory exposes modules over MCP only. Studio curation is a separate contract, not yet reconciled (N12).',
      )
    },

    deferDecision: async (id, decisionId, deferred) => {
      const answered = await call(
        `/api/projects/${resolve(id)}/clarifications/${decisionId}/answer`,
        {
          method: 'POST',
          body: JSON.stringify({
            answer: deferred ? 'Deferred from Studio.' : 'Reopened from Studio.',
            // A deferral records that someone was asked and did not decide. It
            // must not close the question (N36).
            //
            // `open`, not `answered`, on the way back. `answered` is in SETTLES,
            // so "Bring back" closed the question it was bringing back — the
            // exact opposite of the button's own label, and silent because a
            // settled question simply stops appearing.
            disposition: deferred ? 'deferred' : 'open',
          }),
        },
      )
      return accepted(answered)
    },

    knowledgeTrace: (id, knowledgeId) =>
      call(`/api/projects/${resolve(id)}/knowledge/${knowledgeId}/trace`),

    confirmFinding: async (id, findingId) => {
      const body = await call(`/api/projects/${resolve(id)}/knowledge/${findingId}/confirm`, {
        method: 'POST',
      })
      return accepted(body)
    },

    rejectFinding: async (id, findingId, reason, expectedVersion) => {
      const rejected = await call(`/api/projects/${resolve(id)}/knowledge/${findingId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason, expected_version: expectedVersion }),
      })
      return accepted(rejected)
    },
  }

  const projection: ProjectProjectionService = {
    getProjection: async (id) =>
      toProjection(await call<BackendProjection>(`/api/projects/${resolve(id)}/projection`)),
    // 202. The backend derives the idempotency key from the knowledge
    // revision, so asking twice about unchanged knowledge returns the run that
    // already happened rather than buying a second model pass over every
    // statement.
    classify: async (id) => {
      await call(`/api/projects/${resolve(id)}/classify`, { method: 'POST', body: '{}' })
    },
  }

  const interview: InterviewProvider = {
    // Named honestly in the status bar. This is Memory's clarification queue,
    // not an acquisition intelligence, and a UI that implied otherwise would be
    // overstating what the deployment can do.
    describe: () => ({ name: 'CIE', mode: 'live' }),
    respondTo: async (projectId, body): Promise<InterviewTurn> => {
      // The message goes with the turn now. CIE records it as evidence itself,
      // before reading anything — so a provider failure mid-turn still leaves
      // what the person said durable.
      const result = await call<{
        move: string
        skill: string
        subject: string
        provenance?: string[]
        next_action?: { kind: string; label: string; reason: string }[]
        recommendation?: { advice: string; reason: string; consequence: string } | null
        concluded?: {
          statement: string
          consequence: string
          revisit_when: string
          material: boolean
        }[]
        source: string
      }>(`/api/projects/${resolve(projectId)}/turn`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      })
      const session = await memory.getInterviewSession(projectId)
      return {
        assistantMessage: {
          id: `turn-${Date.now()}`,
          author: 'assistant',
          body: result.move,
          createdAt: new Date().toISOString(),
          syncState: 'acknowledged',
          // Diagnostic, not decoration: which interviewing skill produced this
          // turn is what makes it reviewable afterwards.
          understanding: {
            heading: 'How this reply was produced',
            points: [
              `Interviewing skill: ${result.skill}`,
              ...(result.subject ? [`Subject: ${result.subject}`] : []),
            ],
          },
          // What agreeing with this turn would confirm. Carried through
          // untouched: the set is CIE's account of what it reflected, and an
          // interface that edited it would be changing what a person agrees to.
          provenance: result.provenance ?? [],
          // Carried, never re-ordered. The ranking is CIE's reasoning about
          // this turn; a client that sorted it would be ranking.
          nextAction: result.next_action ?? [],
          recommendation: result.recommendation ?? null,
          concluded: (result.concluded ?? []).map((c) => ({
            statement: c.statement,
            consequence: c.consequence,
            revisitWhen: c.revisit_when,
            material: c.material,
          })),
        } as ConversationMessage,
        session,
      }
    },
    decideRecommendation: async (projectId, decision) => {
      await call(`/api/projects/${resolve(projectId)}/recommendations`, {
        method: 'POST',
        body: JSON.stringify({
          disposition: decision.disposition,
          advice: decision.advice,
          reason: decision.reason,
          consequence: decision.consequence,
          subject: decision.subject ?? '',
          modified_to: decision.modifiedTo ?? '',
        }),
      })
    },
    confirmReading: async (projectId, knowledgeIds) => {
      await call(`/api/projects/${resolve(projectId)}/knowledge/confirm`, {
        method: 'POST',
        body: JSON.stringify({ knowledge_ids: knowledgeIds }),
      })
    },
  }

  const artifacts: ArtifactService = {
    listDeliverables: async (id) => {
      const raw = await call<{ results?: WireDeliverable[] } | WireDeliverable[]>(
        `/api/projects/${resolve(id)}/deliverables`,
      )
      const items = Array.isArray(raw) ? raw : (raw.results ?? [])
      return items.map(deliverable)
    },
  }

  const pipeline: ArtifactPipeline = {
    listProfiles: async () => {
      const body = await callArtifacts<{ profiles: WireProfile[] }>('/api/artifact-profiles')
      return body.profiles.map((p) => ({
        id: p.id,
        artifactCount: p.artifact_count,
        artifacts: p.artifacts.map((a) => ({
          type: a.type,
          defaultPath: a.default_path,
          purpose: a.purpose,
          inputs: a.inputs,
        })),
      }))
    },

    listPublishers: async () => {
      const body = await callArtifacts<{ publishers: WirePublisher[] }>('/api/artifact-publishers')
      return body.publishers.map((p) => ({
        type: p.type,
        available: p.available,
        reason: p.reason ?? '',
      }))
    },

    createPlan: async (id, profile) =>
      plan(
        await callArtifacts<WirePlan>(`/api/projects/${resolve(id)}/artifact-plans`, {
          method: 'POST',
          body: JSON.stringify({ profile }),
        }),
      ),

    getPlan: async (planId) => plan(await callArtifacts<WirePlan>(`/api/artifact-plans/${planId}`)),

    editPlan: async (planId, edits) =>
      plan(
        await callArtifacts<WirePlan>(`/api/artifact-plans/${planId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            edits: edits.map((e) => ({
              type: e.type,
              // Only send what changed. A `null` would read as "clear this",
              // and clearing a logical path is not an edit anyone means.
              ...(e.logicalPath !== undefined ? { logical_path: e.logicalPath } : {}),
              ...(e.selected !== undefined ? { selected: e.selected } : {}),
              ...(e.options !== undefined ? { options: e.options } : {}),
            })),
          }),
        }),
      ),

    generate: async (id, planId, idempotencyKey) => {
      const run = await callArtifacts<WireRun>(`/api/projects/${resolve(id)}/generation-runs`, {
        method: 'POST',
        body: JSON.stringify({ plan_id: planId, idempotency_key: idempotencyKey }),
      })
      return {
        runId: run.run_id,
        status: run.status,
        inputRevision: run.input_revision,
        artifactIds: run.artifact_ids,
        packageId: run.package_id,
        errorCode: run.error_code,
        errorMessage: run.error_message,
      }
    },

    getPackage: async (packageId) => {
      const body = await callArtifacts<WirePackage>(`/api/artifact-packages/${packageId}`)
      return {
        packageId: body.package_id,
        subjectId: body.subject_id,
        inputRevision: body.input_revision,
        runId: body.run_id,
        packageChecksum: body.package_checksum,
        manifestVersion: body.manifest_version,
        createdAt: body.created_at,
        artifacts: body.artifacts.map((a) => ({
          artifactId: a.artifact_id,
          type: a.type,
          logicalPath: a.logical_path,
          checksum: a.checksum,
          sizeBytes: a.size_bytes,
          generatorVersion: a.generator_version,
        })),
      }
    },

    getArtifact: async (artifactId) => {
      const body = await callArtifacts<WireArtifact>(`/api/artifacts/${artifactId}`)
      return {
        artifactId: body.artifact_id,
        type: body.type,
        logicalPath: body.logical_path,
        mediaType: body.media_type,
        checksum: body.checksum,
        sizeBytes: body.size_bytes,
        inputRevision: body.input_revision,
        generatorVersion: body.generator_version,
        content: body.content,
      }
    },

    validate: async (packageId) =>
      callArtifacts<ValidationResult>(`/api/artifact-packages/${packageId}/validation`, {
        method: 'POST',
      }),

    preview: async (packageId, destination) =>
      preview(
        await callArtifacts<WirePreview>('/api/artifact-previews', {
          method: 'POST',
          body: JSON.stringify({
            package_id: packageId,
            destination: wireDestination(destination),
          }),
        }),
      ),

    approve: async (previewId) => {
      const body = await callArtifacts<WireApproval>('/api/artifact-approvals', {
        method: 'POST',
        body: JSON.stringify({ preview_id: previewId }),
      })
      return {
        approvalId: body.approval_id,
        packageId: body.package_id,
        packageChecksum: body.package_checksum,
        previewId: body.preview_id,
        previewChecksum: body.preview_checksum,
        destination: destination(body.destination),
        baseToken: body.base_token,
        approverRef: body.approver_ref,
        approvedAt: body.approved_at,
        expiresAt: body.expires_at,
        policyVersion: body.policy_version,
      }
    },

    publish: async (input) =>
      publication(
        await callArtifacts<WirePublication>('/api/artifact-publications', {
          method: 'POST',
          body: JSON.stringify({
            package_id: input.packageId,
            destination: wireDestination(input.destination),
            approval_id: input.approvalId,
            idempotency_key: input.idempotencyKey,
          }),
        }),
      ),

    getPublication: async (publicationId) =>
      publication(
        await callArtifacts<WirePublication>(`/api/artifact-publications/${publicationId}`),
      ),

    getProvenance: async (publicationId) =>
      callArtifacts<Record<string, unknown>>(
        `/api/artifact-publications/${publicationId}/provenance`,
      ),
  }

  /* ------------------------------------------------------------------ setup */

  /** Shapes as KAE-Memory sends them, mapped once here rather than at each reader. */
  interface WireConfigured {
    value: string
    state: string
    in_use: boolean
    evidence: string
    confirmed_by: string | null
  }
  interface WireTarget {
    target_id: string
    name: string
    provider: string
    purpose: string
    is_default: boolean
    enabled: boolean
    available: boolean
    unavailable_reason: string | null
    authorization: string
    configuration: Record<string, string>
  }
  interface WireConnectionRecord {
    connection_id: string
    provider: string
    state: string
    credential_reference: string | null
    authorized_by: string | null
    last_verified_at: string | null
    detail: string
  }
  interface WireSetup {
    project_id: string
    setup_state: string
    blocks_anything: boolean
    gaps: SetupGap[]
    configuration: Record<string, WireConfigured>
    unknown_fields: string[]
    targets: WireTarget[]
  }

  const target = (raw: WireTarget): PublicationTarget => ({
    targetId: raw.target_id,
    name: raw.name,
    provider: raw.provider,
    purpose: raw.purpose,
    isDefault: raw.is_default,
    enabled: raw.enabled,
    available: raw.available,
    // Carried, never derived from `available`. Three states with three
    // remedies, and a boolean cannot say which.
    unavailableReason: raw.unavailable_reason,
    authorization: raw.authorization,
    configuration: raw.configuration ?? {},
  })

  const memoryConnection = (raw: WireConnectionRecord): MemoryConnection => ({
    connectionId: raw.connection_id,
    provider: raw.provider,
    state: raw.state,
    credentialReference: raw.credential_reference,
    authorizedBy: raw.authorized_by,
    lastVerifiedAt: raw.last_verified_at,
    detail: raw.detail,
  })

  const setupState = (raw: WireSetup): SetupState => ({
    projectId: raw.project_id,
    setupState: raw.setup_state,
    blocksAnything: raw.blocks_anything,
    gaps: raw.gaps ?? [],
    configuration: raw.configuration ?? {},
    unknownFields: raw.unknown_fields ?? [],
    targets: (raw.targets ?? []).map(target),
  })

  const setup: SetupPort = {
    getSetup: async (id) => setupState(await call<WireSetup>(`/api/projects/${resolve(id)}/setup`)),

    configure: async (id, field, value, options) =>
      setupState(
        await call<WireSetup>(`/api/projects/${resolve(id)}/setup/configuration`, {
          method: 'POST',
          body: JSON.stringify({
            field,
            value,
            state: options?.state ?? 'confirmed',
            evidence: options?.evidence ?? '',
          }),
        }),
      ),

    registerTarget: async (id, input) =>
      target(
        await call<WireTarget>(`/api/projects/${resolve(id)}/publication-targets`, {
          method: 'POST',
          body: JSON.stringify({
            provider: input.provider ?? 'github',
            name: input.name,
            configuration: input.configuration,
            connection_id: input.connectionId ?? null,
            make_default: input.makeDefault ?? false,
          }),
        }),
      ),

    setDefaultTarget: async (id, targetId) =>
      target(
        await call<WireTarget>(`/api/projects/${resolve(id)}/publication-targets/default`, {
          method: 'POST',
          body: JSON.stringify({ target_id: targetId }),
        }),
      ),

    listConnections: async (id) => {
      const body = await call<{ results: WireConnectionRecord[] }>(
        `/api/projects/${resolve(id)}/memory-connections`,
      )
      return (body.results ?? []).map(memoryConnection)
    },

    recordConnection: async (id, input) =>
      memoryConnection(
        await call<WireConnectionRecord>(`/api/projects/${resolve(id)}/memory-connections`, {
          method: 'POST',
          body: JSON.stringify({
            provider: input.provider ?? 'github',
            // A reference, never a secret. Memory refuses anything that looks
            // like one, so a pasted token is rejected rather than stored.
            credential_reference: input.credentialReference,
            detail: input.detail ?? '',
          }),
        }),
      ),

    authorizeConnection: async (id, connectionId) =>
      memoryConnection(
        await call<WireConnectionRecord>(
          `/api/projects/${resolve(id)}/memory-connections/${connectionId}/authorization`,
          { method: 'POST', body: '{}' },
        ),
      ),
  }

  /* -------------------------------------------------------------- ingestion */

  interface WireIngest {
    document: string
    chunks?: unknown[]
    chunks_created?: number
    truncated_chunks?: number
    warnings?: string[]
  }
  /** Named apart from the module-level `WireRun`, which is a generation run.
   *  Declaring a second `WireRun` in this function shadowed it for the whole
   *  scope, silently retyping the generation-run call above. */
  interface WireAgentRun {
    id: string
    role: string
    status: string
    attempt_number: number
    error_code: string | null
    error_message: string | null
    started_at: string | null
    completed_at: string | null
    output_summary: Record<string, unknown>
  }

  const ingestion: IngestionPort = {
    ingestText: async (id, document) => {
      const raw = await call<WireIngest>(`/api/projects/${resolve(id)}/documents`, {
        method: 'POST',
        body: JSON.stringify({ title: document.title, text: document.text }),
      })
      return {
        document: raw.document ?? document.title,
        // Memory reports the chunks it made either as a list or a count
        // depending on the route's age. Both are read; neither is invented.
        chunks: Array.isArray(raw.chunks) ? raw.chunks.length : (raw.chunks_created ?? 0),
        // `?? 0` is a real zero here, not a fallback: Memory always sends this
        // field, and a document that dropped nothing dropped nothing.
        truncatedChunks: raw.truncated_chunks ?? 0,
        // Verbatim. These are the sentences that say what was not read.
        warnings: raw.warnings ?? [],
      }
    },

    coverage: async (id) =>
      call<ExtractionCoverage>(`/api/projects/${resolve(id)}/extraction-coverage`),

    runs: async (id) => {
      const raw = await call<WireAgentRun[]>(`/api/projects/${resolve(id)}/runs`)
      return raw.map((run) => ({
        id: run.id,
        role: run.role,
        status: run.status,
        attemptNumber: run.attempt_number,
        errorCode: run.error_code,
        // Carried, never summarised. A summarised error is one a person cannot
        // search for, and the summary is written by whoever knows least.
        errorMessage: run.error_message,
        startedAt: run.started_at,
        completedAt: run.completed_at,
        outputSummary: run.output_summary ?? {},
      }))
    },
  }

  const acquisition: AcquisitionPort = {
    installations: async () => {
      const body = await call<{
        installations: { installation_id: number; account: string; repository_selection: string }[]
        unavailable_reason: string
        selected: string
      }>('/api/github/installations')
      return {
        installations: (body.installations ?? []).map((row) => ({
          installationId: row.installation_id,
          account: row.account,
          repositorySelection: row.repository_selection,
        })),
        unavailableReason: body.unavailable_reason ?? '',
        selected: body.selected ?? '',
      }
    },
    cloneRepository: async (fullName) => {
      const body = await callArtifacts<{ location: string; kind: string }>(
        '/api/repositories/clone',
        { method: 'POST', body: JSON.stringify({ full_name: fullName }) },
      )
      return { location: body.location, kind: body.kind ?? 'local' }
    },
    availableRepositories: async (query) => {
      const body = await callArtifacts<{
        repositories: {
          full_name: string
          default_branch: string
          private: boolean
          description: string
          updated_at: string
          kind?: string
        }[]
        truncated: boolean
        unavailable_reason: string
      }>(`/api/repositories${query ? `?q=${encodeURIComponent(query)}` : ''}`)
      return {
        repositories: (body.repositories ?? []).map((repo) => ({
          // Carried, not dropped. `D-68` put `kind` on every entry so a reader
          // could tell `owner/name` from an absolute path — and the adapter
          // discarded it, so the picker showed both with no way to tell which
          // was which. Nothing consumed it, which is why nobody noticed.
          kind: repo.kind === 'local' ? ('local' as const) : ('github' as const),
          fullName: repo.full_name,
          defaultBranch: repo.default_branch,
          private: repo.private,
          description: repo.description,
          updatedAt: repo.updated_at,
        })),
        truncated: body.truncated,
        // Carried, never turned into an empty list. The two reasons a listing
        // is empty have opposite remedies.
        unavailableReason: body.unavailable_reason ?? '',
      }
    },

    listConnections: async () => {
      const body = await callArtifacts<{ connections: WireConnection[] }>('/api/connections')
      return body.connections.map(connection)
    },

    addConnection: async (input) =>
      connection(
        await callArtifacts<WireConnection>('/api/connections', {
          method: 'POST',
          body: JSON.stringify({
            provider: input.provider,
            label: input.label,
            connection_ref: input.connectionRef,
          }),
        }),
      ),

    checkConnectivity: async (connectionId, location) => {
      const body = await callArtifacts<WireConnectivity>('/api/connectivity-checks', {
        method: 'POST',
        body: JSON.stringify({ connection_id: connectionId, location }),
      })
      return {
        ok: body.ok,
        provider: body.provider,
        account: body.account,
        canRead: body.can_read,
        canWrite: body.can_write,
        detail: body.detail,
        checkedAt: body.checked_at,
        proves: body.proves,
      }
    },

    listFiles: async (sourceId, limit = 50) => {
      const raw = await call<{
        files: { path: string; size: number }[]
        truncated: boolean
      }>(`/api/sources/${sourceId}/files?limit=${limit}`)
      return { files: raw.files ?? [], truncated: Boolean(raw.truncated) }
    },

    sample: async (sourceId, path) =>
      callArtifacts<FileExcerpt>(`/api/sources/${sourceId}/sample`, {
        method: 'POST',
        body: JSON.stringify({ path }),
      }),

    ingestFiles: async (sourceId, projectId, paths) => {
      const raw = await call<{
        revision: string
        ingested: { path: string; ingested: Record<string, unknown> }[]
        proves: string
      }>(`/api/sources/${sourceId}/ingest`, {
        method: 'POST',
        body: JSON.stringify({ project_id: resolve(projectId), paths }),
      })
      return { revision: raw.revision, ingested: raw.ingested ?? [], proves: raw.proves }
    },

    listSources: async (id) => {
      const body = await callArtifacts<{ sources: WireSource[]; unavailable?: string }>(
        `/api/projects/${resolve(id)}/sources`,
      )
      return {
        sources: body.sources.map(projectSource),
        // Absent on a backend older than the durable record, and that reads as
        // "nothing was missing" — which is what was true then.
        unavailable: typeof body.unavailable === 'string' ? body.unavailable : '',
      }
    },

    addSource: async (id, input) =>
      projectSource(
        await callArtifacts<WireSource>(`/api/projects/${resolve(id)}/sources`, {
          method: 'POST',
          body: JSON.stringify({
            kind: input.kind,
            connection_id: input.connectionId,
            location: input.location,
            reference: input.reference,
          }),
        }),
      ),

    pinSource: async (sourceId) =>
      projectSource(
        await callArtifacts<WireSource>(`/api/sources/${sourceId}/pin`, { method: 'POST' }),
      ),
  }

  return {
    projectId: projectIdOverride ?? '',
    memory,
    interview,
    projection,
    artifacts,
    pipeline,
    acquisition,
    setup,
    ingestion,
  }
}
