/**
 * Delete every project this run created (T0.3).
 *
 * The suite writes real messages to real KAE-Memory, deliberately — that is why
 * it caught faults an API test could not. What was not deliberate is that it
 * never cleaned up: **78 projects accumulated on the deployment, 55 of them from
 * browser runs**, and for a while the project a person was looking at contained
 * twelve copies of one test sentence.
 *
 * ES-1 stopped the suite writing into *someone else's* project. This stops it
 * leaving its own behind — and a single run creates eleven, so without it the
 * accumulation continues at eleven a run.
 *
 * Runs as a Playwright teardown project, so it executes after the tests it
 * cleans up after, **including when they fail**. A cleanup that only runs on
 * green is a cleanup that never runs on the days it matters.
 */

import { rmSync } from 'node:fs'
import { expect, test as teardown } from '@playwright/test'
import { CREATED_PROJECTS, createdProjects } from './runProject'

teardown('remove the projects this run created', async ({ request }) => {
  const ids = createdProjects()
  teardown.skip(ids.length === 0, 'this run created no projects')

  const failures: string[] = []
  for (const id of ids) {
    // By id, never by name. Deleting by pattern is what put a person's project
    // at risk in the first place.
    const response = await request.delete(`./api/projects/${id}`)

    // 404 is success: something else already removed it. Failing a run because
    // cleanup found nothing to clean would make teardown a source of red builds
    // rather than a cure for accumulation.
    if (![200, 204, 404].includes(response.status())) {
      failures.push(`${id} → ${response.status()} ${(await response.text()).slice(0, 120)}`)
    }
  }

  // Cleared before asserting, so a partial failure does not leave the whole
  // list to be retried — the ones that succeeded are already gone, and asking
  // the next run to delete them again would report failures for work that was
  // done.
  rmSync(CREATED_PROJECTS, { force: true })

  expect(failures, `some projects could not be deleted:\n${failures.join('\n')}`).toEqual([])
})
