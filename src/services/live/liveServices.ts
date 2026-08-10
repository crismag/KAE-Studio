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
  InterviewSession,
  Project,
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
  ProjectProjectionService,
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
}

/** Shape of the backend's projection. Deliberately not the UI's own type. */
interface BackendProjection {
  project: { id: string; name: string; phase: string; memoryRevision: number; createdAt: string }
  confirmed: BackendStatement[]
  proposed: BackendStatement[]
  rejected: BackendStatement[]
  health: {
    percentage: number
    advisory: boolean
    status: string
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
  openQuestions: { id: string; question: string; severity: string; disposition: string }[]
  blockers: unknown[]
  contradictions: { count: number; listable: boolean; reason: string }
  preliminary: { warnings: string[]; materialUnknowns: unknown[] }
  modules: { available: boolean; gap: { capability: string; reason: string } }
  unavailable: { section: string; reason: string }[]
}

export function toProjection(raw: BackendProjection): ProjectProjection {
  // Rejected last: the list reads top-down from settled, to open, to declined,
  // and a decision already taken should not sit above one still waiting.
  const statements = [...raw.confirmed, ...raw.proposed, ...(raw.rejected ?? [])]

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
      // Unrecognised kinds land in `functional` rather than being dropped: a
      // new Memory kind should look mislabelled, not disappear.
      category: CATEGORY_FOR_KIND[s.kind] ?? 'functional',
      statement: s.text,
      // `validated` is Memory's word for confirmed by a person. Anything else
      // is a candidate, and the distinction must survive into the UI.
      status: (s.lifecycle === 'validated'
        ? 'confirmed'
        : s.lifecycle === 'rejected'
          ? 'rejected'
          : 'proposed') as never,
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
      whyItMatters: `Severity: ${q.severity}`,
      blocks: [],
      suggestedOwner: 'you',
      deferred: q.disposition !== 'open',
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
      severity: (s.kind === 'unknown' ? 'major' : 'minor') as never,
      summary: s.text,
      detail:
        s.kind === 'unknown'
          ? 'Recorded as a material unknown: the model could not determine this and did not guess.'
          : `Derived from conversation as ${KIND_LABEL[s.kind] ?? s.kind}. Proposed, not confirmed.`,
      subjectIds: [s.kind, `v${s.version}`],
    })),
    health: {
      phase: raw.project.phase,
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
        state: (a.state === 'satisfied'
          ? 'strong'
          : a.state === 'partial'
            ? 'forming'
            : a.proposed > 0
              ? 'thin'
              : 'missing') as never,
        detail:
          a.state === 'satisfied'
            ? `${a.confirmed} confirmed — enough for now`
            : a.proposed > 0
              ? `${a.confirmed} of ${a.required} confirmed · ${a.proposed} awaiting review`
              : `${a.confirmed} of ${a.required} confirmed`,
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
    modulesGap: raw.modules.available
      ? null
      : {
          capability: raw.modules.gap.capability,
          reason: raw.modules.gap.reason,
          state: 'planned',
          provedInstead: [],
        },
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

function accepted(memoryRevision = 0): MemoryWriteResult {
  return { accepted: true, memoryRevision }
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
      const answered = raw.openQuestions.filter((q) => q.disposition !== 'open').length
      return {
        interviewType: 'Clarification queue',
        objective: 'Resolve the gaps this project actually has.',
        questionsAsked: raw.openQuestions.length,
        questionsAnswered: answered,
        questionsDeferred: 0,
      } as InterviewSession
    },

    recordModuleDecision: async (_id, _moduleId, _decision: ModuleDecision) => {
      throw new CapabilityUnavailable(
        'modules',
        'KAE-Memory exposes modules over MCP only. Studio curation is a separate contract, not yet reconciled (N12).',
      )
    },

    deferDecision: async (id, decisionId, deferred) => {
      await call(`/api/projects/${resolve(id)}/clarifications/${decisionId}/answer`, {
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
      })
      return accepted()
    },

    knowledgeTrace: (id, knowledgeId) =>
      call(`/api/projects/${resolve(id)}/knowledge/${knowledgeId}/trace`),

    confirmFinding: async (id, findingId) => {
      await call(`/api/projects/${resolve(id)}/knowledge/${findingId}/confirm`, { method: 'POST' })
      return accepted()
    },

    rejectFinding: async (id, findingId, reason, expectedVersion) => {
      await call(`/api/projects/${resolve(id)}/knowledge/${findingId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason, expected_version: expectedVersion }),
      })
      return accepted()
    },
  }

  const projection: ProjectProjectionService = {
    getProjection: async (id) =>
      toProjection(await call<BackendProjection>(`/api/projects/${resolve(id)}/projection`)),
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
      const raw = await call<{ results?: unknown[] } | unknown[]>(
        `/api/projects/${resolve(id)}/deliverables`,
      )
      const items = Array.isArray(raw) ? raw : (raw.results ?? [])
      return items as Deliverable[]
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

  const acquisition: AcquisitionPort = {
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

    listSources: async (id) => {
      const body = await callArtifacts<{ sources: WireSource[] }>(
        `/api/projects/${resolve(id)}/sources`,
      )
      return body.sources.map(projectSource)
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
  }
}
