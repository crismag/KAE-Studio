import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServices } from '@/hooks/useServices'
import type { ArtifactPlanEdit, ModuleDecision, PublishInput } from '@/services/interfaces'
import type { ArtifactDestination } from '@/domain/types'

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
      return { result: { accepted: true, memoryRevision: 0 }, turn }
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

export function useProvenance(publicationId: string | undefined) {
  const { pipeline } = useServices()
  return useQuery({
    queryKey: ['artifact-provenance', publicationId],
    queryFn: () => pipeline.getProvenance(publicationId!),
    enabled: Boolean(publicationId),
  })
}
