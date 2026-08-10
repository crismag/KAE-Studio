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
  ArtifactApproval,
  ArtifactDestination,
  ArtifactPackage,
  ArtifactPlan,
  ArtifactPreview,
  ArtifactProfile,
  ArtifactPublication,
  CapabilityGap,
  ConnectivityResult,
  Deliverable,
  ProjectSource,
  ProviderConnection,
  GenerationRun,
  InterviewSession,
  ProjectModule,
  ProjectProjection,
  PublisherAvailability,
  ValidationResult,
} from '@/domain/types'
import type {
  AcquisitionPort,
  ArtifactContent,
  ArtifactPipeline,
  ArtifactPlanEdit,
  ArtifactService,
  PublishInput,
  InterviewProvider,
  InterviewTurn,
  MemoryWriteResult,
  ModuleDecision,
  ProjectMemoryClient,
  ProjectProjectionService,
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

  /**
   * The prototype confirms nothing, and says so by doing nothing.
   *
   * A mock that marked statements confirmed would make the prototype show
   * readiness moving on evidence it never had — the class of fiction the
   * fixture sweep removed from the routes. The gesture's own tests run against
   * the live service, which is where the behaviour lives.
   */
  async confirmReading(_projectId: string, _knowledgeIds: string[]): Promise<void> {
    await delay(undefined, 200)
  }

  /** Records nothing, for the reason `confirmReading` records nothing. */
  async decideRecommendation(_projectId: string, _decision: unknown): Promise<void> {
    await delay(undefined, 200)
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
      // The prototype fixture describes a project whose sections are all
      // computable, so there is nothing unavailable to report. Kept explicit
      // rather than omitted: a surface that renders gaps must be exercised
      // against "no gaps" too.
      unavailable: [],
      modulesGap: null,
      contradictions: { count: 0, listable: true, reason: '' },
    })
  }
}

/* ----------------------------------------------------------- artifact mocks */

class MockArtifactService implements ArtifactService {
  listDeliverables(): Promise<Deliverable[]> {
    return delay(state.deliverables.map((d) => ({ ...d })))
  }
}

/**
 * A deterministic stand-in for KAE-Artifacts.
 *
 * It models the behaviour the UI has to handle, not just the happy path:
 * a blocked entry that cannot be generated, an edited path that survives into
 * the package, a preview that distinguishes an addition from an overwrite, and
 * an approval that stops being valid when the package changes underneath it.
 *
 * A mock that only succeeded would let the interface ship without a single one
 * of those states ever having been rendered.
 */
class MockArtifactPipeline implements ArtifactPipeline {
  private plans = new Map<string, ArtifactPlan>()
  private packages = new Map<string, ArtifactPackage>()
  private previews = new Map<string, ArtifactPreview>()
  private approvals = new Map<string, ArtifactApproval>()
  private publications = new Map<string, ArtifactPublication>()
  private runs = new Map<string, GenerationRun>()
  /** Keyed by idempotency key, so a retry returns the original run. */
  private claimed = new Map<string, string>()
  private counter = 0

  /**
   * `#` rather than `private`, because TypeScript's `private` is erased and the
   * method survives at runtime — where `portParity.test.ts` reads it as a call
   * the live adapter fails to implement. A helper that is not part of the port
   * should not be visible on the object at all.
   */
  #id(prefix: string): string {
    this.counter += 1
    return `${prefix}_${String(this.counter).padStart(4, '0')}`
  }

  listProfiles(): Promise<ArtifactProfile[]> {
    return delay(MOCK_PROFILES.map((p) => ({ ...p, artifacts: [...p.artifacts] })))
  }

  listPublishers(): Promise<PublisherAvailability[]> {
    // GitHub is available because the branch-and-pull-request review flow is
    // the product's headline and a prototype that cannot show it demonstrates
    // little. S3 stays unavailable so the *unavailable* state — reported with
    // a reason rather than silently absent — is on screen too.
    return delay([
      { type: 'download', available: true, reason: '' },
      { type: 'github', available: true, reason: '' },
      { type: 's3', available: false, reason: 'no S3 connection configured' },
    ])
  }

  createPlan(_projectId: string, profile: string): Promise<ArtifactPlan> {
    const shape = MOCK_PROFILES.find((p) => p.id === profile) ?? MOCK_PROFILES[0]
    const plan: ArtifactPlan = {
      planId: this.#id('pln'),
      subjectId: 'proj-ministry-reporting',
      inputRevision: `memory:${state.memoryRevision}`,
      inputDigest: `sha256:mock${state.memoryRevision}`,
      profile: shape.id,
      checksum: `sha256:plan${this.counter}`,
      actionable: true,
      entries: shape.artifacts.map((a) => ({
        type: a.type,
        logicalPath: a.defaultPath,
        purpose: a.purpose,
        inputs: a.inputs,
        // The integration specification is blocked without a repository. Kept
        // in the mock because it is the state the UI most needs to render, and
        // the one a happy-path fixture would never produce.
        readiness: a.type === 'integration-specification' ? 'blocked' : 'ready',
        blockedReason:
          a.type === 'integration-specification'
            ? 'No repository has been chosen for this project.'
            : '',
        selected: true,
        generatable: a.type !== 'integration-specification',
        options: {},
      })),
    }
    this.plans.set(plan.planId, plan)
    return delay({ ...plan })
  }

  getPlan(planId: string): Promise<ArtifactPlan> {
    const plan = this.plans.get(planId)
    if (!plan) throw new Error(`Unknown plan: ${planId}`)
    return delay({ ...plan })
  }

  editPlan(planId: string, edits: ArtifactPlanEdit[]): Promise<ArtifactPlan> {
    const plan = this.plans.get(planId)
    if (!plan) throw new Error(`Unknown plan: ${planId}`)
    const byType = new Map(edits.map((e) => [e.type, e]))
    const edited: ArtifactPlan = {
      ...plan,
      entries: plan.entries.map((entry) => {
        const edit = byType.get(entry.type)
        if (!edit) return entry
        const selected = edit.selected ?? entry.selected
        return {
          ...entry,
          logicalPath: edit.logicalPath ?? entry.logicalPath,
          selected,
          options: edit.options ?? entry.options,
          // Selection cannot override readiness. A user who selects a blocked
          // entry has asked for a file whose content nobody can supply.
          generatable: selected && entry.readiness !== 'blocked',
        }
      }),
    }
    this.plans.set(planId, edited)
    return delay({ ...edited })
  }

  generate(_projectId: string, planId: string, idempotencyKey: string): Promise<GenerationRun> {
    const existing = this.claimed.get(idempotencyKey)
    if (existing) return delay({ ...this.runs.get(existing)! })

    const plan = this.plans.get(planId)
    if (!plan) throw new Error(`Unknown plan: ${planId}`)

    const runId = this.#id('run')
    const packageId = this.#id('pkg')
    const entries = plan.entries.filter((e) => e.generatable)
    const artifacts = entries.map((entry) => ({
      artifactId: this.#id('art'),
      type: entry.type,
      logicalPath: entry.logicalPath,
      checksum: `sha256:${entry.type.slice(0, 6)}${state.memoryRevision}`,
      sizeBytes: 900 + entry.logicalPath.length,
      generatorVersion: 'generator.v1',
    }))

    this.packages.set(packageId, {
      packageId,
      subjectId: plan.subjectId,
      inputRevision: plan.inputRevision,
      runId,
      packageChecksum: `sha256:pkg${this.counter}`,
      manifestVersion: 'manifest.v1',
      createdAt: nextTimestamp(),
      artifacts,
    })

    const run: GenerationRun = {
      runId,
      status: 'succeeded',
      inputRevision: plan.inputRevision,
      artifactIds: artifacts.map((a) => a.artifactId),
      packageId,
      errorCode: '',
      errorMessage: '',
    }
    this.runs.set(runId, run)
    this.claimed.set(idempotencyKey, runId)
    return delay({ ...run }, 700)
  }

  getPackage(packageId: string): Promise<ArtifactPackage> {
    const found = this.packages.get(packageId)
    if (!found) throw new Error(`Unknown package: ${packageId}`)
    return delay({ ...found })
  }

  getArtifact(artifactId: string): Promise<ArtifactContent> {
    for (const pkg of this.packages.values()) {
      const entry = pkg.artifacts.find((a) => a.artifactId === artifactId)
      if (entry) {
        return delay({
          artifactId,
          type: entry.type,
          logicalPath: entry.logicalPath,
          mediaType: 'text/markdown',
          checksum: entry.checksum,
          sizeBytes: entry.sizeBytes,
          inputRevision: pkg.inputRevision,
          generatorVersion: entry.generatorVersion,
          content: `# ${entry.logicalPath}\n\nPrototype content, generated from ${pkg.inputRevision}.\n`,
        })
      }
    }
    throw new Error(`Unknown artifact: ${artifactId}`)
  }

  validate(packageId: string): Promise<ValidationResult> {
    const pkg = this.packages.get(packageId)
    if (!pkg) throw new Error(`Unknown package: ${packageId}`)
    return delay({
      publishable: true,
      findings: [
        {
          check: 'thin_content',
          severity: 'warning',
          message: 'Some sections have nothing in them — the project may not know much yet.',
          remedy: 'Publishable as it stands. More discovery would make it say more.',
          artifactId: pkg.artifacts[0]?.artifactId ?? '',
        },
      ],
    })
  }

  preview(packageId: string, destination: ArtifactDestination): Promise<ArtifactPreview> {
    const pkg = this.packages.get(packageId)
    if (!pkg) throw new Error(`Unknown package: ${packageId}`)
    const prefix = destination.targetPath ? `${destination.targetPath}/` : ''
    const preview: ArtifactPreview = {
      previewId: this.#id('prv'),
      packageId,
      packageChecksum: pkg.packageChecksum,
      checksum: `sha256:prv${this.counter}`,
      destination,
      // A GitHub destination has a base to move; a download does not, and an
      // invented token there would imply a staleness check that cannot exist.
      baseToken: destination.type === 'github' ? 'a1b2c3d4e5f6' : '',
      hasChanges: true,
      changes: pkg.artifacts.map((a, index) => ({
        path: `${prefix}${a.logicalPath}`,
        // One overwrite, so the interface has to render the distinction rather
        // than assuming every publication is an addition.
        outcome: destination.type === 'github' && index === 0 ? 'modify' : 'add',
        existingIdentity: destination.type === 'github' && index === 0 ? 'blob9f8e7d' : '',
        newChecksum: a.checksum,
        sizeBytes: a.sizeBytes,
        detail: '',
      })),
    }
    this.previews.set(preview.previewId, preview)
    return delay(preview)
  }

  approve(previewId: string): Promise<ArtifactApproval> {
    const preview = this.previews.get(previewId)
    if (!preview) throw new Error(`Unknown preview: ${previewId}`)
    const now = new Date(nextTimestamp())
    const approval: ArtifactApproval = {
      approvalId: this.#id('apr'),
      packageId: preview.packageId,
      packageChecksum: preview.packageChecksum,
      previewId,
      previewChecksum: preview.checksum,
      destination: preview.destination,
      baseToken: preview.baseToken,
      approverRef: 'studio:prototype-operator',
      approvedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString(),
      policyVersion: 'mock.v1',
    }
    this.approvals.set(approval.approvalId, approval)
    return delay(approval)
  }

  publish(input: PublishInput): Promise<ArtifactPublication> {
    const existing = this.claimed.get(input.idempotencyKey)
    if (existing) return delay({ ...this.publications.get(existing)! })

    const approval = this.approvals.get(input.approvalId)
    if (!approval) throw new Error(`Unknown approval: ${input.approvalId}`)

    const pkg = this.packages.get(input.packageId)
    const publicationId = this.#id('pub')
    // An approval names one package. Approving one and publishing another is
    // the failure the whole approval model exists to prevent, so the mock
    // refuses it rather than letting the UI ship untested against a refusal.
    const mismatched = approval.packageChecksum !== pkg?.packageChecksum
    const publication: ArtifactPublication = {
      publicationId,
      packageId: input.packageId,
      approvalId: input.approvalId,
      destination: input.destination,
      status: mismatched ? 'failed' : 'succeeded',
      externalReference: mismatched ? '' : referenceFor(input.destination.type),
      reviewUrl:
        !mismatched && input.destination.type === 'github'
          ? 'https://github.test/crismag/ministry-reporting/pull/1'
          : '',
      filesWritten: mismatched ? [] : (pkg?.artifacts ?? []).map((a) => a.logicalPath),
      detail: mismatched
        ? 'package_mismatch: this approval was given for a different package.'
        : 'Prototype only — nothing was written. In the product KAE-Artifacts performs this step.',
    }
    this.publications.set(publicationId, publication)
    this.claimed.set(input.idempotencyKey, publicationId)

    if (!mismatched) {
      const index = state.deliverables.findIndex((d) => d.state !== 'published')
      if (index !== -1) {
        state.deliverables[index] = {
          ...state.deliverables[index],
          state: 'published',
          publishedTo: {
            target: input.destination.type === 'download' ? 's3' : input.destination.type,
            reference: publication.externalReference,
            at: nextTimestamp(),
          },
        }
      }
    }
    return delay(publication, 800)
  }

  getPublication(publicationId: string): Promise<ArtifactPublication> {
    const found = this.publications.get(publicationId)
    if (!found) throw new Error(`Unknown publication: ${publicationId}`)
    return delay({ ...found })
  }

  getProvenance(publicationId: string): Promise<Record<string, unknown>> {
    const publication = this.publications.get(publicationId)
    if (!publication) throw new Error(`Unknown publication: ${publicationId}`)
    const pkg = this.packages.get(publication.packageId)
    const approval = this.approvals.get(publication.approvalId)
    return delay({
      input_revision: pkg?.inputRevision ?? '',
      package_id: publication.packageId,
      package_checksum: pkg?.packageChecksum ?? '',
      approval_id: publication.approvalId,
      approver_ref: approval?.approverRef ?? '',
      publication_id: publicationId,
      status: publication.status,
      external_reference: publication.externalReference,
    })
  }
}

/** The profiles the mock offers. A subset of the real registry, same shape. */
const MOCK_PROFILES: ArtifactProfile[] = [
  {
    id: 'minimal-agent-context',
    artifactCount: 2,
    artifacts: [
      {
        type: 'project-context',
        defaultPath: 'docs/context/PROJECT_CONTEXT.md',
        purpose: 'Product mission and boundaries',
        inputs: ['Confirmed project knowledge'],
      },
      {
        type: 'agent-context',
        defaultPath: 'AGENTS.md',
        purpose: 'Instructions for coding agents',
        inputs: ['Governing constraints'],
      },
    ],
  },
  {
    id: 'full-project-foundation',
    artifactCount: 4,
    artifacts: [
      {
        type: 'project-context',
        defaultPath: 'docs/context/PROJECT_CONTEXT.md',
        purpose: 'Product mission and boundaries',
        inputs: ['Confirmed project knowledge'],
      },
      {
        type: 'requirements',
        defaultPath: 'docs/REQUIREMENTS.md',
        purpose: 'What the system must do',
        inputs: ['Confirmed requirements', 'Open questions'],
      },
      {
        type: 'agent-context',
        defaultPath: 'AGENTS.md',
        purpose: 'Instructions for coding agents',
        inputs: ['Governing constraints'],
      },
      {
        type: 'integration-specification',
        defaultPath: 'docs/integrations/GITHUB.md',
        purpose: 'GitHub integration specification',
        inputs: ['Repository configuration'],
      },
    ],
  },
]

function referenceFor(target: ArtifactDestination['type']): string {
  switch (target) {
    case 'github':
      return 'crismag/ministry-reporting · draft PR'
    case 'download':
      return 'download:pkg_0001'
    case 's3':
      return 'kae-artifacts/ministry-reporting/'
  }
}

/**
 * Connections and sources, as far as they honestly go.
 *
 * The mock deliberately models the **incomplete** shape: a source can be
 * configured, verified and pinned, and there is no method that analyzes one.
 * A mock that returned findings would let the whole interface be built and
 * demoed against a capability nothing implements — which is precisely how a
 * product ends up shipping a screen that lies.
 */
class MockAcquisition implements AcquisitionPort {
  private connections: ProviderConnection[] = []
  private sources: ProjectSource[] = []
  private counter = 0

  listConnections(): Promise<ProviderConnection[]> {
    return delay(this.connections.map((c) => ({ ...c })))
  }

  addConnection(input: {
    provider: string
    label: string
    connectionRef: string
  }): Promise<ProviderConnection> {
    this.counter += 1
    const connection: ProviderConnection = {
      connectionId: `con_${String(this.counter).padStart(4, '0')}`,
      provider: input.provider,
      label: input.label,
      // Configured, not verified. Somebody typed it in; nobody has used it.
      state: 'configured',
      canRead: false,
      canWrite: false,
      account: '',
      verifiedAt: '',
      detail: '',
    }
    this.connections.push(connection)
    return delay({ ...connection })
  }

  checkConnectivity(connectionId: string, location: string): Promise<ConnectivityResult> {
    const index = this.connections.findIndex((c) => c.connectionId === connectionId)
    if (index !== -1) {
      this.connections[index] = {
        ...this.connections[index],
        state: 'verified',
        canRead: true,
        // Read without write, so the interface has to render the distinction
        // rather than assuming a connection grants both.
        canWrite: false,
        account: location.split('/')[0] ?? '',
        verifiedAt: nextTimestamp(),
      }
    }
    return delay({
      ok: true,
      provider: 'github',
      account: location.split('/')[0] ?? '',
      canRead: true,
      canWrite: false,
      detail: '',
      checkedAt: nextTimestamp(),
      proves: 'the credential can reach this location. Nothing has been read or analyzed.',
    })
  }

  listSources(projectId: string): Promise<ProjectSource[]> {
    return delay(this.sources.filter((s) => s.projectId === projectId).map((s) => ({ ...s })))
  }

  addSource(
    projectId: string,
    input: { kind: string; connectionId: string; location: string; reference: string },
  ): Promise<ProjectSource> {
    this.counter += 1
    const source: ProjectSource = {
      sourceId: `src_${String(this.counter).padStart(4, '0')}`,
      projectId,
      kind: input.kind as ProjectSource['kind'],
      connectionId: input.connectionId,
      location: input.location,
      reference: input.reference,
      state: 'configured',
      snapshot: null,
      lastError: '',
      analysis: ANALYSIS_GAP,
    }
    this.sources.push(source)
    return delay({ ...source })
  }

  pinSource(sourceId: string): Promise<ProjectSource> {
    const index = this.sources.findIndex((s) => s.sourceId === sourceId)
    if (index === -1) throw new Error(`Unknown source: ${sourceId}`)
    const pinned: ProjectSource = {
      ...this.sources[index],
      // `pinned`, never `analyzed`. The state a product most wants to claim,
      // and the one nothing here can reach.
      state: 'pinned',
      snapshot: {
        revision: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
        resolvedAt: nextTimestamp(),
        fileCount: 128,
        totalBytes: 486_213,
        excludedCount: 41,
        contentDigest: 'sha256:mockdigest0001',
      },
      lastError: '',
    }
    this.sources[index] = pinned
    return delay({ ...pinned }, 700)
  }
}

/** The gap, stated identically to the backend's. */
const ANALYSIS_GAP: CapabilityGap = {
  capability: 'source.analysis',
  reason:
    'Reading a repository into proposed findings is not implemented. A source can be ' +
    'connected, read and pinned to an exact commit; nothing yet turns that snapshot ' +
    'into project knowledge.',
  state: 'planned',
  provedInstead: ['connection verified', 'source readable', 'revision pinned'],
}

/* ------------------------------------------------------------------ factory */

export function createMockServices(): StudioServices {
  return {
    // The fixture's own id. The mocks answer for one project and always have.
    projectId: 'proj-ministry-reporting',
    memory: new MockProjectMemoryClient(),
    interview: new MockInterviewProvider(),
    projection: new MockProjectProjectionService(),
    artifacts: new MockArtifactService(),
    pipeline: new MockArtifactPipeline(),
    acquisition: new MockAcquisition(),
  }
}
