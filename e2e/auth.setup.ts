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

setup('authenticate', async ({ page }) => {
  await page.goto('./')

  const field = page.getByPlaceholder('Operator password')
  const shell = page.getByRole('link', { name: 'Workspace' })
  await expect(field.or(shell).first()).toBeVisible({ timeout: 20_000 })

  if (await field.isVisible()) {
    await field.fill(process.env.STUDIO_PASSWORD ?? '')
    await page.getByRole('button', { name: 'Sign in' }).click()
  }
  await expect(shell).toBeVisible({ timeout: 20_000 })

  await page.context().storageState({ path: FILE })
})
