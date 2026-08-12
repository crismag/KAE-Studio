/**
 * `D-19` — the person who owns the project can read its architecture.
 *
 * `ModuleService` has computed the graph, both directions of a module's
 * neighbourhood, and a stable build order since N17/N18, and the only adapter
 * over it was an MCP tool. So a coding agent could read a project's
 * architecture and its owner could not, and `/dependencies` rendered an empty
 * state on every deployment — with a reason that was accurate, which is why it
 * survived so long.
 *
 * These hold the three things the page must keep straight:
 *
 * 1. **Could not be read** is not **has no modules**. One is a fact about this
 *    deployment and the other is a fact about the project.
 * 2. Build order comes from Memory. Two orders that disagree is a question
 *    nobody can answer from the screen.
 * 3. Nothing on the page describes a module more richly than Memory does. The
 *    version this replaced was built on `ProjectModule` — blocking
 *    dependencies with reasons, interface protocols, failure behaviour — and
 *    every one of those fields would now have to be invented per module.
 */

import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ServiceProvider } from '@/services/ServiceProvider'
import { createMockServices } from '@/services/mock/mockServices'
import { Dependencies } from './Dependencies'
import { layersFrom } from './buildOrderLayers'
import { architecture as fixture } from '@/services/mock/fixtures/ministryReporting'
import type { ArchitectureGraph, ProjectProjection } from '@/domain/types'
import type { StudioServices } from '@/services/interfaces'

function renderWith(architecture: ArchitectureGraph) {
  const services = createMockServices()
  const original = services.projection.getProjection.bind(services.projection)
  const patched: StudioServices = {
    ...services,
    projection: {
      ...services.projection,
      getProjection: async (id: string): Promise<ProjectProjection> => ({
        ...(await original(id)),
        architecture,
      }),
    },
  }
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ServiceProvider services={patched}>
          <Dependencies />
        </ServiceProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

const EMPTY: ArchitectureGraph = {
  available: true,
  reason: '',
  modules: [],
  edges: [],
  buildOrder: [],
  note: '',
}

describe('build order is Memory`s answer', () => {
  it('layers a chain so each module sits below what it depends on', () => {
    const layers = layersFrom(fixture)

    expect(layers.map((layer) => layer.map((module) => module.key))).toEqual([
      ['identity'],
      ['reporting'],
      ['approval'],
      ['publication'],
    ])
  })

  it('puts modules with no dependencies together in the first layer', () => {
    const layers = layersFrom({
      ...EMPTY,
      modules: [
        { key: 'a', name: 'A', summary: '', status: 'proposed' },
        { key: 'b', name: 'B', summary: '', status: 'proposed' },
        { key: 'c', name: 'C', summary: '', status: 'proposed' },
      ],
      edges: [{ source: 'c', relation: 'depends_on', targetModule: 'a', targetKnowledge: null }],
      buildOrder: ['a', 'b', 'c'],
    })

    expect(layers.map((layer) => layer.map((module) => module.key))).toEqual([['a', 'b'], ['c']])
  })

  it('shows a module Memory left out of build order rather than dropping it', () => {
    // It would have to be in a cycle, which the write path refuses — so this is
    // defensive. A module missing from this page is a module a reader believes
    // does not exist.
    const layers = layersFrom({
      ...EMPTY,
      modules: [
        { key: 'a', name: 'A', summary: '', status: 'proposed' },
        { key: 'orphan', name: 'Orphan', summary: '', status: 'proposed' },
      ],
      buildOrder: ['a'],
    })

    expect(layers.flat().map((module) => module.key)).toContain('orphan')
  })

  it('reads the order rather than recomputing one', async () => {
    // Memory breaks ties by key so its order is stable between calls. A second
    // order computed here could disagree with it, and a reader looking at two
    // orders has no way to tell which is the product's answer.
    renderWith({
      ...fixture,
      buildOrder: ['publication', 'approval', 'reporting', 'identity'],
    })

    await screen.findByText('Build order')
    const buttons = screen.getAllByRole('button', { pressed: false })
    const labels = buttons.map((button) => button.textContent ?? '')

    expect(labels[0]).toContain('Publication')
  })
})

describe('what the page says when it has nothing', () => {
  it('says the graph could not be read, in the backend`s words', async () => {
    renderWith({
      ...EMPTY,
      available: false,
      reason: 'KAE-Memory returned 503.',
    })

    expect(await screen.findByText(/KAE-Memory returned 503/)).toBeInTheDocument()
  })

  it('does not call an unreadable graph a project without modules', async () => {
    renderWith({ ...EMPTY, available: false, reason: 'KAE-Memory returned 503.' })

    await screen.findByText(/KAE-Memory returned 503/)
    expect(screen.queryByText(/no modules yet/i)).not.toBeInTheDocument()
  })

  it('says a readable graph with nothing in it is a project with no modules', async () => {
    // The other direction, and the one that was impossible to say before: the
    // route did not exist, so an empty list could never mean "none".
    renderWith(EMPTY)

    expect(await screen.findByText(/no modules yet/i)).toBeInTheDocument()
  })
})

describe('nothing describes a module more richly than Memory does', () => {
  it('shows the summary Memory holds and invents no others', async () => {
    renderWith(fixture)

    expect(await screen.findByText(fixture.modules[0].summary)).toBeInTheDocument()
  })

  it('never says a dependency blocks', async () => {
    // The field that came out. `ProjectModule.dependencies[].blocking` carried
    // a reason per edge; Memory's `depends_on` carries none, and a page that
    // invents why a dependency blocks is worse than one that never mentions
    // blocking.
    const { container } = renderWith(fixture)

    await screen.findByText('Build order')
    expect(container.textContent).not.toMatch(/blocking|blocks/i)
  })

  it('renders an edge to a statement without pretending it is a module', async () => {
    // Both kinds arrive in one list. A statement identifier rendered as a
    // module is a node a reader will try to open.
    //
    // Reached by selecting the module that has one, which is also the *"dig
    // deeper for module-level information"* gesture the owner asked for — so
    // this asserts the panel changes as well as what it holds.
    renderWith(fixture)

    await screen.findByText('Build order')
    fireEvent.click(screen.getByRole('button', { name: /Approval workflow/ }))

    expect(screen.getByText('BR-APR-002')).toBeInTheDocument()
    expect(screen.getByText(/statements this module answers to/i)).toBeInTheDocument()
    // And the dependents half, which is the question the previous page could
    // not answer at all: what breaks if I change this.
    expect(screen.getByText(/depended on by/i)).toBeInTheDocument()
  })

  it('carries Memory`s note about what build order does not mean', async () => {
    renderWith(fixture)

    expect(await screen.findByText(/not yet confirmed/i)).toBeInTheDocument()
  })
})
