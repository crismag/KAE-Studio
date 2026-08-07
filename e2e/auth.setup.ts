import { expect, test as setup } from '@playwright/test'

/**
 * Sign in once and save the session for every test.
 *
 * The suite used to sign in per test. Against a local backend that was merely
 * wasteful; against the deployment it fails, because sign-in is rate limited at
 * the proxy and thirteen attempts in three minutes is what a brute-force
 * attempt looks like from outside.
 *
 * Reusing one session is also closer to the truth. A person signs in once and
 * works; a suite that re-authenticates between every action is testing a flow
 * nobody performs.
 */
const FILE = 'e2e/.auth/operator.json'

// Creating the run's project talks to a real deployment. The default 30s is a
// per-test budget written for assertions, not for provisioning.
setup.setTimeout(120_000)

setup('authenticate', async ({ page }) => {
  await page.goto('./')

  const field = page.getByPlaceholder('Operator password')
  const shell = page.getByRole('link', { name: 'Workspace' })
  // Since ES-1 the project picker also stands here, so settling means any one
  // of three screens. Waiting only for the shell hung until timeout on a
  // deployment where the picker was the correct next screen.
  const picker = page.getByRole('heading', { name: 'Choose a project' })
  await expect(field.or(picker).or(shell).first()).toBeVisible({ timeout: 20_000 })

  if (await field.isVisible()) {
    await field.fill(process.env.STUDIO_PASSWORD ?? '')
    await page.getByRole('button', { name: 'Sign in' }).click()
  }

  // One project for the whole run, created here and inherited by every test
  // through the saved storage state — `storageState` captures localStorage, and
  // the active project is a localStorage preference.
  //
  // Shared *within the suite*, which is the point. The problem this replaces was
  // sharing with whichever project a person was looking at; thirteen tests each
  // creating their own would trade that for thirteen new projects per run.
  await expect(picker.or(shell).first()).toBeVisible({ timeout: 20_000 })

  if (await picker.isVisible()) {
    await page.getByPlaceholder('Project name').fill(`e2e ${new Date().toISOString()}`)
    // Seeded at creation so the suite has something to assert against. A project
    // created and left empty makes every content test skip, and a suite that
    // skips is indistinguishable from one that passes.
    await page
      .getByPlaceholder(/One sentence about it/)
      .fill('A booking tool for a physiotherapy clinic. Four therapists and one receptionist.')
    await page.getByRole('button', { name: 'Create project' }).click()
  }

  await expect(shell).toBeVisible({ timeout: 60_000 })

  await page.context().storageState({ path: FILE })
})
