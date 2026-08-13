import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServices } from '@/hooks/useServices'
import type { ArtifactPlanEdit, ModuleDecision, PublishInput } from '@/services/interfaces'
import type { ArtifactPublication, ArtifactDestination, ProjectSource } from '@/domain/types'

/**
 * The mock fixture's project id.
 *
 * **Not the active project.** Read `useServices().projectId` for that. This
 * remains only because the mock adapters and their tests are written against
 * this one fixture; anything reaching for it in live code is reaching for the
 * wrong project.
 */
export const PROJECT_ID = 'proj-ministry-reporting'

export function useProjection() {
  const { projection, projectId } = useServices()
  return useQuery({
    queryKey: ['projection', projectId],
    queryFn: () => projection.getProjection(projectId),
  })
}

export function useMessages() {
  const { memory, projectId } = useServices()
  return useQuery({
    queryKey: ['messages', projectId],
    queryFn: () => memory.listMessages(projectId),
  })
}

export function useInterviewSession() {
  const { memory, projectId } = useServices()
  return useQuery({
    queryKey: ['session', projectId],
    queryFn: () => memory.getInterviewSession(projectId),
  })
}

export function useProject() {
  const { memory, projectId } = useServices()
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: () => memory.getProject(projectId),
  })
}

/**
 * Submits a message and then requests the assistant turn.
 *
 * Order matters and mirrors ADR-0006: the message goes to KAE-Memory first, and
 * only an acknowledged message produces a turn. Studio never holds the message
 * as durable state of its own.
 */
export function useSendMessage() {
  // `memory` is deliberately not taken. This used to post the message and then
  // ask for a turn; CIE now records it itself, and holding a reference to the
  // client that could post it again is how the duplicate comes back.
  const { interview, projectId } = useServices()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: string) => {
      // One post, not two. CIE records the message itself as the first act of a
      // turn — before it reads anything, so a provider failure still leaves the
      // sentence durable. Calling `submitMessage` as well would store it twice,
      // and Memory is append-only: two pieces of evidence for one thing said
      // once, and every count downstream wrong.
      const turn = await interview.respondTo(projectId, body)
      // `null` rather than `0`: a turn does not report a revision, and
      // claiming one was the same fabrication as `accepted()` (AUD-014).
      return { result: { accepted: true, memoryRevision: null }, turn }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['messages', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['session', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
      ])
    },
  })
}

/**
 * Confirm the statements a turn reflected back.
 *
 * **The click is the confirmation**, which is why this invalidates the
 * projection as well as the transcript. The point of the gesture is that the
 * project visibly grows when a person agrees — a chat that got longer while
 * Discovery Progress stayed at "0 of 1 confirmed" is the defect it closes.
 */
export function useConfirmReading() {
  const { interview, projectId } = useServices()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (knowledgeIds: string[]) => interview.confirmReading(projectId, knowledgeIds),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['projection', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['session', projectId] }),
      ])
    },
  })
}

/**
 * Ask KAE-Memory to classify what the project holds into discovery areas.
 *
 * **The middle link of the loop, reachable from the product for the first
 * time.** Extraction writes knowledge, review assigns each statement to an
 * area, readiness counts per area. Studio drove the first and read the third
 * and never asked for the second, so a project could hold thirty confirmed
 * statements and report `0% · not_started` — which is what the deployed
 * acceptance project did (`AUD-041`).
 *
 * Queued, not done. The invalidation on success will usually read the same
 * numbers back; the run finishes in a worker, and the surface says so rather
 * than implying the click classified anything.
 */
export function useClassify() {
  const { projection, projectId } = useServices()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => projection.classify(projectId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projection', projectId] })
    },
  })
}

/**
 * Record a disposition on KAE's advice.
 *
 * Invalidates the projection: accepting a recommendation adds an assumption to
 * the project, and the point of the gesture is that agreeing visibly changes
 * something.
 */
export function useDecideRecommendation() {
  const { interview, projectId } = useServices()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      recommendation,
      disposition,
      modifiedTo,
      subject,
    }: {
      recommendation: { advice: string; reason: string; consequence: string }
      disposition: 'accept' | 'modify' | 'keep_open'
      modifiedTo?: string
      subject?: string
    }) =>
      interview.decideRecommendation(projectId, {
        disposition,
        advice: recommendation.advice,
        reason: recommendation.reason,
        consequence: recommendation.consequence,
        subject,
        modifiedTo,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['projection', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
      ])
    },
  })
}

export function useModuleDecision() {
  const { memory, projectId } = useServices()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ moduleId, decision }: { moduleId: string; decision: ModuleDecision }) =>
      memory.recordModuleDecision(projectId, moduleId, decision),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['projection', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['deliverables', projectId] }),
      ])
    },
  })
}

export function useDeferDecision() {
  const { memory, projectId } = useServices()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ decisionId, deferred }: { decisionId: string; deferred: boolean }) =>
      memory.deferDecision(projectId, decisionId, deferred),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projection', projectId] }),
  })
}

/**
 * Reject a candidate, with a reason.
 *
 * Its own hook rather than a flag on confirm. The prototype's Reject button
 * called the confirm mutation — harmless against fixtures that only counted
 * clicks, and against a live KAE-Memory it would have written the opposite of
 * what the operator pressed, into the durable record, silently.
 */
/** Provenance for one statement, fetched only when someone expands the row —
 *  a trace per requirement on every page load would be a request storm for
 *  information almost nobody opens. */
export function useKnowledgeTrace(knowledgeId: string) {
  const { memory, projectId } = useServices()
  return useQuery({
    queryKey: ['trace', projectId, knowledgeId],
    queryFn: () => memory.knowledgeTrace(projectId, knowledgeId),
    staleTime: Infinity,
  })
}

export function useRejectFinding() {
  const { memory, projectId } = useServices()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      findingId,
      reason,
      expectedVersion,
    }: {
      findingId: string
      reason: string
      expectedVersion: number
    }) => memory.rejectFinding(projectId, findingId, reason, expectedVersion),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projection', projectId] }),
  })
}

export function useConfirmFinding() {
  const { memory, projectId } = useServices()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (findingId: string) => memory.confirmFinding(projectId, findingId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projection', projectId] }),
  })
}

export function useDeliverables() {
  const { artifacts, projectId } = useServices()
  return useQuery({
    queryKey: ['deliverables', projectId],
    queryFn: () => artifacts.listDeliverables(projectId),
  })
}

export function useArtifactProfiles() {
  // Unscoped on purpose: profiles are a property of the deployment, not of a
  // project. If that contract ever gains a project, this key has to gain one
  // with it — a cache keyed on nothing would serve one project's answer for
  // another, which is the bug this file already carries a comment about.
  const { pipeline } = useServices()
  return useQuery({ queryKey: ['artifact-profiles'], queryFn: () => pipeline.listProfiles() })
}

export function useArtifactPublishers() {
  const { pipeline } = useServices()
  return useQuery({ queryKey: ['artifact-publishers'], queryFn: () => pipeline.listPublishers() })
}

/** Propose a plan. Generates nothing, so it is safe to call as often as asked. */
export function useCreateArtifactPlan() {
  const { pipeline, projectId } = useServices()
  return useMutation({
    mutationFn: (profile: string) => pipeline.createPlan(projectId, profile),
  })
}

export function useEditArtifactPlan() {
  const { pipeline } = useServices()
  return useMutation({
    mutationFn: ({ planId, edits }: { planId: string; edits: ArtifactPlanEdit[] }) =>
      pipeline.editPlan(planId, edits),
  })
}

/**
 * Generate from the plan as edited.
 *
 * The idempotency key is generated once per attempt and passed in, not derived
 * here from a render — a key that changed between a double-click's two calls
 * would produce two runs, which is the failure the key exists to prevent.
 */
export function useGenerateArtifacts() {
  const { pipeline, projectId } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ planId, idempotencyKey }: { planId: string; idempotencyKey: string }) =>
      pipeline.generate(projectId, planId, idempotencyKey),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deliverables', projectId] }),
  })
}

export function useArtifactPackage(packageId: string | undefined) {
  const { pipeline } = useServices()
  return useQuery({
    queryKey: ['artifact-package', packageId],
    queryFn: () => pipeline.getPackage(packageId!),
    enabled: Boolean(packageId),
  })
}

export function useValidatePackage(packageId: string | undefined) {
  const { pipeline } = useServices()
  return useQuery({
    queryKey: ['artifact-validation', packageId],
    queryFn: () => pipeline.validate(packageId!),
    enabled: Boolean(packageId),
  })
}

/** Read one generated document, so a person can read before approving. */
export function useArtifactContent(artifactId: string | undefined) {
  const { pipeline } = useServices()
  return useQuery({
    queryKey: ['artifact-content', artifactId],
    queryFn: () => pipeline.getArtifact(artifactId!),
    enabled: Boolean(artifactId),
  })
}

/**
 * Read the destination and describe what would change. Writes nothing.
 *
 * A mutation rather than a query despite being read-only: it must run when the
 * user asks, not when a component mounts, and its result has to stay put while
 * they read it. A query would refetch on focus and quietly replace the preview
 * an approval is about to bind.
 */
export function usePreviewPublication() {
  const { pipeline } = useServices()
  return useMutation({
    mutationFn: ({
      packageId,
      destination,
    }: {
      packageId: string
      destination: ArtifactDestination
    }) => pipeline.preview(packageId, destination),
  })
}

export function useApprovePreview() {
  const { pipeline } = useServices()
  return useMutation({ mutationFn: (previewId: string) => pipeline.approve(previewId) })
}

export function usePublishPackage() {
  const { pipeline, projectId } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PublishInput) => pipeline.publish(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deliverables', projectId] }),
  })
}

/**
 * A publication's authoritative status, polled until it stops moving.
 *
 * `POST /api/artifact-publications` returns **202 Accepted**. The UI treated
 * that first response as terminal and rendered anything other than `succeeded`
 * as "Not published" — so an in-flight publication appeared under a warning
 * icon as a failure, and a user would reasonably retry a publication that was
 * still running (AUD-018).
 *
 * Wrong in the safe direction, and still wrong. `accepted` and `running` are
 * the two states that mean *ask again*.
 */
const TERMINAL = new Set(['succeeded', 'failed'])

export function usePublicationStatus(publication: ArtifactPublication | null) {
  const { pipeline } = useServices()
  const id = publication?.publicationId
  const settled = publication ? TERMINAL.has(publication.status) : true

  return useQuery({
    queryKey: ['artifact-publication', id],
    queryFn: () => pipeline.getPublication(id!),
    // Only while there is something to wait for. A settled publication is
    // re-read by nothing, and an absent one starts nothing.
    enabled: Boolean(id) && !settled,
    refetchInterval: (query) => {
      const status = (query.state.data as ArtifactPublication | undefined)?.status
      return status && TERMINAL.has(status) ? false : 1500
    },
  })
}

export function useProvenance(publicationId: string | undefined) {
  const { pipeline } = useServices()
  return useQuery({
    queryKey: ['artifact-provenance', publicationId],
    queryFn: () => pipeline.getProvenance(publicationId!),
    enabled: Boolean(publicationId),
  })
}

/* ------------------------------------------------------------- acquisition */

export function useConnections() {
  const { acquisition } = useServices()
  return useQuery({ queryKey: ['connections'], queryFn: () => acquisition.listConnections() })
}

export function useAddConnection() {
  const { acquisition } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { provider: string; label: string; connectionRef: string }) =>
      acquisition.addConnection(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['connections'] }),
  })
}

/** Ask the provider what a credential can do. Writes nothing. */
export function useCheckConnectivity() {
  const { acquisition } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ connectionId, location }: { connectionId: string; location: string }) =>
      acquisition.checkConnectivity(connectionId, location),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['connections'] }),
  })
}

/**
 * This project's sources.
 *
 * Selected down to the list, so every existing caller keeps its shape and
 * `QueryState` keeps its meaning — an empty array is still an empty project.
 * Whether the list is *complete* is the other question and it has its own hook,
 * because a caller that answers one while believing it answered the other is
 * exactly the failure `D-21` introduced the field to prevent.
 */
export function useSources() {
  const { acquisition, projectId } = useServices()
  return useQuery({
    queryKey: ['sources', projectId],
    queryFn: () => acquisition.listSources(projectId),
    select: (listing) => listing.sources,
  })
}

/**
 * Sources of one kind — the same query and cache entry as `useSources`.
 *
 * Added when `paste` became a kind (`D-24`). Every source used to be a
 * repository, so the Repositories tab could list them all; a pasted brief
 * appearing there would be labelled a repository by its surroundings, which is
 * a claim the list makes without saying a word.
 */
export function useSourcesOfKind(kinds: ProjectSource['kind'][]) {
  const { acquisition, projectId } = useServices()
  return useQuery({
    queryKey: ['sources', projectId],
    queryFn: () => acquisition.listSources(projectId),
    select: (listing) => listing.sources.filter((source) => kinds.includes(source.kind)),
  })
}

/**
 * Why this project's source list may be short, or `''` when it is not.
 *
 * The same query and the same cache entry as `useSources` — not a second
 * request. Sources became durable in `D-21`, which means reading them can now
 * fail, and an empty list then says *"this project has no sources"* about a
 * request that did not complete.
 */
export function useSourcesUnavailable() {
  const { acquisition, projectId } = useServices()
  return useQuery({
    queryKey: ['sources', projectId],
    queryFn: () => acquisition.listSources(projectId),
    select: (listing) => listing.unavailable,
  })
}

export function useAddSource() {
  const { acquisition, projectId } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      kind: string
      connectionId: string
      location: string
      reference: string
    }) => acquisition.addSource(projectId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sources', projectId] }),
  })
}

/** Resolve to an immutable commit. **Not** analysis — see `ProjectSources`. */
export function usePinSource() {
  const { acquisition, projectId } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sourceId: string) => acquisition.pinSource(sourceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sources', projectId] }),
  })
}

/** The files a pinned source would read. Enabled only once one is chosen. */
export function useSourceFiles(sourceId: string | undefined, limit?: number) {
  const { acquisition } = useServices()
  return useQuery({
    queryKey: ['source-files', sourceId, limit],
    queryFn: () => acquisition.listFiles(sourceId!, limit),
    enabled: Boolean(sourceId),
  })
}

/**
 * The first part of one file, at the pinned revision.
 *
 * `POST /api/sources/{id}/sample` was routed and on no port, so nothing could
 * call it. Fetched only when a file is actually opened — reading every file to
 * populate a list would be an expensive way to show nothing.
 */
export function useSampleFile(sourceId: string, path: string | null) {
  const { acquisition } = useServices()
  return useQuery({
    queryKey: ['source-sample', sourceId, path],
    queryFn: () => acquisition.sample(sourceId, path!),
    enabled: Boolean(path),
  })
}

export function useIngestFiles() {
  const { acquisition, projectId } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { sourceId: string; paths: string[] }) =>
      acquisition.ingestFiles(input.sourceId, projectId, input.paths),
    onSuccess: async () => {
      // Extraction is asynchronous, so the projection will not have moved yet.
      // Invalidating anyway is right: the transcript has grown, and a user who
      // just handed KAE four files should see the page acknowledge it rather
      // than look unchanged until they reload.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['projection', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['sources', projectId] }),
      ])
    },
  })
}

/* -------------------------------------------------------------- setup (SET-2) */

/**
 * What this project is configured to do — stage one of the seven stages.
 *
 * Its own query key rather than part of the projection, because setup and
 * knowledge answer different questions and must be able to fail independently.
 * A projection that could not be read must not also hide whether a repository
 * is connected.
 */
export function useSetup() {
  const { setup, projectId } = useServices()
  return useQuery({
    queryKey: ['setup', projectId],
    queryFn: () => setup.getSetup(projectId),
  })
}

export function useMemoryConnections() {
  const { setup, projectId } = useServices()
  return useQuery({
    queryKey: ['memory-connections', projectId],
    queryFn: () => setup.listConnections(projectId),
  })
}

/** Everything that changes setup invalidates the same two reads. */
function useSetupMutation<TArgs>(run: (projectId: string, args: TArgs) => Promise<unknown>) {
  const { setup, projectId } = useServices()
  const queryClient = useQueryClient()
  void setup
  return useMutation({
    mutationFn: (args: TArgs) => run(projectId, args),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['setup', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['memory-connections', projectId] }),
      ])
    },
  })
}

export function useConfigureField() {
  const { setup } = useServices()
  return useSetupMutation<{ field: string; value: string; state?: string; evidence?: string }>(
    (projectId, args) =>
      setup.configure(projectId, args.field, args.value, {
        state: args.state,
        evidence: args.evidence,
      }),
  )
}

export function useRegisterTarget() {
  const { setup } = useServices()
  return useSetupMutation<{
    name: string
    configuration: Record<string, string>
    connectionId?: string
    makeDefault?: boolean
  }>((projectId, args) => setup.registerTarget(projectId, args))
}

export function useSetDefaultTarget() {
  const { setup } = useServices()
  return useSetupMutation<string>((projectId, targetId) =>
    setup.setDefaultTarget(projectId, targetId),
  )
}

export function useRecordMemoryConnection() {
  const { setup } = useServices()
  return useSetupMutation<{ credentialReference: string; provider?: string; detail?: string }>(
    (projectId, args) => setup.recordConnection(projectId, args),
  )
}

export function useAuthorizeMemoryConnection() {
  const { setup } = useServices()
  return useSetupMutation<string>((projectId, connectionId) =>
    setup.authorizeConnection(projectId, connectionId),
  )
}

/* ---------------------------------------------------------- ingestion (ING-1) */

/**
 * Hand KAE a document.
 *
 * Invalidates coverage and runs but **not** the projection: the statements do
 * not exist yet. Extraction is queued, a worker does it, and a projection
 * refetched here would show the same numbers and read as "nothing happened".
 */
export function useIngestText() {
  const { ingestion, projectId } = useServices()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (document: { title: string; text: string }) =>
      ingestion.ingestText(projectId, document),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['runs', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['coverage', projectId] }),
      ])
    },
  })
}

export function useExtractionCoverage() {
  const { ingestion, projectId } = useServices()
  return useQuery({
    queryKey: ['coverage', projectId],
    queryFn: () => ingestion.coverage(projectId),
  })
}

/**
 * What KAE has done, refreshed while anything is still going.
 *
 * Polling only while a run is unfinished. A page that polled forever would keep
 * a browser busy describing a project nothing is happening to; one that never
 * polled would show a person a pending run and never change it.
 */
export function useRuns() {
  const { ingestion, projectId } = useServices()
  const queryClient = useQueryClient()
  // Whether work was in flight the last time this was asked. The transition
  // out of it is the event nothing was listening for (`D-43`).
  const wasWorking = useRef(false)

  const query = useQuery({
    queryKey: ['runs', projectId],
    queryFn: () => ingestion.runs(projectId),
    refetchInterval: (query) => {
      const rows = query.state.data
      if (!rows) return false
      const working = rows.some((run) => run.status === 'pending' || run.status === 'running')
      return working ? 4000 : false
    },
  })

  const working = (query.data ?? []).some(
    (run) => run.status === 'pending' || run.status === 'running',
  )

  useEffect(() => {
    // **Extraction is the one thing that changes a project without anybody
    // touching it.** Every mutation a person makes already invalidates the
    // projection; a run finishing did not, so somebody could watch the runs go
    // green and read a page still describing the project as it was before
    // their document was read.
    //
    // Fired on the transition rather than on every poll: invalidating while
    // work is in flight would refetch the whole projection every four seconds
    // to show a project that has not changed yet.
    if (wasWorking.current && !working) {
      void queryClient.invalidateQueries({ queryKey: ['projection', projectId] })
    }
    wasWorking.current = working
  }, [working, projectId, queryClient])

  return query
}

/**
 * Repositories this deployment's credential can reach.
 *
 * Not per project — the credential is deployment-wide today, so the answer is
 * the same for every project here. Keyed accordingly, which also means the list
 * is fetched once and shared by every surface that offers a picker.
 */
export function useAvailableRepositories(query?: string) {
  const { acquisition } = useServices()
  return useQuery({
    queryKey: ['github-repositories', query ?? ''],
    queryFn: () => acquisition.availableRepositories(query),
    // The set changes when somebody creates a repository, not between renders.
    staleTime: 60_000,
  })
}
