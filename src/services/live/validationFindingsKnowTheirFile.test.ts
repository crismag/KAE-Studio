/**
 * A validation finding says which file it is about (`D-251`).
 *
 * KAE-Artifacts sets `artifact_id` on nine of its twelve findings and leaves
 * it empty on the three that are genuinely about the package. `validate` was
 * the one method on this boundary that cast the wire body straight to the UI
 * type instead of mapping it, so `artifactId` was `undefined` on every finding
 * and the panel announced each of them *"across the whole package"* — the
 * sentence reserved for the other three (`D-210`).
 *
 * The two arms are asserted together on purpose: either one alone passes while
 * the other is inverted.
 */

import { describe, expect, it, vi, afterEach } from 'vitest'

import { createLiveServices } from './liveServices'

const PER_ARTIFACT = {
  check: 'no_secrets',
  severity: 'error',
  message: 'a credential appears in this document',
  remedy: 'remove it and rotate the key',
  artifact_id: 'art_7',
}

const PACKAGE_LEVEL = {
  check: 'package_not_empty',
  severity: 'error',
  message: 'the package contains no documents',
  remedy: 'generate at least one',
  artifact_id: '',
}

function respond(body: unknown) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }))
}

async function validated(findings: Record<string, unknown>[]) {
  respond({ publishable: false, findings })
  return createLiveServices('p1').pipeline.validate('pkg_1')
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('a validation finding reaches the panel knowing its file', () => {
  it('carries the artifact a per-file finding names', async () => {
    const result = await validated([PER_ARTIFACT])

    expect(result.findings[0].artifactId).toBe('art_7')
  })

  it('keeps the empty identifier that means the whole package', async () => {
    // The control, and it is not a formality: defaulting the missing field to
    // a placeholder would make this pass while the arm above stayed broken.
    const result = await validated([PACKAGE_LEVEL])

    expect(result.findings[0].artifactId).toBe('')
  })

  it('tells the two apart in one response', async () => {
    const result = await validated([PER_ARTIFACT, PACKAGE_LEVEL])

    expect(result.findings.map((f) => f.artifactId)).toEqual(['art_7', ''])
  })

  it('carries the rest of the finding through the same mapper', async () => {
    // A second unmapped field on this body is how the defect recurs.
    const [finding] = (await validated([PER_ARTIFACT])).findings

    expect(finding).toEqual({
      check: 'no_secrets',
      severity: 'error',
      message: 'a credential appears in this document',
      remedy: 'remove it and rotate the key',
      artifactId: 'art_7',
    })
  })

  it('reads whether the package may be published', async () => {
    respond({ publishable: true, findings: [] })

    expect((await createLiveServices('p1').pipeline.validate('pkg_1')).publishable).toBe(true)
  })
})
