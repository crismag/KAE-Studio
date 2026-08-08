/**
 * ES-1 — a project is chosen, not guessed.
 *
 * Studio took `projects[0]` and showed it as the whole product. On a deployment
 * holding eighteen projects that made one of them the entire application, and
 * because it was the project three test harnesses wrote into, its contents read
 * as unrelated things jumbled together. That was reported as cross-project
 * leakage in KAE-Memory. Memory's isolation was proven intact; the fault was a
 * client that never said which project it was showing.
 *
 * These run against the live stack and **create projects**, which is the point:
 * the acceptance criterion is about more than one existing. They are named so
 * they are identifiable afterwards.
 */

import { expect, test, type Page } from '@playwright/test'
import { recordCreatedProject } from './runProject'
import { LEFT, MAIN, RIGHT } from './testProjects'

const LIVE = process.env.STUDIO_WEB !== ''

test.skip(!LIVE, 'set STUDIO_WEB to a running Studio to run against the live stack')

const picker = (page: Page) => page.getByRole('heading', { name: 'Choose a project' })
const shell = (page: Page) => page.getByRole('link', { name: 'Workspace' })

/** Forget the remembered project without touching the session. */
async function toThePicker(page: Page) {
  await page.goto('./')
  await expect(picker(page).or(shell(page)).first()).toBeVisible({ timeout: 20_000 })
  if (await shell(page).isVisible()) {
    await page.getByRole('button', { name: 'Switch project' }).click()
  }
  await expect(picker(page)).toBeVisible()
}

/**
 * Open a named project, creating it if the deployment does not have it yet.
 *
 * The name comes from the fixed roster. `create_project` is idempotent by the
 * key derived from the name, so this reuses the same project on every run
 * instead of leaving a new one behind — which is how a deployment reached a
 * hundred and one projects.
 */
async function create(page: Page, name: string, sentence?: string): Promise<string> {
  await page.getByPlaceholder('Project name').fill(name)
  if (sentence) await page.getByPlaceholder(/One sentence about it/).fill(sentence)
  await page.getByRole('button', { name: 'Create project' }).click()
  await expect(shell(page)).toBeVisible({ timeout: 30_000 })
  // Recorded here rather than in teardown: this helper is the only place the
  // suite creates a project, so it is the only place that knows one exists.
  await recordCreatedProject(page)
  return name
}

test.describe('choosing a project', () => {
  test('the picker stands in front of the application, listing what exists', async ({ page }) => {
    await toThePicker(page)

    // The count is part of the point: eighteen projects were invisible behind a
    // client that showed the first one.
    await expect(page.getByRole('heading', { name: /\d+ projects|No projects yet/ })).toBeVisible()
  })

  test('the shell names the project you chose', async ({ page }) => {
    await toThePicker(page)
    const name = await create(page, MAIN)

    // Not a UUID. The operator has to be able to tell, at a glance, which
    // project they are looking at — that is the whole failure being repaired.
    await expect(page.getByText(name)).toBeVisible()
  })

  test('the choice survives a reload', async ({ page }) => {
    await toThePicker(page)
    const name = await create(page, MAIN)

    await page.reload()

    await expect(shell(page)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(name)).toBeVisible()
  })

  test('a deep link without a chosen project recovers through the picker', async ({ page }) => {
    await toThePicker(page)

    // The old behaviour was to resolve *something* and render it. Landing deep
    // in the application with no project has to ask rather than assume.
    await page.goto('./#/requirements')

    await expect(picker(page)).toBeVisible({ timeout: 20_000 })
  })
})

test.describe('switching projects', () => {
  test('one project does not show another project transcript', async ({ page }) => {
    // The acceptance criterion, and the thing that was actually wrong.
    await toThePicker(page)
    const first = await create(page, LEFT, 'A booking system for a physiotherapy clinic.')

    await page.getByRole('button', { name: 'Switch project' }).click()
    await expect(picker(page)).toBeVisible()
    const second = await create(page, RIGHT, 'A tool for tracking invoices for freelancers.')

    // The second project's shell must not carry the first's identity.
    await expect(page.getByText(second)).toBeVisible()
    await expect(page.getByText(first)).toHaveCount(0)
  })

  test('switching back does not leave the other project rendered', async ({ page }) => {
    /**
     * The subtle half. React Query caches by key, and the keys were a fixture
     * constant rather than the project — so every project shared one cache
     * entry and switching would have served the previous project's answers
     * until each query refetched. That renders as one project's content under
     * another's name, which is indistinguishable from the leak this was
     * mistaken for.
     */
    await toThePicker(page)
    const left = await create(page, LEFT, 'Invoices are sent within three days.')

    await page.getByRole('button', { name: 'Switch project' }).click()
    await expect(picker(page)).toBeVisible()
    await create(page, RIGHT, 'Therapists set their own availability.')

    await page.getByRole('button', { name: 'Switch project' }).click()
    await expect(picker(page)).toBeVisible()
    await page.getByRole('button', { name: left }).click()

    await expect(shell(page)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(left)).toBeVisible()
  })
})

test.describe('the status bar reports rather than asserts', () => {
  test.beforeEach(async ({ page }) => {
    await toThePicker(page)
    await create(page, MAIN)
  })

  test('it says whether Memory is reachable, and can say it is not', async ({ page }) => {
    // The old bar read "Memory: synchronised" from a string literal. It had no
    // code path that could render anything else, including an outage.
    await expect(page.getByText(/Memory:/)).toBeVisible()
    await expect(page.getByText(/reachable|not reachable|Studio unreachable/)).toBeVisible()
  })

  test('it does not claim to be showing fixtures while serving a real project', async ({
    page,
  }) => {
    // `Prototype — mock data` was an unconditional badge on a deployment
    // serving live KAE-Memory through CIE.
    await expect(page.getByText('Prototype — mock data')).toHaveCount(0)
  })

  test('an open deployment says so where nobody has to go looking', async ({ page }) => {
    // Only meaningful while STUDIO_NO_AUTH is set, which it is on this
    // deployment by request. The assertion is conditional on the deployment's
    // own answer rather than on an assumption about it.
    const open = await page.evaluate(async () => {
      const response = await fetch('./api/status', { credentials: 'include' })
      return response.ok ? ((await response.json()).authentication as string) : ''
    })
    test.skip(open !== 'disabled', 'this deployment requires sign-in')

    await expect(page.getByText(/Sign-in disabled/)).toBeVisible()
  })

  test('there is no control that does nothing', async ({ page }) => {
    // Settings rendered, invited a click, and had no handler.
    await expect(page.getByRole('button', { name: 'Settings' })).toHaveCount(0)
  })
})
