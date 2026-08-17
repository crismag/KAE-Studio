/**
 * Copying is one act and adding a source is another (`D-93`).
 *
 * The `+` menu carried this branch marked **Not yet** since `D-80`, honestly:
 * nothing ran `git clone`. Now that it does, the thing worth guarding is the
 * seam — a clone puts bytes on disk and reads nothing, and a panel that
 * announced *added* after copying would claim work the project has not done.
 *
 * The failure this prevents is specific: a person clones a large repository,
 * the source registration fails, and a single button leaves them unable to tell
 * whether the copy exists — so they clone again, onto a directory that is now
 * there, and get told it already exists.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ServiceProvider } from '@/services/ServiceProvider'
import { createMockServices } from '@/services/mock/mockServices'
import { CloneRepository } from './CloneRepository'
import type { AcquisitionPort } from '@/services/interfaces'

/**
 * The mock's acquisition port is a class instance, so spreading it drops every
 * method onto nothing — each has to be forwarded by hand, as `sourcesRoom`
 * already does. Getting this wrong renders a failed read and passes tests that
 * assert failure.
 */
function show(over: Partial<AcquisitionPort> = {}) {
  const base = createMockServices()
  const port = base.acquisition
  const services = {
    ...base,
    acquisition: {
      availableRepositories: (q?: string) => port.availableRepositories(q),
      cloneRepository: (fullName: string) => port.cloneRepository(fullName),
      installations: () => port.installations(),
      listConnections: () => port.listConnections(),
      addConnection: (input: Parameters<AcquisitionPort['addConnection']>[0]) =>
        port.addConnection(input),
      checkConnectivity: (id: string, location: string) => port.checkConnectivity(id, location),
      listSources: (projectId: string) => port.listSources(projectId),
      addSource: (projectId: string, input: Parameters<AcquisitionPort['addSource']>[1]) =>
        port.addSource(projectId, input),
      pinSource: (sourceId: string) => port.pinSource(sourceId),
      classifySource: (
        sourceId: string,
        disposition: Parameters<AcquisitionPort['classifySource']>[1],
      ) => port.classifySource(sourceId, disposition),
      sourceMaterial: (projectId: string) => port.sourceMaterial(projectId),
      listFiles: (sourceId: string, limit?: number) => port.listFiles(sourceId, limit),
      sample: (sourceId: string, path: string) => port.sample(sourceId, path),
      ingestFiles: (sourceId: string, projectId: string, paths: string[]) =>
        port.ingestFiles(sourceId, projectId, paths),
      ...over,
    } as AcquisitionPort,
  }
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ServiceProvider services={services}>
        <MemoryRouter>
          <CloneRepository onDone={() => {}} />
        </MemoryRouter>
      </ServiceProvider>
    </QueryClientProvider>,
  )
}

describe('cloning a repository', () => {
  it('will not copy until a repository has been chosen', async () => {
    show()

    expect(await screen.findByRole('button', { name: /copy it here/i })).toBeDisabled()
  })

  it('says where the copy landed, and that nothing has been read from it', async () => {
    const user = userEvent.setup()
    show()

    await user.click(await screen.findByRole('option', { name: /reporting-platform/i }))
    await user.click(screen.getByRole('button', { name: /copy it here/i }))

    // Both halves. Where it is, and what has *not* happened to it yet.
    expect(await screen.findByText(/\/workspaces\/reporting-platform/)).toBeInTheDocument()
    expect(screen.getByText(/nothing has been read from it yet/i)).toBeInTheDocument()
  })

  it('adds the copy as a folder, not as a GitHub repository', async () => {
    /**
     * The point of cloning: from here on it is a directory on this machine, and
     * reading it involves no network. Registering it as `github` would send
     * every later read back through the API this was meant to stop depending on.
     */
    const user = userEvent.setup()
    const addSource = vi.fn().mockResolvedValue({ sourceId: 's1' })
    show({ addSource })

    await user.click(await screen.findByRole('option', { name: /reporting-platform/i }))
    await user.click(screen.getByRole('button', { name: /copy it here/i }))
    await user.click(await screen.findByRole('button', { name: /add it as a source/i }))

    await waitFor(() => expect(addSource).toHaveBeenCalled())
    expect(addSource.mock.calls[0][1]).toMatchObject({
      kind: 'local',
      location: '/workspaces/reporting-platform',
    })
  })

  it('keeps the copy when adding it as a source fails', async () => {
    // The reason the two acts are shown as two. Otherwise a failure here reads
    // as "the clone failed", and the retry hits a directory that now exists.
    const user = userEvent.setup()
    const addSource = vi.fn().mockRejectedValue(new Error('the durable record could not be read'))
    show({ addSource })

    await user.click(await screen.findByRole('option', { name: /reporting-platform/i }))
    await user.click(screen.getByRole('button', { name: /copy it here/i }))
    await user.click(await screen.findByRole('button', { name: /add it as a source/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/copy is on this machine/i)
    expect(screen.getByText(/\/workspaces\/reporting-platform/)).toBeInTheDocument()
  })

  it('shows the reason a clone failed rather than swallowing it', async () => {
    const user = userEvent.setup()
    const cloneRepository = vi
      .fn()
      .mockRejectedValue(new Error('GitHub refused this deployment’s credential'))
    show({ cloneRepository })

    await user.click(await screen.findByRole('option', { name: /reporting-platform/i }))
    await user.click(screen.getByRole('button', { name: /copy it here/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/refused/i)
  })
})
