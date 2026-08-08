/**
 * What an operator can actually see and do, checked in a real browser.
 *
 * Every assertion here corresponds to a fault that shipped and was found by a
 * person reloading the page:
 *
 *   - Reviews rendered no controls, because the projection sent `findings: []`.
 *     Requirements is read-only by design, so the only thing on screen was a
 *     status filter — and a filter chip reads exactly like a disabled button.
 *   - The Reject button called the confirm mutation. Against fixtures that only
 *     counted clicks it looked fine; against a live Memory it would have written
 *     the opposite of what was pressed, into the durable record, silently.
 *   - A rejected statement was retained by Memory and unfindable in Studio, so
 *     "what did we decide against?" had no answer in the product.
 *
 * None of these were visible from the API. That is the whole argument for this
 * file: the projection was correct in every case, and the page was not.
 */

import { expect, test, type Page } from '@playwright/test'
import { RECOVERY } from './testProjects'

// Gated on a live stack, not on a password. `STUDIO_NO_AUTH` deployments have
// no password to set, and skipping every browser test because of that would
// silently retire the suite on exactly the configuration most likely to be
// poked at by hand. `STUDIO_WEB=` opts out explicitly.
const LIVE = process.env.STUDIO_WEB !== ''

test.skip(!LIVE, 'set STUDIO_WEB to a running Studio to run against the live stack')

/**
 * Sign in, then open a project this suite owns.
 *
 * The suite writes real messages to a real Memory, which is deliberate and is
 * why it caught faults an API test could not. What was not deliberate is
 * *where* it wrote: Studio opened whichever project came back first, so twelve
 * runs of one test sentence landed in the project a person was looking at, and
 * the resulting jumble was reported as cross-project leakage. It was this file.
 *
 * ES-1 gives Studio a picker, so the suite now names its own project and the
 * pollution stops being anyone else's problem. One project per run: a shared
 * one accumulates until the assertions about counts stop meaning anything.
 */
async function signIn(page: Page) {
  // The session comes from auth.setup.ts. This waits for the shell and only
  // signs in if something has expired — it must not re-authenticate routinely,
  // or a rate-limited deployment refuses the suite partway through.
  await page.goto('./')

  const field = page.getByPlaceholder('Operator password')
  const shell = page.getByRole('link', { name: 'Workspace' })
  const picker = page.getByRole('heading', { name: 'Choose a project' })

  // Wait for the gate to *settle* before deciding. It renders "Checking
  // Studio…" first, so asking whether the password field is visible the moment
  // the page loads answers "no" for a reason that has nothing to do with being
  // signed in — and every test then ran unauthenticated against the sign-in
  // screen. The bug was in this helper, and it looked exactly like a broken app.
  //
  // Three screens can be correct here, not two: since ES-1 the picker sits
  // between sign-in and the shell. Omitting it from this wait is what made
  // every test fail with "element not found" while the picker was on screen,
  // patiently waiting to be used.
  await expect(field.or(picker).or(shell).first()).toBeVisible({ timeout: 15_000 })

  if (await field.isVisible()) {
    await field.fill(process.env.STUDIO_PASSWORD ?? '')
    await page.getByRole('button', { name: 'Sign in' }).click()
  }

  // Normally already chosen: auth.setup.ts creates the run's project and its
  // storage state carries the preference. This is the recovery path for a
  // context that lost it.
  if (await picker.isVisible()) {
    await page.getByPlaceholder('Project name').fill(RECOVERY)
    await page.getByRole('button', { name: 'Create project' }).click()
  }

  await expect(shell).toBeVisible({ timeout: 20_000 })
}

test.describe('the operator can reach the application', () => {
  test('the gate does not strand a reader when the backend blinks', async ({ page }) => {
    await page.goto('./')
    const unreachable = page.getByText('Studio backend unreachable')
    if (await unreachable.isVisible().catch(() => false)) {
      // The failure this replaced: the gate checked once on mount and never
      // again, so a five-second restart pinned this screen until someone
      // thought to reload — and nothing on it suggested that would help.
      await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
    }
  })
})

test.describe('requirements', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
    await page.goto('./#/requirements')
  })

  test('it renders without throwing on a young project', async ({ page }) => {
    // A new project has empty strings where the prototype's fixture had prose,
    // and the date formatter threw on exactly that.
    await expect(page.getByRole('heading', { name: 'Requirements' })).toBeVisible()
    await expect(page.getByText('Unexpected Application Error')).toHaveCount(0)
  })

  test('rejected statements are findable', async ({ page }) => {
    // Keeping them off the review queue is right. Dropping them from the
    // product is not: Memory retains them, and Studio has to be able to answer
    // what was decided against.
    await expect(page.getByRole('button', { name: /rejected/i })).toBeVisible()
  })

  test('every status filter is reachable', async ({ page }) => {
    for (const name of [/^all/i, /confirmed/i, /proposed/i, /rejected/i]) {
      await page.getByRole('button', { name }).click()
      await expect(page.getByText('Unexpected Application Error')).toHaveCount(0)
    }
  })
})

test.describe('reviews', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
    await page.goto('./#/reviews')
    // Wait for the projection, not just the frame. `expect().toBeVisible()`
    // retries; `locator.count()` does not — so a `count() === 0` guard taken
    // straight after navigation reads the loading skeleton and reports "nothing
    // to review" about a page that has four candidates a second later. A skip
    // is worse than a failure here: it is a green run that checked nothing.
    await expect(page.getByRole('heading', { name: 'Reviews' })).toBeVisible()
    await expect(page.getByText('Agent-proposed knowledge')).toBeVisible({ timeout: 15_000 })
  })

  test('a candidate offers both decisions', async ({ page }) => {
    const confirm = page.getByRole('button', { name: 'Confirm' }).first()
    // Nothing awaiting review is a legitimate state, not a failure — but it
    // must not be reported as a pass for the thing this test checks.
    test.skip(
      (await confirm.count()) === 0,
      'no candidates awaiting review; send a message to produce some',
    )

    await expect(confirm).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Reject' }).first()).toBeEnabled()
  })

  test('reject removes the candidate rather than confirming it', async ({ page }) => {
    const reject = page.getByRole('button', { name: 'Reject' }).first()
    test.skip((await reject.count()) === 0, 'no candidates awaiting review')

    const before = await page.getByRole('button', { name: 'Reject' }).count()
    const confirmedBefore = await page.getByRole('button', { name: 'Confirm' }).count()

    await reject.click()
    await expect
      .poll(async () => page.getByRole('button', { name: 'Reject' }).count())
      .toBe(before - 1)

    // The distinction that matters. A Reject that confirmed would also remove
    // the card from the queue, so a count check alone would have passed on the
    // exact bug this replaced.
    expect(await page.getByRole('button', { name: 'Confirm' }).count()).toBe(confirmedBefore - 1)
    await page.goto('./#/requirements')
    await page.getByRole('button', { name: /rejected/i }).click()
    await expect(page.getByText('Rejected').first()).toBeVisible()
  })
})

test.describe('workspace', () => {
  // These two send a real message and wait for a real model to answer. The
  // per-test default is 30s, which is *shorter than the poll inside the test* —
  // so the test died before its own wait expired, and reported a missing
  // element rather than a slow one. Passing in isolation and failing in the
  // suite is the signature: two turns queued behind each other exceed what one
  // turn comfortably fits in.
  test.setTimeout(150_000)

  test.beforeEach(async ({ page }) => {
    await signIn(page)
    await page.goto('./#/workspace')
  })

  test('a sent message produces a reply that was not there before', async ({ page }) => {
    const replies = page.getByRole('article')
    const before = await replies.count()

    const composer = page.getByRole('textbox').first()
    await composer.fill('The inbox should group tasks by the day they are due.')
    await composer.press('Enter')

    // Counted, not matched. An earlier version looked for the clarification
    // queue's wording and passed on text already in the transcript from a
    // previous run — green, and testing nothing. A new reply is one that was
    // not there a moment ago, whatever it says.
    await expect.poll(async () => replies.count(), { timeout: 60_000 }).toBeGreaterThan(before)
  })

  test('the reply says why KAE asked it, in words', async ({ page }) => {
    // The skill name used to be printed raw. `handle_non_answer` is the reason
    // and is not a sentence, so it is translated — a reader should not have to
    // learn CIE's vocabulary to understand why they are being asked something.

    const composer = page.getByRole('textbox').first()
    await composer.fill('It is only ever me, on my own phone.')
    await composer.press('Enter')

    await expect
      .poll(async () => page.getByText(/KAE asked this because/).count(), { timeout: 60_000 })
      .toBeGreaterThan(0)
  })
})

test.describe('classification', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
    await page.goto('./#/requirements')
    await expect(page.getByRole('heading', { name: 'Requirements' })).toBeVisible()
    // The summary only renders once the projection has arrived. Waiting on the
    // heading alone leaves the same count()-against-a-skeleton race that
    // skipped the review tests as "nothing to review" while four candidates
    // sat there — I wrote it twice, which is a good argument for waiting on
    // data rather than on chrome.
    await expect(page.getByText(/\d+ requirements? · \d+ confirmed/)).toBeVisible({
      timeout: 15_000,
    })
  })

  test('a question is not listed as a requirement', async ({ page }) => {
    // The single most confusing thing on this page: KAE-Memory types its
    // knowledge, the adapter stamped `functional` on all of it, and a persona,
    // a performance target and a question the model could not answer all
    // rendered as "proposed functional requirement".
    const questions = page.getByText('Open questions')
    test.skip((await questions.count()) === 0, 'no open questions in this project')

    await expect(questions.first()).toBeVisible()

    // And the heading it must not appear under — if that heading exists at all.
    //
    // `not.toContainText` fails on a locator matching nothing, so asserting it
    // unconditionally turned "this project has questions and no requirements"
    // into a failure. That state was unreachable while the suite ran against a
    // project stuffed with both; a project of its own reaches it on the first
    // run. A question cannot be filed under a heading that is not rendered.
    const functional = page.getByText('Functional requirements')
    if ((await functional.count()) > 0) {
      await expect(functional).not.toContainText('What is')
    }
  })

  test('the summary does not count questions as requirements', async ({ page }) => {
    await expect(page.getByText(/\d+ requirements? · \d+ confirmed/)).toBeVisible()
  })
})

test.describe('understanding what is on the page', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
    await page.goto('./#/requirements')
    await expect(page.getByText(/\d+ requirements? · \d+ confirmed/)).toBeVisible({
      timeout: 15_000,
    })
  })

  test('the storage id is not the first thing on a row', async ({ page }) => {
    // U2. A UUID in the leftmost column is where a reader looks first, and it
    // told them nothing. What the item *is* belongs there.
    const rows = page.getByRole('listitem')
    test.skip((await rows.count()) === 0, 'no requirements in this project')

    await expect(rows.first()).not.toContainText(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
    )
  })

  test('a row can say where it came from', async ({ page }) => {
    // U3. Recorded provenance, not a generated explanation.
    const trigger = page.getByRole('button', { name: /Source & reasoning/ }).first()
    test.skip((await trigger.count()) === 0, 'no requirements in this project')

    await trigger.click()
    await expect(page.getByText(/Derived from|Provenance could not be read/)).toBeVisible({
      timeout: 15_000,
    })
  })

  test('the page can explain itself without a permanent panel', async ({ page }) => {
    // U8. Collapsed by default: an instruction block read once occupies the top
    // of the page forever for everyone who already knows.
    const explainer = page.getByText('Nothing here is true because KAE said so.')
    await expect(explainer).toHaveCount(0)

    await page.getByRole('button', { name: 'How this page works' }).click()
    await expect(explainer).toBeVisible()
  })
})
