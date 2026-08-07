/**
 * The rendered-page harness.
 *
 * Studio's faults this week were not visible from its API. The projection was
 * self-consistent and every count was correct while the review page rendered no
 * controls at all, a Reject button called the confirm mutation, and a rejected
 * statement was retained and unfindable. Each was found by a person looking at
 * the screen, one reload at a time.
 *
 * These run against the **live stack** — a real Studio backend and a real
 * KAE-Memory — because that is where the faults were. A mocked run would have
 * passed on every one of them: each bug lived in the seam between what Memory
 * returns and what the page does with it, and mocking that seam is mocking away
 * the defect.
 *
 * Consequence, stated plainly: this suite writes to a real project. Point it at
 * a throwaway one. It confirms nothing it did not create.
 */

import { defineConfig, devices } from '@playwright/test'

// Trailing slash matters. Without it a relative goto resolves against the
// parent, and under a subpath deployment that is whatever else is mounted at
// the origin — here, KAE-Memory's API answering 401 where the app should be.
const BASE = (process.env.STUDIO_WEB ?? 'http://127.0.0.1:5173').replace(/\/?$/, '/')

export default defineConfig({
  testDir: './e2e',
  // One worker. The tests share a project and assert on its statement counts,
  // so parallel runs would each be reading a state the other is changing.
  workers: 1,
  fullyParallel: false,
  // No retries. A flaky pass here would be indistinguishable from the class of
  // bug this exists to catch — a page that renders correctly only sometimes.
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASE,
    // Kept on failure only. The point of a screenshot here is answering "what
    // did the operator actually see", which nobody asks about a passing run.
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    // One sign-in for the run. See e2e/auth.setup.ts — per-test sign-in is
    // indistinguishable from a brute-force attempt to a rate-limited proxy.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/operator.json' },
    },
  ],
})
