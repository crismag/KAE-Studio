/**
 * 174 proposed statements as a queue rather than a wall (`NAV-01` N3, `D-97`).
 *
 * The live sweep counted **350 buttons on `/reviews`** and 188 on
 * `/requirements`. One flat list of every proposed statement, in an order
 * nobody chose, with no way to decide all the constraints and stop — and beside
 * it a diagnostic panel opening with seven findings that said one fact seven
 * ways.
 *
 * The customer's original complaint is *"KAE generated 70 things I don't know
 * how to organise."* A page that hands back a pile of 174 is that complaint
 * restated in the product's own words.
 *
 * ## The line these protect
 *
 * Grouping must never become **hiding**. Every statement stays one disclosure
 * away, every count says how many are behind it, and no summary paraphrases
 * what it collapsed. The moment this page shows fewer statements than the
 * project has and does not say so, it is lying about the size of the work.
 */

import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ProposedStatements, groupByKind, PAGE } from './ProposedStatements'
import { QualityReview } from './QualityReview'
import type { ProjectReview, ReviewFinding } from '@/domain/types'

function finding(id: string, statementKind?: string): ReviewFinding {
  return {
    id,
    kind: 'agent_proposal',
    severity: 'minor',
    summary: `Statement ${id}`,
    detail: '',
    subjectIds: [],
    version: 1,
    statementKind,
  } as ReviewFinding
}

function many(count: number, statementKind: string): ReviewFinding[] {
  return Array.from({ length: count }, (_, i) => finding(`${statementKind}-${i}`, statementKind))
}

function show(findings: ReviewFinding[]) {
  return render(
    <ProposedStatements findings={findings}>
      {(f) => <li key={f.id}>{f.summary}</li>}
    </ProposedStatements>,
  )
}

describe('grouping the proposed statements', () => {
  it('puts statements of one kind together, under the word a person uses', () => {
    const groups = groupByKind([
      finding('a', 'constraint'),
      finding('b', 'goal'),
      finding('c', 'constraint'),
    ])

    expect(groups.map((g) => g.heading)).toEqual(['Constraints', 'Goals'])
    expect(groups[0].items).toHaveLength(2)
  })

  it('puts the largest group first, because that is where the work is', () => {
    const groups = groupByKind([...many(3, 'goal'), ...many(9, 'rule')])

    expect(groups[0].heading).toBe('Rules')
  })

  it('shows an unmapped kind under its own name rather than folding it into Other', () => {
    /**
     * A kind KAE-Memory adds and this map has not learned should look
     * *unlabelled*, not disappear into a bucket. `assumption`, `requirement`
     * and `decision` were all live and all missing, and rendering the raw word
     * is how that was noticed.
     */
    const groups = groupByKind([finding('a', 'newly_invented_kind')])

    expect(groups[0].heading).toBe('newly_invented_kind')
  })

  it('leaves a finding with no kind ungrouped instead of guessing one', () => {
    const groups = groupByKind([finding('a')])

    expect(groups[0].heading).toBe('Proposed statements')
  })
})

describe('what a person meets on the page', () => {
  it('says how many are behind a heading, in a word', () => {
    // "15" beside a heading is the sidebar's old bare-badge problem one level
    // down. The reader has to be able to tell what the number counts.
    show(many(15, 'rule'))

    expect(screen.getByText('15 to decide')).toBeInTheDocument()
  })

  it('arrives closed when a group is large, and open when it is small', async () => {
    // `R10`: KAE does not hand its organisational burden back. The shape of the
    // pile is visible before any of it is.
    const { container } = render(
      <ProposedStatements findings={[...many(30, 'rule'), ...many(2, 'goal')]}>
        {(f) => <li key={f.id}>{f.summary}</li>}
      </ProposedStatements>,
    )

    const sections = [...container.querySelectorAll('details')]
    expect(sections).toHaveLength(2)
    expect(sections[0].open).toBe(false)
    expect(sections[1].open).toBe(true)
  })

  it('shows a page at a time, and says how many are left', async () => {
    // Fifty rows behind one heading is the same wall with a lid on it.
    const user = userEvent.setup()
    show(many(PAGE + 7, 'rule'))

    expect(screen.getAllByRole('listitem')).toHaveLength(PAGE)
    expect(screen.getByText(`7 more in this group`)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /show 7 more/i }))

    expect(screen.getAllByRole('listitem')).toHaveLength(PAGE + 7)
    expect(screen.queryByText(/more in this group/)).not.toBeInTheDocument()
  })

  it('never renders fewer than the project has without saying so', () => {
    /**
     * The line this whole slice must not cross. Any statement not on screen is
     * accounted for by a count that is on screen — the group heading and the
     * "N more" line together.
     */
    show(many(50, 'rule'))

    const heading = screen.getByText('50 to decide')
    const remainder = screen.getByText(`${50 - PAGE} more in this group`)

    expect(heading).toBeInTheDocument()
    expect(remainder).toBeInTheDocument()
  })
})

function review(findings: ProjectReview['findings']): ProjectReview {
  return { available: true, reason: '', findings }
}

const partial = (areaKey: string) =>
  ({
    kind: 'partial_area',
    severity: 'major',
    areaKey,
    subjectKey: areaKey,
    summary: `${areaKey} has 0 confirmed item(s); 1 are required.`,
    recommendedAction: `Confirm more knowledge for ${areaKey}.`,
    knowledgeItemIds: [],
  }) as never

describe('a diagnostic that repeats itself teaches people to stop reading it', () => {
  it('collapses findings of one kind into a row that says how many', async () => {
    render(<QualityReview review={review([partial('problem_and_value'), partial('quality')])} />)

    expect(screen.getByText('2 areas need more confirmed evidence')).toBeInTheDocument()
    // And every one is still there, one disclosure away.
    const group = screen.getByRole('group')
    expect(within(group).getByText(/problem_and_value has 0 confirmed/)).toBeInTheDocument()
    expect(within(group).getByText(/quality has 0 confirmed/)).toBeInTheDocument()
  })

  it('leaves a single finding alone, because a disclosure around one row is ceremony', () => {
    const { container } = render(<QualityReview review={review([partial('acceptance')])} />)

    expect(container.querySelector('details')).toBeNull()
    expect(screen.getByText(/acceptance has 0 confirmed/)).toBeInTheDocument()
  })

  it('summarises from the kind and the count, never by paraphrasing the findings', () => {
    /**
     * A one-line summary that restates seven sentences is a claim about all
     * seven that nothing checked. This one says only what is countable.
     */
    render(<QualityReview review={review([partial('a'), partial('b'), partial('c')])} />)

    expect(screen.getByText('3 areas need more confirmed evidence')).toBeInTheDocument()
  })
})
