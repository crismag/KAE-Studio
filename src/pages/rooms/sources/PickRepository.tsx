/**
 * Choosing the repository a project reads from — the one place it happens.
 *
 * `/setup` had a picker and Sources had none, so the `+` menu offered *a folder
 * on this machine* and then rendered nothing (`D-81`). Selection lives here and
 * Setup shows a summary.
 *
 * **The widget is `components/project/RepositoryPicker`** (`D-87`). This file is
 * what a choice *means* in Sources, which is the part that differs by caller —
 * and folding it into the widget is what made two pickers diverge.
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

import { Badge, Button } from '@/components/ui/primitives'
import { RepositoryPicker, type PickedRepository } from '@/components/project/RepositoryPicker'
import { useAddSource, useConfigureField, useSetup } from '@/hooks/useProject'

export function PickRepository({ kind, onDone }: { kind: 'local' | 'github'; onDone: () => void }) {
  const add = useAddSource()
  const configure = useConfigureField()
  const setup = useSetup()

  const branchSet = Boolean(setup.data?.configuration.primary_branch?.value)

  function choose(repo: PickedRepository) {
    add.mutate({
      kind,
      connectionId: '',
      location: repo.fullName,
      reference: repo.defaultBranch || '',
    })
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
      <RepositoryPicker kind={kind} onSelect={choose} />
      {/* What choosing *means*, which is the caller's to say. The shared widget
          cannot: the same control picks a publication destination one page
          over, where "records where KAE reads from" would be false (`D-87`). */}
      <p className="flex items-center gap-1.5 text-caption text-ink-subtle">
        <Badge tone="neutral">Selection</Badge>
        Choosing a repository records where KAE reads from. It reads nothing until you ask it to.
      </p>
      {add.error instanceof Error && (
        <p role="alert" className="text-caption text-blocking">
          {add.error.message}
        </p>
      )}
      <Button variant="ghost" size="sm" onClick={onDone}>
        Cancel
      </Button>
    </div>
  )
}
