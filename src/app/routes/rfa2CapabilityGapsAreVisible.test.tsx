/**
 * RFA-2 · An unavailable capability says so, on screen.
 *
 * The audit's central finding pointed at the rendered page rather than at the
 * adapter. `AUD-002` was that Studio's backend computes capability gaps with
 * real care and the adapter dropped them; the conservation check written for it
 * asserts they survive the *mapper*.
 *
 * That check passed while `/definition` looked up a bare `value` against a
 * backend emitting `definition.value` — so every capability note returned
 * `undefined` and the panels rendered as blankly as before. A repair that looks
 * right and delivers nothing is this audit's own subject, and the guard did not
 * catch it because it stopped one layer short of a person.
 *
 * So this one goes all the way: given a projection carrying gaps, the reasons
 * must be **on the screen**.
 */

import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ServiceProvider } from '@/services/ServiceProvider'
import { createMockServices } from '@/services/mock/mockServices'
import { ProjectDefinition } from '@/pages/rooms/definition/DefinitionRoom'
import { CoverageSection, GenerableNow } from '@/pages/rooms/interview/InterviewRoom'
import { Memory } from '@/pages/memory/MemoryPage'
import { SectionsNotRead } from '@/components/project/SectionsNotRead'
import { sectionsNotRead } from '@/components/project/sectionsNotRead'
import { Modules } from '@/pages/rooms/architecture/ModulesSubflow'
import type { ProjectProjection } from '@/domain/types'
import type { StudioServices } from '@/services/interfaces'

const VALUE_REASON = 'The area covers problem and value together, and nothing distinguishes them.'
const WORKFLOWS_REASON = 'Memory holds statements, not sequences, so there is nothing to order.'
const MODULES_REASON = 'Studio curation is a separate contract, not yet reconciled.'

/** A projection shaped like the live one, carrying gaps a person must see. */
function withGaps(base: ProjectProjection): ProjectProjection {
  return {
    ...base,
    definition: { ...base.definition, value: '', workflows: [] },
    modules: [],
    unavailable: [
      { section: 'definition.value', reason: VALUE_REASON },
      { section: 'definition.workflows', reason: WORKFLOWS_REASON },
    ],
    modulesGap: {
      capability: 'modules',
      reason: MODULES_REASON,
      state: 'planned',
      provedInstead: [],
    },
  }
}

function renderWithProjection(node: React.ReactNode) {
  const services = createMockServices()
  const original = services.projection.getProjection.bind(services.projection)
  const patched: StudioServices = {
    ...services,
    projection: {
      ...services.projection,
      getProjection: async (id: string) => withGaps(await original(id)),
    },
  }

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ServiceProvider services={patched}>{node}</ServiceProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

afterEach(() => vi.restoreAllMocks())

describe('a capability gap reaches the screen', () => {
  it('states why the value section is empty, in the backend`s own words', async () => {
    renderWithProjection(<ProjectDefinition />)

    // Verbatim. A reason paraphrased on the way through is one a person cannot
    // act on, and the backend wrote these to be read.
    expect(await screen.findByText(VALUE_REASON)).toBeInTheDocument()
  })

  it('states why business workflows are empty', async () => {
    renderWithProjection(<ProjectDefinition />)

    expect(await screen.findByText(WORKFLOWS_REASON)).toBeInTheDocument()
  })

  it('states why no modules exist rather than showing a bare zero', async () => {
    renderWithProjection(<Modules />)

    expect(await screen.findByText(MODULES_REASON)).toBeInTheDocument()
    // And the counts are gone: "0 accepted" beside a capability that cannot
    // produce a module reads as a project with none.
    expect(screen.queryByText(/0 accepted/i)).not.toBeInTheDocument()
  })

  it('says module packages cannot be listed rather than that none were proposed', async () => {
    // `D-184`. The panel is headed *What can be generated now* and branched on
    // `modules.length`, which the live adapter sets to `[]` on every projection
    // — so a project with modules and a project with none produced the same
    // sentence, and the sentence was about the project.
    const projection = {
      modules: [],
      openDecisions: [],
      modulesGap: {
        capability: 'modules',
        reason: MODULES_REASON,
        state: 'planned',
        provedInstead: [],
      },
    } as unknown as ProjectProjection

    renderWithProjection(<GenerableNow projection={projection} />)

    expect(await screen.findByText(new RegExp(MODULES_REASON))).toBeInTheDocument()
    expect(screen.queryByText(/no modules have been proposed yet/i)).not.toBeInTheDocument()
  })

  it('answers "not readable" where the Memory page counted a zero', async () => {
    renderWithProjection(<Memory />)

    // The stat, and the reason beneath it. A bare `0` on the page that claims
    // to say *why the system believes what it believes* reads as the record
    // having been consulted and found empty.
    expect(await screen.findByText('not readable')).toBeInTheDocument()
    expect(screen.getByText(new RegExp(MODULES_REASON))).toBeInTheDocument()
  })

  it('says nothing when there is nothing to say', async () => {
    // The other half, and the one that keeps this honest. A project whose
    // sections all computed must not carry a standing notice about limits it
    // does not have — a banner on every project is a banner nobody reads.
    renderWithProjection(<Modules />)
    await screen.findByText(MODULES_REASON)

    const services = createMockServices()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    })
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <ServiceProvider services={services}>
            <ProjectDefinition />
          </ServiceProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    )

    expect(screen.queryByText(VALUE_REASON)).not.toBeInTheDocument()
  })
})

/**
 * The conservation check RFA-2 was written for.
 *
 * > *assert every `unavailable[].reason` the backend sent appears somewhere the
 * > user can read.*
 *
 * The assertions above name their sections. That is what `AUD-002` needed and
 * it is not what the journey asks for: a check that names four sections cannot
 * notice a fifth. The backend emits seven more — `project`, `readiness`,
 * `knowledge`, `clarifications`, `blockers`, `preliminary_context`,
 * `extraction_coverage` — one per Memory call `_safe` caught, and **no surface
 * read any of them** (`AUD-040`).
 *
 * A failed readiness call therefore rendered as `0% understood` with every area
 * missing, because `_health({})` substitutes zeros. Not a lower number: a
 * confident number about a project nobody had read.
 */
describe('a section that could not be read is not rendered as a fact', () => {
  const READINESS_FAILED = 'KAE-Memory did not answer within 5s.'
  const KNOWLEDGE_FAILED = 'KAE-Memory returned 503.'

  /** The shape `_health({})` produces: a percentage and no areas at all. */
  function withFailures(): ProjectProjection {
    return {
      health: { percentage: 0, phase: 'discovering', coverage: [] },
      unavailable: [
        { section: 'readiness', reason: READINESS_FAILED },
        { section: 'knowledge', reason: KNOWLEDGE_FAILED },
      ],
    } as unknown as ProjectProjection
  }

  it('names each unread section, in the backend`s own words', () => {
    render(<SectionsNotRead unavailable={withFailures().unavailable} />)

    expect(screen.getByText(new RegExp(READINESS_FAILED))).toBeInTheDocument()
    expect(screen.getByText(new RegExp(KNOWLEDGE_FAILED))).toBeInTheDocument()
  })

  it('says the numbers are wrong rather than low', () => {
    render(<SectionsNotRead unavailable={withFailures().unavailable} />)

    // The consequence has to arrive before the causes. A reader who sees only
    // a list of error messages still does not know whether to trust the
    // percentage beside them.
    expect(screen.getByRole('alert')).toHaveTextContent(/could not be read/i)
  })

  it('shows a section name it has never heard of', () => {
    // The property that makes this hold under change. Every named lookup in
    // this file was added after a finding; this one covers the finding nobody
    // has had yet.
    const invented = 'Deliverables could not be listed: the endpoint is new.'
    render(<SectionsNotRead unavailable={[{ section: 'deliverables', reason: invented }]} />)

    expect(screen.getByText(new RegExp(invented))).toBeInTheDocument()
    expect(screen.getByText('deliverables')).toBeInTheDocument()
  })

  it('leaves inline gaps to the surfaces that render them', () => {
    // `definition.*` is claimed by `ProjectDefinition`, beside the answer it
    // would have been. Repeating it here would say the project failed to load
    // when what actually happened is that KAE cannot derive one field.
    expect(
      sectionsNotRead([
        { section: 'definition.value', reason: VALUE_REASON },
        { section: 'readiness', reason: READINESS_FAILED },
      ]),
    ).toEqual([{ section: 'readiness', reason: READINESS_FAILED }])
  })

  it('replaces the coverage list rather than rendering it empty', () => {
    render(<CoverageSection projection={withFailures()} onDiscuss={() => {}} />)

    expect(screen.getByText(READINESS_FAILED)).toBeInTheDocument()
    // No areas at all is what `_health({})` produces, and rendering that bare
    // is the substitution this journey exists to forbid.
    expect(screen.queryByText(/missing/i)).not.toBeInTheDocument()
  })

  it('every reason the backend sent is on a screen, whatever the section', async () => {
    // The journey's own words, as an assertion over the whole list rather than
    // over remembered names.
    const sent: ProjectProjection['unavailable'] = [
      { section: 'definition.value', reason: VALUE_REASON },
      { section: 'readiness', reason: READINESS_FAILED },
      { section: 'knowledge', reason: KNOWLEDGE_FAILED },
      { section: 'something_added_later', reason: 'A reason nobody wrote a lookup for.' },
    ]

    renderWithProjection(<ProjectDefinition />)
    await screen.findByText(VALUE_REASON)
    render(<SectionsNotRead unavailable={sent} />)

    for (const entry of sent) {
      expect(
        screen.queryAllByText(new RegExp(entry.reason.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))),
        `${entry.section} was reported and is nowhere on screen`,
      ).not.toHaveLength(0)
    }
  })
})
