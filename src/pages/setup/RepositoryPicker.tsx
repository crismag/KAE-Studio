/**
 * Choose a repository from the ones the credential can actually see.
 *
 * ## Why this replaces a text field
 *
 * `§6` of the UX package: **workflow pages select configured resources;
 * Settings pages configure those resources.** Typing `owner/name` into a free
 * text box is not selection — it is configuration with no feedback, where the
 * way you learn you were wrong is a connectivity check failing afterwards.
 *
 * The package points at Codex for the shape: when the account is connected,
 * picking a repository is a searchable list; managing the connection is
 * somewhere else entirely.
 *
 * ## What the list means
 *
 * Exactly what this credential can reach — `GET /user/repos`, not a search.
 * Search would rank by relevance across GitHub and make an empty result
 * ambiguous between *"no such repository"* and *"not visible to this token"*.
 * Those need opposite responses, so the list is scoped to visibility and
 * filtered locally.
 *
 * ## The state that matters most
 *
 * **No credential configured.** The picker then has no options and the reason
 * is the only actionable thing on the screen, so it is rendered instead of the
 * list rather than beside it — an empty dropdown with a note underneath is a
 * dropdown people keep clicking.
 */

import { useState } from 'react'
import { Check, Github, Lock, Search } from 'lucide-react'

import { CapabilityNote } from '@/components/project/CapabilityNote'
import { Input } from '@/components/ui/form'
import { Badge, Mono, Skeleton } from '@/components/ui/primitives'
import { QueryState } from '@/components/ui/QueryState'
import { useAvailableRepositories } from '@/hooks/useProject'

export function RepositoryPicker({
  value,
  onSelect,
}: {
  /** The currently configured repository, if there is one. */
  value: string
  /** Called with the full name and the repository's own default branch. */
  onSelect: (repository: { fullName: string; defaultBranch: string }) => void
}) {
  const [query, setQuery] = useState('')
  const listing = useAvailableRepositories()

  return (
    <div className="space-y-2">
      <QueryState
        query={listing}
        of="The repositories KAE can reach"
        skeleton={<Skeleton className="h-32" />}
      >
        {(result) =>
          result.unavailableReason ? (
            // Instead of the list, not beside it. An empty dropdown with a note
            // underneath is a dropdown people keep clicking.
            <CapabilityNote
              reason={result.unavailableReason}
              proved={
                value
                  ? [`This project is already configured for ${value}, which still stands.`]
                  : undefined
              }
            />
          ) : (
            <>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-subtle"
                  aria-hidden="true"
                />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filter repositories"
                  aria-label="Filter repositories"
                  className="pl-8"
                />
              </div>

              <RepositoryList
                repositories={result.repositories.filter((repo) =>
                  repo.fullName.toLowerCase().includes(query.trim().toLowerCase()),
                )}
                query={query}
                value={value}
                truncated={result.truncated}
                onSelect={onSelect}
              />
            </>
          )
        }
      </QueryState>
    </div>
  )
}

function RepositoryList({
  repositories,
  query,
  value,
  truncated,
  onSelect,
}: {
  repositories: {
    fullName: string
    defaultBranch: string
    private: boolean
    description: string
  }[]
  query: string
  value: string
  truncated: boolean
  onSelect: (repository: { fullName: string; defaultBranch: string }) => void
}) {
  if (repositories.length === 0) {
    return (
      <p className="py-2 text-[12.5px] italic text-ink-subtle">
        {query
          ? `No repository this credential can see matches “${query}”.`
          : 'This credential can see no repositories. It may be scoped to none, or to repositories in another account.'}
      </p>
    )
  }

  return (
    <>
      <ul
        role="listbox"
        aria-label="Repositories"
        className="max-h-64 space-y-1 overflow-y-auto kae-scrollbar"
      >
        {repositories.map((repo) => {
          const chosen = repo.fullName === value
          return (
            <li key={repo.fullName}>
              <button
                type="button"
                role="option"
                aria-selected={chosen}
                onClick={() =>
                  onSelect({ fullName: repo.fullName, defaultBranch: repo.defaultBranch })
                }
                className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left transition-colors ${
                  chosen
                    ? 'border-accent-line bg-accent-soft'
                    : 'border-line bg-surface hover:bg-surface-sunken'
                }`}
              >
                <Github className="size-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-mono text-[12px] text-ink">{repo.fullName}</span>
                    {repo.private && (
                      <Lock className="size-3 shrink-0 text-ink-subtle" aria-label="Private" />
                    )}
                  </span>
                  {/* Never invented. An absent description stays absent, so the
                      row is shorter rather than filled with a placeholder. */}
                  {repo.description && (
                    <span className="mt-0.5 block truncate text-[11.5px] text-ink-subtle">
                      {repo.description}
                    </span>
                  )}
                </span>
                <Mono>{repo.defaultBranch}</Mono>
                {chosen && <Check className="size-3.5 shrink-0 text-accent" aria-hidden="true" />}
              </button>
            </li>
          )
        })}
      </ul>

      {truncated && (
        // Said, never swallowed. A partial list presented as complete is how
        // somebody concludes their repository is inaccessible when it is on
        // page two.
        <p className="text-[11.5px] text-ink-muted">
          This credential reaches more than one page of repositories. Filter to narrow the list.
        </p>
      )}

      {value && !repositories.some((repo) => repo.fullName === value) && (
        // The configured repository is not in the visible set. That is a real
        // situation — access revoked, token rescoped — and hiding it would make
        // the page look like nothing is configured.
        <p className="text-[11.5px] text-ink-muted">
          This project is configured for <Mono>{value}</Mono>, which this credential cannot
          currently see.
        </p>
      )}

      <p className="flex items-center gap-1.5 text-[11px] text-ink-subtle">
        <Badge tone="neutral">Selection</Badge>
        Choosing a repository records where KAE reads from. It reads nothing until you ask it to.
      </p>
    </>
  )
}
