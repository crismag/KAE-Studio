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

  it('pins a generated package to the memory revision it read', async () => {
    const { pipeline, memory } = createMockServices()
    const project = await memory.getProject(PROJECT_ID)

    const plan = await pipeline.createPlan(PROJECT_ID, 'minimal-agent-context')

    expect(plan.inputRevision).toBe(`memory:${project.memoryRevision}`)
  })

  it('will not generate a blocked artifact even when it is selected', async () => {
    // The behaviour that separates a plan from a template. A blocked entry
    // names a decision nobody has made, and producing it with a placeholder is
    // exactly what the readiness state exists to prevent.
    const { pipeline } = createMockServices()
    const plan = await pipeline.createPlan(PROJECT_ID, 'full-project-foundation')
    const blocked = plan.entries.find((e) => e.readiness === 'blocked')
    expect(blocked?.blockedReason).toMatch(/repository/i)

    const edited = await pipeline.editPlan(plan.planId, [{ type: blocked!.type, selected: true }])

    expect(edited.entries.find((e) => e.type === blocked!.type)?.generatable).toBe(false)
  })

  it('generates the file where the user moved it', async () => {
    const { pipeline } = createMockServices()
    const plan = await pipeline.createPlan(PROJECT_ID, 'minimal-agent-context')
    await pipeline.editPlan(plan.planId, [
      { type: 'agent-context', logicalPath: '.github/AGENTS.md' },
    ])

    const run = await pipeline.generate(PROJECT_ID, plan.planId, 'k1')
    const pkg = await pipeline.getPackage(run.packageId)

    expect(pkg.artifacts.map((a) => a.logicalPath)).toContain('.github/AGENTS.md')
  })

  it('returns the original run when a generation is retried', async () => {
    const { pipeline } = createMockServices()
    const plan = await pipeline.createPlan(PROJECT_ID, 'minimal-agent-context')

    const first = await pipeline.generate(PROJECT_ID, plan.planId, 'same')
    const second = await pipeline.generate(PROJECT_ID, plan.planId, 'same')

    expect(second.runId).toBe(first.runId)
  })

  it('distinguishes a file it would add from one it would overwrite', async () => {
    // A user approving four modifications is agreeing to overwrite four files.
    // A list of filenames never told them so.
    const { pipeline } = createMockServices()
    const plan = await pipeline.createPlan(PROJECT_ID, 'minimal-agent-context')
    const run = await pipeline.generate(PROJECT_ID, plan.planId, 'k2')

    const preview = await pipeline.preview(run.packageId, {
      type: 'github',
      mode: 'pull_request',
      target: 'crismag/ministry-reporting',
      targetPath: 'docs/kae',
      baseBranch: 'main',
    })

    expect(preview.changes.some((c) => c.outcome === 'modify')).toBe(true)
    expect(preview.baseToken).not.toBe('')
  })

  it('reports a destination it cannot reach, with the reason', async () => {
    // Reported rather than omitted. A missing entry would be indistinguishable
    // from a destination that does not exist, and sends an operator to an issue
    // tracker instead of to their settings.
    const { pipeline } = createMockServices()
    const publishers = await pipeline.listPublishers()
    const s3 = publishers.find((p) => p.type === 's3')
    expect(s3?.available).toBe(false)
    expect(s3?.reason).toMatch(/configured/i)
  })

  it('binds an approval to the preview that was reviewed', async () => {
    const { pipeline } = createMockServices()
    const plan = await pipeline.createPlan(PROJECT_ID, 'minimal-agent-context')
    const run = await pipeline.generate(PROJECT_ID, plan.planId, 'k3')
    const preview = await pipeline.preview(run.packageId, {
      type: 'download',
      mode: 'object_write',
      target: '',
      targetPath: '',
      baseBranch: '',
    })

    const approval = await pipeline.approve(preview.previewId)

    expect(approval.previewChecksum).toBe(preview.checksum)
    expect(approval.packageChecksum).toBe(preview.packageChecksum)
    expect(new Date(approval.expiresAt).getTime()).toBeGreaterThan(
      new Date(approval.approvedAt).getTime(),
    )
  })

  it('refuses to publish a package the approval was not given for', async () => {
    // Approving one package must never authorise publishing another.
    const { pipeline } = createMockServices()
    const plan = await pipeline.createPlan(PROJECT_ID, 'minimal-agent-context')
    const approved = await pipeline.generate(PROJECT_ID, plan.planId, 'k4')
    const other = await pipeline.generate(PROJECT_ID, plan.planId, 'k5')
    const preview = await pipeline.preview(approved.packageId, {
      type: 'download',
      mode: 'object_write',
      target: '',
      targetPath: '',
      baseBranch: '',
    })
    const approval = await pipeline.approve(preview.previewId)

    const publication = await pipeline.publish({
      packageId: other.packageId,
      destination: preview.destination,
      approvalId: approval.approvalId,
      idempotencyKey: 'p1',
    })

    expect(publication.status).toBe('failed')
    expect(publication.detail).toMatch(/package_mismatch/)
  })

  it('labels publication as prototype behaviour', async () => {
    const { pipeline } = createMockServices()
    const plan = await pipeline.createPlan(PROJECT_ID, 'minimal-agent-context')
    const run = await pipeline.generate(PROJECT_ID, plan.planId, 'k6')
    const preview = await pipeline.preview(run.packageId, {
      type: 'download',
      mode: 'object_write',
      target: '',
      targetPath: '',
      baseBranch: '',
    })
    const approval = await pipeline.approve(preview.previewId)

    const publication = await pipeline.publish({
      packageId: run.packageId,
      destination: preview.destination,
      approvalId: approval.approvalId,
      idempotencyKey: 'p2',
    })

    expect(publication.detail).toMatch(/prototype/i)
  })
})
