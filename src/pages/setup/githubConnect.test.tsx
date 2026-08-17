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
import { ProjectSettings } from '@/pages/settings/SettingsPage'
import type { AcquisitionPort, StudioServices } from '@/services/interfaces'

function withAcquisition(base: StudioServices, over: Partial<AcquisitionPort>): StudioServices {
  const port = base.acquisition
  return {
    ...base,
    acquisition: {
      availableRepositories: (q) => port.availableRepositories(q),
      installations: () => port.installations(),
      cloneRepository: (fullName: string) => port.cloneRepository(fullName),
      listConnections: () => port.listConnections(),
      addConnection: (input) => port.addConnection(input),
      checkConnectivity: (id, location) => port.checkConnectivity(id, location),
      listSources: (projectId) => port.listSources(projectId),
      addSource: (projectId, input) => port.addSource(projectId, input),
      pinSource: (sourceId) => port.pinSource(sourceId),
      classifySource: (sourceId, disposition) => port.classifySource(sourceId, disposition),
      sourceMaterial: (projectId) => port.sourceMaterial(projectId),
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
    renderWith(<RepositoryPicker kind="github" onSelect={() => {}} />)

    expect(
      await screen.findByRole('option', { name: /ministry\/reporting-platform/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /ministry\/identity-service/ })).toBeInTheDocument()
  })

  it('filters the list', async () => {
    const user = userEvent.setup()
    renderWith(<RepositoryPicker kind="github" onSelect={() => {}} />)

    await user.type(await screen.findByLabelText(/filter repositories/i), 'identity')

    expect(screen.getByRole('option', { name: /identity-service/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /reporting-platform/ })).not.toBeInTheDocument()
  })

  it('reports the repository and its own default branch', async () => {
    const user = userEvent.setup()
    const chosen: { fullName: string; defaultBranch: string }[] = []
    renderWith(<RepositoryPicker kind="github" onSelect={(repo) => chosen.push(repo)} />)

    await user.click(await screen.findByRole('option', { name: /identity-service/ }))

    // The branch travels with the repository because GitHub already told us.
    // `§5`: do not ask for what KAE can infer.
    expect(chosen).toEqual([{ fullName: 'ministry/identity-service', defaultBranch: 'develop' }])
  })

  it('marks what is already configured', async () => {
    renderWith(
      <RepositoryPicker kind="github" value="ministry/reporting-docs" onSelect={() => {}} />,
    )

    const chosen = await screen.findByRole('option', { name: /reporting-docs/ })
    expect(chosen).toHaveAttribute('aria-selected', 'true')
  })

  it('says when a filter matches nothing this credential can see', async () => {
    const user = userEvent.setup()
    renderWith(<RepositoryPicker kind="github" onSelect={() => {}} />)

    await user.type(await screen.findByLabelText(/filter repositories/i), 'zzz')

    // Deliberately not "no results". The set is scoped to what the credential
    // can reach, and "no such repository" and "not visible to this token" need
    // opposite responses.
    expect(screen.getByText(/No repository KAE can reach matches/i)).toBeInTheDocument()
  })

  it('states the limit instead of showing an empty list', async () => {
    // The state that matters most. An empty dropdown with a note underneath is
    // a dropdown people keep clicking.
    renderWith(<RepositoryPicker kind="github" onSelect={() => {}} />, (services) =>
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

  it('does not offer a search over an empty GitHub list', async () => {
    // Granted access that can see folders but no GitHub repositories. An empty
    // search box here reads as "type the name", which is the interaction this
    // picker exists to replace — and "scoped to another account" would guess.
    renderWith(<RepositoryPicker kind="github" onSelect={() => {}} />, (services) =>
      withAcquisition(services, {
        availableRepositories: async () => ({
          repositories: [
            {
              kind: 'local',
              fullName: '/mnt/ai/workspaces/example',
              defaultBranch: '',
              private: false,
              description: '',
              updatedAt: '2026-08-10T09:00:00Z',
            },
          ],
          truncated: false,
          unavailableReason: '',
        }),
      }),
    )

    expect(await screen.findByText(/cannot see any GitHub repositories/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/filter/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('keeps a configured repository visible when the credential cannot see it', async () => {
    // Access revoked or a token rescoped. Hiding it would make the page look
    // like nothing is configured, which is a different and wrong claim.
    renderWith(<RepositoryPicker kind="github" value="ministry/archived" onSelect={() => {}} />)

    expect(await screen.findByText(/which KAE cannot currently see/i)).toBeInTheDocument()
  })

  it('says selection is not reading, where selecting means that', async () => {
    /**
     * The sentence moved to the **caller** (`D-87`). The shared widget cannot
     * carry it: the same control picks a publication destination one page over,
     * where *"records where KAE reads from"* would be false.
     */
    const { PickRepository } = await import('@/pages/rooms/sources/PickRepository')
    renderWith(<PickRepository kind="github" onDone={() => {}} />)

    expect(await screen.findByText(/It reads nothing until you ask it to/i)).toBeInTheDocument()
  })

  it('surfaces a refused listing rather than an empty picker', async () => {
    renderWith(<RepositoryPicker kind="github" onSelect={() => {}} />, (services) =>
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

describe('a value GitHub supplied is not a value a person confirmed', () => {
  it('records the branch as inferred, with its evidence', async () => {
    // `INFER-1`. Memory models `inferred` and `suggested` with evidence,
    // `/setup` renders them, and nothing produced one — a state with a reader
    // and no writer. This is its first writer, and it corrects an attribution:
    // the branch was being recorded as `confirmed`, which is the word this
    // product uses for human agreement, about a value nobody looked at.
    const user = userEvent.setup()
    const written: { field: string; state?: string; evidence?: string }[] = []
    // **The picker moved to Sources** (`D-81`). Setup shows a summary and links
    // there; selection has one home. The claim under test is unchanged — a
    // value the provider supplied is recorded as `inferred`, never `confirmed`
    // — and it is asserted where the selection now happens.
    const { PickRepository } = await import('@/pages/rooms/sources/PickRepository')

    const base = createMockServices()
    const services: StudioServices = {
      ...base,
      setup: {
        // A project with no branch chosen yet — the case the inference is for.
        // The fixture has one, and with a branch already set the guard
        // correctly declines to overwrite it.
        getSetup: async (id) => {
          const state = await base.setup.getSetup(id)
          const { primary_branch: _dropped, ...rest } = state.configuration
          return { ...state, configuration: rest }
        },
        registerTarget: (id, i) => base.setup.registerTarget(id, i),
        setDefaultTarget: (id, t) => base.setup.setDefaultTarget(id, t),
        listConnections: (id) => base.setup.listConnections(id),
        recordConnection: (id, i) => base.setup.recordConnection(id, i),
        authorizeConnection: (id, c) => base.setup.authorizeConnection(id, c),
        configure: async (id, field, value, options) => {
          written.push({ field, state: options?.state, evidence: options?.evidence })
          return base.setup.configure(id, field, value, options)
        },
      },
    }
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    })
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <ServiceProvider services={services}>
            <PickRepository kind="github" onDone={() => {}} />
          </ServiceProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    )

    await user.click(await screen.findByRole('option', { name: /identity-service/ }))

    const branch = written.find((entry) => entry.field === 'primary_branch')
    expect(branch?.state).toBe('inferred')
    // Evidence travels with it. The domain refuses an inference without one,
    // and a reader deciding whether to trust a value needs to know who said it.
    expect(branch?.evidence).toMatch(/reported as the default branch/)
  })

  it('still records the repository as the person’s choice', async () => {
    // The other half. Selecting *is* a decision, so the repository stays
    // `confirmed` — the correction is about the branch that came along with it.
    const user = userEvent.setup()
    const written: { field: string; state?: string }[] = []
    // **The picker moved to Sources** (`D-81`). Setup shows a summary and links
    // there; selection has one home. The claim under test is unchanged — a
    // value the provider supplied is recorded as `inferred`, never `confirmed`
    // — and it is asserted where the selection now happens.
    const { PickRepository } = await import('@/pages/rooms/sources/PickRepository')

    const base = createMockServices()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    })
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <ServiceProvider
            services={{
              ...base,
              setup: {
                getSetup: (id) => base.setup.getSetup(id),
                registerTarget: (id, i) => base.setup.registerTarget(id, i),
                setDefaultTarget: (id, t) => base.setup.setDefaultTarget(id, t),
                listConnections: (id) => base.setup.listConnections(id),
                recordConnection: (id, i) => base.setup.recordConnection(id, i),
                authorizeConnection: (id, c) => base.setup.authorizeConnection(id, c),
                configure: async (id, field, value, options) => {
                  written.push({ field, state: options?.state })
                  return base.setup.configure(id, field, value, options)
                },
              },
            }}
          >
            <PickRepository kind="github" onDone={() => {}} />
          </ServiceProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    )

    await user.click(await screen.findByRole('option', { name: /identity-service/ }))

    const repository = written.find((entry) => entry.field === 'primary_repository')
    expect(repository?.state).toBeUndefined()
  })
})

describe('configuring GitHub lives in Settings', () => {
  it('does not tell a user to set an operator environment variable', async () => {
    renderWith(<ProjectSettings />)

    await screen.findByRole('heading', { name: /^GitHub$/i })
    expect(screen.queryByText(/STUDIO_GITHUB_APP_SLUG/i)).not.toBeInTheDocument()
  })

  it('keeps the server-token reference behind Advanced', async () => {
    renderWith(<ProjectSettings />)

    // Operator path, not the product connector. Still present so a deployment
    // that records `env:KAE_GITHUB_TOKEN` can keep doing so.
    expect(await screen.findByLabelText(/environment variable/i)).toBeInTheDocument()
    expect(
      screen.getByText(/the name of the variable holding the token, not the token/i),
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

  it('names a token connection GitHub, not the environment variable', async () => {
    renderWith(<ProjectSettings />)

    expect(await screen.findByText('Connected')).toBeInTheDocument()
    expect(screen.queryByText(/^env:KAE_GITHUB_TOKEN$/)).not.toBeInTheDocument()
  })
})

/**
 * `D-60` — the Settings contract claimed the page says *when*, and it did not.
 *
 * `lastVerifiedAt` is mapped by the adapter, populated on the live deployment
 * (`2026-08-10T17:02:42Z` for the granted connection, stamped by
 * `authorize_connection`) and rendered nowhere. The contract's user question —
 * *"Who granted it, and when was it last checked?"* — described a screen that
 * did not exist.
 */
describe('a grant says when it was made', () => {
  it('shows the date beside who made it', async () => {
    renderWith(<ProjectSettings />)

    // Both, in one sentence: a *who* with no *when* is what this fixes, and a
    // *when* with no *who* would be the same defect mirrored.
    // `D-79` renamed the label from "granted by" to "connected by" — the page
    // is now about accounts rather than credential records. The claim is
    // unchanged: who, and when.
    const line = await screen.findByText(/connected by operator/i)
    expect(line).toHaveTextContent(/10 Aug/)
  })

  it('never calls the grant a check', async () => {
    // `D-25`: *verified means proved, not declared.* The timestamp is stamped
    // when somebody authorises the connection; nothing has reached GitHub
    // since. "Last checked" would commit that defect in a label rather than in
    // a badge, and the contract said exactly that before this.
    renderWith(<ProjectSettings />)

    await screen.findByText(/connected by operator/i)
    expect(screen.queryByText(/last checked/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/verified on/i)).not.toBeInTheDocument()
  })

  it('says nothing rather than inventing a date when there is none', async () => {
    renderWith(<ProjectSettings />, (services) => ({
      ...services,
      setup: {
        ...services.setup,
        listConnections: async (id) =>
          (await services.setup.listConnections(id)).map((c) => ({
            ...c,
            lastVerifiedAt: null,
          })),
      },
    }))

    const line = await screen.findByText(/connected by operator/i)
    expect(line).not.toHaveTextContent(/ on /)
  })
})
