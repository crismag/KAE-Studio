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
  it('says what the number means, for anyone not looking at the layout', async () => {
    renderShell()

    // Spoken rather than implied. "3" beside "Reviews" is ambiguous on screen
    // and meaningless to a screen reader.
    const badge = await screen.findByLabelText(/need review/i)

    expect(badge).toBeInTheDocument()
  })

  it('counts only what needs a person now', async () => {
    renderShell()

    const badge = await screen.findByLabelText(/need review/i)
    const shown = Number(badge.textContent)

    // Fewer than every finding. Major and minor stay on the page; what they are
    // not is a reason to interrupt somebody who just described their idea.
    expect(shown).toBeGreaterThan(0)
    expect(badge.getAttribute('aria-label')).toBe(`${shown} need review`)
  })
})
