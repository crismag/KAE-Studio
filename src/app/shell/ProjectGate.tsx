/**
 * Which project you are working on, chosen rather than guessed.
 *
 * Studio used to take `projects[0]` and show it as the whole product. On a
 * deployment holding eighteen projects that meant one of them was the entire
 * visible application, and because it happened to be the project three test
 * harnesses had written into, its contents read as unrelated things jumbled
 * together — which was reported, reasonably, as cross-project leakage.
 *
 * It was not. KAE-Memory's isolation is proven. The fault was here: a client
 * that never said which project it was showing, and never let anyone say
 * otherwise.
 *
 * **Only the preference lives in the browser.** The project itself, its
 * conversation, and its knowledge are Memory's. What `localStorage` holds is
 * one id — "the one I was last looking at" — which is a UI preference and
 * survives being wrong: if that project is gone, the picker comes back.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { STORAGE_KEY, readActiveProject } from './activeProjectStorage'
import { Field, Input, Textarea } from '@/components/ui/form'
import { Button, Panel, PanelBody } from '@/components/ui/primitives'

const API = (import.meta.env.VITE_STUDIO_API as string | undefined) ?? ''

export type ProjectSummary = {
  id: string
  name: string
  key?: string | null
  description?: string | null
  knowledgeRevision?: number
  status?: string
}

type Listing =
  | { state: 'loading' }
  | { state: 'unreachable'; detail: string }
  | { state: 'ready'; projects: ProjectSummary[] }

async function fetchProjects(): Promise<ProjectSummary[]> {
  const response = await fetch(`${API}/api/projects`, { credentials: 'include' })
  if (!response.ok) throw new Error(`projects unavailable (${response.status})`)
  const raw: unknown = await response.json()
  if (!Array.isArray(raw)) throw new Error('projects response was not a list')
  return raw.map((p) => {
    const row = p as Record<string, unknown>
    return {
      id: String(row.id ?? ''),
      name: String(row.name ?? 'Untitled'),
      key: (row.key as string | null) ?? null,
      description: (row.description ?? null) as string | null,
      status: typeof row.status === 'string' ? row.status : undefined,
      // EM-1. Absent against an older Memory, which is why it is optional
      // rather than defaulted to 0 — zero means "nobody has written to this",
      // and a default that also renders 0 would make the two indistinguishable.
      knowledgeRevision:
        typeof row.knowledge_revision === 'number' ? row.knowledge_revision : undefined,
    }
  })
}

function writeActiveProject(id: string | null): void {
  try {
    if (id === null) window.localStorage.removeItem(STORAGE_KEY)
    else window.localStorage.setItem(STORAGE_KEY, id)
  } catch {
    /* see readActiveProject */
  }
}

/**
 * Stands between sign-in and the application, and hands down a chosen project.
 *
 * `children` receives the id and a way to leave it. Nothing below this point
 * has to consider the possibility of no project, which is the whole reason the
 * gate is a component rather than a hook sprinkled through the routes.
 */
export function ProjectGate({
  children,
}: {
  children: (project: { id: string; onSwitch: () => void }) => ReactNode
}) {
  const [listing, setListing] = useState<Listing>({ state: 'loading' })
  const [active, setActive] = useState<string | null>(() => readActiveProject())
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const projects = await fetchProjects()
        if (!cancelled) setListing({ state: 'ready', projects })
      } catch (error) {
        if (!cancelled) setListing({ state: 'unreachable', detail: (error as Error).message })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [attempt])

  const choose = useCallback((id: string | null) => {
    writeActiveProject(id)
    setActive(id)
  }, [])

  if (listing.state === 'loading')
    return (
      <Centered>
        <p className="text-[13px] text-ink-muted">Loading your projects…</p>
      </Centered>
    )

  if (listing.state === 'unreachable') {
    return (
      <Centered>
        <Panel className="max-w-md text-left">
          <PanelBody className="space-y-2">
            <h1 className="text-[15px] font-semibold text-ink">Projects could not be loaded</h1>
            <p className="text-[13px] leading-relaxed text-ink-muted">
              Nothing was opened, so nothing on screen would be project truth. {listing.detail}
            </p>
            <Button
              type="button"
              onClick={() => {
                setListing({ state: 'loading' })
                setAttempt((n) => n + 1)
              }}
              className="mt-1"
            >
              Try again
            </Button>
          </PanelBody>
        </Panel>
      </Centered>
    )
  }

  // A remembered project that no longer exists is not an error worth a screen.
  // It happens whenever a project is removed elsewhere, and the honest response
  // is the picker with the stale preference forgotten.
  const remembered = active && listing.projects.some((p) => p.id === active) ? active : null
  if (active && !remembered) writeActiveProject(null)

  if (!remembered) {
    return (
      <Picker
        // Archived projects are hidden here rather than dropped from the state
        // above, and the difference matters: the membership check that recovers
        // a stale preference runs against the *full* list, so someone who
        // archived the project they were working in still opens it rather than
        // being told it no longer exists.
        //
        // Memory has no delete, deliberately — nothing is thrown away — so
        // cleanup is a status, and this list is where that status has to mean
        // something.
        projects={listing.projects.filter((p) => p.status !== 'archived')}
        onChoose={choose}
        onCreated={(project) => {
          // Added to the listing before it is chosen. The membership check
          // above is what makes a stale preference recoverable, and a
          // just-created project is absent from a listing fetched moments
          // earlier — so choosing it without this left the picker on screen
          // having silently discarded the choice, with the new project sitting
          // in the list behind it.
          // Deduplicated by id. Creating a project whose name is already taken
          // returns the *existing* one — Memory is idempotent by a key derived
          // from the name — so prepending unconditionally rendered the same
          // project twice, and a click became ambiguous.
          setListing({
            state: 'ready',
            projects: [project, ...listing.projects.filter((p) => p.id !== project.id)],
          })
          choose(project.id)
          // **A new project lands on Setup**, not on whatever route the person
          // happened to be looking at when they created it — usually a
          // dashboard describing a project with nothing in it (`D-85`).
          //
          // The hash, not `useNavigate`. This component **wraps**
          // `RouterProvider` — it decides which project before any route
          // renders — so it is outside the router by construction and
          // `useNavigate()` throws *"may be used only in the context of a
          // <Router>"*, blanking the whole application. The app uses
          // `createHashRouter`, so the hash is the route (`D-86`).
          //
          // Only on creation. Choosing an existing project leaves the route
          // alone, because somebody who deep-linked to a Room meant to go
          // there.
          window.location.hash = '#/setup'
        }}
      />
    )
  }

  return <>{children({ id: remembered, onSwitch: () => choose(null) })}</>
}

function Picker({
  projects,
  onChoose,
  onCreated,
}: {
  projects: ProjectSummary[]
  onChoose: (id: string) => void
  onCreated: (project: ProjectSummary) => void
}) {
  const [name, setName] = useState('')
  const [context, setContext] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function create(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`${API}/api/projects`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (!response.ok) throw new Error(`could not create the project (${response.status})`)
      const created = (await response.json()) as { id?: string; name?: string }
      if (!created.id) throw new Error('the project was created without an id')

      // The opening sentence goes as an ordinary first message, through the
      // same path any other message takes. Writing it as knowledge directly
      // would make Studio the author of a project's first fact.
      //
      // **Not awaited.** A turn goes to a model, which takes seconds and
      // sometimes tens of them, and blocking creation on it means staring at a
      // disabled button while a project that already exists refuses to open.
      // The reply arrives in the workspace, which is where a reply belongs.
      if (context.trim()) {
        void fetch(`${API}/api/projects/${created.id}/turn`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: context.trim() }),
        }).catch(() => {
          /* The project exists either way. A failed opening turn is a
             conversation that has not started, not a creation that failed. */
        })
      }
      onCreated({ id: created.id, name: created.name ?? name.trim(), knowledgeRevision: 0 })
    } catch (failure) {
      setError((failure as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto grid min-h-screen max-w-2xl content-start gap-8 px-6 py-16">
      <header>
        <h1 className="text-xl text-ink">Choose a project</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Everything you see afterwards belongs to the one you pick. You can switch at any time.
        </p>
      </header>

      <section aria-labelledby="existing">
        <h2 id="existing" className="mb-2 text-xs uppercase tracking-wide text-ink-subtle">
          {projects.length ? `${projects.length} projects` : 'No projects yet'}
        </h2>

        {projects.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Nothing is wrong — this deployment simply has no projects. Start one below.
          </p>
        ) : (
          <ul className="grid gap-1.5">
            {projects.map((project) => (
              <li key={project.id}>
                <button
                  type="button"
                  onClick={() => onChoose(project.id)}
                  className="flex w-full items-baseline justify-between gap-4 rounded-md border border-line bg-surface px-3 py-2 text-left transition-colors hover:bg-surface-sunken"
                >
                  <span className="text-[13px] text-ink">{project.name}</span>
                  <span className="shrink-0 font-mono text-[11px] text-ink-subtle">
                    {project.knowledgeRevision === undefined
                      ? ''
                      : project.knowledgeRevision === 0
                        ? 'nothing recorded yet'
                        : `revision ${project.knowledgeRevision}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form onSubmit={create} className="grid gap-2" aria-labelledby="new-project">
        <h2 id="new-project" className="text-xs uppercase tracking-wide text-ink-subtle">
          Start a new one
        </h2>
        <Field label="Project name" error={error}>
          {(props) => (
            <Input
              {...props}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Reporting platform"
            />
          )}
        </Field>
        <Field
          label="One sentence about it"
          hint="Optional. A name is enough — unknowns are expected, and nothing here has to be decided before you start."
        >
          {(props) => (
            <Textarea
              {...props}
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={3}
              placeholder="You can leave this empty."
            />
          )}
        </Field>
        <Button
          type="submit"
          variant="primary"
          disabled={!name.trim() || busy}
          className="justify-self-start"
        >
          {busy ? 'Creating…' : 'Create project'}
        </Button>
      </form>
    </div>
  )
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div>{children}</div>
    </div>
  )
}
