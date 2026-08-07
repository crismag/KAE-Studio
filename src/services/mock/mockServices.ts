/**
 * Deterministic mock adapters for every Studio service interface.
 *
 * PROTOTYPE ONLY. None of this talks to KAE-Memory, an AI provider, GitHub,
 * a filesystem, or S3. Every method resolves from the in-memory fixture after a
 * small artificial delay so that loading and pending states are exercised.
 *
 * Determinism: no Math.random, no Date.now-derived content. Ordering and
 * generated identifiers come from monotonic counters, so a given sequence of
 * interactions always produces the same result.
 */

import type {
  ConversationMessage,
  Deliverable,
  InterviewSession,
  ProjectModule,
  ProjectProjection,
  PublishTarget,
  PublishTargetKind,
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
  PublishOutcome,
  StudioServices,
} from '@/services/interfaces'
import * as fixture from './fixtures/ministryReporting'

const LATENCY_MS = 220

function delay<T>(value: T, ms = LATENCY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

/**
 * Mutable prototype state. This is UI state for a demo session, not a store:
 * it lives in memory, is discarded on reload, and is never authoritative.
 */
interface PrototypeState {
  messages: ConversationMessage[]
  modules: ProjectModule[]
  deliverables: Deliverable[]
  deferredDecisionIds: Set<string>
  confirmedFindingIds: Set<string>
  memoryRevision: number
  counter: number
}

function initialState(): PrototypeState {
  return {
    messages: fixture.messages.map((m) => ({ ...m })),
    modules: fixture.modules.map((m) => ({ ...m })),
    deliverables: fixture.deliverables.map((d) => ({ ...d })),
    deferredDecisionIds: new Set(fixture.openDecisions.filter((d) => d.deferred).map((d) => d.id)),
    confirmedFindingIds: new Set<string>(),
    memoryRevision: fixture.MEMORY_REVISION,
    counter: 0,
  }
}

const state: PrototypeState = initialState()

/** Test seam: restore the fixture between tests. */
export function resetPrototypeState(): void {
  Object.assign(state, initialState())
}

function nextId(prefix: string): string {
  state.counter += 1
  return `${prefix}-${String(state.counter).padStart(3, '0')}`
}

/**
 * Fixed clock. Timestamps advance deterministically from the last fixture
 * message so the transcript stays ordered without depending on wall time.
 */
let clockOffsetSeconds = 600
function nextTimestamp(): string {
  clockOffsetSeconds += 47
  return new Date(Date.parse('2026-07-28T09:18:52Z') + clockOffsetSeconds * 1000).toISOString()
}

/* ------------------------------------------------------- memory client mock */

class MockProjectMemoryClient implements ProjectMemoryClient {
  listProjects() {
    return delay([fixture.project])
  }

  getProject() {
    return delay({ ...fixture.project, memoryRevision: state.memoryRevision })
  }

  listMessages() {
    return delay(state.messages.map((m) => ({ ...m })))
  }

  async submitMessage(
    _projectId: string,
    body: string,
    idempotencyKey: string,
  ): Promise<{ message: ConversationMessage; result: MemoryWriteResult }> {
    // Idempotency is demonstrated, not merely claimed: resubmitting the same
    // key returns the existing message rather than creating a second one.
    const existing = state.messages.find((m) => m.id === idempotencyKey)
    if (existing) {
      return delay({
        message: { ...existing },
        result: { accepted: true, memoryRevision: state.memoryRevision },
      })
    }

    const message: ConversationMessage = {
      id: idempotencyKey,
      author: 'user',
      body,
      createdAt: nextTimestamp(),
      syncState: 'acknowledged',
    }
    state.messages.push(message)
    state.memoryRevision += 1
    return delay({
      message: { ...message },
      result: { accepted: true, memoryRevision: state.memoryRevision },
    })
  }

  getInterviewSession(): Promise<InterviewSession> {
    const answered = state.messages.filter((m) => m.author === 'user').length
    return delay({
      ...fixture.interviewSession,
      questionsAnswered: answered,
      questionsDeferred: state.deferredDecisionIds.size,
    })
  }

  async recordModuleDecision(
    _projectId: string,
    moduleId: string,
    decision: ModuleDecision,
  ): Promise<MemoryWriteResult> {
    const index = state.modules.findIndex((m) => m.id === moduleId)
    if (index === -1) {
      return delay({
        accepted: false,
        memoryRevision: state.memoryRevision,
        pendingReason: 'Unknown module',
      })
    }
    const target = state.modules[index]

    switch (decision.kind) {
      case 'accept':
        state.modules[index] = { ...target, proposalState: 'accepted' }
        break
      case 'reject':
        state.modules[index] = { ...target, proposalState: 'rejected' }
        break
      case 'rename':
        state.modules[index] = { ...target, name: decision.name }
        break
      case 'split': {
        const [firstName, secondName] = decision.intoNames
        // Split semantics in the prototype are deliberately conservative: the
        // original module's requirements, interfaces, and data stay with the
        // first half and the second half starts empty, so nothing is silently
        // discarded. Real split semantics are an unresolved platform question
        // (MODULE_SPECIFICATION.md, minimum module capability contract #8).
        const first: ProjectModule = { ...target, name: firstName, proposalState: 'proposed' }
        const second: ProjectModule = {
          ...target,
          id: nextId('MOD-NEW'),
          key: nextId('MOD-NEW'),
          name: secondName,
          proposalState: 'proposed',
          rationale: `Split from ${target.name}. Responsibilities not yet reassigned.`,
          responsibilities: [],
          requirementIds: [],
          businessRuleIds: [],
          interfaces: [],
          data: [],
          acceptanceTestIds: [],
          readiness: target.readiness.map((r) => ({
            dimension: r.dimension,
            value: 'incomplete' as const,
          })),
          implementationReady: false,
        }
        state.modules.splice(index, 1, first, second)
        break
      }
      case 'merge': {
        const otherIndex = state.modules.findIndex((m) => m.id === decision.withModuleId)
        if (otherIndex === -1) break
        const other = state.modules[otherIndex]
        const merged: ProjectModule = {
          ...target,
          name: decision.name,
          proposalState: 'proposed',
          rationale: `Merged from ${target.name} and ${other.name}.`,
          responsibilities: [...target.responsibilities, ...other.responsibilities],
          requirementIds: [...target.requirementIds, ...other.requirementIds],
          businessRuleIds: [...target.businessRuleIds, ...other.businessRuleIds],
          interfaces: [...target.interfaces, ...other.interfaces],
          data: [...target.data, ...other.data],
          dependencies: [...target.dependencies, ...other.dependencies].filter(
            (d) => d.moduleId !== target.id && d.moduleId !== other.id,
          ),
          acceptanceTestIds: [...target.acceptanceTestIds, ...other.acceptanceTestIds],
          openDecisionIds: [...target.openDecisionIds, ...other.openDecisionIds],
        }
        state.modules = state.modules.filter((m) => m.id !== other.id)
        const mergedIndex = state.modules.findIndex((m) => m.id === target.id)
        state.modules[mergedIndex] = merged
        break
      }
    }

    state.memoryRevision += 1
    // Any package generated from a superseded revision is now outdated.
    state.deliverables = state.deliverables.map((d) =>
      d.state === 'generated' || d.state === 'published' || d.state === 'reviewed'
        ? { ...d, state: 'outdated' }
        : d,
    )
    return delay({ accepted: true, memoryRevision: state.memoryRevision })
  }

  deferDecision(
    _projectId: string,
    decisionId: string,
    deferred: boolean,
  ): Promise<MemoryWriteResult> {
    if (deferred) state.deferredDecisionIds.add(decisionId)
    else state.deferredDecisionIds.delete(decisionId)
    state.memoryRevision += 1
    return delay({ accepted: true, memoryRevision: state.memoryRevision })
  }

  knowledgeTrace(_projectId: string, _knowledgeId: string) {
    return delay({ kind: 'rule', lifecycle: 'proposed', source_message_ids: ['fixture'] })
  }

  confirmFinding(_projectId: string, findingId: string): Promise<MemoryWriteResult> {
    state.confirmedFindingIds.add(findingId)
    state.memoryRevision += 1
    return delay({ accepted: true, memoryRevision: state.memoryRevision })
  }

  rejectFinding(
    _projectId: string,
    findingId: string,
    _reason: string,
    _expectedVersion: number,
  ): Promise<MemoryWriteResult> {
    state.confirmedFindingIds.delete(findingId)
    state.memoryRevision += 1
    return delay({ accepted: true, memoryRevision: state.memoryRevision })
  }
}

/* ---------------------------------------------------- interview provider mock */

/**
 * Scripted assistant. Replies are selected by turn index from a fixed script —
 * there is no model here and no attempt to appear as one. When the script is
 * exhausted it says so rather than improvising, because a prototype that
 * fabricates novel requirements would misrepresent what the product does.
 */
const SCRIPTED_TURNS: Omit<ConversationMessage, 'id' | 'createdAt' | 'syncState'>[] = [
  {
    author: 'assistant',
    body: "Noted. That resolves the readership question, and it also tells me the reader check is separate from the submitter check — I've kept them as two permissions rather than one role list.",
    understanding: {
      heading: 'What I understand',
      points: [
        'Readership is limited to named internal roles.',
        'Submission and readership are separate permission checks.',
      ],
    },
    question: 'Should a ministry leader be able to read another ministry’s published report?',
    suggestions: ['Yes, all published reports', 'Only their own ministry', 'Decide later'],
    resultingChanges: ['Updated FR-PUB-001', 'Added 1 acceptance test'],
  },
  {
    author: 'assistant',
    body: 'Recorded. I want to return to approval authority, because it now blocks three separate things: the authority-check interface, the security requirements for the approval module, and the dependency order for delivery.',
    understanding: {
      heading: 'What I understand',
      points: [
        'Report visibility is scoped by ministry.',
        'Approval authority remains the largest open question.',
      ],
    },
    question:
      'For approval authority — is it a named role such as pastor, a per-ministry assignment, or a small approvals group?',
    suggestions: ['A named role', 'Per-ministry assignment', 'An approvals group', 'Decide later'],
    resultingChanges: ['Raised OD-011 priority'],
  },
  {
    author: 'assistant',
    body: "Understood, and I'll leave it open rather than assume one. It stays visible in Reviews and in every generated package until it is decided, so nothing downstream treats it as settled.",
    understanding: {
      heading: 'What I understand',
      points: ['Approval authority is deliberately deferred, not forgotten.'],
    },
    question:
      'While that is open — should a rejected report keep its review comments visible to the submitter after resubmission?',
    suggestions: ['Keep the history', 'Clear on resubmission', 'Decide later'],
    resultingChanges: ['OD-011 marked deferred'],
  },
]

class MockInterviewProvider implements InterviewProvider {
  describe() {
    return { name: 'Scripted prototype responder', mode: 'mock' as const }
  }

  async respondTo(_projectId: string, _userMessage: string): Promise<InterviewTurn> {
    const assistantTurns = state.messages.filter((m) => m.author === 'assistant').length
    const scriptIndex =
      assistantTurns - fixture.messages.filter((m) => m.author === 'assistant').length

    const scripted = SCRIPTED_TURNS[scriptIndex]
    const message: ConversationMessage = scripted
      ? { ...scripted, id: nextId('msg'), createdAt: nextTimestamp(), syncState: 'acknowledged' }
      : {
          id: nextId('msg'),
          author: 'assistant',
          body: 'The prototype script ends here. In the product this turn would come from the configured AI provider, informed by the current project briefing from KAE-Memory. No response is being generated.',
          createdAt: nextTimestamp(),
          syncState: 'acknowledged',
        }

    state.messages.push(message)
    const session = await new MockProjectMemoryClient().getInterviewSession()
    return delay({ assistantMessage: { ...message }, session }, 700)
  }
}

/* --------------------------------------------------------- projection mock */

class MockProjectProjectionService implements ProjectProjectionService {
  getProjection(): Promise<ProjectProjection> {
    const openDecisions = fixture.openDecisions.map((d) => ({
      ...d,
      deferred: state.deferredDecisionIds.has(d.id),
    }))
    const findings = fixture.findings.filter((f) => !state.confirmedFindingIds.has(f.id))

    return delay({
      project: { ...fixture.project, memoryRevision: state.memoryRevision },
      definition: fixture.definition,
      requirements: fixture.requirements,
      acceptanceTests: fixture.acceptanceTests,
      modules: state.modules.map((m) => ({ ...m })),
      openDecisions,
      findings,
      health: fixture.health,
      recentChanges: fixture.recentChanges,
    })
  }
}

/* ----------------------------------------------------------- artifact mocks */

class MockArtifactService implements ArtifactService {
  listDeliverables(): Promise<Deliverable[]> {
    return delay(state.deliverables.map((d) => ({ ...d })))
  }

  async generate(_projectId: string, deliverableId: string): Promise<Deliverable> {
    const index = state.deliverables.findIndex((d) => d.id === deliverableId)
    if (index === -1) throw new Error(`Unknown deliverable: ${deliverableId}`)

    const existing = state.deliverables[index]
    const versionNumber = Number((existing.version ?? 'v0').replace('v', '')) + 1
    const generated: Deliverable = {
      ...existing,
      state: 'generated',
      version: `v${versionNumber}`,
      generatedAt: nextTimestamp(),
      sourceMemoryRevision: state.memoryRevision,
      contentHash: `sha256:${deliverableId.toLowerCase().slice(-4)}…${String(state.memoryRevision).padStart(4, '0')}`,
    }
    state.deliverables[index] = generated
    return delay({ ...generated }, 900)
  }
}

class MockArtifactPublisher implements ArtifactPublisher {
  listTargets(): Promise<PublishTarget[]> {
    return delay(fixture.publishTargets)
  }

  previewPublish(deliverableId: string, target: PublishTargetKind): Promise<PublishOutcome> {
    const deliverable = state.deliverables.find((d) => d.id === deliverableId)
    const proposedChanges = (deliverable?.files ?? []).map((f, i) => ({
      path: f.path,
      change: (deliverable?.state === 'published' && i === 0 ? 'modify' : 'add') as
        'add' | 'modify',
    }))
    return delay({
      ok: true,
      target,
      reference: referenceFor(target),
      proposedChanges,
      message: 'Prototype preview. No repository, filesystem, or bucket was contacted.',
    })
  }

  publish(deliverableId: string, target: PublishTargetKind): Promise<PublishOutcome> {
    const index = state.deliverables.findIndex((d) => d.id === deliverableId)
    if (index !== -1) {
      state.deliverables[index] = {
        ...state.deliverables[index],
        state: 'published',
        publishedTo: { target, reference: referenceFor(target), at: nextTimestamp() },
      }
    }
    const files = state.deliverables[index]?.files ?? []
    return delay(
      {
        ok: true,
        target,
        reference: referenceFor(target),
        proposedChanges: files.map((f) => ({ path: f.path, change: 'add' as const })),
        message:
          'Prototype only — nothing was written. In the product a GitHubPublisher, LocalWorkspacePublisher, or S3Publisher performs this step.',
      },
      800,
    )
  }
}

function referenceFor(target: PublishTargetKind): string {
  switch (target) {
    case 'github':
      return 'crismag/ministry-reporting · draft PR'
    case 'local':
      return '~/workspaces/ministry-reporting/docs/kae/'
    case 's3':
      return 'kae-artifacts/ministry-reporting/'
  }
}

/* ------------------------------------------------------------------ factory */

export function createMockServices(): StudioServices {
  return {
    memory: new MockProjectMemoryClient(),
    interview: new MockInterviewProvider(),
    projection: new MockProjectProjectionService(),
    artifacts: new MockArtifactService(),
    publisher: new MockArtifactPublisher(),
  }
}
