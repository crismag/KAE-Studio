import * as React from 'react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'
import {
  Activity,
  LayoutDashboard,
  Settings2,
  FileInput,
  FolderGit2,
  SlidersHorizontal,
  Boxes,
  ClipboardList,
  Database,
  FileOutput,
  GitBranch,
  LayoutGrid,
  ListChecks,
  Menu,
  MessagesSquare,
  PanelsTopLeft,
  ScanSearch,
  ChevronRight,
  X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { Badge, Button } from '@/components/ui/primitives'
import { useActiveProject } from '@/app/shell/activeProject'
import { useDeploymentStatus } from '@/app/shell/useDeploymentStatus'
import { useProject, useProjection } from '@/hooks/useProject'
import { SURFACES, surfacesInGroup } from '@/app/registries/rooms'
import { useServices } from '@/hooks/useServices'
import { projectCounts } from '@/lib/counts'

interface NavItem {
  to: string
  label: string
  icon: typeof MessagesSquare
}

/**
 * Icons per surface id, and nothing else.
 *
 * The label, the path and the order come from the registry, so a rename or a
 * route move is one edit rather than three. Only the icon lives here — it is a
 * presentation choice the registry has no business holding.
 */
const ICONS: Record<string, NavItem['icon']> = {
  dashboard: LayoutDashboard,
  setup: SlidersHorizontal,
  interview: MessagesSquare,
  sources: FolderGit2,
  ingestion: FileInput,
  definition: ClipboardList,
  modules: Boxes,
  requirements: ListChecks,
  architecture: PanelsTopLeft,
  dependencies: GitBranch,
  planning: LayoutGrid,
  deliverables: FileOutput,
  review: ScanSearch,
  'project-settings': Settings2,
  memory: Database,
  diagnostics: Activity,
}

const NAV: NavItem[] = SURFACES.map((surface) => ({
  to: surface.route,
  label: surface.title,
  icon: ICONS[surface.id] ?? Database,
}))

function navItems(group: Parameters<typeof surfacesInGroup>[0]): NavItem[] {
  return surfacesInGroup(group).map((surface) => ({
    to: surface.route,
    label: surface.title,
    icon: ICONS[surface.id] ?? Database,
  }))
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { data: projection } = useProjection()
  // How many need a person, not how many exist.
  //
  // R13. This counted every finding, so a first project showed `Reviews 81` —
  // which reads as "KAE has found 81 things wrong with your idea" and is the
  // customer's original problem restated in the product's own words. A badge
  // that cannot be driven to zero is decoration; one that can is a queue.
  //
  // Critical only. Major and minor are real and stay on the page; what they are
  // not is a reason to interrupt someone who has just described their idea.
  //
  // **AUD-012 was here, and was fixed upstream.** This rule is right; what was
  // wrong is that the live adapter graded every material unknown `major`, so
  // `critical` was unreachable and the badge could never appear. Severity now
  // means the same thing on both adapters, and the rule stands unchanged.
  const needsAttention = projection ? projectCounts(projection).criticalAwaitingDecision : 0

  const renderItem = (item: NavItem) => {
    const Icon = item.icon
    const showCount = item.to === '/reviews' && needsAttention > 0
    return (
      <NavLink
        key={item.to}
        to={item.to}
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(
            'group flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] transition-colors',
            isActive
              ? 'bg-accent-soft font-medium text-accent-ink'
              : 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
          )
        }
      >
        {({ isActive }) => (
          <>
            <Icon
              className={cn('size-4 shrink-0', isActive ? 'text-accent' : 'text-ink-subtle')}
              aria-hidden="true"
            />
            <span className="truncate">{item.label}</span>
            {showCount && (
              <span
                className="ml-auto shrink-0 rounded bg-attention-soft px-1.5 py-px text-[11px] font-medium text-attention"
                // **The noun, on screen and not only to a screen reader**
                // (`NAV-01`). A bare `59` beside "Reviews" was ambiguous to
                // anyone not looking and to most who were: 59 findings? 59
                // items? 59 things wrong with the idea? The word is three
                // characters and removes the guess.
                aria-label={`${needsAttention} critical, needing review`}
              >
                {needsAttention} critical
              </span>
            )}
          </>
        )}
      </NavLink>
    )
  }

  return (
    <nav aria-label="Project sections" className="flex flex-col gap-0.5 px-2">
      {navItems('primary').map(renderItem)}
      {/* **Open-able, never hidden** (`NAV-01`). Fourteen equal entries gave a
          reader no way to tell which are the product; deleting ten would take
          away pages that answer real questions. A section that opens does
          neither. */}
      <Section label="Understanding" hint="What the project knows, and why">
        {navItems('understanding').map(renderItem)}
      </Section>
      <Section label="Settings" hint="How this project is set up">
        {navItems('settings').map(renderItem)}
      </Section>
    </nav>
  )
}

/**
 * A named group of destinations, closed until somebody wants it.
 *
 * `<details>` rather than state: it is keyboard-operable, screen readers
 * announce it as expandable, and a deep link into a page inside it still works
 * whether or not the section has been opened — which a conditionally rendered
 * list would not guarantee.
 */
function Section({
  label,
  hint,
  children,
}: {
  label: string
  hint: string
  children: React.ReactNode
}) {
  const location = useLocation()
  const routes = React.Children.toArray(children)
  // Open when the reader is already inside it. Landing on a page whose section
  // is shut reads as "this page is not in the menu".
  const inside = routes.some(
    (child) =>
      React.isValidElement<{ to?: string }>(child) &&
      typeof child.props.to === 'string' &&
      location.pathname.startsWith(child.props.to),
  )

  return (
    <details open={inside} className="group/section mt-1.5">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md px-2.5 py-[7px] text-[11px] font-semibold uppercase tracking-wider text-ink-subtle hover:text-ink-muted">
        <ChevronRight
          className="size-3 shrink-0 transition-transform group-open/section:rotate-90"
          aria-hidden="true"
        />
        {label}
        <span className="sr-only"> — {hint}</span>
      </summary>
      <div className="flex flex-col gap-0.5 pt-0.5">{children}</div>
    </details>
  )
}

function ProjectCard() {
  const { data: project } = useProject()
  return (
    <div className="mx-2 rounded-md border border-line bg-surface-sunken/70 px-3 py-2.5">
      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-subtle">
        Current project
      </p>
      <p className="mt-1 text-[13px] font-medium leading-snug text-ink">
        {project?.name ?? 'Loading…'}
      </p>
      <p className="mt-1.5 text-[11.5px] text-ink-muted">{project?.phase ?? ''}</p>
      <SwitchProject />
    </div>
  )
}

/**
 * Only rendered where switching means something.
 *
 * `useActiveProject()` is null against the mocks, which answer for one fixture.
 * A control that cannot do anything is worse than an absent one: it invites a
 * click and teaches that the button is broken.
 */
function SwitchProject() {
  const active = useActiveProject()
  if (!active) return null

  return (
    <button
      type="button"
      onClick={active.onSwitch}
      className="mt-2 text-[11.5px] text-accent-ink underline-offset-2 hover:underline"
    >
      Switch project
    </button>
  )
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-4 py-4">
      <div className="flex items-center gap-2 px-4">
        <div
          className="grid size-7 place-items-center rounded bg-accent text-[12px] font-bold text-white"
          aria-hidden="true"
        >
          K
        </div>
        <span className="text-[14px] font-semibold tracking-tight text-ink">KAE-Studio</span>
      </div>
      <ProjectCard />
      <div className="min-h-0 flex-1 overflow-y-auto kae-scrollbar">
        <NavList onNavigate={onNavigate} />
      </div>
      {/* Settings was a button with no handler and nothing behind it. Removed
          rather than disabled: there is no settings surface to reach, so a
          greyed-out control would promise one that does not exist. What it
          looked like it should show — which Memory, which interviewer, whether
          sign-in is on — is in the status bar, where it is read rather than
          hunted for. It comes back when there is something to configure. */}
    </div>
  )
}

/**
 * What this deployment is, reported rather than asserted.
 *
 * Every claim here used to be a literal. See `useDeploymentStatus` for what
 * that cost. The rule this follows: **no indicator may have only one possible
 * value.** If a label cannot render a failure it does not belong in a status
 * bar.
 */
function StatusBar() {
  const { data: project } = useProject()
  const { interview } = useServices()
  const deployment = useDeploymentStatus()
  const mocked = interview.describe().mode === 'mock'

  const status = deployment.state === 'ready' ? deployment.status : undefined

  return (
    <div className="flex items-center gap-x-4 gap-y-1 overflow-x-auto border-t border-line bg-surface px-4 py-1.5 text-[11.5px] text-ink-muted kae-scrollbar">
      {mocked && <Badge tone="attention">Fixtures — nothing here is a real project</Badge>}

      {/* Open access is the loudest thing this bar can say, so it says it
          first. A deployment anyone can reach and write to should never be a
          fact you have to go and look up. */}
      {status?.authentication === 'disabled' && (
        <Badge tone="attention">Sign-in disabled — anyone can reach this</Badge>
      )}

      <span className="hidden md:inline">
        Memory:{' '}
        {deployment.state === 'checking' ? (
          <span className="text-ink">checking…</span>
        ) : deployment.state === 'unavailable' ? (
          <span className="text-blocking">Studio unreachable</span>
        ) : status?.memoryReachable ? (
          <span className="text-ink">
            reachable
            {status.migrationRevision ? ` · schema ${status.migrationRevision}` : ''}
          </span>
        ) : (
          <span className="text-blocking">not reachable</span>
        )}
      </span>

      {!mocked && status?.interviewProvider && (
        <span className="hidden lg:inline">
          Interviewer: <span className="text-ink">{status.interviewProvider}</span>
        </span>
      )}

      {/* Absent rather than zero when Memory does not report it. A dash asks a
          question; a fabricated 0 answers one wrongly, which is what the old
          bar did for as long as it existed. */}
      <span className="ml-auto whitespace-nowrap font-mono text-[11px]">
        {project?.memoryRevision === undefined
          ? 'revision unreported'
          : `revision ${project.memoryRevision}`}
      </span>
    </div>
  )
}

export function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const location = useLocation()
  const current = NAV.find((n) => location.pathname.startsWith(n.to))

  return (
    <div className="flex h-full flex-col bg-canvas">
      <div className="flex min-h-0 flex-1">
        {/* Desktop rail */}
        <aside className="hidden w-[232px] shrink-0 border-r border-line bg-surface lg:block">
          <SidebarContent />
        </aside>

        {/* Mobile navigation sheet */}
        <Dialog.Root open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/25 lg:hidden" />
            <Dialog.Content
              className="fixed inset-y-0 left-0 z-50 w-[264px] border-r border-line bg-surface shadow-raised outline-none lg:hidden"
              aria-describedby={undefined}
            >
              <Dialog.Title className="sr-only">Project navigation</Dialog.Title>
              <div className="relative h-full">
                <Dialog.Close asChild>
                  <Button variant="ghost" size="icon" className="absolute right-2 top-3.5">
                    <X className="size-4" aria-hidden="true" />
                    <span className="sr-only">Close navigation</span>
                  </Button>
                </Dialog.Close>
                <SidebarContent onNavigate={() => setMobileNavOpen(false)} />
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile header */}
          <header className="flex items-center gap-3 border-b border-line bg-surface px-3 py-2 lg:hidden">
            <Button variant="ghost" size="icon" onClick={() => setMobileNavOpen(true)}>
              <Menu className="size-4" aria-hidden="true" />
              <span className="sr-only">Open navigation</span>
            </Button>
            <span className="text-[13px] font-medium text-ink">
              {current?.label ?? 'KAE-Studio'}
            </span>
          </header>

          <main className="min-h-0 flex-1 overflow-hidden">
            <Outlet />
          </main>
        </div>
      </div>
      <StatusBar />
    </div>
  )
}
