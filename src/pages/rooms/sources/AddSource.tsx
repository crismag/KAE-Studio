/**
 * The `+` a project grows its sources through (`D-80`).
 *
 * The owner's correction: a project **accumulates** places it reads from, so the
 * model is a list you add to, not a long list you pick one from. What differs
 * between entries is where the thing lives — and there are five cases, of which
 * three work today.
 *
 * The two that do not are **drawn anyway, and marked**. A menu that silently
 * omits the thing somebody came to do teaches them the product cannot do it;
 * one that shows it and says what it needs teaches them what is missing. Each
 * states its prerequisite **when reached for**, never as a paragraph above the
 * menu — `D-78`'s line between honest and demoralising.
 */

import { useState } from 'react'
import { FolderOpen, Github, FilePlus2, GitBranch, Plus } from 'lucide-react'

import { Badge } from '@/components/ui/primitives'
import { Button } from '@/components/ui/primitives'

export type Branch = 'folder' | 'github' | 'clone' | 'create' | 'paste'

interface Option {
  id: Branch
  icon: typeof FolderOpen
  title: string
  /** What it is, in the words a person would use for it. */
  means: string
  /** Empty when the branch works. A sentence when it does not, and why. */
  needs: string
}

/**
 * `needs` is computed from what the deployment actually has, never hardcoded —
 * the GitHub row is ready or not depending on a connection, and saying so wrongly
 * is the defect this codebase keeps finding.
 */
export function options({
  localRoots,
  connected,
  githubCount = 0,
}: {
  localRoots: number
  connected: boolean
  /** How many GitHub repositories KAE can actually see right now. */
  githubCount?: number
}): Option[] {
  return [
    {
      id: 'folder',
      icon: FolderOpen,
      title: 'A folder on this machine',
      means: localRoots
        ? `${localRoots} available · nothing to connect, nothing to download`
        : 'A directory KAE can read directly',
      needs: localRoots
        ? ''
        : 'This deployment reads no local directories. An operator sets KAE_LOCAL_SOURCE_ROOTS to the folders KAE may read.',
    },
    {
      id: 'github',
      icon: Github,
      title: 'A repository on GitHub',
      means: connected
        ? githubCount > 0
          ? `${githubCount} available from your connected account`
          : 'An account is connected, and KAE can see no repositories through it'
        : 'From a connected account',
      // **Three states, not two** (`D-89`). Connected-with-nothing-visible is
      // this Studio's access, not a missing connect step — and telling that
      // person to *connect an account* sends them to do again the thing they
      // already did.
      needs: !connected
        ? 'No GitHub account is connected yet. Connect one in Settings first.'
        : githubCount === 0
          ? 'KAE cannot see any GitHub repositories through this Studio’s access. Folders on this machine still work. Open GitHub in Settings to see why.'
          : '',
    },
    {
      id: 'clone',
      icon: GitBranch,
      title: 'Clone a repository here first',
      means: 'Copies it to this machine, then reads the copy',
      // Real since `D-93`, and its prerequisites are the union of the two
      // branches it spans: something to copy *from*, somewhere to copy *to*.
      // Stating one when both are missing sends somebody to fix half of it.
      needs: !connected
        ? 'No GitHub account is connected yet, so there is nothing to copy from. Connect one in Settings first.'
        : !localRoots
          ? 'This deployment writes no local directories, so there is nowhere to put the copy. An operator sets KAE_LOCAL_SOURCE_ROOTS.'
          : '',
    },
    {
      id: 'create',
      icon: FilePlus2,
      title: 'Create a new repository',
      means: 'On GitHub, then use it here',
      needs:
        'KAE cannot create a repository yet. It would need permission to write to your GitHub account, which is a wider grant than reading and has not been decided.',
    },
    {
      id: 'paste',
      icon: FilePlus2,
      title: 'Paste a document',
      means: 'Text works now · PDF and DOCX are not decoded yet',
      needs: '',
    },
  ]
}

export function AddSource({
  localRoots,
  connected,
  githubCount = 0,
  chosen,
  onChoose,
}: {
  localRoots: number
  connected: boolean
  githubCount?: number
  /** The branch the caller is currently showing, if any. */
  chosen?: Branch | null
  onChoose: (branch: Branch) => void
}) {
  const [open, setOpen] = useState(false)
  const [reached, setReached] = useState<Branch | null>(null)
  const list = options({ localRoots, connected, githubCount })

  // **The menu yields to the picker** (`D-89`). It stayed open above the list,
  // so a person saw a kind menu, a repository list and *two* Cancel buttons —
  // and could pick a second kind while a picker for the first was on screen.
  if (chosen) return null

  if (!open) {
    return (
      <Button className="w-full" onClick={() => setOpen(true)}>
        <Plus className="size-3.5" aria-hidden="true" />
        Add a source
      </Button>
    )
  }

  return (
    <div className="space-y-1.5 rounded-md border border-line bg-surface-sunken p-2">
      <p className="px-1.5 pb-1 text-[11.5px] font-medium uppercase tracking-wide text-ink-subtle">
        Add a source
      </p>
      {list.map((option) => {
        const Icon = option.icon
        const blocked = Boolean(option.needs)
        return (
          <div key={option.id}>
            <button
              type="button"
              onClick={() => (blocked ? setReached(option.id) : onChoose(option.id))}
              aria-expanded={blocked ? reached === option.id : undefined}
              className="flex w-full items-start gap-2.5 rounded-md border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:bg-surface-sunken"
            >
              <Icon className="mt-0.5 size-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-[12.5px] font-medium text-ink">
                  {option.title}
                  {blocked && <Badge tone="neutral">Not yet</Badge>}
                </span>
                <span className="mt-0.5 block text-[11.5px] text-ink-subtle">{option.means}</span>
              </span>
            </button>
            {/* Only once somebody reaches for it. The whole point of `D-78`:
                the explanation is available, and it is not the first thing on
                the screen. */}
            {blocked && reached === option.id && (
              <p
                role="status"
                className="mx-1 mt-1 rounded-md border border-line bg-surface px-3 py-2 text-[11.5px] leading-relaxed text-ink-muted"
              >
                {option.needs}
              </p>
            )}
          </div>
        )
      })}
      <Button variant="ghost" size="sm" className="w-full" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  )
}
