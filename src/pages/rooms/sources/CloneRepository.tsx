/**
 * Copy a repository to this machine, then read the copy (`D-93`).
 *
 * The `+` menu carried this branch marked **Not yet** since `D-80`, honestly:
 * nothing in the estate ran `git clone`. It does now, and the branch is a real
 * one.
 *
 * **Two steps, shown as two.** Cloning puts bytes on disk; adding a source is a
 * separate act, and the panel says which one has happened. Folding them into one
 * button would make a failure ambiguous — a person could not tell whether the
 * copy exists.
 *
 * The picker is the shared one (`D-87`), filtered to GitHub, because *which
 * repository* is the same question here as everywhere else.
 */

import { useState } from 'react'
import { Check, GitBranch } from 'lucide-react'

import { Button, Mono } from '@/components/ui/primitives'
import { RepositoryPicker } from '@/components/project/RepositoryPicker'
import { useAddSource, useCloneRepository } from '@/hooks/useProject'

export function CloneRepository({ onDone }: { onDone: () => void }) {
  const [chosen, setChosen] = useState('')
  const clone = useCloneRepository()
  const add = useAddSource()

  const landed = clone.data?.location ?? ''

  if (landed) {
    return (
      <div className="space-y-3 rounded-md border border-line bg-surface p-4">
        <p className="flex items-start gap-2 text-body text-ink">
          <Check className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden="true" />
          <span>
            <Mono>{chosen}</Mono> is now on this machine, at <Mono>{landed}</Mono>.
          </span>
        </p>
        {/* What has *not* happened, said plainly. The copy exists; the project
            does not read it until somebody says so. */}
        <p className="text-caption text-ink-muted">
          Nothing has been read from it yet. Add it as a source to make it part of this project.
        </p>
        {add.isError ? (
          <p role="alert" className="text-caption text-ink-muted">
            The copy is on this machine, but it could not be added as a source.{' '}
            {String((add.error as Error)?.message ?? '')}
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button
            disabled={add.isPending || add.isSuccess}
            onClick={() =>
              add.mutate(
                { kind: 'local', connectionId: '', location: landed, reference: '' },
                { onSuccess: onDone },
              )
            }
          >
            {add.isPending ? 'Adding…' : 'Add it as a source'}
          </Button>
          <Button variant="ghost" onClick={onDone}>
            Leave it for now
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-md border border-line bg-surface p-4">
      <p className="flex items-start gap-2 text-body text-ink">
        <GitBranch className="mt-0.5 size-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
        <span>
          Choose a repository to copy here. KAE reads the copy from this machine, so it keeps
          working when GitHub does not.
        </span>
      </p>

      <RepositoryPicker
        kind="github"
        value={chosen}
        onSelect={(repo) => setChosen(repo.fullName)}
        label="Filter repositories to clone"
      />

      {clone.isError && (
        // git's own failures, already turned into a sentence with a remedy by
        // the backend. Repeating "exit status 128" here would undo that.
        <p role="alert" className="text-caption text-ink-muted">
          {String((clone.error as Error)?.message ?? 'The repository could not be copied.')}
        </p>
      )}

      <div className="flex gap-2">
        <Button disabled={!chosen || clone.isPending} onClick={() => clone.mutate(chosen)}>
          {clone.isPending ? 'Copying…' : 'Copy it here'}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
