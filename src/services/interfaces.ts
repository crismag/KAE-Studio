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
 *   ArtifactService          -> KAE-Memory's recorded deliverables
 *   ArtifactPipeline         -> the KAE-Artifacts v1 API, through Studio's backend
 *
 * No implementation here writes to a database. Studio owns no durable project
 * state (ADR-0006).
 */

import type {
  ConnectivityResult,
  ProjectSource,
  ProviderConnection,
  ArtifactApproval,
  ArtifactPackage,
  ArtifactPlan,
  ArtifactPreview,
  ArtifactProfile,
  ArtifactPublication,
  ArtifactDestination,
  ConversationMessage,
  Deliverable,
  GenerationRun,
  AgentRunRecord,
  ExtractionCoverage,
  DocumentIngestOutcome,
  InterviewSession,
  MemoryConnection,
  Project,
  ProjectProjection,
  PublicationTarget,
  PublisherAvailability,
  SetupState,
  ValidationResult,
} from '@/domain/types'

/**
 * Result of a mutating call, carrying the revision it produced.
 *
 * `memoryRevision` is `null` when the write succeeded and the response did not
 * report one. It was `number`, and the live adapter returned a literal `0` for
 * every write — discarding the actual response body and asserting a revision
 * nobody had reported (AUD-014). Nothing rendered it, so no screen was wrong;
 * what was wrong was that a caller could not tell an unreported revision from
 * revision zero, and the first consumer to trust it would have been.
 */
export interface MemoryWriteResult {
  accepted: boolean
  /** `null` when the write was acknowledged without a revision. */
  memoryRevision: number | null
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
  /**
   * The engine the producing run recorded — a model identifier, or
   * `deterministic-fixture` when the offline adapter produced it.
   *
   * Absent on a Memory older than the disclosure, which is different from
   * `null`: absent means nobody can say, `null` means the run recorded none.
   */
  produced_by?: string | null
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
  /**
   * Confirm the statements a turn reflected back, as one act.
   *
   * **The click is the confirmation.** A person reads a reading, agrees once,
   * and everything it was built from becomes confirmed knowledge — nothing
   * asks afterwards whether they meant it.
   *
   * The ids come from the turn's own `provenance`, so agreement lands on what
   * was shown rather than on whatever is proposed by the time the click
   * arrives. KAE-Memory applies the set all or nothing.
   */
  confirmReading(projectId: string, knowledgeIds: string[]): Promise<void>
  /**
   * Record what a person did with KAE's advice.
   *
   * All three dispositions cost one call. If accepting were cheap and
   * disagreeing expensive, the agreement collected would mean less for it.
   */
  decideRecommendation(
    projectId: string,
    decision: {
      disposition: 'accept' | 'modify' | 'keep_open'
      advice: string
      reason: string
      consequence: string
      subject?: string
      modifiedTo?: string
    },
  ): Promise<void>
}

/**
 * Project Setup — how a project is wired, as distinct from what it knows.
 *
 * The seven Studio stages begin with Project Setup and it has never existed as
 * a surface. Everything here reaches KAE-Memory, which has modelled all of it
 * since migration `0020` and had no write path (`AUD-042`).
 *
 * Not on the acquisition port, deliberately. `AcquisitionPort` is *doing* —
 * reaching a provider, listing files, reading them. This is *deciding*, and the
 * decisions are durable while the acquiring is not (`ADR-0004`, `ADR-0005`).
 */
export interface SetupPort {
  /** What this project is configured to do, and what is missing. */
  getSetup(projectId: string): Promise<SetupState>
  /** Set one configuration field. Returns the recomputed state. */
  configure(
    projectId: string,
    field: string,
    value: string,
    options?: { state?: string; evidence?: string },
  ): Promise<SetupState>
  /** Register where this project's outputs go. */
  registerTarget(
    projectId: string,
    target: {
      name: string
      provider?: string
      configuration: Record<string, string>
      connectionId?: string
      makeDefault?: boolean
    },
  ): Promise<PublicationTarget>
  /** Point the default at a different registered target. */
  setDefaultTarget(projectId: string, targetId: string): Promise<PublicationTarget>
  /** Connections recorded durably in Memory — unlike acquisition's own. */
  listConnections(projectId: string): Promise<MemoryConnection[]>
  recordConnection(
    projectId: string,
    connection: { provider?: string; credentialReference: string; detail?: string },
  ): Promise<MemoryConnection>
  /** Mark a connection granted. The authoriser is the signed-in operator. */
  authorizeConnection(projectId: string, connectionId: string): Promise<MemoryConnection>
}

/**
 * Getting material into a project without anybody retyping it.
 *
 * The second intake path, and the one the product never had a surface for. The
 * owner's sentence: *"Not all information intake are coming from an interview."*
 *
 * Text, not bytes. Memory parses no file formats — there is no MIME handling or
 * decode path anywhere in the estate — so a file upload port here would be a
 * capability nothing behind it can honour.
 */
export interface IngestionPort {
  /** Hand KAE a document. Returns what it did, including what it dropped. */
  ingestText(
    projectId: string,
    document: { title: string; text: string },
  ): Promise<DocumentIngestOutcome>
  /** How much of what was submitted became knowledge. */
  coverage(projectId: string): Promise<ExtractionCoverage>
  /** Every run this project has produced, newest first. */
  runs(projectId: string): Promise<AgentRunRecord[]>
}

/** Assembles the projection the UI renders from current Memory knowledge. */
export interface ProjectProjectionService {
  getProjection(projectId: string): Promise<ProjectProjection>
  /**
   * Ask KAE-Memory to classify what the project holds into discovery areas.
   *
   * The middle link of the product's own loop: extraction writes knowledge,
   * review assigns each statement to an area, readiness counts per area.
   * Without it a project accumulates confirmed statements and reports `0% ·
   * not_started` forever (`AUD-041`).
   *
   * Queued, not done — a worker runs it. The caller should expect the
   * projection to change on a later read rather than on this one's return.
   */
  classify(projectId: string): Promise<void>
}

/** Deliverables Memory recorded. Read-only history, not generation. */
export interface ArtifactService {
  listDeliverables(projectId: string): Promise<Deliverable[]>
}

/**
 * KAE-Artifacts, as resources rather than as two convenience calls.
 *
 * The prototype had `generate(deliverableId)` and `publish(target)`. Those
 * cannot express the thing the product is actually for: a plan a user argues
 * with before anything is generated, and an approval bound to exactly what a
 * destination would change. Each step below is separate because each is a place
 * a person makes a decision.
 *
 * Studio decides none of them. Whether an entry is generatable, whether an
 * approval still holds, whether a branch moved — all KAE-Artifacts' answers,
 * carried here unchanged.
 */
export interface ArtifactPipeline {
  /** What shapes of package exist, with the files each would propose. */
  listProfiles(): Promise<ArtifactProfile[]>

  /** What this deployment can publish to, and why not where it cannot. */
  listPublishers(): Promise<PublisherAvailability[]>

  /** Propose a plan from current project knowledge. **Generates nothing.** */
  createPlan(projectId: string, profile: string): Promise<ArtifactPlan>

  getPlan(planId: string): Promise<ArtifactPlan>

  /**
   * Apply the user's edits. Only paths, selection and options may change: a
   * different artifact type is a different entry, not an edit to this one.
   */
  editPlan(planId: string, edits: ArtifactPlanEdit[]): Promise<ArtifactPlan>

  /**
   * Generate from the plan **as edited**.
   *
   * The idempotency key is the caller's, so a double-click, a reload, or a
   * retry after a dropped response all resolve to one run.
   */
  generate(projectId: string, planId: string, idempotencyKey: string): Promise<GenerationRun>

  getPackage(packageId: string): Promise<ArtifactPackage>

  /** One document, with its content, so a person can read before approving. */
  getArtifact(artifactId: string): Promise<ArtifactContent>

  validate(packageId: string): Promise<ValidationResult>

  /** Read the destination and describe exactly what would change. Writes nothing. */
  preview(packageId: string, destination: ArtifactDestination): Promise<ArtifactPreview>

  /**
   * Approve a **preview**, not a package.
   *
   * What a person reviewed is a set of changes; a package alone does not say
   * whether those changes add four files or overwrite four. The approver is the
   * signed-in operator, resolved server-side — Studio never names one.
   */
  approve(previewId: string): Promise<ArtifactApproval>

  publish(input: PublishInput): Promise<ArtifactPublication>

  getPublication(publicationId: string): Promise<ArtifactPublication>

  /** Which knowledge and which bytes produced which destination state. */
  getProvenance(publicationId: string): Promise<Record<string, unknown>>
}

/**
 * Connections and sources. STI-1 only.
 *
 * There is no `analyze` method, and that absence is deliberate. A port that
 * declared one would invite a mock to implement it, and a mock that returned
 * findings would let the entire interface be built and demoed against a
 * capability that does not exist.
 */
export interface AcquisitionPort {
  listConnections(): Promise<ProviderConnection[]>
  addConnection(input: {
    provider: string
    label: string
    /** `env:NAME`. A reference to a secret, never one. */
    connectionRef: string
  }): Promise<ProviderConnection>
  /** Ask the provider what a credential can do. **Writes nothing.** */
  checkConnectivity(connectionId: string, location: string): Promise<ConnectivityResult>

  listSources(projectId: string): Promise<ProjectSource[]>
  addSource(
    projectId: string,
    input: { kind: string; connectionId: string; location: string; reference: string },
  ): Promise<ProjectSource>
  /** Resolve to an immutable commit. The furthest a source can currently go. */
  pinSource(sourceId: string): Promise<ProjectSource>

  /**
   * The in-scope files of a pinned source, largest first. **Reads nothing into
   * the project** — it lists what an ingest would read.
   *
   * The tree was always resolved and never returned, so a user could see
   * "412 files" and not one of their names.
   */
  listFiles(sourceId: string, limit?: number): Promise<SourceFileListing>

  /**
   * Read chosen files at the pinned revision and record them as evidence.
   *
   * **Ingestion, not analysis.** Nothing derives structure: the text becomes
   * durable evidence, extraction proposes candidates, a person confirms.
   * `source.analysis` stays a capability gap, and calling this analysis would
   * be the specific dishonesty `ANALYSIS_UNAVAILABLE` exists to prevent.
   *
   * Paths are explicit. Ingesting a whole repository unasked is the bulk import
   * the acquisition contract warns against, and choosing is how a person tells
   * KAE what matters.
   */
  ingestFiles(sourceId: string, projectId: string, paths: string[]): Promise<IngestOutcome>
}

export interface SourceFileListing {
  files: { path: string; size: number }[]
  /** The repository was larger than one listing, or the limit cut it. */
  truncated: boolean
}

export interface IngestOutcome {
  revision: string
  ingested: {
    path: string
    /** Memory's 202 body: chunk counts, truncation and warnings. */
    ingested: Record<string, unknown>
  }[]
  proves: string
}

export interface ArtifactPlanEdit {
  type: string
  logicalPath?: string
  selected?: boolean
  options?: Record<string, string>
}

export interface ArtifactContent {
  artifactId: string
  type: string
  logicalPath: string
  mediaType: string
  checksum: string
  sizeBytes: number
  inputRevision: string
  generatorVersion: string
  content: string
}

export interface PublishInput {
  packageId: string
  destination: ArtifactDestination
  approvalId: string
  idempotencyKey: string
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
  pipeline: ArtifactPipeline
  acquisition: AcquisitionPort
  setup: SetupPort
  ingestion: IngestionPort
}
