/**
 * RFA-1 · A turn changes the project, and the change survives.
 *
 * *The heartbeat.* Its middle beat was missing, and this file is the half of
 * the journey that can be proved without a live stack.
 *
 * ## What the journey asks for
 *
 *     send a message → confirm a candidate → **readiness recalculates** →
 *     a new session sees the same state
 *
 * The third step could not happen. Readiness counts statements per discovery
 * area; a statement reaches an area only when a review run classifies it; and
 * **Studio never asked for one**. `EM-5` found the capability had no caller
 * outside a unit test and exposed it over HTTP and MCP — and the only interface
 * a person uses still did not call it.
 *
 * Measured on the deployed system rather than argued: the acceptance project
 * `Cris Test 2` holds **five successful extraction runs, zero review runs**,
 * and `0% · not_started`. Confirming every statement in it would not have moved
 * the number by one point (`AUD-041`).
 *
 * ## What is asserted here, and what is not
 *
 * A percentage moving is a claim about a worker, a model and a database, so it
 * belongs in `e2e/acceptance/journey.py` against the live stack. What belongs
 * here is the part that made the movement impossible: that the product **asks**,
 * that it says so when nothing has, and that it does not pretend a queued run
 * has finished.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ClassificationState } from './ClassificationState'
import { neverClassified } from './neverClassified'
import type { ClassificationState as Classification } from '@/domain/types'

const NEVER: Classification = {
  engine: null,
  degraded: false,
  note: 'No review has run. Areas reflect whatever links already exist.',
  reviewedAt: null,
}

const OFFLINE: Classification = {
  engine: 'offline_by_kind_after_reviewer_error',
  degraded: true,
  note: 'Classification fell back to the offline rule for some or all statements, which assigns only unambiguous kinds. This percentage is lower than a model would have reached, for a reason that is not about the project.',
  reviewedAt: '2026-08-09T14:41:48Z',
}

const BY_MODEL: Classification = {
  engine: 'reviewed_by_model',
  degraded: false,
  note: 'Classified by the configured review model.',
  reviewedAt: '2026-08-10T10:00:00Z',
}

describe('a project nothing has classified says so', () => {
  it('distinguishes never-classified from a thin project', () => {
    // The distinction the whole finding rests on. Both render `0%`, and only
    // one of them is about the user's project.
    expect(neverClassified(NEVER)).toBe(true)
    expect(neverClassified(OFFLINE)).toBe(false)
    expect(neverClassified(BY_MODEL)).toBe(false)
  })

  it('does not claim it from a missing field', () => {
    // A backend older than the classification block has told us nothing. The
    // strong claim — "no review has run" — from an absent field would be the
    // substitution this audit exists to remove.
    expect(neverClassified(undefined)).toBe(false)
    expect(neverClassified({ ...NEVER, engine: 'unknown' })).toBe(false)
  })

  it('says the zero is about the review, not about the project', () => {
    render(<ClassificationState classification={NEVER} onClassify={() => {}} />)

    expect(screen.getByText(/nothing has classified this project/i)).toBeInTheDocument()
    expect(screen.getByText(/about the review, not about your project/i)).toBeInTheDocument()
  })

  it('offers the pass, because a person cannot ask for it any other way', async () => {
    const user = userEvent.setup()
    const onClassify = vi.fn()
    render(<ClassificationState classification={NEVER} onClassify={onClassify} />)

    await user.click(screen.getByRole('button', { name: /classify what the project holds/i }))

    expect(onClassify).toHaveBeenCalledOnce()
  })

  it('says queued rather than done', () => {
    // A worker runs it. A surface that showed the areas changing on click
    // would be inventing the one thing this journey is about.
    render(
      <ClassificationState
        classification={NEVER}
        onClassify={() => {}}
        outcome={{ queued: true, warnings: [] }}
      />,
    )

    expect(screen.getByText(/queued/i)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('a project that was classified', () => {
  it('carries Memory`s own words about a degraded pass', () => {
    render(<ClassificationState classification={OFFLINE} onClassify={() => {}} />)

    // Verbatim, including the clause that says the cause is not the project.
    // A client that summarised this would be deciding how alarmed to be.
    expect(screen.getByText(/not about the project/i)).toBeInTheDocument()
  })

  it('says when the pass ran, because the number describes the project as it was then', () => {
    render(<ClassificationState classification={BY_MODEL} onClassify={() => {}} />)

    // `D-243`. A review runs once and the conversation continues, so a
    // percentage with no date on it describes an older project — and unlike
    // the zero above, a plausible number invites no question at all.
    expect(screen.getByText(/review pass on 10 Aug/i)).toBeInTheDocument()
  })

  it('does not raise an alarm beside it', () => {
    render(<ClassificationState classification={BY_MODEL} onClassify={() => {}} />)

    // The half that keeps this honest, and the reason the date is subtle text
    // rather than a notice: a standing warning on every project is a warning
    // nobody reads. Nothing here claims the number is wrong — only when it
    // was reached.
    expect(screen.queryByText(/out of date|stale|no longer/i)).not.toBeInTheDocument()
  })

  it('offers the pass again, because a date nobody can act on is a complaint', async () => {
    const user = userEvent.setup()
    const onClassify = vi.fn()
    render(<ClassificationState classification={BY_MODEL} onClassify={onClassify} />)

    await user.click(screen.getByRole('button', { name: /classify again/i }))

    expect(onClassify).toHaveBeenCalledOnce()
  })

  it('says queued rather than done here too', () => {
    render(
      <ClassificationState
        classification={BY_MODEL}
        onClassify={() => {}}
        outcome={{ queued: true, warnings: [] }}
      />,
    )

    expect(screen.getByText(/queued/i)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('says what the queued pass will not see, in Memory`s own words', () => {
    // `D-276`. Review classifies what exists now, so a pass queued while
    // extraction is still draining is short by whatever is still queued.
    // Memory composes the sentence and reports it rather than refusing the
    // request; Studio discarded the body, so nobody was ever told.
    const warning =
      '2 extraction runs have not finished. Review reads what exists now, so anything ' +
      'still queued will not be classified and the pass will need running again.'
    render(
      <ClassificationState
        classification={BY_MODEL}
        onClassify={() => {}}
        outcome={{ queued: true, warnings: [warning] }}
      />,
    )

    // Verbatim, including the number and the instruction to run it again.
    expect(screen.getByText(warning)).toBeInTheDocument()
  })

  it('says nothing extra when the pass will see everything', () => {
    // The control, and the reason this is not a standing warning (`D-243`):
    // the ordinary queued press is unchanged.
    render(
      <ClassificationState
        classification={BY_MODEL}
        onClassify={() => {}}
        outcome={{ queued: true, warnings: [] }}
      />,
    )

    expect(screen.getByText(/worker is reading/i)).toBeInTheDocument()
    expect(screen.queryByText(/will not be classified/i)).not.toBeInTheDocument()
  })

  it('does not describe a worker reading the project when nothing was queued', () => {
    // **The defect this file's own subject came back as** (`D-275`). The
    // backend refuses a classification that already covers the project so that
    // pressing twice does not buy a second model pass (`D-271`), answers it
    // 200, and this surface rendered it with the queued sentence — a person was
    // told a worker was reading their project, the areas then did not move, and
    // nothing ever said why.
    render(
      <ClassificationState
        classification={BY_MODEL}
        onClassify={() => {}}
        outcome={{ queued: false, warnings: [] }}
      />,
    )

    // Asserted on the two clauses that are false rather than on the word
    // "queued", which the honest sentence also contains — *nothing was queued*
    // and *a worker is reading* are opposites that share it.
    expect(screen.queryByText(/worker is reading/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/will change once it finishes/i)).not.toBeInTheDocument()
  })

  it('says instead that there was nothing to classify', () => {
    // Not silence either: a press that produces no sentence at all reads as a
    // control that did nothing, which is the same question unanswered.
    render(
      <ClassificationState
        classification={BY_MODEL}
        onClassify={() => {}}
        outcome={{ queued: false, warnings: [] }}
      />,
    )

    expect(screen.getByText(/nothing was queued/i)).toBeInTheDocument()
    expect(screen.getByText(/already covers everything the project holds/i)).toBeInTheDocument()
  })

  it('offers the control until it is pressed', () => {
    // The control for both arms above: with no outcome the button is what
    // renders, so a failure there means the sentences replaced the wrong thing.
    render(<ClassificationState classification={BY_MODEL} onClassify={() => {}} />)

    expect(screen.getByRole('button', { name: /classify again/i })).toBeInTheDocument()
    expect(screen.queryByText(/nothing was queued/i)).not.toBeInTheDocument()
  })

  it('renders no date rather than an em dash when the pass did not record one', () => {
    render(
      <ClassificationState
        classification={{ ...BY_MODEL, reviewedAt: null }}
        onClassify={() => {}}
      />,
    )

    // `D-241`: an em dash sits exactly where a date is expected and only
    // invites somebody to wonder what is missing. The absence is said instead.
    expect(screen.getByText(/did not record when it ran/i)).toBeInTheDocument()
    expect(screen.queryByText(/—/)).not.toBeInTheDocument()
  })

  it('says nothing on a backend that does not report classification', () => {
    const { container } = render(
      <ClassificationState classification={undefined} onClassify={() => {}} />,
    )

    // `unknown` and `undefined` are not claims that a review ran, so neither
    // gets a date. Unchanged, and the reason the block above is safe.
    expect(container).toBeEmptyDOMElement()

    const older = render(
      <ClassificationState
        classification={{ ...BY_MODEL, engine: 'unknown' }}
        onClassify={() => {}}
      />,
    )
    expect(older.container).toBeEmptyDOMElement()
  })
})

describe('a pass made by a reviewer the deployment has replaced', () => {
  it('says so, because the date alone does not describe that staleness', () => {
    // `D-277`. The date answers *when* the pass ran; this answers *by what*.
    // KAE-Memory computes it and refuses a re-classification while both the
    // reviewer and the knowledge stand still (`D-271`) — so this is the one
    // condition under which the button below changes anything.
    render(
      <ClassificationState
        classification={{ ...BY_MODEL, engineIsCurrent: false }}
        onClassify={() => {}}
      />,
    )

    expect(screen.getByText(/different reviewer from the one KAE uses now/i)).toBeInTheDocument()
  })

  it('offers the pass as the remedy rather than only naming the problem', () => {
    // `UX-16`. A statement a person cannot act on is a complaint.
    render(
      <ClassificationState
        classification={{ ...BY_MODEL, engineIsCurrent: false }}
        onClassify={() => {}}
      />,
    )

    expect(screen.getByText(/replaces it with what the current one decides/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /classify again/i })).toBeInTheDocument()
  })

  it('says nothing when the reviewer still stands', () => {
    render(
      <ClassificationState
        classification={{ ...BY_MODEL, engineIsCurrent: true }}
        onClassify={() => {}}
      />,
    )

    expect(screen.queryByText(/different reviewer/i)).not.toBeInTheDocument()
  })

  it('says nothing when nothing knows', () => {
    // `D-38`, and the reason the component reads `=== false` rather than a
    // falsy check: `null` is a reviewer Memory does not recognise or a backend
    // too old to say, and neither is a claim that the pass is stale.
    render(
      <ClassificationState
        classification={{ ...BY_MODEL, engineIsCurrent: null }}
        onClassify={() => {}}
      />,
    )
    expect(screen.queryByText(/different reviewer/i)).not.toBeInTheDocument()

    const absent = render(<ClassificationState classification={BY_MODEL} onClassify={() => {}} />)
    expect(absent.queryByText(/different reviewer/i)).not.toBeInTheDocument()
  })
})

describe('a number measured before the project moved', () => {
  it('says the areas have not counted what came after the pass', () => {
    // `D-278`, the first staleness. The date above leaves a reader to work out
    // whether anything has happened since; KAE-Memory measures it against the
    // project's revision and Studio dropped the answer.
    render(<ClassificationState classification={BY_MODEL} knowledgeIsStale onClassify={() => {}} />)

    expect(screen.getByText(/have not counted what came after it/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /classify again/i })).toBeInTheDocument()
  })

  it('says nothing when the number was measured at where the project is', () => {
    render(
      <ClassificationState
        classification={BY_MODEL}
        knowledgeIsStale={false}
        onClassify={() => {}}
      />,
    )

    expect(screen.queryByText(/have not counted/i)).not.toBeInTheDocument()
  })

  it('says nothing when nothing knows', () => {
    // `null` is a backend that did not say and a readiness section that did not
    // answer (`D-38`). This asserts what renders, and deliberately claims no
    // more: at this polarity `null`, `undefined` and `false` are all falsy, so
    // it cannot tell an explicit check from a loose one. The tri-state is
    // enforced where a non-boolean can actually arrive — `_stale` in the
    // projection and the adapter — and both are guarded there.
    render(
      <ClassificationState
        classification={BY_MODEL}
        knowledgeIsStale={null}
        onClassify={() => {}}
      />,
    )
    expect(screen.queryByText(/have not counted/i)).not.toBeInTheDocument()

    const absent = render(<ClassificationState classification={BY_MODEL} onClassify={() => {}} />)
    expect(absent.queryByText(/have not counted/i)).not.toBeInTheDocument()
  })

  it('states both causes when both hold, because they are different facts', () => {
    // One remedy, two reasons: the project moved, and the reviewer behind the
    // number was replaced. Collapsing them would leave a reader unable to tell
    // which press is worth making.
    render(
      <ClassificationState
        classification={{ ...BY_MODEL, engineIsCurrent: false }}
        knowledgeIsStale
        onClassify={() => {}}
      />,
    )

    expect(screen.getByText(/different reviewer from the one KAE uses now/i)).toBeInTheDocument()
    expect(screen.getByText(/have not counted what came after it/i)).toBeInTheDocument()
  })
})
