/**
 * Every project this run created, so teardown can remove exactly those.
 *
 * Its own module because `auth.setup.ts` and `projects.spec.ts` write it while
 * `cleanup.teardown.ts` reads it, and Playwright refuses to let one test file
 * import another — a sensible rule, since an imported test file runs twice.
 *
 * **A list of ids, never a name pattern.** The suite creates ten or more
 * projects in a run and the temptation is to clean up by deleting everything
 * called `es1 …`. That is the pattern-matching KAE-Memory's deletion capability
 * refuses to do, for the reason it refuses: a pattern is eventually run against
 * a name somebody real had chosen.
 *
 * A file rather than an environment variable — setup, tests and teardown are
 * separate processes.
 */

import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Page } from '@playwright/test'

export const CREATED_PROJECTS = 'e2e/.auth/created-projects.txt'

/** Record whichever project the app currently has open. */
export async function recordCreatedProject(page: Page): Promise<void> {
  // Read from the app rather than reconstructing from the name we asked for:
  // the name is the request and the id is what exists.
  const id = await page.evaluate(() => window.localStorage.getItem('kae-studio.active-project'))
  if (!id) return
  mkdirSync(dirname(CREATED_PROJECTS), { recursive: true })
  appendFileSync(CREATED_PROJECTS, `${id}\n`)
}

/** Every id recorded this run, de-duplicated. */
export function createdProjects(): string[] {
  try {
    return [...new Set(readFileSync(CREATED_PROJECTS, 'utf8').split('\n').filter(Boolean))]
  } catch {
    return []
  }
}
