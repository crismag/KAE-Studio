/**
 * The Dashboard walking skeleton, and the four things it must not invent.
 *
 * Stage 3: *"Build the smallest truthful Dashboard… Do not invent readiness,
 * tasks, room status, or recent changes if the backing contract does not exist.
 * Document missing contracts first."*
 *
 * That sentence is the whole test plan. A dashboard is the easiest surface in
 * any product to fill with plausible numbers, because the shape is so familiar
 * that a reader supplies the meaning — which is why `UXA-10` names it first:
 * *"no dashboard, Room, board, progress, or readiness component claims
 * unavailable or invented state."*
 */

import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ServiceProvider } from '@/services/ServiceProvider'
import { createMockServices } from '@/services/mock/mockServices'
import { Dashboard, SurfaceCard } from './DashboardPage'
import { surfacesInGroup } from '@/app/registries/rooms'

/** What the grid is meant to offer: the primary surfaces, less Home itself. */
const HOME = surfacesInGroup('primary').filter((surface) => surface.id !== 'dashboard')
import type { AttentionItem, ProjectProjection } from '@/domain/types'
import type { StudioServices } from '@/services/interfaces'

function renderDashboard(
  shape?: (base: ProjectProjection) => ProjectProjection,
  attention?: () => Promise<AttentionItem[]>,
) {
  const services = createMockServices()
  const original = services.projection.getProjection.bind(services.projection)
  const patched: StudioServices = {
    ...services,
    projection: {
      ...services.projection,
      getProjection: async (id: string) => {
        const base = await original(id)
        return shape ? shape(base) : base
      },
      classify: (id: string) => services.projection.classify(id),
    },
    // The panel's first row is a second layer's read (`D-158`), so a test about
    // what the Dashboard says needs a person has to be able to set both.
    synthesis: {
      ...services.synthesis,
      listAttention: (id, options) =>
        attention ? attention() : services.synthesis.listAttention(id, options),
    },
  }
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ServiceProvider services={patched}>
          <Dashboard />
        </ServiceProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

/**
 * Synthesis raised nothing — **resolved**, not unknown.
 *
 * Every test asserting that the panel says nothing is waiting has to set this,
 * because `nothing is waiting` is now a claim about two layers and the mock
 * project has a live attention queue.
 */
const NOTHING_RAISED = () => Promise.resolve([] as AttentionItem[])

describe('the journey', () => {
  it('marks the stage the project reports', async () => {
    renderDashboard((base) => ({ ...base, health: { ...base.health, stage: 'defining' } }))

    const active = await screen.findByText('Definition')
    expect(active).toHaveAttribute('aria-current', 'step')
  })

  it('reads where the project got to, not whether it is still open', async () => {
    /**
     * The bug this replaces. The strip compared `phase` — the project's
     * *status* — against a list of stage names, so `active` matched nothing and
     * every project that has ever existed was told "this view does not
     * recognise your stage". The one device on the home page that says where
     * you are was permanently blank, on a live deployment, for months.
     */
    renderDashboard((base) => ({
      ...base,
      health: { ...base.health, phase: 'active', stage: 'discovering' },
    }))

    expect(await screen.findByText('Discovery')).toHaveAttribute('aria-current', 'step')
    expect(
      screen.queryByText(/reports a stage this view does not recognise/i),
    ).not.toBeInTheDocument()
  })

  it('marks nothing when the stage is one it does not recognise', async () => {
    // Guessing a position would put a project somewhere it is not. Marking the
    // first stage is the tempting default and it is a claim.
    renderDashboard((base) => ({ ...base, health: { ...base.health, stage: 'something-new' } }))

    expect(
      await screen.findByText(/reports a stage this view does not recognise/i),
    ).toBeInTheDocument()
    expect(screen.queryByText('Setup')).not.toHaveAttribute('aria-current')
  })
})

describe('what needs you', () => {
  it('makes one row the primary one, so the page answers what now', async () => {
    /**
     * `NAV-01` N5. Three rows of equal weight ask a person to rank their own
     * work on the page that exists to answer *what now*. The ranking already
     * existed — it is the order the rows are built in — and nothing on screen
     * showed it.
     */
    renderDashboard()

    const first = await screen.findByText(/matters need your judgment/i)
    const row = first.closest('a')

    // The verb appears on the first row and only there.
    expect(row).toHaveTextContent(/See them/)
    const decisions = screen.getByText(/open decision/i).closest('a')
    expect(decisions).not.toHaveTextContent(/Decide them/)
  })

  it('puts what synthesis raised above what extraction counted', async () => {
    /**
     * Doc 17's own bad sentence sat at the top of the project's home page: a
     * raw extraction count presented as human work (`D-158`). It is still here,
     * because `/reviews` is transitional and this is the Dashboard's only
     * pointer to it — but the panel renders `index === 0` prominently, so which
     * row is first is the panel saying which of the two is work.
     */
    renderDashboard()

    const rows = await screen.findAllByRole('link', {
      name: /your judgment|awaiting your decision/i,
    })
    expect(rows[0]).toHaveTextContent(/matters need your judgment/i)
    expect(rows[0]).toHaveAttribute('href', '/attention')
    expect(rows[1]).toHaveTextContent(/proposed statement.* awaiting your decision/i)
    expect(rows[1]).toHaveAttribute('href', '/reviews')
  })

  it('does not count what somebody postponed', async () => {
    // Deferring means *stop recommending this*. A Dashboard row that counted a
    // postponed item would make Defer a gesture that changes nothing on the
    // surface a person looks at first.
    const open: AttentionItem = {
      id: 'attn-open',
      kind: 'material_unknown',
      title: 'Who approves a return',
      explanation: 'Nothing answers it.',
      recommendation: null,
      status: 'open',
      synthesizedObjectId: null,
      priority: 1,
      actions: ['answer'],
      updatedAt: null,
    }
    renderDashboard(undefined, () =>
      Promise.resolve([open, { ...open, id: 'attn-deferred', status: 'deferred' }]),
    )

    expect(await screen.findByText(/1 matter needs your judgment/i)).toBeInTheDocument()
  })

  it('does not say nothing is waiting when the queue could not be read', async () => {
    // Unknown is not zero. `D-38` is the same defect one panel earlier — a
    // hedge that blamed KAE's perception for a gap KAE was displaying.
    renderDashboard(
      (base) => ({
        ...base,
        findings: [],
        openDecisions: [],
        contradictions: { count: 0, listable: true, reason: '' },
        extractionCoverage: { succeeded: 3, abandoned: 0, complete: true },
        blockers: [],
        review: { available: true, reason: '', findings: [] },
      }),
      () => Promise.reject(new Error('the queue is unreachable')),
    )

    expect(
      await screen.findByText(/could not be read, so this list is incomplete/i),
    ).toBeInTheDocument()
    expect(screen.queryByText(/nothing is waiting on you/i)).not.toBeInTheDocument()
  })

  it('keeps the rows it did read when the queue could not be read', async () => {
    // Alongside the rows, not instead of them: hiding what resolved to report
    // the absence of what did not is `G2`'s conservation defect on one panel.
    renderDashboard(undefined, () => Promise.reject(new Error('the queue is unreachable')))

    expect(
      await screen.findByText(/proposed statement.* awaiting your decision/i),
    ).toBeInTheDocument()
  })

  it('counts things that exist and links each one somewhere', async () => {
    renderDashboard()

    const proposals = await screen.findByText(/proposed statement.* awaiting your decision/i)
    expect(proposals.closest('a')).toHaveAttribute('href', '/reviews')
  })

  it('renders no row for a count of zero', async () => {
    // A permanent list of zeroes is `Reviews 81` inverted: it trains the eye
    // past the panel, so the one time a row appears nobody sees it.
    renderDashboard(
      (base) => ({
        ...base,
        findings: [],
        openDecisions: [],
        contradictions: { count: 0, listable: true, reason: '' },
        extractionCoverage: { succeeded: 3, abandoned: 0, complete: true },
        // Cleared as well, since `D-38`. The prototype project has a critical
        // blocker, so leaving these would make "nothing is waiting" false — and
        // this test asserted that sentence against exactly that project.
        blockers: [],
        review: { available: true, reason: '', findings: [] },
      }),
      NOTHING_RAISED,
    )

    expect(
      await screen.findByText(/nothing is waiting on you that KAE can currently detect/i),
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /awaiting your decision/i })).not.toBeInTheDocument()
  })

  it('says "that KAE can detect" rather than "all clear"', async () => {
    // The narrower claim is the true one: three of the five review groups are
    // not computed at all, so silence is not evidence of nothing.
    renderDashboard(
      (base) => ({
        ...base,
        findings: [],
        openDecisions: [],
        contradictions: { count: 0, listable: true, reason: '' },
        extractionCoverage: { succeeded: 3, abandoned: 0, complete: true },
        blockers: [],
        review: { available: true, reason: '', findings: [] },
      }),
      NOTHING_RAISED,
    )

    expect(await screen.findByText(/that KAE can currently detect/i)).toBeInTheDocument()
    expect(screen.queryByText(/all clear/i)).not.toBeInTheDocument()
  })

  it('surfaces content loss as something needing a person', async () => {
    renderDashboard((base) => ({
      ...base,
      extractionCoverage: { succeeded: 3, abandoned: 2, complete: false },
    }))

    const row = await screen.findByText(/part of what you gave KAE was never read/i)
    expect(row.closest('a')).toHaveAttribute('href', '/ingestion')
  })
})

describe('launchers tell the truth before they are clicked', () => {
  it('says what a surface is waiting for', async () => {
    renderDashboard()

    // `§13`: truthful availability. A person should not have to open a surface
    // to discover it cannot do its job.
    //
    // Read from the registry rather than quoting one sentence. The first
    // version of this asserted *"nothing derives an architecture"* and failed
    // the day that stopped being true — which is the check working, and also a
    // test that has to be rewritten every time the product improves. What `§13`
    // actually requires is that **every** limit reaches the card it belongs to.
    const limited = HOME.filter((surface) => surface.limit)

    expect(limited.length).toBeGreaterThan(0)
    for (const surface of limited) {
      expect(
        await screen.findByText(surface.limit!),
        `${surface.title} states a limit the Dashboard does not show`,
      ).toBeInTheDocument()
    }
  })

  it('marks a surface that cannot do its job yet', async () => {
    // Rendered directly, because no primary surface is `awaiting-capability`
    // today (`HOME-ROOMS` — the three that were are read-only and now sit in
    // Understanding). The branch stays checked rather than being checked by
    // whichever surface happens to be broken this month.
    render(
      <MemoryRouter>
        <ul>
          <SurfaceCard
            surface={{
              id: 'not-yet',
              group: 'primary',
              title: 'Something later',
              route: '/later',
              kind: 'room',
              purpose: 'Do a thing KAE cannot do',
              readiness: 'awaiting-capability',
              limit: 'Nothing derives it.',
            }}
          />
        </ul>
      </MemoryRouter>,
    )

    expect(screen.getByRole('link')).toHaveTextContent('Not yet')
  })

  it('does not mark a surface that works', async () => {
    renderDashboard()

    const workspace = (await screen.findByText('Workspace')).closest('a')!
    expect(workspace).not.toHaveTextContent('Not yet')
  })
})

/**
 * `HOME-ROOMS` — doc 14 invariant 3.
 *
 * *"The Rooms grid must not duplicate the application navigation without adding
 * project-state value."* The grid listed every surface whose `kind` is `room`;
 * `NAV-01` then grouped the sidebar by whether a surface can be **operated**,
 * and Home was not told. Six launchers of equal weight beside a sidebar
 * offering four, so the two devices that teach a first-time reader how big this
 * product is disagreed about it.
 */
describe('the launcher grid agrees with the navigation', () => {
  it('offers the places work happens, and only those', async () => {
    renderDashboard()
    // The grid itself, found through a launcher only it has.
    const grid = within((await screen.findByText('Workspace')).closest('ul')!)

    for (const surface of HOME) {
      expect(
        grid.getByText(surface.purpose),
        `${surface.title} is missing from the grid`,
      ).toBeInTheDocument()
    }
    expect(grid.getAllByRole('link')).toHaveLength(HOME.length)
  })

  it('does not launch a page nothing can be done on', async () => {
    renderDashboard()
    await screen.findByText('Where work happens')

    // Read-only surfaces stay one click away in the sidebar's Understanding
    // section, at the paths they always had — grouped, never deleted (`§18`).
    for (const surface of surfacesInGroup('understanding')) {
      expect(
        screen.queryByText(surface.purpose),
        `${surface.title} is a reading surface and Home offers it as a place to work`,
      ).not.toBeInTheDocument()
    }
  })

  it('does not launch the page it is', async () => {
    renderDashboard()
    await screen.findByText('Where work happens')

    // A launcher to the page you are reading is the purest form of the
    // duplication the invariant names.
    expect(screen.queryByRole('link', { name: /Project home/ })).not.toBeInTheDocument()
  })
})

describe('coverage carries a denominator, never a percentage', () => {
  it('says how many of how many', async () => {
    renderDashboard()

    // `§3` and `ADR-0003` agree: `7 of 10 areas` says what `70%` cannot,
    // because the reader can tell what the whole is.
    expect(await screen.findByText(/areas have enough confirmed evidence/i)).toBeInTheDocument()
  })

  it('shows no percentage anywhere on the page', async () => {
    renderDashboard()
    await screen.findByText(/current journey/i)

    expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument()
  })

  it('says when nothing has been assessed rather than showing zero of zero', async () => {
    renderDashboard((base) => ({ ...base, health: { ...base.health, coverage: [] } }))

    expect(await screen.findByText(/no area has been assessed yet/i)).toBeInTheDocument()
  })
})

describe('what the skeleton deliberately omits', () => {
  it('has no recent-changes panel', async () => {
    // `recentChanges` is `[]` in the live adapter and nothing in Memory
    // produces a change feed (`AUD-038`). A panel would be permanently empty,
    // which reads as "nothing has happened".
    renderDashboard()
    await screen.findByText(/current journey/i)

    expect(screen.queryByText(/recent changes/i)).not.toBeInTheDocument()
  })

  it('marks its next action as derived rather than ranked', async () => {
    // `§4`'s work-item model is Stage 6. Until it exists the action comes from
    // `floorAction`, and saying so is the difference between a recommendation
    // and a guess wearing one's clothes.
    renderDashboard()

    // The sentence itself, not the word. `/derived/i` matched this *and* a
    // Room limit reading "not derived by anything", so the assertion started
    // failing on an unrelated change — a matcher loose enough to hit two
    // different claims was never testing this one.
    expect(
      await screen.findByText(/Suggested from where this project has got to/i),
    ).toBeInTheDocument()
  })
})

describe('when the project cannot be read', () => {
  it('says so instead of rendering an empty dashboard', async () => {
    // The worst failure this page could have: every count legitimately zero,
    // every panel empty, and a person concluding their project is empty.
    const services = createMockServices()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    })
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <ServiceProvider
            services={{
              ...services,
              projection: {
                ...services.projection,
                getProjection: async () => {
                  throw new Error('KAE-Memory did not answer within 5s')
                },
                classify: (id: string) => services.projection.classify(id),
              },
            }}
          >
            <Dashboard />
          </ServiceProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be read/i)
    expect(screen.queryByText(/current journey/i)).not.toBeInTheDocument()
  })
})

/**
 * `D-38` — the panel cannot say nothing is waiting beneath something waiting.
 *
 * `NeedsYou` counts proposals, decisions, contradictions and unread content.
 * Blockers and the review findings `D-30` connected arrived later and were not
 * added, so a project whose only outstanding item was a critical blocker read
 * *"nothing is waiting on you"* three inches beneath that blocker.
 *
 * The sentence had been written carefully — *"deliberately not 'all clear':
 * nothing is waiting **that KAE can see**"* — and the hedge made it worse,
 * blaming KAE's perception for a gap KAE was displaying.
 */
describe('nothing is waiting only when nothing is', () => {
  const CRITICAL_BLOCKER = {
    id: 'BLK-9',
    summary: 'Nobody has confirmed who may approve.',
    severity: 'critical',
    status: 'open',
    areaKey: 'approval',
    owner: 'Church leadership',
    resolutionNote: null,
  }

  function quietExcept(over: Record<string, unknown>) {
    return (base: ProjectProjection) =>
      ({
        ...base,
        findings: [],
        openDecisions: [],
        contradictions: { count: 0, listable: true, reason: '' },
        extractionCoverage: { succeeded: 3, abandoned: 0, complete: true },
        blockers: [],
        review: { available: true, reason: '', findings: [] },
        ...over,
      }) as ProjectProjection
  }

  it('does not claim nothing is waiting when a blocker is', async () => {
    renderDashboard(quietExcept({ blockers: [CRITICAL_BLOCKER] }), NOTHING_RAISED)

    await screen.findByText(/needs you/i)
    expect(screen.queryByText(/nothing is waiting on you/i)).not.toBeInTheDocument()
  })

  it('points at what holds it rather than restating it', async () => {
    // `§13`, and `D-37` was two lists of one thing on one page coming to
    // disagree. The blocker is named once, by the panel that owns it.
    renderDashboard(quietExcept({ blockers: [CRITICAL_BLOCKER] }), NOTHING_RAISED)

    expect(await screen.findByText(/is waiting on somebody/i)).toBeInTheDocument()
    expect(screen.getAllByText(CRITICAL_BLOCKER.summary)).toHaveLength(1)
  })

  it('counts a critical review finding too', async () => {
    renderDashboard(
      quietExcept({
        review: {
          available: true,
          reason: '',
          findings: [
            {
              kind: 'missing_area',
              severity: 'critical',
              summary: 'An area has nothing in it.',
              recommendedAction: 'Discuss it.',
              areaKey: 'approval',
              subjectKey: '',
              knowledgeItemIds: [],
            },
          ],
        },
      }),
      NOTHING_RAISED,
    )

    await screen.findByText(/needs you/i)
    expect(screen.queryByText(/nothing is waiting on you/i)).not.toBeInTheDocument()
  })

  it('ignores a minor review finding', async () => {
    // Every project of any size has minor findings. A "needs you" panel that is
    // never empty is one nobody reads, which would destroy the signal this
    // exists to protect.
    renderDashboard(
      quietExcept({
        review: {
          available: true,
          reason: '',
          findings: [
            {
              kind: 'duplicate_knowledge',
              severity: 'minor',
              summary: 'Two statements say the same thing.',
              recommendedAction: 'Supersede one.',
              areaKey: null,
              subjectKey: '',
              knowledgeItemIds: [],
            },
          ],
        },
      }),
      NOTHING_RAISED,
    )

    expect(await screen.findByText(/nothing is waiting on you/i)).toBeInTheDocument()
  })

  it('does not count a blocker somebody closed', async () => {
    renderDashboard(
      quietExcept({ blockers: [{ ...CRITICAL_BLOCKER, status: 'resolved' }] }),
      NOTHING_RAISED,
    )

    expect(await screen.findByText(/nothing is waiting on you/i)).toBeInTheDocument()
  })
})
