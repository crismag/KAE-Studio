import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServices } from '@/hooks/useServices'
import type { ModuleDecision } from '@/services/interfaces'
import type { PublishTargetKind } from '@/domain/types'

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

export function usePublishTargets() {
  // Unscoped on purpose: `listTargets()` takes no project, so publication
  // targets are a property of the deployment rather than of a project. If that
  // contract ever gains a project, this key has to gain one with it.
  const { publisher } = useServices()
  return useQuery({ queryKey: ['publish-targets'], queryFn: () => publisher.listTargets() })
}

export function useGenerateDeliverable() {
  const { artifacts, projectId } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (deliverableId: string) => artifacts.generate(projectId, deliverableId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deliverables', projectId] }),
  })
}

export function usePublishDeliverable() {
  const { publisher, projectId } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ deliverableId, target }: { deliverableId: string; target: PublishTargetKind }) =>
      publisher.publish(deliverableId, target),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deliverables', projectId] }),
  })
}
