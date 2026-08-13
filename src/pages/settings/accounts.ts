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

export interface Account {
  /** `provider:reference`, stable across renders and safe as a key. */
  key: string
  provider: string
  /** Where the credential lives — `env:NAME` — never the credential. */
  credentialReference: string | null
  /** True when **any** record in the group is granted. See below. */
  granted: boolean
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
      authorizedBy: null,
      grantedAt: null,
      records: [connection],
    })
  }

  for (const account of groups.values()) {
    const granted = account.records.filter((record) => record.state === 'granted')
    account.granted = granted.length > 0
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
