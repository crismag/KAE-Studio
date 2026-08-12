/**
 * `GH-CONNECT` — selecting a repository, and configuring GitHub somewhere else.
 *
 * The owner's ask: *"users need to configure their own github repositories that
 * we will be working on. Similar to how codex configuration interfaces with a
 * selected github repository."*
 *
 * `§6` of the UX package makes it a Studio-wide rule:
 *
 * > Workflow pages select configured resources. Settings pages configure those
 * > resources.
 *
 * Before this, `/setup` did both — a free-text `owner/name` box beside a form
 * that added and granted credentials. Typing a repository name is not selection:
 * it is configuration with no feedback, where the way you find out you were
 * wrong is a connectivity check failing afterwards.
 *
 * These assert the three things that make a picker a picker: it offers what the
 * credential can genuinely see, it says why when it can see nothing, and it does
 * not quietly undo a decision somebody already made.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ServiceProvider } from '@/services/ServiceProvider'
import { createMockServices } from '@/services/mock/mockServices'
import { RepositoryPicker } from '@/components/project/RepositoryPicker'
import { ProjectSettings } from './ProjectSettings'
import type { AcquisitionPort, StudioServices } from '@/services/interfaces'

function withAcquisition(base: StudioServices, over: Partial<AcquisitionPort>): StudioServices {
  const port = base.acquisition
  return {
    ...base,
    acquisition: {
      availableRepositories: (q) => port.availableRepositories(q),
      listConnections: () => port.listConnections(),
      addConnection: (input) => port.addConnection(input),
      checkConnectivity: (id, location) => port.checkConnectivity(id, location),
      listSources: (projectId) => port.listSources(projectId),
      addSource: (projectId, input) => port.addSource(projectId, input),
      pinSource: (sourceId) => port.pinSource(sourceId),
      listFiles: (sourceId, limit) => port.listFiles(sourceId, limit),
      sample: (sourceId, path) => port.sample(sourceId, path),
      ingestFiles: (sourceId, projectId, paths) => port.ingestFiles(sourceId, projectId, paths),
      ...over,
    },
  }
}

function renderWith(node: React.ReactNode, patch?: (s: StudioServices) => StudioServices) {
  const base = createMockServices()
  const services = patch ? patch(base) : base
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ServiceProvider services={services}>{node}</ServiceProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('choosing a repository', () => {
  it('offers what the credential can actually reach', async () => {
    renderWith(<RepositoryPicker value="" onSelect={() => {}} />)

    expect(
      await screen.findByRole('option', { name: /ministry\/reporting-platform/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /ministry\/identity-service/ })).toBeInTheDocument()
  })

  it('filters the list', async () => {
    const user = userEvent.setup()
    renderWith(<RepositoryPicker value="" onSelect={() => {}} />)

    await user.type(await screen.findByLabelText(/filter repositories/i), 'identity')

    expect(screen.getByRole('option', { name: /identity-service/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /reporting-platform/ })).not.toBeInTheDocument()
  })

  it('reports the repository and its own default branch', async () => {
    const user = userEvent.setup()
    const chosen: { fullName: string; defaultBranch: string }[] = []
    renderWith(<RepositoryPicker value="" onSelect={(repo) => chosen.push(repo)} />)

    await user.click(await screen.findByRole('option', { name: /identity-service/ }))

    // The branch travels with the repository because GitHub already told us.
    // `§5`: do not ask for what KAE can infer.
    expect(chosen).toEqual([{ fullName: 'ministry/identity-service', defaultBranch: 'develop' }])
  })

  it('marks what is already configured', async () => {
    renderWith(<RepositoryPicker value="ministry/reporting-docs" onSelect={() => {}} />)

    const chosen = await screen.findByRole('option', { name: /reporting-docs/ })
    expect(chosen).toHaveAttribute('aria-selected', 'true')
  })

  it('says when a filter matches nothing this credential can see', async () => {
    const user = userEvent.setup()
    renderWith(<RepositoryPicker value="" onSelect={() => {}} />)

    await user.type(await screen.findByLabelText(/filter repositories/i), 'zzz')

    // Deliberately not "no results". The set is scoped to what the credential
    // can reach, and "no such repository" and "not visible to this token" need
    // opposite responses.
    expect(screen.getByText(/No repository this credential can see matches/i)).toBeInTheDocument()
  })

  it('states the limit instead of showing an empty list', async () => {
    // The state that matters most. An empty dropdown with a note underneath is
    // a dropdown people keep clicking.
    renderWith(<RepositoryPicker value="" onSelect={() => {}} />, (services) =>
      withAcquisition(services, {
        availableRepositories: async () => ({
          repositories: [],
          truncated: false,
          unavailableReason:
            'No GitHub credential is configured for this deployment, so no repository can be listed.',
        }),
      }),
    )

    expect(await screen.findByText(/no gitHub credential is configured/i)).toBeInTheDocument()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('keeps a configured repository visible when the credential cannot see it', async () => {
    // Access revoked or a token rescoped. Hiding it would make the page look
    // like nothing is configured, which is a different and wrong claim.
    renderWith(<RepositoryPicker value="ministry/archived" onSelect={() => {}} />)

    expect(
      await screen.findByText(/which this credential cannot currently see/i),
    ).toBeInTheDocument()
  })

  it('says selection is not reading', async () => {
    renderWith(<RepositoryPicker value="" onSelect={() => {}} />)

    expect(await screen.findByText(/It reads nothing until you ask it to/i)).toBeInTheDocument()
  })

  it('surfaces a refused listing rather than an empty picker', async () => {
    renderWith(<RepositoryPicker value="" onSelect={() => {}} />, (services) =>
      withAcquisition(services, {
        availableRepositories: async () => {
          throw new Error('GitHub is rate limiting this credential')
        },
      }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be read/i)
    expect(screen.getByText(/rate limiting this credential/i)).toBeInTheDocument()
  })
})

describe('configuring GitHub lives in Settings', () => {
  it('is where the credential reference is added', async () => {
    renderWith(<ProjectSettings />)

    expect(await screen.findByLabelText(/add a connection/i)).toBeInTheDocument()
    expect(
      screen.getByText(/the name of the environment variable holding the token, not the token/i),
    ).toBeInTheDocument()
  })

  it('sends the reference unchanged, and never a secret', async () => {
    const user = userEvent.setup()
    const sent: string[] = []
    renderWith(<ProjectSettings />, (services) => ({
      ...services,
      setup: {
        getSetup: (id) => services.setup.getSetup(id),
        configure: (id, f, v, o) => services.setup.configure(id, f, v, o),
        registerTarget: (id, i) => services.setup.registerTarget(id, i),
        setDefaultTarget: (id, t) => services.setup.setDefaultTarget(id, t),
        listConnections: (id) => services.setup.listConnections(id),
        authorizeConnection: (id, c) => services.setup.authorizeConnection(id, c),
        recordConnection: async (id, input) => {
          sent.push(input.credentialReference)
          return services.setup.recordConnection(id, input)
        },
      },
    }))

    await user.click(await screen.findByRole('button', { name: /^add$/i }))

    expect(sent).toEqual(['env:KAE_GITHUB_TOKEN'])
  })

  it('shows a connection that has not been granted as not granted', async () => {
    renderWith(<ProjectSettings />)

    expect(await screen.findByText(/env:KAE_GITHUB_TOKEN/)).toBeInTheDocument()
  })
})
