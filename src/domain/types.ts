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
  /**
   * Which set of adjacent statements this one belongs to, if any.
   *
   * `PPA-15`: seventy flat statements is the customer's original problem
   * restated in the product's own words. Statements sharing a group say
   * adjacent things and are worth reading together.
   *
   * **A group is not a merge.** Every member renders whole and stays separately
   * confirmable. `null` means this resembles nothing else, which is a fact
   * about it — and also what a project too large to group returns, so a surface
   * must not read it as "nothing here resembles anything".
   */
  relatedGroup?: number | null
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
  /**
   * How much this matters, in Memory's own grading.
   *
   * **Not a reason, and no longer labelled as one.** This was `whyItMatters`,
   * rendered under every question in the position an interface reserves for
   * *why this matters* — and filled with `Severity: major`. Nothing was
   * invented; the severity is real. It answered a different question from the
   * one the label asked, and the reader supplied the difference.
   *
   * Memory's clarification candidates carry a severity and no rationale, so
   * there is no reason to render. An absent reason claims less than a grade
   * wearing a reason's label.
   */
  severity: string
  blocks: string[]
  suggestedOwner: string
  deferred: boolean
  /**
   * Whether this question has actually been put to somebody.
   *
   * `false` means it is a *candidate* — derived from the project's findings and
   * shown so a person can see what is unresolved, but never asked. Answering
   * needs a message id, which only asking produces.
   *
   * The distinction exists because reading a project used to ask its questions:
   * the projection called the materialising endpoint, so every page load wrote
   * up to twenty of them into the transcript (issue #3).
   */
  asked: boolean
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
  /** Display chips. Presentation only — never parse these back into data. */
  subjectIds: string[]
  /**
   * The knowledge version this finding was rendered from, for optimistic
   * concurrency on reject.
   *
   * Carried as data because it was previously recovered by string-parsing
   * `subjectIds` for an entry beginning with `v` — which picks the wrong
   * number whenever a knowledge `kind` happens to start with one, and falls
   * back to `0`, a value the route rejects outright (AUD-016). Optimistic
   * concurrency driven by parsing a display string is not concurrency control.
   */
  version: number
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
/**
 * How a project's knowledge reached its discovery areas — beside the number,
 * never folded into it.
 *
 * `engine: null` is the state a bare percentage hides completely: **no review
 * has run**, so no statement is in any area and readiness is 0 whatever the
 * project holds. That is not a thin project, and telling the two apart is the
 * difference between "keep talking" and "press the button nobody knew about".
 *
 * `'unknown'` is a Memory too old to say, which is a third thing again.
 */
export interface ClassificationState {
  engine: string | null | 'unknown'
  degraded: boolean
  /** Memory's own sentence about its limits. Never rewritten on the way through. */
  note: string
  reviewedAt: string | null
}

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
   * How the readiness number was reached. Absent on a backend older than the
   * block, which is why every reader must tolerate `undefined` rather than
   * assuming "never classified".
   */
  classification?: ClassificationState
  /**
   * Present when module derivation is unavailable. `null` when modules are
   * genuinely derivable — at which point an empty `modules` array means the
   * project has none, which is a different statement.
   */
  modulesGap: CapabilityGap | null
  /**
   * Contradictions Memory has counted but will not enumerate.
   *
   * The count is real and the list is not available, which is a combination
   * the UI has to be able to express: a project with two contradictions and no
   * way to show them must not render as a project with none. The adapter used
   * to fold this into `health.summary`, which nothing rendered, so Reviews
   * showed a green `0` over a real number (AUD-003).
   */
  contradictions: { count: number; listable: boolean; reason: string }
  /**
   * What was said, what KAE is guessing, and what nobody has decided.
   *
   * `D-18`. KAE-Memory composes this for exactly the project that has almost
   * nothing yet, and keeps its collections apart on purpose: *"a reader who
   * cannot tell a confirmed requirement from a plausible guess has a document
   * that is worse than nothing — the same document with the warning removed."*
   *
   * Studio received all of it and rendered none of it. The adapter's own type
   * declared two of the fields, read one, and put it into
   * `health.recommendedNext`, which no component renders. `AUD-041` at the
   * last hop.
   */
  preliminary: PreliminaryContext
}

/* ------------------------------------------------------ preliminary context */

/**
 * One thing a person actually said, as it was recorded.
 *
 * First in the section, and first in KAE-Memory's own object, for the reason
 * it gives: *"a preliminary context is most often wrong in its interpretation
 * rather than in its transcription. A reader who can see the original sentence
 * can catch that; one who cannot, cannot."*
 */
export interface StatedVerbatim {
  messageId: string
  text: string
  actorType: string
  messageType: string
}

/** One assumption, with what it would cost to be wrong. */
export interface AssumedEntry {
  assumptionId: string
  subject: string
  assumedValue: string
  reason: string
  origin: string
  consequence: string
  state: string
  reversible: boolean
  /** Architectural, unsafe, or irreversible — the ones worth a person's time. */
  material: boolean
  acceptedBy: string | null
  /** A line a reader can act on, written by Memory and rendered unedited. */
  disclosure: string
}

/** One thing nobody has decided, and whether it is worth deciding now. */
export interface UnknownEntry {
  clarificationId: string
  question: string
  areaKey: string | null
  severity: string
  findingKind: string
  material: boolean
  /**
   * `open` means nobody was asked. Anything else means someone **was** asked
   * and did not decide — a different situation, and one Memory requires to
   * stay visible (`N36`).
   */
  disposition: string
}

export interface PreliminaryContext {
  /**
   * Whether this section was composed at all.
   *
   * `false` when Memory did not answer, and it is not the same as *"nothing
   * is preliminary here"* — a distinction the surface has to keep, because
   * silence read as reassurance is this estate's most repeated defect.
   */
  composed: boolean
  /** Whether anything here rests on something nobody has confirmed. */
  isPreliminary: boolean
  statedVerbatim: StatedVerbatim[]
  assumed: AssumedEntry[]
  materialUnknowns: UnknownEntry[]
  deferrableUnknowns: UnknownEntry[]
  warnings: string[]
}

/* ------------------------------------------------------------ project setup */

/**
 * Stage one of the seven Studio stages, which had no surface at all.
 *
 * KAE-Memory has modelled every field here since migration `0020` —
 * `project_configuration`, `publication_targets`, `provider_connections` — and
 * on the deployed database all three held **zero rows**. Not under-used: never
 * written to. There were no POST routes, and the client methods pointing at the
 * read endpoints had no callers.
 *
 * `ADR-0003` already ruled how this reports state: **no percentage.** Setup
 * carries discrete, verifiable state — *none · configured · verified* — because
 * a percentage over two booleans says less than the booleans and would put
 * configuration into the same visual grammar as knowledge coverage.
 */
export interface ConfiguredValue {
  value: string
  /**
   * How well established this is. `confirmed` means a person chose it;
   * `inferred` and `suggested` must carry evidence, and `suggested` is
   * deliberately **not** in use — it is a proposal to accept, not a setting.
   */
  state: string
  in_use: boolean
  evidence: string
  confirmed_by: string | null
}

/** One thing setup is missing, and whether it stops anything. */
export interface SetupGap {
  field: string
  capability: string
  blocking: boolean
  reason: string
  next_action: string
}

/**
 * A registered destination, described without the means to reach it.
 *
 * `unavailableReason` rather than a bare boolean: *"I never set this up"*,
 * *"it stopped working"* and *"somebody turned it off"* have three different
 * remedies, and a caller given only the boolean has to guess which.
 */
export interface PublicationTarget {
  targetId: string
  name: string
  provider: string
  purpose: string
  isDefault: boolean
  enabled: boolean
  available: boolean
  unavailableReason: string | null
  authorization: string
  configuration: Record<string, string>
}

/** Permission to reach a provider. **Never carries a credential.** */
export interface MemoryConnection {
  connectionId: string
  provider: string
  state: string
  /** Where the credential lives — `env:NAME` — never the credential. */
  credentialReference: string | null
  authorizedBy: string | null
  lastVerifiedAt: string | null
  detail: string
}

export interface SetupState {
  projectId: string
  setupState: string
  blocksAnything: boolean
  gaps: SetupGap[]
  configuration: Record<string, ConfiguredValue>
  unknownFields: string[]
  targets: PublicationTarget[]
}

/* ---------------------------------------------------------------- ingestion */

/**
 * What handing KAE a document actually did.
 *
 * Memory answers `202` with the counts, and **every field here must reach a
 * person**. A document silently cut at a chunk limit reported success and lost
 * most of itself, which is `AUD-024`.
 */
export interface DocumentIngestOutcome {
  document: string
  /** Sections stored as evidence and queued for reading. */
  chunks: number
  /** Sections dropped at the limit. Zero is a fact; a missing count is not. */
  truncatedChunks: number
  /** Memory's own words about what it did or could not do. Never summarised. */
  warnings: string[]
}

/**
 * One thing KAE did, and how the attempt ended.
 *
 * Memory has recorded all of this since the worker existed and Studio rendered
 * none of it, so a person starting a parse watched nothing and a failed run was
 * indistinguishable from one that never started (`VC-02`).
 */
export interface AgentRunRecord {
  id: string
  role: string
  status: string
  attemptNumber: number
  errorCode: string | null
  /** Memory's technical detail, verbatim. Read beside the plain-words reading. */
  errorMessage: string | null
  startedAt: string | null
  completedAt: string | null
  /** What the run produced — items written, what classified it, how much was lost. */
  outputSummary: Record<string, unknown>
}
