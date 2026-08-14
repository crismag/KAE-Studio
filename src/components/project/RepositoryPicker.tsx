/**
 * One repository picker, for every place that picks a repository (`D-87`).
 *
 * There were two. `pages/setup/RepositoryPicker` was polished, accessible and
 * unused after `D-81` moved selection to Sources; `rooms/sources/PickRepository`
 * was live and simpler. Two implementations of one control drift, and the one
 * nobody looks at drifts silently — meanwhile a third place, the destination
 * field, still asked somebody to type `owner/repository` by hand.
 *
 * This keeps what each had. From the setup picker: `listbox`/`option` roles,
 * `aria-selected`, the private badge, truncation said rather than swallowed, and
 * the sentence for *the configured repository is not in the visible set*. From
 * the Sources picker: name first with the path secondary, and filtering by kind
 * so a folder and a GitHub repository can share one list.
 *
 * **Presentational only.** It reports a choice; what a choice *means* differs by
 * caller — Sources records a Source and sets `primary_repository`, a destination
 * records a publication target — and folding that in here is what made the first
 * two diverge.
 */

import { useState } from 'react'
import { Check, FolderOpen, Github, Lock, Search } from 'lucide-react'

import { Badge, EmptyState, Mono, Skeleton } from '@/components/ui/primitives'
import { Input } from '@/components/ui/form'
import { QueryState } from '@/components/ui/QueryState'
import { CapabilityNote } from '@/components/project/CapabilityNote'
import { useAvailableRepositories } from '@/hooks/useProject'

export interface PickedRepository {
  fullName: string
  defaultBranch: string
}

export function RepositoryPicker({
  kind,
  value = '',
  onSelect,
  label = 'Filter repositories',
}: {
  /** Which provider's repositories to offer. Omit for every kind. */
  kind?: 'local' | 'github'
  /** Already chosen, marked in the list rather than hidden from it. */
  value?: string
  onSelect: (repository: PickedRepository) => void
  label?: string
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
            <PickerBody
              kind={kind}
              query={query}
              onQuery={setQuery}
              label={label}
              value={value}
              repositories={result.repositories}
              truncated={result.truncated}
              onSelect={onSelect}
            />
          )
        }
      </QueryState>
    </div>
  )
}

function PickerBody({
  kind,
  query,
  onQuery,
  label,
  value,
  repositories,
  truncated,
  onSelect,
}: {
  kind?: 'local' | 'github'
  query: string
  onQuery: (value: string) => void
  label: string
  value: string
  repositories: {
    kind: 'local' | 'github'
    fullName: string
    defaultBranch: string
    private: boolean
    description: string
  }[]
  truncated: boolean
  onSelect: (repository: PickedRepository) => void
}) {
  const visible = repositories.filter(
    (repo) =>
      (!kind || repo.kind === kind) && repo.fullName.toLowerCase().includes(query.trim().toLowerCase()),
  )
  const noneOfKind = !query.trim() && visible.length === 0

  if (noneOfKind) {
    return (
      <EmptyState title="Nothing to choose from">
        {kind === 'github'
          ? 'KAE cannot see any GitHub repositories. This Studio may not have GitHub access, or that access cannot see any repos. Folders on this machine still work — add one on Sources.'
          : kind === 'local'
            ? 'No folders on this machine are available to read.'
            : 'KAE can reach no repositories of this kind.'}
      </EmptyState>
    )
  }

  return (
    <>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-subtle"
          aria-hidden="true"
        />
        <Input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search"
          className="pl-8"
          aria-label={label}
        />
      </div>
      <Options
        kind={kind}
        repositories={visible}
        query={query}
        value={value}
        truncated={truncated}
        onSelect={onSelect}
      />
    </>
  )
}

function Options({
  kind,
  repositories,
  query,
  value,
  truncated,
  onSelect,
}: {
  kind?: 'local' | 'github'
  repositories: {
    kind: 'local' | 'github'
    fullName: string
    defaultBranch: string
    private: boolean
    description: string
  }[]
  query: string
  value: string
  truncated: boolean
  onSelect: (repository: PickedRepository) => void
}) {
  if (repositories.length === 0) {
    return (
      <EmptyState title={query ? 'Nothing matches that' : 'Nothing to choose from'}>
        {query
          ? `No repository KAE can reach matches “${query}”.`
          : kind === 'github'
            ? 'KAE cannot see any GitHub repositories.'
            : 'KAE can reach no repositories of this kind.'}
      </EmptyState>
    )
  }

  return (
    <>
      <ul
        role="listbox"
        aria-label="Repositories"
        className="kae-scrollbar max-h-72 space-y-1 overflow-y-auto"
      >
        {repositories.map((repo) => {
          const chosen = repo.fullName === value
          const Icon = repo.kind === 'local' ? FolderOpen : Github
          return (
            <li key={`${repo.kind}:${repo.fullName}`}>
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
                <Icon className="size-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    {/* Name first. `fullName` is `owner/name` for GitHub and an
                        absolute path for a folder, and leading with the path
                        made this read as developer output (`D-78`). */}
                    <span className="truncate text-body font-medium text-ink">
                      {displayName(repo)}
                    </span>
                    {repo.private && repo.kind === 'github' && (
                      <Lock className="size-3 shrink-0 text-ink-subtle" aria-label="Private" />
                    )}
                  </span>
                  {repo.description && (
                    <span className="mt-0.5 block truncate text-caption text-ink-subtle">
                      {repo.description}
                    </span>
                  )}
                  {repo.kind === 'local' && (
                    <span className="mt-0.5 block truncate text-caption text-ink-subtle">
                      <Mono>{repo.fullName}</Mono>
                    </span>
                  )}
                </span>
                {repo.defaultBranch && <Mono>{repo.defaultBranch}</Mono>}
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
        <p className="text-caption text-ink-muted">
          KAE reaches more than one page of repositories. Search to narrow the list.
        </p>
      )}

      {value && !repositories.some((repo) => repo.fullName === value) && (
        // A real situation — access revoked, a token rescoped, a folder moved —
        // and hiding it would make the page look like nothing is configured.
        <p className="text-caption text-ink-muted">
          This project is configured for <Mono>{value}</Mono>, which KAE cannot currently see.
        </p>
      )}
    </>
  )
}

function displayName(repo: { kind: string; fullName: string }): string {
  if (repo.kind !== 'local') return repo.fullName
  return repo.fullName.split('/').filter(Boolean).pop() || repo.fullName
}

export { Badge }
