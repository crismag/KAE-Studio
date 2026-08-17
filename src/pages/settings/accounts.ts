/**
 * One row per account, from records that accumulated one per attempt (`D-79`).
 *
 * The deployed project holds **six** connections, all `github`, all
 * `env:KAE_GITHUB_TOKEN`, five granted and one not — because
 * `record_connection` has no uniqueness on `(project_id, provider)` and every
 * attempt wrote a row. A person cannot tell them apart, because there is nothing
 * to tell apart.
 *
 * Collapsed on read rather than deleted or constrained. Deleting is destructive
 * and one of the six is the connection the project actually uses; a uniqueness
 * constraint would fail on this data and forecloses the case the absence was
 * deliberately left for — *two credentials for two accounts of the same
 * provider*.
 *
 * **Grouping is not merging.** Every record stays whole and separately
 * addressable, exactly as `group_related` treats statements; this decides
 * nothing on the record's behalf.
 */

import type { MemoryConnection } from '@/domain/types'

/**
 * `AuthorizationState`, `domain/publication_targets.py:68` — all five words.
 *
 * Transcribed because Studio's CI has no KAE-Memory checkout. The enum's own
 * docstring says the members exist *because the remedies differ*, and
 * `PublicationTarget.unavailable_reason` writes a separate sentence for each of
 * the four that are not `granted` — so collapsing them into *not connected* is
 * discarding a distinction the producer made on purpose (`D-212`).
 */
export type AuthorizationState = 'granted' | 'never_granted' | 'expired' | 'revoked' | 'unverified'

/**
 * What each state is called on the page, and what it means when it is not
 * *granted*.
 *
 * Indexed over the five words rather than defaulted: a sixth member arriving in
 * Memory's enum is a compile error here, not a row quietly reading *Not
 * connected* again. The sentences say the state and stop — Memory's four
 * remedies hang off a publication target this page does not read, and a second
 * copy of them here is the drift `D-125` refuses.
 */
export const CONNECTION_STATE: Record<
  AuthorizationState,
  { label: string; sentence: string | null }
> = {
  granted: { label: 'Connected', sentence: null },
  never_granted: { label: 'Not connected', sentence: null },
  expired: { label: 'Expired', sentence: 'This authorisation has expired and needs renewing.' },
  revoked: {
    label: 'Revoked',
    sentence: 'This authorisation was revoked. Find out why before renewing it.',
  },
  unverified: {
    label: 'Never checked',
    sentence: 'Credentials are recorded and have never been exercised, so nobody knows they work.',
  },
}

/**
 * How one state reads, including a word this page has never heard of.
 *
 * An unknown word shows itself rather than falling back to *Not connected*: a
 * state Memory adds later is not a synonym for one it already has, and drawing
 * it as one would be this page asserting something nobody told it (`D-38`).
 */
export function connectionState(state: string): { label: string; sentence: string | null } {
  return CONNECTION_STATE[state as AuthorizationState] ?? { label: state, sentence: null }
}

export interface Account {
  /** `provider:reference`, stable across renders and safe as a key. */
  key: string
  provider: string
  /** Where the credential lives — `env:NAME` — never the credential. */
  credentialReference: string | null
  /** True when **any** record in the group is granted. See below. */
  granted: boolean
  /**
   * The word this row reports: `granted` when any record is, otherwise the
   * state of the record `ungranted` returns — the same record the *Grant
   * access* button acts on, so the badge and the control cannot describe two
   * different rows (`D-212`).
   */
  state: string
  /** Who granted it first, and when — the earliest grant in the group. */
  authorizedBy: string | null
  grantedAt: string | null
  /** Every record behind this row, newest grant first. Never discarded. */
  records: MemoryConnection[]
}

/**
 * Group connections into the accounts a person would recognise.
 *
 * The row reports the **strongest** authorization in its group: if any record is
 * granted, the account is granted. That is what decides whether KAE can reach
 * the provider at all, and reporting the weakest would tell somebody they had no
 * access while they did — the same class of error as `D-26`, in the direction
 * that hides what already works.
 */
export function accountsFrom(connections: MemoryConnection[]): Account[] {
  const groups = new Map<string, Account>()

  for (const connection of connections) {
    const key = `${connection.provider}:${connection.credentialReference ?? ''}`
    const existing = groups.get(key)
    if (existing) {
      existing.records.push(connection)
      continue
    }
    groups.set(key, {
      key,
      provider: connection.provider,
      credentialReference: connection.credentialReference,
      granted: false,
      state: connection.state,
      authorizedBy: null,
      grantedAt: null,
      records: [connection],
    })
  }

  for (const account of groups.values()) {
    const granted = account.records.filter((record) => record.state === 'granted')
    account.granted = granted.length > 0
    account.state = account.granted ? 'granted' : (ungranted(account)?.state ?? account.state)
    // The earliest grant, because *when was this connected* is a fact about the
    // account and the later records are retries of a thing already true.
    const earliest = granted
      .filter((record) => record.lastVerifiedAt)
      .sort((a, b) => (a.lastVerifiedAt ?? '').localeCompare(b.lastVerifiedAt ?? ''))[0]
    account.authorizedBy = earliest?.authorizedBy ?? granted[0]?.authorizedBy ?? null
    account.grantedAt = earliest?.lastVerifiedAt ?? null
  }

  // Granted accounts first: an account that works is the answer to *what can KAE
  // reach*, and one that does not is a task.
  return [...groups.values()].sort((a, b) => Number(b.granted) - Number(a.granted))
}

/** A connection a person still has to finish. */
export function ungranted(account: Account): MemoryConnection | undefined {
  return account.records.find((record) => record.state !== 'granted')
}
