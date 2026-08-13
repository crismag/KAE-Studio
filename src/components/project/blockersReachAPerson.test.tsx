/**
 * `D-29` — a gap somebody owns reaches them before it stops them.
 *
 * KAE-Memory models blockers deliberately outside the knowledge lifecycle, has
 * routes to raise and resolve them, and gates generation on the critical ones.
 * Studio's backend carried them; the adapter typed them `unknown[]` and mapped
 * them nowhere.
 *
 * So the only place a person met a blocker was that gate — a refusal at the
 * moment they tried to produce a package, with no earlier sign that anything
 * stood in the way. `AUD-041` again: exposing a capability is not connecting
 * it, and this one had teeth, because it was already enforcing something.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { Blockers } from './Blockers'
import { openBlockers } from './openBlockers'
import { blockers as fixture } from '@/services/mock/fixtures/ministryReporting'
import type { ProjectBlocker } from '@/domain/types'

const CRITICAL: ProjectBlocker = {
  id: 'BLK-9',
  summary: 'Nobody has confirmed who may approve.',
  severity: 'critical',
  status: 'open',
  areaKey: 'approval',
  owner: 'Church leadership',
  resolutionNote: null,
}

describe('a blocker is named, not counted', () => {
  it('shows what each one actually is', () => {
    // "2 blockers" is the shape that hides which one is critical, and only one
    // severity stops anything.
    render(<Blockers blockers={fixture} />)

    expect(screen.getByText(fixture[0].summary)).toBeInTheDocument()
  })

  it('names who owns closing it', () => {
    // A gap with no owner named is a gap that stays open.
    render(<Blockers blockers={[CRITICAL]} />)

    expect(screen.getByText(/church leadership owns closing this/i)).toBeInTheDocument()
  })

  it('says so when nobody has been named', () => {
    render(<Blockers blockers={[{ ...CRITICAL, owner: null }]} />)

    expect(screen.getByText(/nobody has been named to close this/i)).toBeInTheDocument()
  })

  it('shows a grade it has never heard of rather than deciding it is minor', () => {
    render(<Blockers blockers={[{ ...CRITICAL, severity: 'catastrophic' }]} />)

    expect(screen.getByText('catastrophic')).toBeInTheDocument()
  })

  it('says a blocker arrived ungraded rather than inventing a grade', () => {
    // Never defaulted downwards: a blocker whose severity did not arrive is not
    // a minor one, and guessing costs a person the thing they needed to see.
    render(<Blockers blockers={[{ ...CRITICAL, severity: '' }]} />)

    expect(screen.getByText('ungraded')).toBeInTheDocument()
  })
})

describe('the consequence arrives before the package screen does', () => {
  it('says what a critical blocker actually does', () => {
    // `D-32`. The first version of this asserted that KAE "will not generate a
    // development package", and **the test passed while the claim was false** —
    // it checked that the component said a sentence, not that the sentence was
    // true of the system.
    //
    // `readiness_service` computes `implementation_eligible`,
    // `assembly_service` carries it into the blueprint, and nothing refuses.
    // A blocker marks the result; it does not withhold it.
    render(<Blockers blockers={[CRITICAL]} />)

    const notice = screen.getByRole('alert')
    expect(notice).toHaveTextContent(/marked not ready for implementation/i)
    expect(notice).not.toHaveTextContent(/will not generate/i)
  })

  it('does not claim generation is stopped by a major one', () => {
    // Only `critical` gates it in KAE-Memory. Saying otherwise would make the
    // warning worthless on the projects that actually have one.
    render(<Blockers blockers={[{ ...CRITICAL, severity: 'major' }]} />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('a resolved blocker is kept', () => {
  it('is not shown among the ones still standing', () => {
    render(<Blockers blockers={fixture} />)

    // The first list is the standing one; the closed ones live inside a
    // disclosure below it. Asserting on "the list" alone would have passed the
    // day both were rendered together.
    const [standing] = screen.getAllByRole('list')
    expect(standing).not.toHaveTextContent(/reporting period boundary/i)
  })

  it('is still reachable, with how it was closed', () => {
    // Memory retains it because "this was dealt with" is a different fact from
    // "this was wrong". Dropping it would make "what was blocking us, and who
    // closed it?" unanswerable from the product.
    render(<Blockers blockers={fixture} />)

    expect(screen.getByText(/1 blocker was closed/i)).toBeInTheDocument()
    expect(screen.getByText(/periods close at 23:59/i)).toBeInTheDocument()
  })

  it('treats a status it has never heard of as still standing', () => {
    // Not resolved. An unknown word means nobody has closed this, and reading
    // it the other way hides the blocker that introduced it.
    expect(openBlockers([{ ...CRITICAL, status: 'escalated' }])).toHaveLength(1)
  })
})

describe('when there is nothing to say', () => {
  it('renders nothing at all rather than an empty panel', () => {
    // A standing "Blocked on someone" panel saying nothing is furniture, and a
    // person learns to skip the place the real warning will appear.
    const { container } = render(<Blockers blockers={[]} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('says the project is unblocked when every blocker was closed', () => {
    render(<Blockers blockers={[{ ...CRITICAL, status: 'resolved' }]} />)

    expect(screen.getByText(/nothing is blocking this project/i)).toBeInTheDocument()
  })
})
