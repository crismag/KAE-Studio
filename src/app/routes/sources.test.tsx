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
import { Sources } from './Sources'
import type { AcquisitionPort, StudioServices } from '@/services/interfaces'
import type { ProjectSource } from '@/domain/types'

function withAcquisition(base: StudioServices, over: Partial<AcquisitionPort>): StudioServices {
  const port = base.acquisition
  return {
    ...base,
    acquisition: {
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
    listSources: async () => [PINNED],
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
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ServiceProvider services={services}>
          <Sources />
        </ServiceProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
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
        listSources: async () => [
          { ...PINNED, lastError: '404: the repository was not found at this revision' },
        ],
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
    renderSources((services) => withAcquisition(services, { listSources: async () => [] }))

    expect(await screen.findByText(/No repository connected yet/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /connect one in project setup/i })).toHaveAttribute(
      'href',
      '/setup',
    )
  })

  it('does not render an empty file browser over it', async () => {
    renderSources((services) => withAcquisition(services, { listSources: async () => [] }))

    await screen.findByText(/No repository connected yet/i)
    expect(screen.queryByLabelText(/find a file/i)).not.toBeInTheDocument()
  })
})
