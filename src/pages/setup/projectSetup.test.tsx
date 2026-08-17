/**
 * Project Setup — stage one, which had no surface at all.
 *
 * KAE-Memory has modelled every field here since migration `0020`. On the
 * deployed database `project_configuration`, `publication_targets` and
 * `provider_connections` held **zero rows between them**, against 1,977
 * knowledge items. Not under-used: never written to, once.
 *
 * These assert the four things that make the page worth having, and the two it
 * must never do.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ServiceProvider } from '@/services/ServiceProvider'
import { createMockServices } from '@/services/mock/mockServices'
import { ProjectSetup } from './SetupPage'
import type { AcquisitionPort, SetupPort, StudioServices } from '@/services/interfaces'

/**
 * Override part of the setup port without losing the rest.
 *
 * The mock ports are classes, so `{...services.setup}` copies own properties
 * and **drops every prototype method** — producing a port whose every call is
 * `undefined is not a function`, which renders as a failed read and passes a
 * test asserting failure for the wrong reason. Delegating explicitly is longer
 * and cannot do that.
 */
function withSetup(base: StudioServices, over: Partial<SetupPort>): StudioServices {
  const port = base.setup
  return {
    ...base,
    setup: {
      getSetup: (id) => port.getSetup(id),
      configure: (id, field, value, options) => port.configure(id, field, value, options),
      registerTarget: (id, input) => port.registerTarget(id, input),
      setDefaultTarget: (id, targetId) => port.setDefaultTarget(id, targetId),
      listConnections: (id) => port.listConnections(id),
      recordConnection: (id, input) => port.recordConnection(id, input),
      authorizeConnection: (id, connectionId) => port.authorizeConnection(id, connectionId),
      ...over,
    },
  }
}

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

function renderSetup(patch?: (services: StudioServices) => StudioServices) {
  const base = createMockServices()
  const services = patch ? patch(base) : base
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ServiceProvider services={services}>
          <ProjectSetup />
        </ServiceProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('the project can be configured through the product', () => {
  it('renders the fields KAE-Memory will actually accept', async () => {
    renderSetup()

    // The six of `KNOWN_FIELDS`. A seventh would be a control whose save always
    // fails, which is the shape of half this audit's findings.
    //
    // `primary_repository` is not among them, and no longer has a picker here
    // either: selection has **one home**, and it is Sources (`D-81`). Setup
    // shows what is configured and links there, because two pickers with
    // different behaviour is how they drift apart.
    expect(
      await screen.findByRole('link', { name: /manage sources|add a source/i }),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText(/filter repositories/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/branch/i)).toBeInTheDocument()
    // `working_directory` **moved beside the source it narrows** (`D-91`), and
    // is absent when there is nothing to narrow. Its label changed with its
    // placement: *Read only this folder* says what it does where it now sits.
    expect(screen.getByLabelText(/read only this folder/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/what kind of project/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/output format/i)).toBeInTheDocument()
  })

  it('shows what is already configured rather than an empty form', async () => {
    renderSetup()

    // What this project reads from, as a summary — the picker moved to Sources
    // (`D-81`). The claim is the same: somebody arriving sees what is already
    // configured rather than an empty form.
    expect(await screen.findByText(/what this project reads from/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /manage sources|add a source/i })).toBeInTheDocument()
  })

  it('saves a changed field', async () => {
    const user = userEvent.setup()
    const calls: string[] = []
    renderSetup((services) =>
      withSetup(services, {
        configure: async (projectId, field, value, options) => {
          calls.push(`${field}=${value}`)
          return services.setup.configure(projectId, field, value, options)
        },
      }),
    )

    const branch = await screen.findByLabelText(/branch/i)
    await user.clear(branch)
    await user.type(branch, 'develop')
    await user.tab()

    expect(calls).toContain('primary_branch=develop')
  })

  it('does not save a field nobody touched', async () => {
    const user = userEvent.setup()
    const calls: string[] = []
    renderSetup((services) =>
      withSetup(services, {
        configure: async (projectId, field, value, options) => {
          calls.push(field)
          return services.setup.configure(projectId, field, value, options)
        },
      }),
    )

    const branch = await screen.findByLabelText(/branch/i)
    await user.click(branch)
    await user.tab()

    // Focus is not intent. A blur that writes would fill the record with
    // "confirmed by" attributions nobody made.
    expect(calls).toEqual([])
  })
})

describe('setup reports state, not a score', () => {
  it('carries no percentage anywhere', async () => {
    renderSetup()
    await screen.findByText(/what this project reads from/i)

    // `ADR-0003`: a percentage over two booleans says less than the booleans,
    // and `Setup 100%` reads as "the project is 100% understood".
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
  })

  it('says what each state means, in words beside the colour', async () => {
    /**
     * The claim survives `D-82`; its carrier changed. A summary panel said
     * *Sources: Configured — a repository is named, nothing has been read from
     * it yet* above a list that says which repository and whether it was read.
     * One subject stated twice is two things to keep in agreement, and this
     * page had already drifted once.
     *
     * Now the state is **per source**, which is a stronger reading: a project
     * with three sources and one read cannot be described by a single word.
     */
    renderSetup()

    await screen.findByText(/what this project reads from/i)
    expect(screen.getByText(/not read yet/i)).toBeInTheDocument()
  })

  it('distinguishes configured from verified', async () => {
    // `ADR-0003`: verified means proved, not declared. A repository somebody
    // named is not one KAE has read, and no grant changes that (`D-25`).
    renderSetup((services) => withSetup(services, { listConnections: async () => [] }))

    await screen.findByText(/what this project reads from/i)

    expect(screen.getByText(/not read yet/i)).toBeInTheDocument()
    // Nothing claims the stronger word, because nothing has proved it.
    expect(screen.queryByText(/^Read$/)).not.toBeInTheDocument()
    expect(screen.queryByText('Verified')).not.toBeInTheDocument()
  })
})

describe('the output destination', () => {
  it('shows where outputs currently go', async () => {
    renderSetup()

    expect(await screen.findByText('planning documents')).toBeInTheDocument()
    expect(screen.getByText(/ministry\/reporting-platform\/docs\/planning/)).toBeInTheDocument()
  })

  it('refuses a destination with no granted connection, and says why', async () => {
    renderSetup((services) => withSetup(services, { listConnections: async () => [] }))

    // Points at Settings, where connections actually live. It said “above”,
    // naming a panel that moved off this page two decisions ago (`D-85`).
    expect(await screen.findByText(/this project has no github access yet/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /register destination/i })).toBeDisabled()
  })

  it('does not offer a destination picker when GitHub lists nothing', async () => {
    renderSetup((services) =>
      withAcquisition(services, {
        availableRepositories: async () => ({
          repositories: [],
          truncated: false,
          unavailableReason: '',
        }),
      }),
    )

    expect(
      await screen.findByText(/cannot see any GitHub repositories to send output to/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /see github in settings/i })).toHaveAttribute(
      'href',
      '/settings/project',
    )
    expect(screen.queryByLabelText(/filter destination repositories/i)).not.toBeInTheDocument()
    expect(await screen.findByText(/no repositories visible/i)).toBeInTheDocument()
  })

  it('states that write access is unproved rather than implying it works', async () => {
    // The honest edge. Publishing is off by decision (`D-8`), so no destination
    // has been proved writable — and a page that implied otherwise would fail
    // at the last step of a long flow.
    renderSetup()

    expect(await screen.findByText(/test write is not available/i)).toBeInTheDocument()
  })
})

describe('when setup cannot be read', () => {
  it('says so instead of showing an empty form', async () => {
    // An empty setup form reads as "nothing is configured", which is the
    // opposite of "we could not tell you what is configured".
    renderSetup((services) =>
      withSetup(services, {
        getSetup: async () => {
          throw new Error('KAE-Memory did not answer within 5s')
        },
      }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be read/i)
    expect(screen.queryByLabelText(/source repository/i)).not.toBeInTheDocument()
  })
})

/**
 * `D-25` — `verified` means proved, not granted.
 *
 * This file's subject states the rule in its own docstring: *"a source is
 * configured when somebody typed a repository; it is verified when its content
 * has actually been read."* The code read `connections.some(granted)`, which is
 * **authorization** — somebody saying KAE may use a credential — and reported it
 * as `verified`.
 *
 * The tell was that the description underneath stayed honest while the word
 * above it did not, so a reader who trusted the badge and skipped the sentence
 * was told the repository had been read. `ADR-0003` ruled this state model on
 * exactly that distinction.
 *
 * It was not fixable when the page shipped: sources lived in a process
 * dictionary, so *"has this been reached?"* had no answer that survived a
 * restart, and a grant was the closest thing available. `D-21` made the source
 * state durable.
 */
describe('verified is earned, not granted', () => {
  const REPOSITORY = {
    sourceId: 'src_1',
    projectId: 'p1',
    kind: 'github' as const,
    connectionId: 'con_1',
    location: 'kae/ministry-reporting',
    reference: 'main',
    state: 'configured' as const,
    snapshot: null,
    lastError: '',
    disposition: null,
    analysis: { capability: 'analysis', reason: '', state: 'planned' as const, provedInstead: [] },
  }

  /**
   * Explicit delegation, never a spread.
   *
   * The port is a class, so `{...port, listSources}` drops every prototype
   * method and produces an object whose other calls all fail — which renders as
   * a failed read and passes a failure-assertion for entirely the wrong reason.
   */
  function withSources(state: 'configured' | 'readable' | 'pinned') {
    return (services: StudioServices): StudioServices => {
      const port = services.acquisition
      return {
        ...services,
        acquisition: {
          availableRepositories: (q) => port.availableRepositories(q),
          installations: () => port.installations(),
          cloneRepository: (fullName: string) => port.cloneRepository(fullName),
          listConnections: () => port.listConnections(),
          addConnection: (input) => port.addConnection(input),
          checkConnectivity: (id, location) => port.checkConnectivity(id, location),
          listSources: async () => ({ sources: [{ ...REPOSITORY, state }], unavailable: '' }),
          addSource: (projectId, input) => port.addSource(projectId, input),
          pinSource: (sourceId) => port.pinSource(sourceId),
          classifySource: (sourceId, disposition) => port.classifySource(sourceId, disposition),
          sourceMaterial: (projectId) => port.sourceMaterial(projectId),
          listFiles: (sourceId, limit) => port.listFiles(sourceId, limit),
          sample: (sourceId, path) => port.sample(sourceId, path),
          ingestFiles: (sourceId, projectId, paths) => port.ingestFiles(sourceId, projectId, paths),
        },
      }
    }
  }

  it('does not call a named repository read', async () => {
    /**
     * `D-25` holds through `D-82`'s change of carrier. A summary panel said it
     * in a sentence — *"a granted credential says KAE may look, not that it
     * has"* — which is true and is an explanation of the product's model, not
     * something a person came to this page to read.
     *
     * It is now a state **per source**, which says the same thing and scales:
     * a project with three sources and one read cannot be described by one
     * sentence.
     */
    renderSetup(withSources('configured'))

    await screen.findByText(/what this project reads from/i)
    expect(screen.getByText(/not read yet/i)).toBeInTheDocument()
  })

  it('calls a repository read once its content has been reached', async () => {
    renderSetup(withSources('readable'))

    await screen.findByText(/what this project reads from/i)
    expect(screen.getByText(/^Read$/)).toBeInTheDocument()
    expect(screen.queryByText(/not read yet/i)).not.toBeInTheDocument()
  })

  it('counts a pinned repository as reached too', async () => {
    // A pin is resolved *after* reading, so a state map that only accepted
    // `readable` would demote a source the moment it got more certain.
    renderSetup(withSources('pinned'))

    await screen.findByText(/what this project reads from/i)
    expect(screen.getByText(/^Read$/)).toBeInTheDocument()
  })
})

/**
 * `D-26` — a destination that cannot be reached is not one nobody set.
 *
 * `destination.available ? 'configured' : 'none'` rounded a registered
 * destination down to **"No output destination. Generated documents have
 * nowhere to go."** — shown to somebody who chose a repository, chose a path
 * and saved it, whose actual problem is an ungranted credential, and whose
 * implied next step is the one thing that will not help.
 *
 * Losing a fact by rounding down is the same defect as claiming one by rounding
 * up (`D-25`). Both replace what is true with what is easy to compute.
 */
describe('a registered destination stays registered', () => {
  function withTarget(
    available: boolean,
    unavailableReason: string | null = null,
    isDefault = true,
  ) {
    return (services: StudioServices): StudioServices =>
      withSetup(services, {
        getSetup: async (projectId) => ({
          ...(await services.setup.getSetup(projectId)),
          targets: [
            {
              targetId: 'tgt_1',
              provider: 'github',
              name: 'Planning documents',
              purpose: 'documentation',
              isDefault,
              enabled: true,
              available,
              unavailableReason,
              authorization: available ? 'granted' : 'never_granted',
              configuration: {},
            },
          ],
        }),
      })
  }

  it('does not report an unreachable destination as none', async () => {
    renderSetup(withTarget(false))

    await screen.findByText(/where outputs go/i)
    expect(screen.queryByText(/nowhere to go/i)).not.toBeInTheDocument()
    expect(screen.getAllByText(/cannot be reached/i).length).toBeGreaterThan(0)
  })

  it('says why it cannot be reached, in the backend`s words where there are any', async () => {
    renderSetup(withTarget(false, 'The connection for this target was revoked.'))

    // Once now, on the destination itself. It used to appear twice — a summary
    // caveat at the top of the page and the destination further down — and
    // `D-82` removed the summary because one subject stated twice is two
    // things to keep in agreement. The reason still reaches a person, beside
    // the thing it is about.
    const shown = await screen.findAllByText(/the connection for this target was revoked/i)
    expect(shown.length).toBeGreaterThanOrEqual(1)
  })

  it('falls back to a reason of its own rather than saying nothing', async () => {
    // A caveat with no sentence is a caveat nobody can act on, and Memory does
    // not always supply one.
    renderSetup(withTarget(false))

    expect(await screen.findByText(/has not been granted/i)).toBeInTheDocument()
  })

  it('says nothing extra when the destination is reachable', async () => {
    // The other half. A caveat on every project is one nobody reads.
    renderSetup(withTarget(true))

    await screen.findByText(/where outputs go/i)
    expect(screen.queryByText(/cannot be reached/i)).not.toBeInTheDocument()
  })

  /**
   * `D-55`'s neighbour, and live: the deployed project holds one target with
   * `is_default: false`. `resolve_target` accepts a registered id or the
   * project's default and **no third option**, deliberately, so that no publish
   * can name a coordinate inline — and nothing in Studio passes an id. A
   * registered target that is not the default therefore receives nothing, and
   * the page said `Configured` beside it without qualification.
   */
  it('says a registered destination that is not the default has nowhere to go', async () => {
    renderSetup(withTarget(true, null, false))

    expect((await screen.findAllByText(/not the default/i)).length).toBeGreaterThan(0)
    expect(screen.getByText(/nowhere to go/i)).toBeInTheDocument()
  })

  it('does not round a non-default destination down to none', async () => {
    // The `D-26` half, against the new condition: it *is* registered.
    renderSetup(withTarget(true, null, false))

    await screen.findByText(/where outputs go/i)
    // Registered is registered (`D-26`). The word is `No default chosen` —
    // never `None`, which would describe a project nobody configured.
    expect(screen.queryByText(/^None$/)).not.toBeInTheDocument()
    expect(screen.getAllByText('No default chosen').length).toBeGreaterThan(0)
  })

  it('sends nobody to Settings to choose a default', async () => {
    // `§16` asks for **one exact** next action. The recovery is the *Make
    // default* control on this page, so the grant link — right for an
    // ungranted connection — would be a wrong instruction here, not a vague
    // one.
    renderSetup(withTarget(true, null, false))

    await screen.findByText(/not the default/i)
    expect(screen.queryByText(/grant the connection in settings/i)).not.toBeInTheDocument()
  })

  it('still reports no destination when there genuinely is none', async () => {
    renderSetup((services) =>
      withSetup(services, {
        getSetup: async (projectId) => ({
          ...(await services.setup.getSetup(projectId)),
          targets: [],
        }),
      }),
    )

    expect((await screen.findAllByText('None')).length).toBeGreaterThan(0)
  })
})

/**
 * `D-221`. KAE-Memory's `IN_USE` holds five `ValueState` members and four of
 * them are not `confirmed`; this page disclosed one. A `provisional`,
 * `inherited` or `overridden` value takes effect, is not required to carry
 * evidence, and rendered with the field's static hint — indistinguishable from
 * a value a person chose, which is the situation
 * `ConfigurationValues.disclosures()` exists to prevent.
 */
describe('a value KAE chose says so, whichever way it chose it', () => {
  /** Every in-use state that is not `confirmed`, with the word it must show. */
  const DISCLOSED: [string, RegExp][] = [
    ['inferred', /inferred/i],
    ['provisional', /provisional/i],
    ['inherited', /inherited/i],
    ['overridden', /overridden/i],
  ]

  function withKind(state: string, inUse = true, evidence = 'from the repository') {
    return (services: StudioServices): StudioServices =>
      withSetup(services, {
        getSetup: async (projectId) => {
          const base = await services.setup.getSetup(projectId)
          return {
            ...base,
            configuration: {
              ...base.configuration,
              project_kind: {
                value: 'internal web application',
                state,
                in_use: inUse,
                evidence,
                confirmed_by: null,
              },
            },
          }
        },
      })
  }

  it.each(DISCLOSED)('discloses a %s value', async (state, word) => {
    renderSetup(withKind(state))

    expect(await screen.findByText(word)).toBeInTheDocument()
    // The provenance replaces the static hint, so the hint is the control: if
    // it is still rendered, nothing was disclosed.
    expect(screen.queryByText(/helps kae ask better questions/i)).not.toBeInTheDocument()
  })

  it('carries the evidence beside the word, where there is any', async () => {
    renderSetup(withKind('provisional'))

    expect(await screen.findByText(/from the repository/)).toBeInTheDocument()
  })

  it('says nothing extra about a value a person confirmed', async () => {
    renderSetup(withKind('confirmed'))

    expect(await screen.findByText(/helps kae ask better questions/i)).toBeInTheDocument()
    DISCLOSED.forEach(([, word]) => expect(screen.queryByText(word)).not.toBeInTheDocument())
  })

  it('keeps `suggested` separate, because it is the one state not in use', async () => {
    renderSetup(withKind('suggested', false))

    expect(await screen.findByText(/suggested, not applied/i)).toBeInTheDocument()
  })

  it('shows an unrecognised in-use state its own word rather than a borrowed one', async () => {
    // `D-212`. A tenth `ValueState` must not render as `Inferred`, and must not
    // render as nothing either.
    renderSetup(withKind('ratified_by_committee'))

    expect(await screen.findByText(/ratified_by_committee/)).toBeInTheDocument()
    expect(screen.queryByText(/inferred/i)).not.toBeInTheDocument()
  })
})
