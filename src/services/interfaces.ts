/**
 * Replaceable service interfaces.
 *
 * Every piece of project data and every intelligent behaviour in the prototype
 * arrives through one of these. Presentation components never import fixtures;
 * they consume these interfaces via `ServiceProvider`.
 *
 * When the platform is real, each interface is re-implemented against:
 *   ProjectMemoryClient      -> the KAE-Memory versioned HTTP API
 *   InterviewProvider        -> a Studio-side orchestrator over an AI provider
 *   ProjectProjectionService -> KAE-Memory context assembly + projection cache
 *   ArtifactService          -> Studio delivery (generation from a pinned revision)
 *   ArtifactPublisher        -> GitHubPublisher | LocalWorkspacePublisher | S3Publisher
 *
 * No implementation here writes to a database. Studio owns no durable project
 * state (ADR-0006).
 */

import type {
  ConversationMessage,
  Deliverable,
  InterviewSession,
  Project,
  ProjectProjection,
  PublishTarget,
  PublishTargetKind,
} from '@/domain/types'

/** Result of a mutating call, carrying the revision it produced. */
export interface MemoryWriteResult {
  accepted: boolean
  memoryRevision: number
  /** Present when the write could not be acknowledged by Memory. */
  pendingReason?: string
}

/**
 * Reads and writes durable project state. In production this is the only route
 * to KAE-Memory; Studio never touches its tables (SYSTEM_BOUNDARY.md).
 */
export interface ProjectMemoryClient {
  listProjects(): Promise<Project[]>
  getProject(projectId: string): Promise<Project>
  /** Conversation is Memory-owned (ADR-0006); Studio reads it back. */
  listMessages(projectId: string): Promise<ConversationMessage[]>
  submitMessage(
    projectId: string,
    body: string,
    idempotencyKey: string,
  ): Promise<{ message: ConversationMessage; result: MemoryWriteResult }>
  getInterviewSession(projectId: string): Promise<InterviewSession>
  /** Curation of a proposed module is a versioned decision, not a silent edit. */
  recordModuleDecision(
    projectId: string,
    moduleId: string,
    decision: ModuleDecision,
  ): Promise<MemoryWriteResult>
  deferDecision(
    projectId: string,
    decisionId: string,
    deferred: boolean,
  ): Promise<MemoryWriteResult>
  /** Stored provenance for one statement. Recorded evidence, never a generated
   *  explanation — the two are indistinguishable on screen, so only one is shown. */
  knowledgeTrace(projectId: string, knowledgeId: string): Promise<KnowledgeTrace>
  confirmFinding(projectId: string, findingId: string): Promise<MemoryWriteResult>
  /** Reject a candidate, with the reason. Separate from confirm on purpose:
   *  they are opposite acts on the durable record, and one method serving both
   *  is how a Reject button ends up confirming. */
  rejectFinding(
    projectId: string,
    findingId: string,
    reason: string,
    expectedVersion: number,
  ): Promise<MemoryWriteResult>
}

export interface KnowledgeTrace {
  kind: string
  lifecycle: string
  source_message_ids?: string[]
  produced_by_run_id?: string | null
}

export type ModuleDecision =
  | { kind: 'accept' }
  | { kind: 'reject'; reason: string }
  | { kind: 'rename'; name: string }
  | { kind: 'split'; intoNames: [string, string] }
  | { kind: 'merge'; withModuleId: string; name: string }

export interface InterviewTurn {
  assistantMessage: ConversationMessage
  session: InterviewSession
}

/** Produces the assistant's turn. In production, an AI provider sits behind this. */
export interface InterviewProvider {
  /** Human-readable provider identity, shown honestly in the status bar. */
  describe(): { name: string; mode: 'mock' | 'live' }
  respondTo(projectId: string, userMessage: string): Promise<InterviewTurn>
}

/** Assembles the projection the UI renders from current Memory knowledge. */
export interface ProjectProjectionService {
  getProjection(projectId: string): Promise<ProjectProjection>
}

/** Generates versioned artifact bundles pinned to a Memory revision. */
export interface ArtifactService {
  listDeliverables(projectId: string): Promise<Deliverable[]>
  generate(projectId: string, deliverableId: string): Promise<Deliverable>
}

export interface PublishOutcome {
  ok: boolean
  target: PublishTargetKind
  reference: string
  /** Files the publisher would write, shown for review before anything happens. */
  proposedChanges: { path: string; change: 'add' | 'modify' }[]
  message: string
}

/** Writes a generated bundle to a destination. Destination never alters the bundle. */
export interface ArtifactPublisher {
  listTargets(): Promise<PublishTarget[]>
  previewPublish(deliverableId: string, target: PublishTargetKind): Promise<PublishOutcome>
  publish(deliverableId: string, target: PublishTargetKind): Promise<PublishOutcome>
}

export interface StudioServices {
  /**
   * The project every call in this bundle is about.
   *
   * Here rather than in a hook constant because it has to reach React Query's
   * cache keys. The live adapter already rewrites the project id on every
   * request, so calls were correct while the *cache* was keyed on a fixture
   * string — meaning switching projects would have served one project's answers
   * for another, and looked exactly like the cross-project leak this product
   * was accused of.
   */
  projectId: string
  memory: ProjectMemoryClient
  interview: InterviewProvider
  projection: ProjectProjectionService
  artifacts: ArtifactService
  publisher: ArtifactPublisher
}
