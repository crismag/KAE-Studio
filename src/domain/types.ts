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
  /**
   * The statements this turn reflected back, as KAE-Memory's own ids.
   *
   * What a person's "yes, that holds" applies to. Empty or absent is normal —
   * a turn that asks something new reflects nothing, and only a turn that
   * reflected something can be agreed with.
   *
   * Without it the interface would have to guess which statements a sentence
   * covered, which is how "Confirmed" came to be shown beside "0 of 1
   * confirmed".
   */
  provenance?: string[]
  /**
   * What to do next, best first, each with the reason it outranks the rest.
   *
   * Ranked by CIE (ADR-0002) — Memory refuses to rank and Studio must not, or
   * the panel would disagree with the move beside it.
   */
  nextAction?: { kind: string; label: string; reason: string }[]
  /**
   * What KAE advises, when it advises anything.
   *
   * Distinct from a conclusion: a conclusion is something KAE settled without
   * asking, this is something it deliberately did not settle. The interface
   * must not blur them, or advice becomes a decision by omission.
   */
  recommendation?: { advice: string; reason: string; consequence: string } | null
  /** What the turn settled on its own account, and how much each one costs. */
  concluded?: {
    statement: string
    consequence: string
    revisitWhen: string
    material: boolean
  }[]
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
  /**
   * Optional because KAE-Memory does not hold them.
   *
   * A stakeholder there is an `actor` statement — "Ministry leaders submit
   * monthly reports" — with no separate role or interest field. The prototype
   * fixture had both, so the type required both, and the only way to satisfy it
   * from real data was to invent two empty strings that render as blank labels.
   * Optional says the truth: these exist for some sources and not others.
   */
  role?: string
  interest?: string
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

/**
 * How much of what was submitted became knowledge.
 *
 * Beside the readiness percentage, never inside it. A project that lost content
 * is not less *ready* — it is less **read**, and one number cannot say both.
 */
export interface ExtractionCoverage {
  succeeded: number
  abandoned: number
  complete: boolean
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

/* ------------------------------------------------------- artifact generation */

/**
 * The KAE-Artifacts resources, as the UI sees them.
 *
 * Deliberately close to that service's wire shape rather than translated into
 * Studio vocabulary. Two reasons: the vocabulary is the contract, and a
 * translation layer would be a second place for "what does blocked mean?" to be
 * answered — which is how the two answers start to differ.
 *
 * Nothing here is invented by Studio. Every field arrives from KAE-Artifacts,
 * and where it is absent the UI says so rather than substituting a default.
 */

/** Whether a planned artifact can be produced from what the project knows. */
export type ArtifactReadiness = 'ready' | 'needs_review' | 'blocked'

export interface ArtifactPlanEntry {
  type: string
  logicalPath: string
  purpose: string
  inputs: string[]
  readiness: ArtifactReadiness
  /**
   * Required when readiness is `blocked`, and the most important string on the
   * screen: it names the decision nobody has made. A blocked entry without one
   * would be indistinguishable from an oversight.
   */
  blockedReason: string
  selected: boolean
  /** Selected **and** not blocked. Selection alone cannot override readiness. */
  generatable: boolean
  options: Record<string, string>
}

export interface ArtifactPlan {
  planId: string
  subjectId: string
  /** The Memory revision this plan was proposed against, e.g. `memory:281`. */
  inputRevision: string
  inputDigest: string
  profile: string
  checksum: string
  actionable: boolean
  entries: ArtifactPlanEntry[]
}

export interface ArtifactProfile {
  id: string
  artifactCount: number
  artifacts: { type: string; defaultPath: string; purpose: string; inputs: string[] }[]
}

export interface GenerationRun {
  runId: string
  status: 'accepted' | 'running' | 'succeeded' | 'failed'
  inputRevision: string
  artifactIds: string[]
  packageId: string
  errorCode: string
  errorMessage: string
}

export interface ArtifactManifestEntry {
  artifactId: string
  type: string
  logicalPath: string
  checksum: string
  sizeBytes: number
  generatorVersion: string
}

export interface ArtifactPackage {
  packageId: string
  subjectId: string
  inputRevision: string
  runId: string
  packageChecksum: string
  manifestVersion: string
  createdAt: string
  artifacts: ArtifactManifestEntry[]
}

export interface ValidationFinding {
  check: string
  severity: 'error' | 'warning' | 'info'
  message: string
  remedy: string
  artifactId: string
}

export interface ValidationResult {
  publishable: boolean
  findings: ValidationFinding[]
}

/** What publishing would do to one path at the destination. */
export type FileOutcome = 'add' | 'modify' | 'unchanged' | 'conflict'

export interface PreviewChange {
  path: string
  outcome: FileOutcome
  /** The destination's current content identity — a blob SHA, an ETag. */
  existingIdentity: string
  newChecksum: string
  sizeBytes: number
  detail: string
}

export interface ArtifactDestination {
  type: 'download' | 'github' | 's3'
  mode: 'pull_request' | 'direct' | 'object_write'
  target: string
  targetPath: string
  baseBranch: string
}

export interface ArtifactPreview {
  previewId: string
  packageId: string
  packageChecksum: string
  checksum: string
  destination: ArtifactDestination
  /**
   * The provider's concurrency handle at preview time — a commit SHA for
   * GitHub. If the destination moves, the approval bound to this stops being
   * valid, which is the whole mechanism behind "review before mutation".
   */
  baseToken: string
  hasChanges: boolean
  changes: PreviewChange[]
}

export interface ArtifactApproval {
  approvalId: string
  packageId: string
  packageChecksum: string
  previewId: string
  previewChecksum: string
  destination: ArtifactDestination
  baseToken: string
  approverRef: string
  approvedAt: string
  expiresAt: string
  policyVersion: string
}

export interface ArtifactPublication {
  publicationId: string
  packageId: string
  approvalId: string
  destination: ArtifactDestination
  status: 'accepted' | 'awaiting_approval' | 'running' | 'succeeded' | 'failed'
  externalReference: string
  reviewUrl: string
  filesWritten: string[]
  detail: string
}

export interface PublisherAvailability {
  type: string
  available: boolean
  /** Why not, when unavailable. Empty is only correct when it *is* available. */
  reason: string
}

/* ------------------------------------------------------------- acquisition */

/**
 * Reading an existing project in. STI-1 exists; STI-2 to STI-4 do not.
 *
 * The types below are shaped so the interface cannot accidentally claim more
 * than has happened. `SourceState` has four values and only the first three are
 * reachable — `analyzed` is declared so that `pinned` cannot quietly stand in
 * for it.
 */

export type ConnectionState = 'configured' | 'verified' | 'refused' | 'unreachable'

export interface ProviderConnection {
  connectionId: string
  provider: string
  label: string
  state: ConnectionState
  /** Separate grants. One boolean would assert both on the evidence of one. */
  canRead: boolean
  canWrite: boolean
  account: string
  verifiedAt: string
  detail: string
}

/**
 * How far a source has actually got.
 *
 * `analyzed` is **not reachable**. Nothing sets it, because nothing reads a
 * repository into findings yet. It exists in the type so a component that
 * renders state cannot treat `pinned` as the finish line.
 */
export type SourceState = 'configured' | 'readable' | 'pinned' | 'analyzed'

export interface SourceSnapshot {
  revision: string
  resolvedAt: string
  fileCount: number
  totalBytes: number
  excludedCount: number
  contentDigest: string
}

/** A capability that does not exist, reported as a fact rather than an empty list. */
export interface CapabilityGap {
  capability: string
  reason: string
  state: 'planned'
  /** What *was* proved, so the UI can show how far the user actually got. */
  provedInstead: string[]
}

export interface ProjectSource {
  sourceId: string
  projectId: string
  kind: 'github' | 's3' | 'upload'
  connectionId: string
  location: string
  reference: string
  state: SourceState
  snapshot: SourceSnapshot | null
  lastError: string
  /** Present on every source, always. A conditional field is one a UI forgets. */
  analysis: CapabilityGap
}

export interface ConnectivityResult {
  ok: boolean
  provider: string
  account: string
  canRead: boolean
  canWrite: boolean
  detail: string
  checkedAt: string
  /** In words, on every result: what this does and does not establish. */
  proves: string
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
/**
 * A section the backend could not compute, and why.
 *
 * **The difference this exists to preserve.** An empty `workflows` array can
 * mean two opposite things: the project has no business workflows, or KAE
 * cannot derive them. The first is a prompt to do work; the second is a limit
 * of the product. Studio's backend has always distinguished them and sent both
 * — `projection.py` returns `unavailable: [{section, reason}]` — and the
 * adapter used to fold every reason into a prose string in `health.recommendedNext`,
 * which nothing rendered. So every deliberate gap reached the user as a blank
 * panel (AUD-002).
 *
 * Kept structured rather than prose precisely so a surface can find *its own*
 * section rather than parsing a list of sentences.
 */
export interface SectionUnavailable {
  /** The projection key, e.g. `workflows`, `value`, `inScope`. */
  section: string
  reason: string
}

export interface ProjectProjection {
  project: Project
  definition: ProjectDefinition
  requirements: Requirement[]
  acceptanceTests: AcceptanceTest[]
  modules: ProjectModule[]
  openDecisions: OpenDecision[]
  findings: ReviewFinding[]
  health: ProjectHealth
  /** Absent on a backend older than the disclosure. */
  extractionCoverage?: ExtractionCoverage
  recentChanges: { id: string; text: string; at: string }[]
  /**
   * Sections the backend declined to compute, with its reason for each.
   * Empty when everything asked for was computable.
   */
  unavailable: SectionUnavailable[]
  /**
   * Present when module derivation is unavailable. `null` when modules are
   * genuinely derivable — at which point an empty `modules` array means the
   * project has none, which is a different statement.
   */
  modulesGap: CapabilityGap | null
}
