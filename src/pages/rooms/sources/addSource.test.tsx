/**
 * The `+` menu says what each branch needs, and only when reached for (`D-80`).
 *
 * Two of the five branches do not exist. They are drawn anyway: a menu that
 * silently omits the thing somebody came to do teaches them the product cannot
 * do it, where one that shows it and says what it needs teaches them what is
 * missing.
 *
 * The rule under test is `D-78`'s — the explanation arrives **when somebody
 * reaches for the control**, never as a paragraph above the menu. That is the
 * line between honest and demoralising, and it is the whole reason this
 * redesign was asked for.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { AddSource, options } from './AddSource'

function open(props: Partial<{ localRoots: number; connected: boolean }> = {}) {
  const chosen: string[] = []
  render(
    <AddSource
      localRoots={props.localRoots ?? 29}
      connected={props.connected ?? false}
      onChoose={(branch) => chosen.push(branch)}
    />,
  )
  return chosen
}

describe('what the menu offers', () => {
  it('offers every branch, including the ones that do not exist', async () => {
    const user = userEvent.setup()
    open()

    await user.click(screen.getByRole('button', { name: /add a source/i }))

    for (const title of [
      /a folder on this machine/i,
      /a repository on github/i,
      /clone a repository here first/i,
      /create a new repository/i,
      /paste a document/i,
    ]) {
      expect(screen.getByRole('button', { name: title })).toBeInTheDocument()
    }
  })

  it('says nothing about a prerequisite until the control is reached for', async () => {
    const user = userEvent.setup()
    // Not connected, so cloning has an unmet prerequisite to withhold.
    open({ connected: false })

    await user.click(screen.getByRole('button', { name: /add a source/i }))

    // The menu is open and no explanation is on screen. This is the assertion
    // the whole redesign turns on.
    expect(screen.queryByText(/nothing to copy from/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/wider grant than reading/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /clone a repository here first/i }))

    expect(await screen.findByText(/nothing to copy from/i)).toBeInTheDocument()
    // Still only the one reached for.
    expect(screen.queryByText(/wider grant than reading/i)).not.toBeInTheDocument()
  })

  it('names write access as what creating a repository would need', async () => {
    // The decision the owner has to make, stated where it is met rather than
    // buried: creating is the only branch that writes to somebody's account.
    const user = userEvent.setup()
    open()

    await user.click(screen.getByRole('button', { name: /add a source/i }))
    await user.click(screen.getByRole('button', { name: /create a new repository/i }))

    expect(await screen.findByText(/write to your github account/i)).toBeInTheDocument()
  })

  it('chooses a branch that works instead of explaining it', async () => {
    const user = userEvent.setup()
    const chosen = open({ localRoots: 29 })

    await user.click(screen.getByRole('button', { name: /add a source/i }))
    await user.click(screen.getByRole('button', { name: /a folder on this machine/i }))

    expect(chosen).toEqual(['folder'])
  })
})

describe('what each branch needs is computed, not written down', () => {
  it('a folder is ready when this deployment reads any', () => {
    const folder = options({ localRoots: 29, connected: false }).find((o) => o.id === 'folder')

    expect(folder?.needs).toBe('')
    expect(folder?.means).toContain('29')
  })

  it('a folder needs configuring when the deployment reads none', () => {
    // The `D-58` shape: a deployment with no roots must say which setting is
    // missing, not that folders are impossible.
    const folder = options({ localRoots: 0, connected: false }).find((o) => o.id === 'folder')

    expect(folder?.needs).toContain('KAE_LOCAL_SOURCE_ROOTS')
  })

  it('separates “not connected” from “connected and sees nothing”', () => {
    /**
     * Three states, not two (`D-89`). The live evidence: an account is granted,
     * the GitHub listing is empty, and the menu told the person to *connect an
     * account in Settings* — to do again the thing they had already done.
     *
     * Connected-with-nothing-visible is this Studio's access, not a missing
     * connect step.
     */
    const without = options({ localRoots: 29, connected: false }).find((o) => o.id === 'github')
    const scoped = options({ localRoots: 29, connected: true, githubCount: 0 }).find(
      (o) => o.id === 'github',
    )
    const ready = options({ localRoots: 29, connected: true, githubCount: 4 }).find(
      (o) => o.id === 'github',
    )

    expect(without?.needs).toContain('Connect one in Settings')

    expect(scoped?.needs).toMatch(/cannot see any GitHub repositories/i)
    expect(scoped?.needs).not.toMatch(/connect one in settings/i)

    expect(ready?.needs).toBe('')
    expect(ready?.means).toContain('4')
  })

  it('cloning spans two prerequisites and names whichever is missing', () => {
    /**
     * It was **Not yet** and now runs (`D-93`). Cloning is the one branch that
     * needs both halves — something to copy *from*, somewhere to copy *to* —
     * and naming one while the other is also missing sends somebody to fix half
     * of it and try again.
     */
    const ready = options({ localRoots: 29, connected: true }).find((o) => o.id === 'clone')
    const noAccount = options({ localRoots: 29, connected: false }).find((o) => o.id === 'clone')
    const noRoots = options({ localRoots: 0, connected: true }).find((o) => o.id === 'clone')

    expect(ready?.needs).toBe('')
    expect(noAccount?.needs).toMatch(/nothing to copy from/i)
    expect(noRoots?.needs).toMatch(/KAE_LOCAL_SOURCE_ROOTS/)
  })
})

describe('the menu yields to the picker', () => {
  it('renders nothing once a kind has been chosen', () => {
    /**
     * It stayed open **above** the picker, so a person saw a kind menu, a
     * repository list and two Cancel buttons — and could choose a second kind
     * while a picker for the first was on screen (`D-89`).
     */
    const { container } = render(
      <AddSource localRoots={29} connected chosen="folder" onChoose={() => {}} />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('is there while nothing has been chosen', () => {
    // The other half: a rule that always hides is not a rule.
    render(<AddSource localRoots={29} connected chosen={null} onChoose={() => {}} />)

    expect(screen.getByRole('button', { name: /add a source/i })).toBeInTheDocument()
  })
})
