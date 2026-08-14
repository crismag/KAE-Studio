/**
 * `ProjectGate` renders outside the router, and must never assume otherwise.
 *
 * `D-86`: adding `useNavigate()` here blanked the entire application. The
 * component **wraps** `RouterProvider` — it decides which project before any
 * route renders — so it is outside the router by construction, and a router
 * hook throws *"may be used only in the context of a <Router>"* at the top of
 * the tree, where there is nothing left to catch it.
 *
 * The unit tests did not catch it because they mount pages inside a
 * `MemoryRouter`. Nothing mounted the gate the way the application does, so
 * this does — bare, with no router anywhere.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

import { ProjectGate } from './ProjectGate'

function renderBare() {
  // **No router, and no ServiceProvider.** That is how the application renders
  // it: the gate reads `/api/projects` directly, because it runs before a
  // project id exists to build services with.
  return render(<ProjectGate>{({ id }) => <div>project {id}</div>}</ProjectGate>)
}

describe('the gate survives having no router', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.location.hash = ''
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify([{ id: 'p1', name: 'A project', knowledge_revision: 2 }]), {
            headers: { 'content-type': 'application/json' },
          }),
      ),
    )
  })

  it('renders the picker rather than throwing', async () => {
    const errors: unknown[] = []
    const spy = vi.spyOn(console, 'error').mockImplementation((e) => errors.push(e))

    renderBare()

    expect(await screen.findByText(/choose a project/i)).toBeInTheDocument()
    // A router hook throws during render; React reports it here before the
    // tree unmounts, so an empty page and a clean console are both required.
    expect(errors.filter((e) => String(e).includes('may be used only in the context'))).toEqual([])
    spy.mockRestore()
  })

  it('uses the hash to move, because the hash is the route', async () => {
    // `createHashRouter`. Anything else would need router context the gate
    // cannot have.
    renderBare()
    await screen.findByText(/choose a project/i)

    expect(() => {
      window.location.hash = '#/setup'
    }).not.toThrow()
  })
})
