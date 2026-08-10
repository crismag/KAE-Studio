/**
 * The screen must not claim a repository has been analyzed.
 *
 * Every test here is about a sentence a user reads. The mechanics — adding a
 * connection, pinning a source — are covered by the backend; what this covers is
 * the gap between what happened and what the interface says happened, because
 * that gap is where a product starts lying.
 *
 * If somebody later adds a green "Connected ✓" and removes the standing notice,
 * these fail. That is the point.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ServiceProvider } from '@/services/ServiceProvider'
import { createMockServices, resetPrototypeState } from '@/services/mock/mockServices'
import { ProjectSources } from './ProjectSources'

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ServiceProvider services={createMockServices()}>
        <ProjectSources />
      </ServiceProvider>
    </QueryClientProvider>,
  )
}

async function connectAndAdd(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/label/i), 'personal')
  await user.click(screen.getByRole('button', { name: /add connection/i }))
  await screen.findByText('personal')

  await user.type(screen.getByLabelText(/^repository$/i), 'crismag/example')
  await user.click(screen.getByRole('button', { name: /check access/i }))
  await waitFor(() => expect(screen.getByText(/can read/i)).toBeInTheDocument())
  await user.click(screen.getByRole('button', { name: /add repository/i }))
  await screen.findByText('crismag/example')
}

beforeEach(() => resetPrototypeState())

describe('ProjectSources', () => {
  it('says analysis is not built before anything is configured', async () => {
    renderPanel()

    expect(await screen.findByText(/repository analysis is not built yet/i)).toBeInTheDocument()
  })

  it('never renders the word analyzed as a state', async () => {
    const user = userEvent.setup()
    renderPanel()

    await connectAndAdd(user)
    await user.click(screen.getByRole('button', { name: /pin to a commit/i }))
    await screen.findByText(/pinned to a commit/i)

    // The state a product most wants to claim. Nothing can reach it, so nothing
    // may display it.
    expect(screen.queryByText(/^analyzed$/i)).not.toBeInTheDocument()
  })

  it('says what pinning does not mean, beside the state that says it happened', async () => {
    const user = userEvent.setup()
    renderPanel()

    await connectAndAdd(user)
    await user.click(screen.getByRole('button', { name: /pin to a commit/i }))

    expect(
      await screen.findByText(/none of them have been read or interpreted/i),
    ).toBeInTheDocument()
  })

  it('reports read and write capability separately', async () => {
    /* One boolean would assert both on the evidence of whichever was checked,
       and "connected" beside a repository is read as permission to write. */
    const user = userEvent.setup()
    renderPanel()

    await connectAndAdd(user)

    expect(screen.getByText(/can read/i)).toBeInTheDocument()
    expect(screen.getByText(/no write/i)).toBeInTheDocument()
  })

  it('states what a connectivity check does and does not prove', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.type(screen.getByLabelText(/label/i), 'personal')
    await user.click(screen.getByRole('button', { name: /add connection/i }))
    await screen.findByText('personal')
    await user.type(screen.getByLabelText(/^repository$/i), 'crismag/example')

    await user.click(screen.getByRole('button', { name: /check access/i }))

    expect(await screen.findByText(/nothing has been read or analyzed/i)).toBeInTheDocument()
  })

  it('shows a new connection as configured rather than verified', async () => {
    /* Somebody typed it in. Nobody has used it. */
    const user = userEvent.setup()
    renderPanel()

    await user.type(screen.getByLabelText(/label/i), 'personal')
    await user.click(screen.getByRole('button', { name: /add connection/i }))

    expect(await screen.findByText(/^configured$/i)).toBeInTheDocument()
  })

  it('refuses to add a repository against an unverified credential', async () => {
    /* Adding requires verification; *checking* must not, or the button that
       verifies a connection would need a verified connection to be clickable. */
    const user = userEvent.setup()
    renderPanel()

    await user.type(screen.getByLabelText(/label/i), 'personal')
    await user.click(screen.getByRole('button', { name: /add connection/i }))
    await screen.findByText('personal')
    await user.type(screen.getByLabelText(/^repository$/i), 'crismag/example')

    expect(screen.getByRole('button', { name: /add repository/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /check access/i })).toBeEnabled()
    expect(screen.getByText(/check access before adding a repository/i)).toBeInTheDocument()
  })

  it('asks for a reference to a credential, never a credential', async () => {
    renderPanel()

    expect(await screen.findByDisplayValue(/^env:/)).toBeInTheDocument()
    expect(screen.getByText(/never the credential/i)).toBeInTheDocument()
  })

  it('shows how many files the scope excluded', async () => {
    /* So a user can tell secrets and build output were left out deliberately
       rather than missed. */
    const user = userEvent.setup()
    renderPanel()

    await connectAndAdd(user)
    await user.click(screen.getByRole('button', { name: /pin to a commit/i }))

    expect(await screen.findByText(/excluded/i)).toBeInTheDocument()
  })
})

describe('giving KAE files from a pinned source', () => {
  /** Connect, add and pin — everything the ingest panel builds on. */
  async function pinned(user: ReturnType<typeof userEvent.setup>) {
    await connectAndAdd(user)
    await user.click(screen.getByRole('button', { name: /pin to a commit/i }))
    // The mock delays pinning 700ms and the file list 400ms, which together
    // exceed the default one-second wait.
    await screen.findByText(/give kae these files/i, undefined, { timeout: 4000 })
  }

  it('offers the files a pinned source would read', async () => {
    const user = userEvent.setup()
    renderPanel()
    await pinned(user)

    // The list the user could not see: pinning reported "N files" and named
    // none of them, so there was nothing to hand over (issue #3).
    expect(await screen.findByText('README.md', undefined, { timeout: 4000 })).toBeInTheDocument()
    expect(await screen.findByText('docs/ARCHITECTURE.md')).toBeInTheDocument()
  })

  it('will not read until a file is chosen', async () => {
    const user = userEvent.setup()
    renderPanel()
    await pinned(user)

    // No "ingest everything". Choosing is how somebody says which files
    // actually describe their project.
    expect(screen.getByRole('button', { name: /read 0 files into the project/i })).toBeDisabled()
  })

  it('says what reading them did, and did not, establish', async () => {
    const user = userEvent.setup()
    renderPanel()
    await pinned(user)

    await user.click(screen.getByRole('checkbox', { name: /README\.md/i }))
    await user.click(screen.getByRole('button', { name: /read 1 file into the project/i }))

    expect(await screen.findByText(/recorded as evidence/i)).toBeInTheDocument()
    // And the standing gap is untouched: reading files is not analysing a
    // repository, and the panel must not start implying otherwise.
    expect(screen.getByText(/repository analysis is not built yet/i)).toBeInTheDocument()
  })
})
