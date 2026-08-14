/**
 * Six identical rows become one account (`D-79`).
 *
 * The deployed project holds six `github` connections, all
 * `env:KAE_GITHUB_TOKEN`, five granted and one not — every write attempt, shown.
 * The owner's report was that the page is hard to understand, and this is a
 * large part of why: there is nothing to tell the rows apart, because there is
 * nothing different about them.
 *
 * Collapsed on read. Nothing is deleted — one of those six is the connection the
 * project actually uses, and a uniqueness constraint would both fail on this
 * data and forbid the case the service deliberately left room for: two
 * credentials for two accounts of the same provider.
 */

import { describe, expect, it } from 'vitest'

import type { MemoryConnection } from '@/domain/types'
import { accountsFrom, ungranted } from './accounts'

function connection(over: Partial<MemoryConnection> = {}): MemoryConnection {
  return {
    connectionId: `c${Math.random()}`,
    provider: 'github',
    state: 'granted',
    credentialReference: 'env:KAE_GITHUB_TOKEN',
    authorizedBy: 'cris',
    lastVerifiedAt: '2026-08-10T17:02:42Z',
    detail: '',
    ...over,
  }
}

describe('connections become accounts', () => {
  it('collapses the deployment’s six rows into one', () => {
    const rows = [
      connection(),
      connection(),
      connection(),
      connection(),
      connection({ state: 'never_granted', authorizedBy: null, lastVerifiedAt: null }),
      connection(),
    ]

    const accounts = accountsFrom(rows)

    expect(accounts).toHaveLength(1)
    expect(accounts[0].records).toHaveLength(6)
  })

  it('keeps two accounts of the same provider apart', () => {
    // The case the missing uniqueness constraint was left open for, and the
    // reason this groups on the reference rather than on the provider alone.
    const accounts = accountsFrom([
      connection({ credentialReference: 'env:PERSONAL_TOKEN' }),
      connection({ credentialReference: 'env:WORK_TOKEN' }),
    ])

    expect(accounts.map((a) => a.credentialReference)).toEqual([
      'env:PERSONAL_TOKEN',
      'env:WORK_TOKEN',
    ])
  })

  it('reports the account as connected when any record is', () => {
    /**
     * The strongest state, not the weakest. What decides whether KAE can reach
     * the provider is whether *some* grant exists — reporting the ungranted
     * record would tell somebody they had no access while they had it, which is
     * `D-26`'s defect in the direction that hides what already works.
     */
    const accounts = accountsFrom([
      connection({ state: 'never_granted', lastVerifiedAt: null }),
      connection({ state: 'granted' }),
    ])

    expect(accounts[0].granted).toBe(true)
  })

  it('is not connected when nothing in the group is', () => {
    // The other half. A rule that always says yes is not a rule.
    const accounts = accountsFrom([
      connection({ state: 'never_granted', lastVerifiedAt: null }),
      connection({ state: 'never_granted', lastVerifiedAt: null }),
    ])

    expect(accounts[0].granted).toBe(false)
  })

  it('dates the account from the earliest grant, not the latest retry', () => {
    /** *When was this connected* is a fact about the account; the later records
     * are retries of something already true. */
    const accounts = accountsFrom([
      connection({ lastVerifiedAt: '2026-08-12T09:00:00Z', authorizedBy: 'someone-else' }),
      connection({ lastVerifiedAt: '2026-08-10T17:02:42Z', authorizedBy: 'cris' }),
    ])

    expect(accounts[0].grantedAt).toBe('2026-08-10T17:02:42Z')
    expect(accounts[0].authorizedBy).toBe('cris')
  })

  it('offers the ungranted record so it can still be finished', () => {
    const pending = connection({ connectionId: 'needs-granting', state: 'never_granted' })
    const [account] = accountsFrom([connection(), pending])

    expect(ungranted(account)?.connectionId).toBe('needs-granting')
  })

  it('offers nothing to finish when the account is fully granted', () => {
    const [account] = accountsFrom([connection(), connection()])

    expect(ungranted(account)).toBeUndefined()
  })

  it('puts an account that works before one that does not', () => {
    const accounts = accountsFrom([
      connection({ credentialReference: 'env:BROKEN', state: 'never_granted' }),
      connection({ credentialReference: 'env:WORKING', state: 'granted' }),
    ])

    expect(accounts.map((a) => a.credentialReference)).toEqual(['env:WORKING', 'env:BROKEN'])
  })

  it('has nothing to show when there are no connections', () => {
    // Guards the guard: an empty result must come from an empty input rather
    // than from the grouping quietly dropping everything.
    expect(accountsFrom([])).toEqual([])
  })
})

describe('a connected account offers nothing to finish', () => {
  it('has no pending record once any grant exists', () => {
    /**
     * `Connected` beside `Grant access` reads as a contradiction, and it is
     * noise: the account already reaches the provider. The rule lives at the
     * call site, so this asserts the shape it depends on — `granted` is true
     * while an ungranted record still exists, and the page must not offer it.
     */
    const [account] = accountsFrom([
      connection({ state: 'granted' }),
      connection({ state: 'never_granted', lastVerifiedAt: null }),
    ])

    expect(account.granted).toBe(true)
    expect(ungranted(account)).toBeDefined()
  })
})

/**
 * `D-90` — the row is an account, and multi-install is named rather than faked.
 *
 * Settings showed `github` and `env:KAE_GITHUB_TOKEN`: what the record holds,
 * and neither of them what a person calls this connection. An App installation
 * knows the account; a token does not, and inventing one would be worse than
 * the provider's name.
 *
 * `OD-SRC-2` is answered by what can be stored, not by what would look best.
 * Listing installations is free. **Choosing** one durably has nowhere to live —
 * `KNOWN_FIELDS` refuses a seventh configuration field, Studio holds no durable
 * state of its own (`D-21`, `D-22`), and an installation belongs to the
 * deployment rather than to a project — so the product names them and the host
 * setting still decides.
 */
describe('an account is named where KAE knows it', () => {
  it('groups duplicates whatever the display name becomes', () => {
    // The `D-79` claim, restated against the change: naming is presentation and
    // must not alter which records collapse together.
    const rows = [connection(), connection(), connection({ state: 'never_granted' })]

    expect(accountsFrom(rows)).toHaveLength(1)
    expect(accountsFrom(rows)[0].records).toHaveLength(3)
  })

  it('keeps the credential reference, because that is what a token is', () => {
    // Not shown as the headline any more, and not discarded: it is the only
    // thing that distinguishes two token connections to one provider.
    const [account] = accountsFrom([connection({ credentialReference: 'env:WORK_TOKEN' })])

    expect(account.credentialReference).toBe('env:WORK_TOKEN')
  })
})
