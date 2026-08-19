/**
 * `D-18` — the preliminary view reaches a person, and reaches them unmerged.
 *
 * Found by `G2` (conservation between layers) and confirmed by `G3`
 * (reachability). KAE-Memory composes six collections it keeps deliberately
 * apart; Studio's backend proxied five of them; the live adapter's own type
 * declared two, read one, and put it into `health.recommendedNext` — a field no
 * component renders. Every layer looked correct and nothing arrived.
 *
 * That is why these run in two halves. The **adapter** half asserts the payload
 * survives the mapping, which is where it died. The **screen** half asserts a
 * person can read it, which is where `RFA-2` learned that a conservation check
 * stopping one layer short of a person proves nothing: the `AUD-002` guard
 * passed for weeks while `/definition` rendered every panel blank.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { toProjection } from '@/services/live/liveServices'
import { PreliminaryContextPanel } from './PreliminaryContextPanel'
import { preliminary as fixture } from '@/services/mock/fixtures/ministryReporting'
import type { PreliminaryContext } from '@/domain/types'

/** The shape Studio's backend emits, in its own snake-cased entry keys. */
const BACKEND_PRELIMINARY = {
  composed: true,
  isPreliminary: true,
  statedVerbatim: [
    {
      message_id: 'msg-1',
      text: 'We need churches to submit reports without me chasing them on WhatsApp.',
      actor_type: 'user',
      message_type: 'statement',
    },
  ],
  assumed: [
    {
      assumption_id: 'ASM-9',
      subject: 'Who may approve',
      assumed_value: 'A regional officer',
      reason: 'Approval was described as happening regionally.',
      origin: 'inferred_from_statements',
      consequence: 'The permission model is built on this.',
      state: 'proposed',
      reversible: false,
      material: true,
      accepted_by: null,
      revisit: 'before_build',
      disclosure: 'KAE assumed a church cannot approve its own report.',
    },
  ],
  materialUnknowns: [
    {
      clarification_id: 'OD-1',
      question: 'Which role holds approval authority?',
      area_key: 'approval',
      severity: 'critical',
      finding_kind: 'missing_decision',
      material: true,
      disposition: 'open',
    },
  ],
  deferrableUnknowns: [
    {
      clarification_id: 'OD-2',
      question: 'Can an administrator override a rejection?',
      area_key: 'approval',
      severity: 'minor',
      finding_kind: 'missing_decision',
      material: false,
      disposition: 'deferred',
    },
  ],
  warnings: ['Readiness rests on statements nobody has confirmed.'],
}

/** The rest of the projection, reduced to what `toProjection` must have. */
function backendProjection(preliminary: unknown) {
  return {
    project: { id: 'p1', name: 'Test', phase: 'active', createdAt: '', memoryRevision: 1 },
    confirmed: [],
    proposed: [],
    rejected: [],
    health: { percentage: 0, phase: 'discovering', areas: [] },
    definition: {
      problem: { value: '' },
      value: { value: '' },
      stakeholders: [],
      inScope: [],
      outOfScope: [],
      workflows: [],
      assumptions: [],
      constraints: [],
      mappingVersion: 1,
    },
    openQuestions: [],
    blockers: [],
    contradictions: { count: 0, listable: false, reason: '' },
    preliminary,
    modules: { available: false, gap: { capability: 'modules', reason: 'planned' } },
    unavailable: [],
  } as never
}

describe('the adapter carries every collection, entry by entry', () => {
  const mapped = toProjection(backendProjection(BACKEND_PRELIMINARY)).preliminary

  it('keeps a person`s own sentence unedited', () => {
    // The field the whole section is anchored on. Memory keeps it because a
    // preliminary context is more often wrong in its interpretation than in
    // its transcription, and that only helps if the sentence survives.
    expect(mapped.statedVerbatim[0].text).toBe(BACKEND_PRELIMINARY.statedVerbatim[0].text)
  })

  it('carries the assumption`s own disclosure rather than rebuilding one', () => {
    expect(mapped.assumed[0].disclosure).toBe(BACKEND_PRELIMINARY.assumed[0].disclosure)
    expect(mapped.assumed[0].material).toBe(true)
    expect(mapped.assumed[0].reversible).toBe(false)
  })

  it('carries what brings the assumption back', () => {
    // `D-290`. A **non-default** trigger, so a mapper that dropped the field
    // and substituted `on_request` fails here — a check reading the default is
    // a check that cannot fail, which is why this was recorded as a row rather
    // than written as a green line during `J4` (`D-289`).
    expect(mapped.assumed[0].revisit).toBe('before_build')
  })

  it('leaves an absent revisit absent rather than inventing a promise', () => {
    // A backend too old to send it has not told us the question comes back on
    // request; it has told us nothing, and the panel draws no line at all.
    const mapped = toProjection(
      backendProjection({
        ...BACKEND_PRELIMINARY,
        assumed: [{ ...BACKEND_PRELIMINARY.assumed[0], revisit: undefined }],
      }),
    ).preliminary

    expect(mapped.assumed[0].revisit).toBe('')
  })

  it('keeps material and deferrable unknowns in separate collections', () => {
    // Merged, they become one undifferentiated list of open questions, which
    // is the state the whole capability exists to prevent.
    expect(mapped.materialUnknowns.map((u) => u.clarificationId)).toEqual(['OD-1'])
    expect(mapped.deferrableUnknowns.map((u) => u.clarificationId)).toEqual(['OD-2'])
  })

  it('keeps `not yet asked` distinct from `asked and postponed`', () => {
    // N36. A default of `open` would render "nobody has looked at this" for a
    // question somebody looked at and deliberately set down.
    expect(mapped.materialUnknowns[0].disposition).toBe('open')
    expect(mapped.deferrableUnknowns[0].disposition).toBe('deferred')
  })

  it('leaves an absent disposition absent rather than calling it `open`', () => {
    // Written after this file's first version passed with the default in
    // place: every assertion used an entry that *had* a disposition, so the
    // one line the mapper's comment promised was untested. `open` is a claim
    // that nobody has been asked, and a mapper that invents it turns a missing
    // field into a fact about the project.
    const mapped = toProjection(
      backendProjection({
        ...BACKEND_PRELIMINARY,
        materialUnknowns: [{ clarification_id: 'OD-3', question: 'Anything?' }],
      }),
    ).preliminary

    expect(mapped.materialUnknowns[0].disposition).toBe('')
  })

  it('carries the warnings that used to go to a field nothing rendered', () => {
    expect(mapped.warnings).toEqual(BACKEND_PRELIMINARY.warnings)
  })

  it('reads a section Memory did not answer as unread, not as empty', () => {
    const mapped = toProjection(backendProjection({ warnings: [] })).preliminary

    expect(mapped.composed).toBe(false)
    // And not as "nothing rests on unconfirmed material", which is a claim
    // about the project derived from our own ignorance.
    expect(mapped.isPreliminary).toBe(false)
  })
})

describe('a person can read it', () => {
  it('shows the stated sentence verbatim on screen', () => {
    render(<PreliminaryContextPanel preliminary={fixture} />)

    expect(screen.getByText(fixture.statedVerbatim[0].text)).toBeInTheDocument()
  })

  it('shows each assumption`s disclosure, in Memory`s own words', () => {
    render(<PreliminaryContextPanel preliminary={fixture} />)

    for (const assumption of fixture.assumed) {
      expect(screen.getByText(assumption.disclosure)).toBeInTheDocument()
    }
  })

  it('says nobody has agreed to an assumption nobody has accepted', () => {
    render(<PreliminaryContextPanel preliminary={fixture} />)

    expect(screen.getAllByText(/nobody has agreed to this yet/i).length).toBeGreaterThan(0)
  })

  it('says what brings each assumption back, in words rather than in Memory`s key', () => {
    // The half that makes leaving a guess safe (`D-290`). The two fixtures
    // carry different triggers, so a panel rendering one phrase for both fails
    // here. `on_request` is asserted too: it is the weakest promise, and
    // suppressing it would render "nothing brings this back on its own" as
    // silence.
    render(<PreliminaryContextPanel preliminary={fixture} />)

    expect(screen.getByText(/comes back before anything is built on it/i)).toBeInTheDocument()
    expect(screen.getByText(/comes back only if somebody asks/i)).toBeInTheDocument()
    // `D-199`: never the key itself on the line a person reads.
    expect(screen.queryByText(/before_build|on_request/)).toBeNull()
  })

  it('draws no revisit line at all for a word it does not recognise', () => {
    // `D-28`: something rendered and wrong is worse than something absent,
    // beside a guess somebody is deciding whether to trust.
    const unrecognised: PreliminaryContext = {
      ...fixture,
      assumed: [{ ...fixture.assumed[0], revisit: 'when_the_moon_is_right' }],
    }
    render(<PreliminaryContextPanel preliminary={unrecognised} />)

    expect(screen.queryByText(/comes back/i)).toBeNull()
    expect(screen.queryByText(/when_the_moon_is_right/)).toBeNull()
  })

  it('separates what nobody has decided from what was postponed', () => {
    render(<PreliminaryContextPanel preliminary={fixture} />)

    // Two headings, not one list. The distinction is the content.
    expect(screen.getByText(/nobody has decided/i)).toBeInTheDocument()
    expect(screen.getByText(/safe to leave for now/i)).toBeInTheDocument()
    expect(screen.getByText(/not yet asked/i)).toBeInTheDocument()
    // `D-199`: this asserted `asked · deferred`, which is Memory's key on the
    // line a person reads. The distinction the test is about survives the
    // rewording; the key does not.
    expect(screen.getByText(/asked · set aside for now/i)).toBeInTheDocument()
  })

  it('states that the section could not be read rather than rendering nothing', () => {
    const unread: PreliminaryContext = {
      composed: false,
      isPreliminary: false,
      statedVerbatim: [],
      assumed: [],
      materialUnknowns: [],
      deferrableUnknowns: [],
      warnings: [],
    }
    render(<PreliminaryContextPanel preliminary={unread} />)

    expect(screen.getByRole('alert')).toHaveTextContent(/did not answer/i)
    expect(screen.getByRole('alert')).toHaveTextContent(/not a statement that there is nothing/i)
  })

  it('renders nothing at all when there is genuinely nothing', () => {
    // The other half, and the one that keeps the section from becoming
    // furniture. An empty bordered box on every mature project still says
    // "this applies to you".
    const empty: PreliminaryContext = {
      composed: true,
      isPreliminary: false,
      statedVerbatim: [],
      assumed: [],
      materialUnknowns: [],
      deferrableUnknowns: [],
      warnings: [],
    }
    const { container } = render(<PreliminaryContextPanel preliminary={empty} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('counts nothing', () => {
    // A heading reading "2 assumptions · 1 unknown" has already thrown away
    // the distinction the section exists to preserve, and totals are the
    // easiest thing in the world to add later.
    const { container } = render(<PreliminaryContextPanel preliminary={fixture} />)

    expect(container.textContent).not.toMatch(/\b\d+\s+(assumption|unknown|statement)/i)
  })
})
