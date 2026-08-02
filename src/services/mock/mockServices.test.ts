import { beforeEach, describe, expect, it } from 'vitest'
import { createMockServices, resetPrototypeState } from './mockServices'
import { PROJECT_ID } from '@/hooks/useProject'

describe('mock services', () => {
  beforeEach(() => resetPrototypeState())

  it('does not duplicate a message when the same idempotency key is resubmitted', async () => {
    const { memory } = createMockServices()
    const before = (await memory.listMessages(PROJECT_ID)).length

    await memory.submitMessage(PROJECT_ID, 'Only leaders may submit.', 'studio-message-fixed')
    await memory.submitMessage(PROJECT_ID, 'Only leaders may submit.', 'studio-message-fixed')

    const after = await memory.listMessages(PROJECT_ID)
    expect(after.length).toBe(before + 1)
  })

  it('reports the interview provider honestly as a mock', () => {
    const { interview } = createMockServices()
    expect(interview.describe().mode).toBe('mock')
  })

  it('records an accepted module as a decision rather than editing silently', async () => {
    const { memory, projection } = createMockServices()
    const before = await projection.getProjection(PROJECT_ID)
    expect(before.modules.find((m) => m.id === 'MOD-APR')?.proposalState).toBe('proposed')

    const result = await memory.recordModuleDecision(PROJECT_ID, 'MOD-APR', { kind: 'accept' })
    expect(result.accepted).toBe(true)
    expect(result.memoryRevision).toBeGreaterThan(before.project.memoryRevision)

    const after = await projection.getProjection(PROJECT_ID)
    expect(after.modules.find((m) => m.id === 'MOD-APR')?.proposalState).toBe('accepted')
  })

  it('marks generated packages outdated once project knowledge changes', async () => {
    const { memory, artifacts } = createMockServices()
    const before = await artifacts.listDeliverables(PROJECT_ID)
    expect(before.find((d) => d.id === 'DLV-PROJECT-CONTEXT')?.state).toBe('generated')

    await memory.recordModuleDecision(PROJECT_ID, 'MOD-RPT', { kind: 'accept' })

    const after = await artifacts.listDeliverables(PROJECT_ID)
    expect(after.find((d) => d.id === 'DLV-PROJECT-CONTEXT')?.state).toBe('outdated')
  })

  it('splits a module without discarding its requirements', async () => {
    const { memory, projection } = createMockServices()
    const before = await projection.getProjection(PROJECT_ID)
    const original = before.modules.find((m) => m.id === 'MOD-APR')!

    await memory.recordModuleDecision(PROJECT_ID, 'MOD-APR', {
      kind: 'split',
      intoNames: ['Approval Decision', 'Approval Authority'],
    })

    const after = await projection.getProjection(PROJECT_ID)
    expect(after.modules.length).toBe(before.modules.length + 1)
    const retained = after.modules.find((m) => m.name === 'Approval Decision')
    expect(retained?.requirementIds).toEqual(original.requirementIds)
  })

  it('pins a generated package to the current memory revision', async () => {
    const { artifacts, memory } = createMockServices()
    const project = await memory.getProject(PROJECT_ID)

    const generated = await artifacts.generate(PROJECT_ID, 'DLV-MOD-APR')

    expect(generated.state).toBe('generated')
    expect(generated.sourceMemoryRevision).toBe(project.memoryRevision)
    expect(generated.unresolvedDecisionIds).toContain('OD-011')
  })

  it('keeps open decisions open in a generated package', async () => {
    const { artifacts } = createMockServices()
    const generated = await artifacts.generate(PROJECT_ID, 'DLV-MOD-APR')
    // The product must never resolve a decision to make output look complete.
    expect(generated.unresolvedDecisionIds.length).toBeGreaterThan(0)
  })

  it('does not offer the local workspace target without an agent', async () => {
    const { publisher } = createMockServices()
    const targets = await publisher.listTargets()
    const local = targets.find((t) => t.kind === 'local')
    expect(local?.available).toBe(false)
    expect(local?.unavailableReason).toMatch(/local agent/i)
  })

  it('labels publication as prototype behaviour', async () => {
    const { publisher } = createMockServices()
    const outcome = await publisher.publish('DLV-MOD-APR', 'github')
    expect(outcome.message).toMatch(/prototype/i)
  })
})
