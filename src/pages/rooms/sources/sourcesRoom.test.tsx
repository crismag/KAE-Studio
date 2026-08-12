/**
 * Sources — two-thirds built, and invisible.
 *
 * `ProjectSources` rendered in exactly one place: partway down `/deliverables`,
 * a page about generated output, beneath a permanent banner saying repository
 * analysis is not built. The banner is true. It was stated over four controls
 * that work — connect, verify, pin, read — which is most of why repository
 * ingestion read as absent.
 *
 * `tree()` returned a full listing and was used only to count files. `sample()`
 * was routed and on no port. These assert both are reachable now, and that the
 * page still refuses to call any of it *analysis*.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ServiceProvider } from '@/services/ServiceProvider'
import { createMockServices } from '@/services/mock/mockServices'
import { SourcesRoom } from './SourcesRoom'
import { PasteDocument } from './intake'
import type { AcquisitionPort, StudioServices } from '@/services/interfaces'
import type { ProjectSource } from '@/domain/types'

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

const PINNED: ProjectSource = {
  sourceId: 'src-1',
  projectId: 'demo',
  kind: 'github',
  connectionId: 'conn-1',
  location: 'ministry/reporting-platform',
  reference: 'main',
  state: 'pinned',
  snapshot: {
    revision: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
    resolvedAt: '2026-08-10T09:00:00Z',
    fileCount: 412,
    totalBytes: 1_204_882,
    excludedCount: 88,
    contentDigest: 'sha256:deadbeef',
  },
  lastError: '',
  analysis: {
    capability: 'repository-analysis',
    reason: 'not built',
    state: 'planned',
    provedInstead: [],
  },
}

/**
 * A pinned source plus the file calls that answer for it.
 *
 * The mock's `listFiles` and `sample` look up their own internal source list,
 * so injecting a source through `listSources` alone gives a page whose browser
 * throws "Unknown source" — which renders as a failed read and would pass a
 * test asserting failure for the wrong reason.
 */
function withPinnedSource(services: StudioServices, over: Partial<AcquisitionPort> = {}) {
  const files = [
    { path: 'README.md', size: 4_812 },
    { path: 'docs/ARCHITECTURE.md', size: 12_408 },
  ]
  return withAcquisition(services, {
    listSources: async () => ({ sources: [PINNED], unavailable: '' }),
    listFiles: async () => ({ files, truncated: false }),
    sample: async (_sourceId, path) => ({
      path,
      bytes: 120,
      excerpt: `# ${path}\n\nFixture content for the prototype.`,
      proves: 'this credential can read file content at this revision.',
    }),
    ingestFiles: async (_sourceId, _projectId, paths) => ({
      revision: PINNED.snapshot!.revision,
      ingested: paths.map((path) => ({ path, ingested: {} })),
      proves: 'these files were read at the pinned revision.',
    }),
    ...over,
  })
}

function renderSources(patch?: (services: StudioServices) => StudioServices) {
  const base = createMockServices()
  const services = patch ? patch(base) : base
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const rendered = render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ServiceProvider services={services}>
          <SourcesRoom />
        </ServiceProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  )

  return rendered
}

describe('a repository’s files are visible at all', () => {
  it('lists the file names, not only how many there are', async () => {
    // `tree()` has always returned this and was used only to count. A person
    // saw "412 files" and not one of their names.
    renderSources((services) => withPinnedSource(services))

    expect(await screen.findByText('README.md')).toBeInTheDocument()
    expect(screen.getByText('docs/ARCHITECTURE.md')).toBeInTheDocument()
  })

  it('filters by path', async () => {
    const user = userEvent.setup()
    renderSources((services) => withPinnedSource(services))

    await user.type(await screen.findByLabelText(/find a file/i), 'docs/')

    expect(screen.getByText('docs/ARCHITECTURE.md')).toBeInTheDocument()
    expect(screen.queryByText('README.md')).not.toBeInTheDocument()
  })

  it('says so when a filter matches nothing, in the filter’s own words', async () => {
    const user = userEvent.setup()
    renderSources((services) => withPinnedSource(services))

    await user.type(await screen.findByLabelText(/find a file/i), 'zzz')

    expect(screen.getByText(/No file path contains “zzz”/)).toBeInTheDocument()
  })

  it('will not read until a file is chosen', async () => {
    renderSources((services) => withPinnedSource(services))

    await screen.findByText('README.md')

    expect(screen.getByRole('button', { name: /^read files$/i })).toBeDisabled()
  })

  it('reads the files a person actually chose', async () => {
    const user = userEvent.setup()
    const sent: string[][] = []
    renderSources((services) =>
      withPinnedSource(services, {
        ingestFiles: async (_sourceId, _projectId, paths) => {
          sent.push(paths)
          return { revision: 'a1b2c3', ingested: [], proves: '' }
        },
      }),
    )

    await user.click(await screen.findByLabelText('README.md'))
    await user.click(screen.getByRole('button', { name: /read 1 file/i }))

    expect(sent).toEqual([['README.md']])
  })
})

describe('previewing a file', () => {
  it('reaches the endpoint that was on no port', async () => {
    const user = userEvent.setup()
    renderSources((services) => withPinnedSource(services))

    await user.click(await screen.findByRole('button', { name: /preview README.md/i }))

    expect(await screen.findByText(/Fixture content for the prototype/)).toBeInTheDocument()
  })

  it('says what reading it proved', async () => {
    const user = userEvent.setup()
    renderSources((services) => withPinnedSource(services))

    await user.click(await screen.findByRole('button', { name: /preview README.md/i }))

    // A connectivity check does not prove this: a token with metadata-only
    // scope passes the check and fails here.
    expect(
      await screen.findByText(/this credential can read file content at this revision/i),
    ).toBeInTheDocument()
  })

  it('surfaces a refused read rather than an empty pane', async () => {
    const user = userEvent.setup()
    renderSources((services) =>
      withPinnedSource(services, {
        sample: async () => {
          throw new Error('403: the credential cannot read file content')
        },
      }),
    )

    await user.click(await screen.findByRole('button', { name: /preview README.md/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be read/i)
    expect(screen.getByText(/the credential cannot read file content/i)).toBeInTheDocument()
  })
})

describe('the page never calls connecting analysis', () => {
  it('scopes the limit to the claim rather than to the page', async () => {
    renderSources((services) => withPinnedSource(services))

    // The sentence stays. What changes is that it sits beside the thing it is
    // about, instead of over four working controls.
    expect(await screen.findByText(/KAE does not analyse a repository/i)).toBeInTheDocument()
    expect(screen.getByText(/Connecting and reading are not analysis/i)).toBeInTheDocument()
  })

  it('describes a pinned source by what happened, never with a tick', async () => {
    renderSources((services) => withPinnedSource(services))

    expect(await screen.findByText('Pinned')).toBeInTheDocument()
    expect(screen.getByText(/Fixed to one commit/i)).toBeInTheDocument()
    // "Connected ✓" is read as "KAE has understood my project".
    expect(screen.queryByText(/connected/i)).not.toBeInTheDocument()
  })

  it('renders a source that cannot be reached as its own state', async () => {
    // The fourth state, and the one usually missed. A source that exists and
    // could not be reached is neither an empty list nor a failed page load.
    //
    // `refused` and `unreachable` are `ConnectionState` values and describe a
    // *credential*; putting them in a source's state map would have been two
    // branches nothing can ever produce.
    renderSources((services) =>
      withPinnedSource(services, {
        listSources: async () => ({
          unavailable: '',
          sources: [{ ...PINNED, lastError: '404: the repository was not found at this revision' }],
        }),
      }),
    )

    expect(await screen.findByText('Unreachable')).toBeInTheDocument()
    // The reason, on the source. It is the only part a person can act on.
    expect(
      screen.getAllByText(/the repository was not found at this revision/i).length,
    ).toBeGreaterThan(0)
  })
})

describe('when there is nothing connected', () => {
  it('sends a person to the page that can connect one', async () => {
    renderSources((services) =>
      withAcquisition(services, { listSources: async () => ({ sources: [], unavailable: '' }) }),
    )

    expect(await screen.findByText(/No repository connected yet/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /connect one in project setup/i })).toHaveAttribute(
      'href',
      '/setup',
    )
  })

  it('does not render an empty file browser over it', async () => {
    renderSources((services) =>
      withAcquisition(services, { listSources: async () => ({ sources: [], unavailable: '' }) }),
    )

    await screen.findByText(/No repository connected yet/i)
    expect(screen.queryByLabelText(/find a file/i)).not.toBeInTheDocument()
  })
})

describe('one Source abstraction, not two pages', () => {
  it('offers repositories, text, files and activity in one place', async () => {
    // `§7`: repository, document, pasted note and the rest are Project Sources,
    // not unrelated fields. Split across two routes, "give KAE something to
    // read" meant two navigation items depending on where the material lived.
    renderSources((services) => withPinnedSource(services))

    expect(await screen.findByRole('tab', { name: /repositories/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^text$/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^files$/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /activity/i })).toBeInTheDocument()
  })

  it('takes pasted text without leaving the room', async () => {
    const user = userEvent.setup()
    renderSources((services) => withPinnedSource(services))

    await user.click(await screen.findByRole('tab', { name: /^text$/i }))

    expect(await screen.findByLabelText(/what is this/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /read this/i })).toBeInTheDocument()
  })

  it('still states the file gap rather than offering a drop zone', async () => {
    const user = userEvent.setup()
    renderSources((services) => withPinnedSource(services))

    await user.click(await screen.findByRole('tab', { name: /^files$/i }))

    expect(await screen.findByText(/KAE cannot read files yet/i)).toBeInTheDocument()
    expect(document.querySelector('input[type="file"]')).toBeNull()
  })

  it('keeps the run history reachable', async () => {
    const user = userEvent.setup()
    renderSources((services) => withPinnedSource(services))

    await user.click(await screen.findByRole('tab', { name: /activity/i }))

    // The merge must not lose what /ingestion made visible: a person who starts
    // a read still has to be able to watch it, and see why it failed.
    expect(await screen.findByText(/quoted text that is not in the source/i)).toBeInTheDocument()
  })
})

/**
 * `D-21` — an empty list and an unread record are different statements.
 *
 * Sources became durable, which means reading them can now fail. Before, an
 * empty process could only ever say "none", and that was true. Now the same
 * empty list can mean *"KAE-Memory did not answer"* — and the page's own empty
 * state, "No repository connected yet… connect one in Project setup", would be
 * telling somebody who connected a repository last week to go and do it again.
 */
describe('when the record cannot be read', () => {
  it('says why the list may be short, in the backend`s words', async () => {
    const reason = 'Configured sources could not be read from KAE-Memory: connection refused'
    renderSources((services) =>
      withAcquisition(services, {
        listSources: async () => ({ sources: [], unavailable: reason }),
      }),
    )

    expect(await screen.findByText(new RegExp('connection refused'))).toBeInTheDocument()
  })

  it('does not tell a person to connect a repository they may already have', async () => {
    renderSources((services) =>
      withAcquisition(services, {
        listSources: async () => ({
          sources: [],
          unavailable: 'Configured sources could not be read from KAE-Memory: 503',
        }),
      }),
    )

    await screen.findByText(/503/)
    expect(screen.queryByText(/No repository connected yet/i)).not.toBeInTheDocument()
  })

  it('says nothing when the record read', async () => {
    // The other half. A standing notice on every project is one nobody reads,
    // and it would make the warning above invisible.
    renderSources((services) =>
      withAcquisition(services, { listSources: async () => ({ sources: [], unavailable: '' }) }),
    )

    expect(await screen.findByText(/No repository connected yet/i)).toBeInTheDocument()
    expect(screen.queryByText(/could not be read/i)).not.toBeInTheDocument()
  })
})

/**
 * `D-24` — a pasted document is a Source, and is not a repository.
 *
 * The ingest path worked the whole time and recorded nothing that said intake
 * had happened, so the Sources Room listed repositories and nothing else.
 * Somebody who handed KAE their brief last week found no trace of it on the
 * page that takes documents, and the honest response to that is to paste it
 * again.
 *
 * The risk the fix carries is the opposite one: every source used to be a
 * repository, so a pasted brief in the Repositories tab would be labelled one
 * by its surroundings — a claim a list makes without saying a word.
 */
describe('sources of different kinds are not shown as one another', () => {
  const PASTED = {
    ...PINNED,
    sourceId: 'src_paste',
    kind: 'paste' as const,
    location: 'Project brief',
    state: 'readable' as const,
    snapshot: null,
  }

  it('keeps a pasted document out of the repository list', async () => {
    renderSources((services) =>
      withAcquisition(services, {
        listSources: async () => ({ sources: [PINNED, PASTED], unavailable: '' }),
      }),
    )

    // The repository appears twice — once in the list, once in the detail
    // panel beside it — so its presence is asserted through the list rather
    // than a bare text lookup.
    expect((await screen.findAllByText(PINNED.location)).length).toBeGreaterThan(0)
    expect(screen.queryByText('Project brief')).not.toBeInTheDocument()
  })

  it('says no repository is connected when only a document was given', async () => {
    // The reading that matters. A project with a pasted brief and no repository
    // has no repository, and a list that counted the brief would say otherwise.
    renderSources((services) =>
      withAcquisition(services, {
        listSources: async () => ({ sources: [PASTED], unavailable: '' }),
      }),
    )

    expect(await screen.findByText(/No repository connected yet/i)).toBeInTheDocument()
  })
})

describe('the documents already given', () => {
  const PASTED = {
    ...PINNED,
    sourceId: 'src_paste',
    kind: 'paste' as const,
    location: 'Project brief',
    state: 'readable' as const,
    snapshot: null,
  }

  /**
   * `PasteDocument` directly rather than through the Room.
   *
   * The Room is tabbed, only the open panel renders, and Radix triggers do not
   * switch on a synthetic click — so a test driving the tab would assert
   * against whatever the default panel happened to be. This renders the
   * component that owns the behaviour.
   */
  function renderPaste(patch: (services: StudioServices) => StudioServices) {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    })
    return render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <ServiceProvider services={patch(createMockServices())}>
            <PasteDocument />
          </ServiceProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    )
  }

  it('lists what this project has been handed', async () => {
    renderPaste((services) =>
      withAcquisition(services, {
        listSources: async () => ({ sources: [PASTED], unavailable: '' }),
      }),
    )

    expect(await screen.findByText('Project brief')).toBeInTheDocument()
  })

  it('says an unread record is not an empty one', async () => {
    // Found by re-scanning this change rather than by anybody hitting it. An
    // absent section reads as "nothing has been given", to somebody deciding
    // whether to paste their brief a second time.
    renderPaste((services) =>
      withAcquisition(services, {
        listSources: async () => ({ sources: [], unavailable: 'KAE-Memory returned 503.' }),
      }),
    )

    const notice = await screen.findByRole('alert')
    expect(notice).toHaveTextContent(/503/)
    expect(notice).toHaveTextContent(/not a statement that nothing was/i)
  })

  it('says nothing at all when nothing has been given', async () => {
    renderPaste((services) =>
      withAcquisition(services, {
        listSources: async () => ({ sources: [], unavailable: '' }),
      }),
    )

    await screen.findByText(/Read this/i)
    expect(screen.queryByText(/already given/i)).not.toBeInTheDocument()
  })
})
