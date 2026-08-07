/**
 * Product-oriented view types for the KAE-Studio prototype.
 *
 * These are presentation contracts, NOT KAE-Memory row shapes. Nothing here is
 * authoritative: the real values arrive from KAE-Memory through the service
 * interfaces in `src/services`. Per docs/architecture/PROJECT_MODEL.md, Studio
 * holds projections only.
 */

/** Status of any project-model node. Mirrors PROJECT_MODEL.md's lifecycle. */
export type NodeStatus =
  'proposed' | 'confirmed' | 'contested' | 'superseded' | 'rejected' | 'deferred'

/** Per-dimension readiness value. MODULE_SPECIFICATION.md. */
export type ReadinessValue = 'complete' | 'draft' | 'incomplete' | 'blocked' | 'not_applicable'

export type ReadinessDimension =
  | 'requirements'
  | 'interfaces'
  | 'data_model'
  | 'security'
  | 'operations'
  | 'acceptance_tests'
  | 'ui'

export interface ReadinessEntry {
  dimension: ReadinessDimension
  value: ReadinessValue
  note?: string
}

/** Provenance shown on demand, never as the primary workflow. */
export interface TraceReference {
  evidenceId: string
  sourceLabel: string
  quotedText: string
  recordedAt: string
}

export interface Project {
  id: string
  name: string
  phase: string
  memoryRevision: number
  createdAt: string
}

/* ---------------------------------------------------------------- conversation */

export type MessageAuthor = 'user' | 'assistant'

/** Delivery state of a message Studio submitted to KAE-Memory (ADR-0006). */
export type MessageSyncState = 'acknowledged' | 'pending' | 'failed'

export interface AssistantUnderstanding {
  heading: string
  points: string[]
}

export interface ConversationMessage {
  id: string
  author: MessageAuthor
  body: string
  createdAt: string
  syncState: MessageSyncState
  /** Structured support shown as a card beneath assistant prose. */
  understanding?: AssistantUnderstanding
  /** The single focused question this turn asks. */
  question?: string
  /** Optional short reply chips, only when genuinely useful. */
  suggestions?: string[]
  /** Model-facing changes this turn produced, summarised for humans. */
  resultingChanges?: string[]
}

export interface InterviewSession {
  interviewType: string
  objective: string
  questionsAsked: number
  questionsAnswered: number
  questionsDeferred: number
}

/* ---------------------------------------------------------------- definition */

export interface StakeholderEntry {
  id: string
  name: string
  role: string
  interest: string
  status: NodeStatus
}

export interface WorkflowStep {
  actor: string
  action: string
}

export interface BusinessWorkflow {
  id: string
  name: string
  status: NodeStatus
  steps: WorkflowStep[]
  realizedBy: string[]
}

export interface DefinitionStatement {
  id: string
  text: string
  status: NodeStatus
  trace?: TraceReference[]
}

export interface ProjectDefinition {
  problem: string
  value: string
  objectives: DefinitionStatement[]
  stakeholders: StakeholderEntry[]
  inScope: DefinitionStatement[]
  outOfScope: DefinitionStatement[]
  workflows: BusinessWorkflow[]
  assumptions: DefinitionStatement[]
  constraints: DefinitionStatement[]
}

/* ---------------------------------------------------------------- requirements */

/**
 * What a record *is*, independent of what state it is in.
 *
 * The last four exist because KAE-Memory types its knowledge and the interface
 * has to keep that distinction. A question, a persona and an assumption are not
 * requirements, and listing them as "proposed functional requirements" asks a
 * reader to reclassify every row themselves before they can act on any of it.
 */
export type RequirementCategory =
  | 'functional'
  | 'integration'
  | 'security'
  | 'operational'
  | 'quality'
  | 'business_rule'
  | 'user_need'
  | 'constraint'
  | 'assumption'
  | 'decision'
  | 'open_question'

export interface Requirement {
  id: string
  category: RequirementCategory
  statement: string
  status: NodeStatus
  moduleId?: string
  satisfies: string[]
  verifiedBy: string[]
  updatedAt: string
  trace: TraceReference[]
  clarificationNeeded?: string
}

export interface AcceptanceTest {
  id: string
  statement: string
  verifies: string[]
  status: NodeStatus
}

/* ---------------------------------------------------------------- modules */

export type ModuleProposalState = 'proposed' | 'accepted' | 'rejected'

export interface ModuleInterfaceRef {
  id: string
  name: string
  direction: 'exposes' | 'consumes'
  protocol: string
  synchronicity: 'synchronous' | 'asynchronous'
  ownerModuleId: string
  status: NodeStatus
  note?: string
}

export interface ModuleDataRef {
  id: string
  name: string
  ownership: 'owns' | 'reads'
  classification: string
}

export interface ModuleDependency {
  moduleId: string
  reason: string
  nature: 'runtime' | 'build' | 'data' | 'operational'
  /** True when the dependency cannot be satisfied yet. */
  blocking?: boolean
  blockingReason?: string
}

export interface OpenDecision {
  id: string
  question: string
  whyItMatters: string
  blocks: string[]
  suggestedOwner: string
  deferred: boolean
}

export interface FailureBehaviour {
  condition: string
  behaviour: string
}

export interface ProjectModule {
  id: string
  key: string
  name: string
  purpose: string
  proposalState: ModuleProposalState
  /** Rationale Studio gives for proposing this boundary. */
  rationale: string
  responsibilities: string[]
  nonResponsibilities: { text: string; ownerModuleId: string }[]
  inputs: string[]
  outputs: string[]
  requirementIds: string[]
  businessRuleIds: string[]
  interfaces: ModuleInterfaceRef[]
  data: ModuleDataRef[]
  dependencies: ModuleDependency[]
  failureBehaviour: FailureBehaviour[]
  acceptanceTestIds: string[]
  openDecisionIds: string[]
  readiness: ReadinessEntry[]
  /** True only when every dimension is complete and nothing blocks it. */
  implementationReady: boolean
}

/* ---------------------------------------------------------------- reviews */

export type FindingKind =
  | 'open_decision'
  | 'requirement_gap'
  | 'contradiction'
  | 'unverified_requirement'
  | 'agent_proposal'

export type FindingSeverity = 'critical' | 'major' | 'minor'

export interface ReviewFinding {
  id: string
  kind: FindingKind
  severity: FindingSeverity
  summary: string
  detail: string
  subjectIds: string[]
  /** Present for agent_proposal: which agent submitted it, and from where. */
  agentOrigin?: {
    agent: string
    repository: string
    commit: string
    memoryRevision: number
  }
  competingStatements?: { text: string; sourceLabel: string }[]
}

/* ---------------------------------------------------------------- deliverables */

export type DeliverableState = 'not_generated' | 'generated' | 'reviewed' | 'published' | 'outdated'

export type PublishTargetKind = 'github' | 'local' | 's3'

export interface PublishTarget {
  kind: PublishTargetKind
  label: string
  detail: string
  available: boolean
  unavailableReason?: string
}

export interface PackageFile {
  path: string
  summary: string
  /** Number of statements traced to evidence in this file. */
  tracedStatements: number
}

export interface Deliverable {
  id: string
  name: string
  description: string
  scope: 'project' | 'module'
  moduleId?: string
  state: DeliverableState
  version?: string
  generatedAt?: string
  sourceMemoryRevision?: number
  contentHash?: string
  includes: string[]
  files: PackageFile[]
  /** Open decisions that remain unresolved inside this package. */
  unresolvedDecisionIds: string[]
  publishedTo?: { target: PublishTargetKind; reference: string; at: string }
  blockedReason?: string
}

/* ---------------------------------------------------------------- health */

export interface CoverageTopic {
  key: string
  name: string
  state: 'strong' | 'forming' | 'thin' | 'missing'
  detail: string
}

export interface ProjectHealth {
  phase: string
  summary: string
  coverage: CoverageTopic[]
  blockingDecisionIds: string[]
  recommendedNext: string[]
}

/* ---------------------------------------------------------------- memory view */

export interface MemoryRecord {
  id: string
  kind: string
  statement: string
  status: NodeStatus
  revision: number
  changedAt: string
  supportedBy: TraceReference[]
  supersedes?: string
}

/** Whole projection the UI renders. Assembled by ProjectProjectionService. */
export interface ProjectProjection {
  project: Project
  definition: ProjectDefinition
  requirements: Requirement[]
  acceptanceTests: AcceptanceTest[]
  modules: ProjectModule[]
  openDecisions: OpenDecision[]
  findings: ReviewFinding[]
  health: ProjectHealth
  recentChanges: { id: string; text: string; at: string }[]
}
