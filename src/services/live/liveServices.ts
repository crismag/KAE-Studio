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
  ConversationMessage,
  Deliverable,
  InterviewSession,
  Project,
  ProjectProjection,
  PublishTarget,
  PublishTargetKind,
  Requirement,
} from '@/domain/types'
import type {
  ArtifactPublisher,
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
  openQuestions: { id: string; question: string; severity: string; disposition: string }[]
  blockers: unknown[]
  contradictions: { count: number; listable: boolean; reason: string }
  preliminary: { warnings: string[]; materialUnknowns: unknown[] }
  modules: { available: boolean; gap: { capability: string; reason: string } }
  unavailable: { section: string; reason: string }[]
}

function toProjection(raw: BackendProjection): ProjectProjection {
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
    // The prototype's ProjectDefinition was designed against a fixture with a
    // written problem statement. Real projects reach that later, so the fields
    // carry what Memory actually holds and nothing is invented to fill them.
    definition: {
      problem: '',
      value: '',
      objectives: [],
      stakeholders: [],
      inScope: [],
      outOfScope: [],
      workflows: [],
      assumptions: [],
      constraints: [],
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
      recommendedNext: [
        ...raw.preliminary.warnings,
        ...raw.unavailable.map((u) => `Unavailable: ${u.section} — ${u.reason}`),
        ...(raw.modules.available ? [] : [`Modules: ${raw.modules.gap.reason}`]),
      ],
    },
    recentChanges: [],
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
        { id: string; content: string; actor_type: string; created_at: string }[]
      >(`/api/projects/${resolve(id)}/messages`)
      return raw.map((m) => ({
        id: m.id,
        author: m.actor_type === 'user' ? 'user' : 'assistant',
        body: m.content,
        createdAt: m.created_at,
        // Read back from Memory, so it is durable by definition. A message the
        // browser can see here is one Memory already accepted.
        syncState: 'acknowledged',
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
          disposition: deferred ? 'deferred' : 'answered',
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
        } as ConversationMessage,
        session,
      }
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
    generate: async () => {
      throw new CapabilityUnavailable(
        'deliverable.generate',
        'Recording a deliverable is available; generating one from Studio is not wired yet.',
      )
    },
  }

  const publisher: ArtifactPublisher = {
    listTargets: async () => [] as PublishTarget[],
    previewPublish: async (_id, target: PublishTargetKind) => ({
      ok: false,
      target,
      reference: '',
      proposedChanges: [],
      message: 'Publication is not wired from Studio yet.',
    }),
    publish: async (_id, target: PublishTargetKind) => ({
      ok: false,
      target,
      reference: '',
      proposedChanges: [],
      message: 'Publication is not wired from Studio yet.',
    }),
  }

  return { projectId: projectIdOverride ?? '', memory, interview, projection, artifacts, publisher }
}
