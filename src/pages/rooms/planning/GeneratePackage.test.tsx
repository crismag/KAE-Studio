/**
 * What the generation surface must say, not merely do.
 *
 * Every test here is about a sentence on screen. The pipeline is tested
 * elsewhere; what this covers is the part a user reads before agreeing to
 * something — and the states an interface built against a happy path would
 * never render:
 *
 *   - a blocked file names the decision it is waiting on;
 *   - selecting a blocked file does not make it generatable;
 *   - a preview distinguishes an addition from an overwrite, in words;
 *   - approval is a separate act from publication.
 */

import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ServiceProvider } from '@/services/ServiceProvider'
import { createMockServices, resetPrototypeState } from '@/services/mock/mockServices'
import { GeneratePackage } from './GeneratePackage'

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ServiceProvider services={createMockServices()}>
        <GeneratePackage />
      </ServiceProvider>
    </QueryClientProvider>,
  )
}

async function proposePlan(user: ReturnType<typeof userEvent.setup>, profile: string) {
  // Wait for the *option*, not the select. The select renders immediately and
  // empty while the profiles load, so waiting on it passes before there is
  // anything to choose.
  const select = await screen.findByLabelText(/package profile/i)
  await waitFor(() =>
    expect(within(select).getByRole('option', { name: new RegExp(profile) })).toBeInTheDocument(),
  )
  await user.selectOptions(select, profile)
  await user.click(screen.getByRole('button', { name: /propose a plan/i }))
}

beforeEach(() => resetPrototypeState())

describe('GeneratePackage', () => {
  it('says planning generates nothing, before anything is planned', async () => {
    renderPanel()
    expect(await screen.findByText(/proposing generates nothing/i)).toBeInTheDocument()
  })

  it('shows the revision a plan was proposed against', async () => {
    const user = userEvent.setup()
    renderPanel()

    await proposePlan(user, 'minimal-agent-context')

    expect(await screen.findByText(/^memory:\d+$/)).toBeInTheDocument()
  })

  it('names the decision a blocked file is waiting on', async () => {
    // The most product-relevant behaviour on the screen. A UI that hid this
    // row would discard the whole reason a plan is a proposal to argue with.
    const user = userEvent.setup()
    renderPanel()

    await proposePlan(user, 'full-project-foundation')

    expect(
      await screen.findByText(/No repository has been chosen for this project/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/waiting on a decision/i)).toBeInTheDocument()
  })

  it('will not let a blocked file be selected for generation', async () => {
    const user = userEvent.setup()
    renderPanel()

    await proposePlan(user, 'full-project-foundation')

    const checkbox = await screen.findByLabelText(/include integration-specification/i)
    expect(checkbox).toBeDisabled()
  })

  it('counts only the files it can actually generate', async () => {
    const user = userEvent.setup()
    renderPanel()

    await proposePlan(user, 'full-project-foundation')

    // Four in the profile, one blocked.
    expect(await screen.findByRole('button', { name: /generate 3 files/i })).toBeInTheDocument()
  })

  it('reports the package and its source revision after generating', async () => {
    const user = userEvent.setup()
    renderPanel()
    await proposePlan(user, 'minimal-agent-context')

    await user.click(await screen.findByRole('button', { name: /generate 2 files/i }))

    expect(await screen.findByText(/validated and publishable/i)).toBeInTheDocument()
  })

  it('says in words that a preview would overwrite existing files', async () => {
    const user = userEvent.setup()
    renderPanel()
    await proposePlan(user, 'minimal-agent-context')
    await user.click(await screen.findByRole('button', { name: /generate 2 files/i }))
    await screen.findByText(/validated and publishable/i)

    await user.selectOptions(await screen.findByLabelText(/destination/i), 'github')
    // Naming the repository is now part of choosing GitHub. It used to be a
    // hardcoded empty string behind a button reading "create pull request"
    // (AUD-019), so these tests could reach a preview without saying where.
    await user.type(await screen.findByLabelText(/repository/i), 'crismag/kae-artifacts-proof')
    await user.click(screen.getByRole('button', { name: /see what would change/i }))

    // Not only the badge. "Approve" against a list of filenames is agreement to
    // something the user was never told.
    expect(await screen.findByText(/current content will be overwritten/i)).toBeInTheDocument()
  })

  it('warns that a moved destination invalidates the approval', async () => {
    const user = userEvent.setup()
    renderPanel()
    await proposePlan(user, 'minimal-agent-context')
    await user.click(await screen.findByRole('button', { name: /generate 2 files/i }))
    await screen.findByText(/validated and publishable/i)

    await user.selectOptions(await screen.findByLabelText(/destination/i), 'github')
    // Naming the repository is now part of choosing GitHub. It used to be a
    // hardcoded empty string behind a button reading "create pull request"
    // (AUD-019), so these tests could reach a preview without saying where.
    await user.type(await screen.findByLabelText(/repository/i), 'crismag/kae-artifacts-proof')
    await user.click(screen.getByRole('button', { name: /see what would change/i }))

    expect(await screen.findByText(/stops being valid and nothing is written/i)).toBeInTheDocument()
  })

  it('requires approval as its own act before offering to publish', async () => {
    const user = userEvent.setup()
    renderPanel()
    await proposePlan(user, 'minimal-agent-context')
    await user.click(await screen.findByRole('button', { name: /generate 2 files/i }))
    await screen.findByText(/validated and publishable/i)
    await user.click(await screen.findByRole('button', { name: /see what would change/i }))

    // No publish control until something has been approved.
    await screen.findByRole('button', { name: /approve these/i })
    expect(screen.queryByRole('button', { name: /^publish$/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /approve these/i }))

    expect(await screen.findByRole('button', { name: /^publish$/i })).toBeInTheDocument()
    expect(screen.getByText(/approved by/i)).toBeInTheDocument()
  })

  it('offers a pull request rather than an export, for a repository', async () => {
    const user = userEvent.setup()
    renderPanel()
    await proposePlan(user, 'minimal-agent-context')
    await user.click(await screen.findByRole('button', { name: /generate 2 files/i }))
    await screen.findByText(/validated and publishable/i)
    await user.selectOptions(await screen.findByLabelText(/destination/i), 'github')
    // Naming the repository is now part of choosing GitHub. It used to be a
    // hardcoded empty string behind a button reading "create pull request"
    // (AUD-019), so these tests could reach a preview without saying where.
    await user.type(await screen.findByLabelText(/repository/i), 'crismag/kae-artifacts-proof')
    await user.click(screen.getByRole('button', { name: /see what would change/i }))
    await user.click(await screen.findByRole('button', { name: /approve these/i }))

    expect(
      await screen.findByRole('button', { name: /approve & create pull request/i }),
    ).toBeInTheDocument()
  })

  it('discards a stale approval when the plan changes underneath it', async () => {
    // An approval names one package. Leaving it on screen after a re-plan would
    // offer a publish the service would refuse — correctly, and confusingly.
    const user = userEvent.setup()
    renderPanel()
    await proposePlan(user, 'minimal-agent-context')
    await user.click(await screen.findByRole('button', { name: /generate 2 files/i }))
    await screen.findByText(/validated and publishable/i)
    await user.click(await screen.findByRole('button', { name: /see what would change/i }))
    await user.click(await screen.findByRole('button', { name: /approve these/i }))
    await screen.findByText(/approved by/i)

    await user.click(screen.getByRole('button', { name: /propose a plan/i }))

    await waitFor(() => expect(screen.queryByText(/approved by/i)).not.toBeInTheDocument())
  })

  it('reports which destinations this deployment cannot reach, and why', async () => {
    const user = userEvent.setup()
    renderPanel()
    await proposePlan(user, 'minimal-agent-context')
    await user.click(await screen.findByRole('button', { name: /generate 2 files/i }))
    await screen.findByText(/validated and publishable/i)

    const select = await screen.findByLabelText(/destination/i)

    // Present and disabled, with a reason — not silently absent, which would be
    // indistinguishable from a destination that does not exist.
    const s3 = within(select).getByRole('option', { name: /s3 — no S3 connection configured/i })
    expect(s3).toBeDisabled()
  })
})

describe('a destination has to be named', () => {
  it('will not preview a repository nobody has named', async () => {
    const user = userEvent.setup()
    renderPanel()

    await proposePlan(user, 'minimal-agent-context')
    await user.click(await screen.findByRole('button', { name: /generate 2 files/i }))
    await screen.findByText(/validated and publishable/i)
    await user.selectOptions(await screen.findByLabelText(/destination/i), 'github')

    // AUD-019. `target` and `targetPath` were hardcoded empty strings, and the
    // approval button still read "Approve & create pull request" — a pull
    // request against nothing, offered as though it were configured.
    expect(screen.getByRole('button', { name: /see what would change/i })).toBeDisabled()
    expect(await screen.findByText(/name the repository/i)).toBeInTheDocument()
  })

  it('needs no target for a download, which writes nowhere', async () => {
    const user = userEvent.setup()
    renderPanel()

    await proposePlan(user, 'minimal-agent-context')
    await user.click(await screen.findByRole('button', { name: /generate 2 files/i }))
    await screen.findByText(/validated and publishable/i)

    // The distinction that keeps the requirement honest: it is about writing to
    // somewhere somebody owns, not about ceremony before every action.
    expect(screen.getByRole('button', { name: /see what would change/i })).toBeEnabled()
  })
})
