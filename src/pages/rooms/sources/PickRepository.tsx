/**
 * Choosing the repository a project reads from — the one place it happens.
 *
 * `/setup` had a picker and Sources had none, so the `+` menu offered *a folder
 * on this machine* and then rendered nothing (`D-81`). Selection now lives here
 * and Setup shows a summary, because two pickers with different behaviour is how
 * they drift apart.
 *
 * ## What choosing does, which is three things
 *
 * The old picker did all three and it was easy to miss when the component moved:
 *
 * 1. **Records a Source** — what this project reads from.
 * 2. **Sets `primary_repository`** — the project's own configuration, which
 *    `/setup` reports and which `D-55`'s repair keys on.
 * 3. **Infers the branch**, when none is set, from what the provider reports.
 *    Recorded as `inferred` and never `confirmed`: the provider said it, a
 *    person did not (`§5` — do not ask for what KAE can infer; show it for
 *    confirmation).
 *
 * Dropping any one of them would have left a flow that looked complete and
 * quietly stopped configuring the project.
 */

import { useState } from 'react'
import { FolderOpen, Github, Search } from 'lucide-react'

import { Badge, Button, EmptyState, Mono } from '@/components/ui/primitives'
import { Input } from '@/components/ui/form'
import { QueryState } from '@/components/ui/QueryState'
import { Skeleton } from '@/components/ui/primitives'
import { CapabilityNote } from '@/components/project/CapabilityNote'
import {
  useAddSource,
  useAvailableRepositories,
  useConfigureField,
  useSetup,
} from '@/hooks/useProject'

export function PickRepository({ kind, onDone }: { kind: 'local' | 'github'; onDone: () => void }) {
  const [query, setQuery] = useState('')
  const listing = useAvailableRepositories()
  const add = useAddSource()
  const configure = useConfigureField()
  const setup = useSetup()

  const branchSet = Boolean(setup.data?.configuration.primary_branch?.value)

  function choose(repo: { fullName: string; defaultBranch: string }) {
    add.mutate({
      kind,
      connectionId: '',
      location: repo.fullName,
      reference: repo.defaultBranch || '',
    })
    // The project's own configuration, not only a Source. `/setup` reports this
    // and `D-55`'s repair keys on it.
    // No state, deliberately. A person picked it, and the default is what the
    // old picker wrote — `confirmed` is a word this product reserves, and
    // changing its meaning while moving a component is how semantics drift.
    configure.mutate({ field: 'primary_repository', value: repo.fullName })
    // Only when unset. Overwriting a branch somebody chose would make picking a
    // repository quietly undo a decision.
    if (!branchSet && repo.defaultBranch) {
      configure.mutate({
        field: 'primary_branch',
        value: repo.defaultBranch,
        state: 'inferred',
        evidence: `reported as the default branch of ${repo.fullName}`,
      })
    }
    onDone()
  }

  return (
    <div className="space-y-3">
      <QueryState
        query={listing}
        of="Repositories KAE can reach"
        skeleton={<Skeleton className="h-40" />}
      >
        {(result) => {
          if (result.unavailableReason) {
            return <CapabilityNote reason={result.unavailableReason} />
          }
          const matching = result.repositories.filter(
            (repo) =>
              repo.kind === kind && repo.fullName.toLowerCase().includes(query.toLowerCase()),
          )
          return (
            <>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-subtle"
                  aria-hidden="true"
                />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={`Search ${matching.length} ${kind === 'local' ? 'folders' : 'repositories'}…`}
                  className="pl-8"
                  aria-label="Search repositories"
                />
              </div>

              {matching.length === 0 ? (
                <EmptyState title="Nothing matches that">
                  {query
                    ? 'No repository here has that in its name.'
                    : 'This deployment can reach none of this kind.'}
                </EmptyState>
              ) : (
                <ul className="max-h-96 space-y-1.5 overflow-y-auto">
                  {matching.slice(0, 60).map((repo) => (
                    <li key={repo.fullName}>
                      <button
                        type="button"
                        onClick={() => choose(repo)}
                        disabled={add.isPending}
                        className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:bg-surface-sunken disabled:opacity-60"
                      >
                        <span className="flex items-center gap-2 text-[13px] font-medium text-ink">
                          {kind === 'local' ? (
                            <FolderOpen className="size-3.5 text-ink-subtle" aria-hidden="true" />
                          ) : (
                            <Github className="size-3.5 text-ink-subtle" aria-hidden="true" />
                          )}
                          {/* Name first. The path is what it is, one line down —
                              leading with it made this read as developer output
                              rather than as a product (`D-78`). */}
                          {displayName(repo.fullName, kind)}
                          {repo.defaultBranch && <Badge tone="neutral">{repo.defaultBranch}</Badge>}
                        </span>
                        {repo.description && (
                          <span className="mt-0.5 block truncate text-[11.5px] text-ink-subtle">
                            {repo.description}
                          </span>
                        )}
                        {kind === 'local' && (
                          <span className="mt-0.5 block truncate text-[11px] text-ink-subtle">
                            <Mono>{repo.fullName}</Mono>
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )
        }}
      </QueryState>

      {add.error instanceof Error && (
        <p role="alert" className="text-[11.5px] text-blocking">
          {add.error.message}
        </p>
      )}
      <Button variant="ghost" size="sm" onClick={onDone}>
        Cancel
      </Button>
    </div>
  )
}

function displayName(fullName: string, kind: 'local' | 'github'): string {
  if (kind !== 'local') return fullName
  return fullName.split('/').filter(Boolean).pop() || fullName
}
