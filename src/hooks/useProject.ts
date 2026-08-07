import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServices } from '@/hooks/useServices'
import type { ModuleDecision } from '@/services/interfaces'
import type { PublishTargetKind } from '@/domain/types'

/** The prototype operates on one sample project. */
export const PROJECT_ID = 'proj-ministry-reporting'

export function useProjection() {
  const { projection } = useServices()
  return useQuery({
    queryKey: ['projection', PROJECT_ID],
    queryFn: () => projection.getProjection(PROJECT_ID),
  })
}

export function useMessages() {
  const { memory } = useServices()
  return useQuery({
    queryKey: ['messages', PROJECT_ID],
    queryFn: () => memory.listMessages(PROJECT_ID),
  })
}

export function useInterviewSession() {
  const { memory } = useServices()
  return useQuery({
    queryKey: ['session', PROJECT_ID],
    queryFn: () => memory.getInterviewSession(PROJECT_ID),
  })
}

export function useProject() {
  const { memory } = useServices()
  return useQuery({
    queryKey: ['project', PROJECT_ID],
    queryFn: () => memory.getProject(PROJECT_ID),
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
  const { memory, interview } = useServices()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: string) => {
      const idempotencyKey = `studio-message-${Date.now()}`
      const { result } = await memory.submitMessage(PROJECT_ID, body, idempotencyKey)
      await queryClient.invalidateQueries({ queryKey: ['messages', PROJECT_ID] })
      const turn = await interview.respondTo(PROJECT_ID, body)
      return { result, turn }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['messages', PROJECT_ID] }),
        queryClient.invalidateQueries({ queryKey: ['session', PROJECT_ID] }),
        queryClient.invalidateQueries({ queryKey: ['project', PROJECT_ID] }),
      ])
    },
  })
}

export function useModuleDecision() {
  const { memory } = useServices()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ moduleId, decision }: { moduleId: string; decision: ModuleDecision }) =>
      memory.recordModuleDecision(PROJECT_ID, moduleId, decision),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['projection', PROJECT_ID] }),
        queryClient.invalidateQueries({ queryKey: ['project', PROJECT_ID] }),
        queryClient.invalidateQueries({ queryKey: ['deliverables', PROJECT_ID] }),
      ])
    },
  })
}

export function useDeferDecision() {
  const { memory } = useServices()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ decisionId, deferred }: { decisionId: string; deferred: boolean }) =>
      memory.deferDecision(PROJECT_ID, decisionId, deferred),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projection', PROJECT_ID] }),
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
export function useRejectFinding() {
  const { memory } = useServices()
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
    }) => memory.rejectFinding(PROJECT_ID, findingId, reason, expectedVersion),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projection', PROJECT_ID] }),
  })
}

export function useConfirmFinding() {
  const { memory } = useServices()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (findingId: string) => memory.confirmFinding(PROJECT_ID, findingId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projection', PROJECT_ID] }),
  })
}

export function useDeliverables() {
  const { artifacts } = useServices()
  return useQuery({
    queryKey: ['deliverables', PROJECT_ID],
    queryFn: () => artifacts.listDeliverables(PROJECT_ID),
  })
}

export function usePublishTargets() {
  const { publisher } = useServices()
  return useQuery({ queryKey: ['publish-targets'], queryFn: () => publisher.listTargets() })
}

export function useGenerateDeliverable() {
  const { artifacts } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (deliverableId: string) => artifacts.generate(PROJECT_ID, deliverableId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deliverables', PROJECT_ID] }),
  })
}

export function usePublishDeliverable() {
  const { publisher } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ deliverableId, target }: { deliverableId: string; target: PublishTargetKind }) =>
      publisher.publish(deliverableId, target),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deliverables', PROJECT_ID] }),
  })
}
