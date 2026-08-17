/**
 * The Room reads the attention layer, and says what the run left out (`SYN-3e`).
 *
 * Two things can quietly go wrong here and neither would fail anything else.
 *
 * **The Room could read the evidence layer.** `ADR-0007`'s whole point is that
 * extracted rows and attention items are different things; a Room that listed
 * proposed knowledge under this heading would be the 803-row queue with a nicer
 * title, which is the failure the synthesis package was opened to avoid. So the
 * page's data has to come from `SynthesisPort` and from nothing else.
 *
 * **The exclusions could be dropped.** Memory computes `withheld` deliberately
 * — 36 themes become 8 items, and the 28 that did not are the first question a
 * person asks. A field computed carefully, transmitted faithfully and read by
 * nothing is the largest recurring defect in this estate, and it is invisible:
 * the page looks finished without it.
 *
 * **Postponing could quietly become hiding** (`SYN-4`, `D-142`). Deferring means
 * *stop recommending this*, not *this is dealt with*. That distinction only
 * survives if the page keeps asking for deferred items and keeps showing them,
 * so the guards below pin the read as well as the write.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { AttentionRoom } from './AttentionRoom'
import { ServiceProvider } from '@/services/ServiceProvider'
import { createMockServices } from '@/services/mock/mockServices'
import type { StudioServices } from '@/services/interfaces'
import type { AttentionItem, UnknownSynthesisReport } from '@/domain/types'

const REPORT: UnknownSynthesisReport = {
  considered: 41,
  resolved: 5,
  themes: 36,
  raised: [{ attentionItemId: 'attn-001', question: 'Who approves a return' }],
  withheld: ['Which fields of the return are mandatory', 'How long a return is retained'],
  clustered: true,
  rankedByBlocking: true,
}

function harness(overrides: Partial<StudioServices['synthesis']> = {}) {
  const services = createMockServices()
  // Delegating rather than spreading: the mock is a class, so its methods are on
  // the prototype and `{...mock}` would produce an object with none of them.
  const synthesis: StudioServices['synthesis'] = {
    listAttention: (id, options) => services.synthesis.listAttention(id, options),
    listSynthesizedModel: (id) => services.synthesis.listSynthesizedModel(id),
    getSynthesizedObject: (id, objectId) => services.synthesis.getSynthesizedObject(id, objectId),
    runUnknownSynthesis: (id) => services.synthesis.runUnknownSynthesis(id),
    deferAttention: (id, itemId) => services.synthesis.deferAttention(id, itemId),
    reopenAttention: (id, itemId) => services.synthesis.reopenAttention(id, itemId),
    ...overrides,
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  render(
    <QueryClientProvider client={client}>
      <ServiceProvider services={{ ...services, synthesis }}>
        <AttentionRoom />
      </ServiceProvider>
    </QueryClientProvider>,
  )
  return synthesis
}

describe('the Room reads the attention layer', () => {
  it('renders the items the synthesis port returned', async () => {
    harness()

    // Two matches on purpose: the theme in the model, and the item raised from
    // it. They legitimately share a title.
    expect(
      (await screen.findAllByText(/Who approves a return before it is published/)).length,
    ).toBeGreaterThan(0)
  })

  it('renders the synthesized model beside them, not the evidence behind it', async () => {
    harness()

    // A goal, which is a synthesized object. The sentences it was drawn from
    // live on `/reviews` and must not appear here.
    expect(await screen.findByText(/Monthly reporting without manual collation/)).toBeTruthy()
  })

  it('never reads the proposal list to fill this page', async () => {
    const services = createMockServices()
    const proposals = vi.spyOn(services.projection, 'getProjection')
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={client}>
        <ServiceProvider services={services}>
          <AttentionRoom />
        </ServiceProvider>
      </QueryClientProvider>,
    )
    await screen.findAllByText(/Who approves a return before it is published/)

    // The projection is where proposed rows live. Reading it here is how this
    // Room becomes the queue it exists to replace.
    expect(proposals).not.toHaveBeenCalled()
  })
})

describe('a run says what it withheld', () => {
  it('names every theme the run declined to raise', async () => {
    harness({ runUnknownSynthesis: () => Promise.resolve(REPORT) })

    await userEvent.click(await screen.findByRole('button', { name: /look again/i }))

    for (const theme of REPORT.withheld) {
      expect(await screen.findByText(theme)).toBeTruthy()
    }
  })

  it('reports how many themes were formed, so 8 items from 36 is legible', async () => {
    harness({ runUnknownSynthesis: () => Promise.resolve(REPORT) })

    await userEvent.click(await screen.findByRole('button', { name: /look again/i }))

    expect(await screen.findByText(/36 themes/)).toBeTruthy()
  })

  it('says when nothing was compared, so themes of one are not read as compaction', async () => {
    harness({
      runUnknownSynthesis: () => Promise.resolve({ ...REPORT, clustered: false }),
    })

    await userEvent.click(await screen.findByRole('button', { name: /look again/i }))

    expect(await screen.findByText(/every unknown stood alone/)).toBeTruthy()
  })

  it('says which ordering the run performed, so two different queues are not read alike', async () => {
    harness({ runUnknownSynthesis: () => Promise.resolve(REPORT) })

    await userEvent.click(await screen.findByRole('button', { name: /look again/i }))

    expect(await screen.findByText(/Ordered by what each question blocks/)).toBeTruthy()
  })

  it('says the blocked areas are weighed, since a count and a weight rank differently', async () => {
    // `D-152`. Memory ranks a question blocking one required area above one
    // blocking two optional areas; a sentence that says only "what each
    // question blocks" describes an ordering this queue does not perform.
    harness({ runUnknownSynthesis: () => Promise.resolve(REPORT) })

    await userEvent.click(await screen.findByRole('button', { name: /look again/i }))

    expect(await screen.findByText(/weighing the areas readiness requires/)).toBeTruthy()
  })

  it('says a contested area leads a quiet one, since equal weights are not left unordered', async () => {
    // `D-154`/`D-155`. Memory breaks the tie between equally weighted blocked
    // areas by whether their statements already contradict each other, and the
    // `D-152` wording stops at the weighing — true, and no longer sufficient.
    harness({ runUnknownSynthesis: () => Promise.resolve(REPORT) })

    await userEvent.click(await screen.findByRole('button', { name: /look again/i }))

    expect(await screen.findByText(/already contradict each other/)).toBeTruthy()
  })

  it('says an area one statement short of its minimum leads, which is the tie under conflict', async () => {
    // `D-157`. The third tie-break, and the second time in two increments that
    // the sentence stopped describing the queue beneath it. Named as the rule —
    // which area is nearly met is in the item's own explanation (`D-151`).
    harness({ runUnknownSynthesis: () => Promise.resolve(REPORT) })

    await userEvent.click(await screen.findByRole('button', { name: /look again/i }))

    expect(await screen.findByText(/a single confirmed statement short/)).toBeTruthy()
  })

  it('says a corroboration ordering is not a blocking one, rather than saying nothing', async () => {
    harness({
      runUnknownSynthesis: () => Promise.resolve({ ...REPORT, rankedByBlocking: false }),
    })

    await userEvent.click(await screen.findByRole('button', { name: /look again/i }))

    expect(await screen.findByText(/not by what it blocks/)).toBeTruthy()
  })
})

describe('the page says how much there is to do', () => {
  /**
   * The **whole** summary sentence, not the emphasised clause inside it.
   *
   * `findByText` returns the innermost element holding the match, which here is
   * the `<span>` carrying *"3 things need your attention"* — so a negative
   * assertion made against it passes whatever the rest of the paragraph says.
   * Two of the guards below did exactly that until the positive one failed and
   * showed it.
   */
  async function summary(): Promise<string> {
    const said = await screen.findByText(/things? needs? your attention/)
    return said.closest('p')!.textContent!
  }

  it('states the count, so the number a person quotes is one the page said', async () => {
    harness()

    // Doc 01's page-level summary. The queue rendered fine without it; what it
    // could not do is be quoted without counting rows.
    const said = Number((await summary()).match(/^(\d+)/)![1])
    expect(said).toBe(2)
    expect(await screen.findAllByRole('button', { name: /postpone/i })).toHaveLength(said)
  })

  it('agrees with itself in the singular', async () => {
    harness({ listAttention: () => Promise.resolve([{ ...WORDS_ONLY }]) })

    expect(await screen.findByText(/1 thing needs your attention/)).toBeTruthy()
  })

  it('leaves the kinds unsaid while the queue holds only one', async () => {
    harness()

    // Both fixture items are `unknown`, as every item the live system has ever
    // produced is. "2 things need your attention — 2 unknowns" is a clause that
    // repeats its own subject.
    expect(await summary()).not.toMatch(/unknown/)
  })

  it('names the kinds once the queue is mixed, in Memory’s own word', async () => {
    harness({
      listAttention: () =>
        Promise.resolve([
          { ...WORDS_ONLY, id: 'a', kind: 'unknown' },
          { ...WORDS_ONLY, id: 'b', kind: 'unknown' },
          // `AttentionKind.CONFLICT` — what `SYN-5a` raises for doc 03's second
          // Accountable claimant, so a mixed queue is reachable and not
          // hypothetical.
          { ...WORDS_ONLY, id: 'c', kind: 'conflict' },
        ]),
    })

    expect(await summary()).toMatch(/3 things need your attention — 2 unknowns and 1 conflict/)
  })

  it('counts what somebody postponed apart from it, never into it', async () => {
    // `D-142`: postponing means stop recommending, not dealt with. A summary
    // that folded a postponed item into the count would make the gesture do
    // nothing; one that dropped it would make it clear the page.
    harness()

    await userEvent.click((await screen.findAllByRole('button', { name: /postpone/i }))[0])
    await waitFor(async () =>
      expect(await screen.findAllByRole('button', { name: /postpone/i })).toHaveLength(1),
    )

    expect(await summary()).toMatch(/1 thing needs your attention, and 1 you postponed\./)
  })

  it('claims nothing about urgency or about what an item blocks', async () => {
    // `D-166` refuses doc 01's other two summary forms. The areas a question
    // blocks reach Studio only inside `explanation`, and *can wait* is the one
    // ranking dimension `D-165` closed without. Both would be the interface
    // asserting what nothing computed.
    harness()

    expect(await summary()).not.toMatch(/blocks|can wait|urgent/i)
  })
})

/** An item that names no gesture Studio can perform, for the negative cases. */
const WORDS_ONLY: AttentionItem = {
  id: 'attn-words',
  kind: 'unknown',
  title: 'Whether a directorate may publish early',
  explanation: 'Nothing in the record says.',
  recommendation: 'Say who may.',
  status: 'open',
  synthesizedObjectId: 'syn-theme-009',
  priority: 1,
  actions: ['discuss'],
  updatedAt: '2026-07-28T09:41:00Z',
}

describe('an item can say what it rests on', () => {
  it('answers with the sentences KAE read, not with the identifiers of rows', async () => {
    harness()

    await userEvent.click((await screen.findAllByText(/What this rests on/))[0])

    // `attn-001` stands on `syn-theme-001`, whose three members are questions.
    // Identifiers would be a link to a page nobody has; the sentence is the
    // answer to *what supports this*.
    expect(await screen.findByText(/Who signs off a return before it is published\?/)).toBeTruthy()
    expect(screen.queryByText(/UNK-APR-001/)).toBeNull()
  })

  it('counts what it shows, so the count cannot claim more than the list', async () => {
    harness()

    await userEvent.click((await screen.findAllByText(/What this rests on/))[0])

    const counted = await screen.findByText(/observations? KAE read/)
    const list = counted.parentElement!.querySelector('ul')!

    // A count carried separately from the list is how a card says *three* over
    // two sentences. Read the number the page printed and hold it to the rows.
    expect(Number(counted.textContent!.match(/^\d+/)![0])).toBe(list.children.length)
    expect(list.children.length).toBe(3)
  })

  it('does not read the evidence until somebody asks for it', async () => {
    const services = createMockServices()
    const asked = vi.spyOn(services.synthesis, 'getSynthesizedObject')
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <ServiceProvider services={services}>
          <AttentionRoom />
        </ServiceProvider>
      </QueryClientProvider>,
    )
    await screen.findAllByRole('button', { name: /postpone/i })

    // Eight items would be eight requests for a page whose point is brevity.
    expect(asked).not.toHaveBeenCalled()

    await userEvent.click((await screen.findAllByText(/What this rests on/))[0])
    await waitFor(() => expect(asked).toHaveBeenCalledWith(expect.anything(), 'syn-theme-001'))
  })
})

const UNBOUND = {
  id: 'syn-goal-unbound',
  domain: 'goal',
  identityKey: 'goal:unbound',
  title: 'A guess with nothing behind it',
  statement: 'KAE minted this and bound nothing to it.',
  lifecycle: 'proposed',
  authority: 'synthesized',
  revision: 1,
  supportingEvidence: 0,
}

describe('the model says how much of the project stands behind each object', () => {
  /* `SYN-4b`, `D-167`. Doc 01's aggregation is a count and a disclosure
     together. The attention card gets its count from Memory's own sentence;
     this panel had neither, so a goal drawn from 47 observations was drawn
     exactly like one drawn from 1. */

  it('says the count before anybody opens anything', async () => {
    harness()

    // The fixture's three objects rest on two, one and three observations.
    expect(await screen.findByText('Drawn from 2 observations')).toBeTruthy()
    expect(screen.getByText('Drawn from 1 observation')).toBeTruthy()
  })

  it('does not read the statements to say the number', async () => {
    const services = createMockServices()
    const asked = vi.spyOn(services.synthesis, 'getSynthesizedObject')
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <ServiceProvider services={services}>
          <AttentionRoom />
        </ServiceProvider>
      </QueryClientProvider>,
    )

    // The count travels with the list. Twenty-three objects each fetching their
    // own evidence to print one number is the N+1 the disclosure exists to
    // avoid, and it would arrive here silently.
    expect(await screen.findByText('Drawn from 2 observations')).toBeTruthy()
    expect(asked).not.toHaveBeenCalled()
  })

  it('says the count once, on the line somebody clicked', async () => {
    harness()

    await userEvent.click(await screen.findByText('Drawn from 2 observations'))

    expect(
      await screen.findByText(/Directorates submit their figures|submits its figures/),
    ).toBeTruthy()
    // The summary already carries it. Repeating it underneath is `D-142`'s
    // say-it-once failure, one component over.
    expect(screen.queryByText(/2 observations KAE read/)).toBeNull()
  })

  it('says nothing supports an object without claiming it was drawn from anything', async () => {
    harness({ listSynthesizedModel: () => Promise.resolve([UNBOUND]) })

    expect(await screen.findByText('Nothing is recorded as supporting this')).toBeTruthy()
    expect(screen.queryByText(/Drawn from/)).toBeNull()
  })

  it('still offers the way in at zero, because zero means nothing supports it', async () => {
    // `D-187`. The count is `supports` alone, so an object with two
    // contradicting rows and no supporting one reads zero — and suppressing the
    // disclosure here would make the evidence against it the only evidence on
    // this page a person cannot reach.
    harness({
      listSynthesizedModel: () => Promise.resolve([UNBOUND]),
      getSynthesizedObject: () =>
        Promise.resolve({
          ...UNBOUND,
          evidence: [
            {
              id: 'bind-against',
              knowledgeItemId: 'FR-RPT-100',
              kind: 'contradicts',
              statement: 'Directorates were told to stop submitting figures monthly.',
              knowledgeKind: 'requirement',
              lifecycle: 'validated',
            },
          ],
        }),
    })

    await userEvent.click(await screen.findByText('What is bound to this'))

    expect(
      await screen.findByText(/Directorates were told to stop submitting figures monthly/),
    ).toBeTruthy()
  })

  it('names a row that stands against the object, and leaves it out of the count', async () => {
    // `D-187`. `supporting_evidence` counts `supports` and the detail lists
    // every binding, so the list is legitimately longer than the number on the
    // line somebody clicked — which has to be said, not left to be noticed.
    harness({
      listSynthesizedModel: () => Promise.resolve([{ ...UNBOUND, supportingEvidence: 1 }]),
      getSynthesizedObject: () =>
        Promise.resolve({
          ...UNBOUND,
          supportingEvidence: 1,
          evidence: [
            {
              id: 'bind-for',
              knowledgeItemId: 'FR-RPT-101',
              kind: 'supports',
              statement: 'The monthly return is assembled from what directorates submit.',
              knowledgeKind: 'requirement',
              lifecycle: 'validated',
            },
            {
              id: 'bind-against',
              knowledgeItemId: 'FR-RPT-100',
              kind: 'contradicts',
              statement: 'Directorates were told to stop submitting figures monthly.',
              knowledgeKind: 'requirement',
              lifecycle: 'validated',
            },
          ],
        }),
    })

    await userEvent.click(await screen.findByText('Drawn from 1 observation'))

    const against = await screen.findByText(
      /Directorates were told to stop submitting figures monthly/,
    )
    expect(against.textContent).toMatch(/contradicts/)
    // The supporting row is not labelled: naming every relation would make the
    // ordinary case noisy and the exception quiet.
    expect(
      screen.getByText(/The monthly return is assembled from what directorates submit/).textContent,
    ).not.toMatch(/supports/)
    expect(
      screen.getByText(/1 observation here stands to this as something other than support/),
    ).toBeTruthy()
  })
})

describe('postponing is not the same as hiding', () => {
  it('moves the item out of what needs you and into what was postponed', async () => {
    harness()

    const postpone = await screen.findAllByRole('button', { name: /postpone/i })
    expect(postpone).toHaveLength(2)
    await userEvent.click(postpone[0])

    // Still on the page, under its own heading, still counted.
    expect(await screen.findByText(/1 item you postponed/)).toBeTruthy()
    await waitFor(async () =>
      expect(await screen.findAllByRole('button', { name: /postpone/i })).toHaveLength(1),
    )
  })

  it('brings a postponed item back to what needs you', async () => {
    harness()

    await userEvent.click((await screen.findAllByRole('button', { name: /postpone/i }))[0])
    await userEvent.click(await screen.findByRole('button', { name: /bring back/i }))

    await waitFor(async () =>
      expect(await screen.findAllByRole('button', { name: /postpone/i })).toHaveLength(2),
    )
  })

  it('asks the port for deferred items, or postponing is indistinguishable from deleting', async () => {
    const services = createMockServices()
    const asked = vi.spyOn(services.synthesis, 'listAttention')
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <ServiceProvider services={services}>
          <AttentionRoom />
        </ServiceProvider>
      </QueryClientProvider>,
    )
    await screen.findAllByRole('button', { name: /postpone/i })
    expect(asked).toHaveBeenCalledWith(expect.anything(), { includeDeferred: true })
  })

  it('offers no control for a gesture the item does not name', async () => {
    harness({ listAttention: () => Promise.resolve([WORDS_ONLY]) })

    await screen.findByText(WORDS_ONLY.title)
    expect(screen.queryByRole('button', { name: /postpone/i })).toBeNull()
  })

  it('says a gesture once — as a control, or as a word, never both', async () => {
    harness({
      listAttention: () => Promise.resolve([{ ...WORDS_ONLY, actions: ['discuss', 'defer'] }]),
    })

    await screen.findByRole('button', { name: /postpone/i })

    // `defer` has a button, so it must not also appear in the list of things
    // that can be done but not here.
    expect(await screen.findByText(/What can be done with this: discuss$/)).toBeTruthy()
  })
})
