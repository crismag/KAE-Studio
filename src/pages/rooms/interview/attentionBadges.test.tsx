/**
 * A badge means attention, not a count.
 *
 * R13. `Reviews 81` on a first project reads as "KAE has found 81 things wrong
 * with your idea" — the customer's original problem restated in the product's
 * own words (R10, PPA-15, PPA-21). A number that cannot be driven to zero is
 * decoration; one that can is a queue.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ServiceProvider } from '@/services/ServiceProvider'
import { createMockServices, resetPrototypeState } from '@/services/mock/mockServices'
import { AppShell } from '@/app/shell/AppShell'

function renderShell() {
  resetPrototypeState()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ServiceProvider services={createMockServices()}>
          <AppShell />
        </ServiceProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('the reviews badge', () => {
  it('says what the number means on screen, not only to a screen reader', async () => {
    /**
     * `NAV-01`. The badge carried its noun in `aria-label` and showed a bare
     * number, so a sighted reader met `59` beside "Reviews" with no way to tell
     * whether that was findings, items, or things wrong with their idea. The
     * word is three characters.
     */
    renderShell()

    const badge = await screen.findByLabelText(/needing review/i)

    expect(badge).toBeInTheDocument()
    expect(badge.textContent).toMatch(/\d+ critical/)
  })

  it('counts only what needs a person now', async () => {
    renderShell()

    const badge = await screen.findByLabelText(/needing review/i)
    const shown = Number((badge.textContent ?? '').replace(/[^0-9]/g, ''))

    // Fewer than every finding. Major and minor stay on the page; what they are
    // not is a reason to interrupt somebody who just described their idea.
    expect(shown).toBeGreaterThan(0)
    expect(badge.getAttribute('aria-label')).toBe(`${shown} critical, needing review`)
  })
})
