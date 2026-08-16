/**
 * The Dashboard — project home, and the surface Studio has never had.
 *
 * `§3`: it answers *where am I, what changed, what is blocked, what should I do
 * next* — and **summarises work without containing every work surface.**
 * Landing on `/workspace` made the conversation the home, which is one way of
 * working presented as the only one.
 *
 * ## What makes this a walking skeleton rather than a dashboard
 *
 * Stage 3 asks for *"the smallest truthful Dashboard"* and is explicit about the
 * limit: **"Do not invent readiness, tasks, room status, or recent changes if
 * the backing contract does not exist. Document missing contracts first."**
 *
 * So every number here comes from the projection that already backs nine
 * routes, and three things the package's §3 hierarchy asks for are **absent
 * rather than faked**:
 *
 * - **Recent changes** — `recentChanges` is `[]` in the live adapter and
 *   nothing in Memory produces a change feed (`AUD-038`). A panel would be
 *   permanently empty, which reads as *"nothing has happened"*.
 * - **A work-item model** — `§4` wants actions carrying objective, evidence,
 *   destination and completion rule. Stage 6 builds it. Until then the ranked
 *   action is `floorAction`, which is derived rather than invented, and says so.
 * - **Per-Room attention counts** — needs the same work model. What is shown
 *   instead is each surface's *capability* readiness, which is a fact the
 *   registry holds.
 *
 * ## The denominator rule
 *
 * `§3`: *"Avoid ambiguous global percentages when dimensions differ. Prefer
 * `7 of 10 planning areas have sufficient evidence` to `70% complete`."*
 * `ADR-0003` reached the same conclusion for Project Setup a week earlier, so
 * this reuses the rule rather than inventing a second one.
 */

import { ArrowRight, CircleDot, Clock, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Blockers } from './Blockers'
import { openBlockers } from '@/components/project/openBlockers'
import { NextAction } from '@/components/project/NextAction'
import { PageLayout } from '@/components/project/PageLayout'
import { floorAction } from '@/components/project/nextActionFloor'
import { SectionsNotRead } from '@/components/project/SectionsNotRead'
import {
  Badge,
  Button,
  Mono,
  Panel,
  PanelBody,
  PanelHeader,
  PanelTitle,
  Skeleton,
} from '@/components/ui/primitives'
import { QueryState } from '@/components/ui/QueryState'
import { SURFACES, surfacesInGroup, type SurfaceDefinition } from '@/app/registries/rooms'
import { useAttention, useProjection } from '@/hooks/useProject'
import { projectCounts } from '@/lib/counts'
import type { AttentionItem, ProjectProjection } from '@/domain/types'
import type { UseQueryResult } from '@tanstack/react-query'

export function Dashboard() {
  const projection = useProjection()
  // A second read of a second layer (`D-158`). `NeedsYou`'s first row is what
  // synthesis decided is worth a person's time, and that is not in the
  // projection — the projection carries evidence counts, which is the thing
  // doc 17 says must stop being presented as work.
  const attention = useAttention()

  return (
    <PageLayout
      title="Project home"
      lead="Where this project stands, what needs you, and where to go next. Everything here is read from the project’s own record — nothing on this page is a second source of truth."
      wide
    >
      <QueryState
        query={projection}
        of="This project"
        skeleton={
          <div className="space-y-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-48" />
          </div>
        }
      >
        {(data) => (
          <div className="space-y-5">
            <SectionsNotRead unavailable={data.unavailable} />
            <Journey projection={data} />
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="space-y-5">
                {/* Above "Needs you" deliberately. A blocker is a gap
                    somebody owns and a critical one already stops generation,
                    so it outranks a queue of things to look at (`D-29`). */}
                <Blockers blockers={data.blockers} />
                <NeedsYou projection={data} attention={attention} />
                <WhereWorkHappens />
              </div>
              <div className="space-y-5">
                <NextAction action={floorAction(data)} derived />
                <Coverage projection={data} />
              </div>
            </div>
          </div>
        )}
      </QueryState>
    </PageLayout>
  )
}

/**
 * Where the project is, as a stage flow rather than a percentage.
 *
 * `§3`'s example is a journey with an active marker, and the honest version of
 * that is the phase Memory already reports. **The stages are not invented
 * here** — they are the seven in `01_PRODUCT_OPERATING_MODEL.md`, which
 * remains a correct description of what a project goes through even though the
 * package governs how Studio is organised (`D-2`).
 */
const JOURNEY = [
  { key: 'setup', label: 'Setup' },
  { key: 'discovering', label: 'Discovery' },
  { key: 'defining', label: 'Definition' },
  { key: 'requirements', label: 'Requirements' },
  { key: 'architecture', label: 'Architecture' },
  { key: 'planning', label: 'Plan' },
  { key: 'packaging', label: 'Package' },
]

function Journey({ projection }: { projection: ProjectProjection }) {
  const phase = projection.health.stage
  const activeIndex = JOURNEY.findIndex((stage) => stage.key === phase)

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Current journey</PanelTitle>
        <Mono>{phase}</Mono>
      </PanelHeader>
      <PanelBody>
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
          {JOURNEY.map((stage, index) => {
            const active = index === activeIndex
            // Everything after the active stage is *not yet*, and everything
            // before it is *passed* — but only when the phase is recognised.
            // An unknown phase marks nothing rather than guessing a position.
            const passed = activeIndex >= 0 && index < activeIndex
            return (
              <li key={stage.key} className="flex items-center gap-1.5">
                <span
                  aria-current={active ? 'step' : undefined}
                  className={`rounded px-2 py-1 text-[12px] ${
                    active
                      ? 'bg-accent-soft font-medium text-accent-ink'
                      : passed
                        ? 'text-ink-muted'
                        : 'text-ink-subtle'
                  }`}
                >
                  {stage.label}
                </span>
                {index < JOURNEY.length - 1 && (
                  <ArrowRight className="size-3 text-ink-subtle" aria-hidden="true" />
                )}
              </li>
            )
          })}
        </ol>
        {activeIndex < 0 && (
          // The phase Memory reports is not one this list knows. Saying so beats
          // marking the first stage and being quietly wrong about where a
          // project is.
          <p className="mt-2 text-[11.5px] text-ink-muted">
            This project reports a stage this view does not recognise, so none is marked.
          </p>
        )}
      </PanelBody>
    </Panel>
  )
}

/**
 * What needs a person, counted from things that exist.
 *
 * `§3`: *"Every alert or recommendation must link to the correct Room."* Each
 * row is a real count with a destination, and a row with a count of zero is not
 * rendered — a permanent list of zeroes is the *"Reviews 81"* problem inverted.
 *
 * The first row is the **attention queue**, and the rest are counts of evidence
 * (`D-158`). Doc 17 rules that a raw extraction count must not be presented as
 * human work, and *"N proposed statements awaiting your decision"* at the top of
 * the project's home page was that sentence. It is still here, one row lower,
 * because `/reviews` is transitional under `OD-SYN-3` and this is the
 * Dashboard's only pointer to it.
 */
function NeedsYou({
  projection,
  attention,
}: {
  projection: ProjectProjection
  attention: UseQueryResult<AttentionItem[]>
}) {
  // From `projectCounts`, never recomputed here (`D-96`). Two pages counting
  // the same thing their own way is how "174 proposed statements" came to sit
  // beside a tab strip totalling 180.
  const counts = projectCounts(projection)
  const proposed = counts.awaitingDecision
  // Postponed items are excluded, not counted (`D-158`). The hook asks for both
  // compartments because the Room draws both; a Dashboard row that counted what
  // somebody deferred would make Defer a gesture that changes nothing on the
  // surface they look at first.
  const matters = attention.data?.filter((item) => item.status !== 'deferred').length
  const decisions = counts.openDecisions
  const contradictions = counts.unresolvedContradictions
  const lost = projection.extractionCoverage && !projection.extractionCoverage.complete
  // What is outstanding on this page but held by another panel. Only critical
  // review findings: every project of any size has minor ones, and a "needs
  // you" panel that is never empty is one nobody reads — which would destroy
  // the signal this exists to protect.
  const elsewhere = openBlockers(projection.blockers).length + counts.criticalReviewFindings

  const items = [
    // First by construction, and the panel renders the first row prominently —
    // so this position is the panel saying which of the two below it is work
    // (`D-158`). Doc 17's replacement sentence for the row beneath it.
    matters !== undefined &&
      matters > 0 && {
        text: `${matters} matter${matters === 1 ? '' : 's'} need${matters === 1 ? 's' : ''} your judgment`,
        to: '/attention',
        verb: 'See them',
        tone: 'accent' as const,
      },
    proposed > 0 && {
      text: `${proposed} proposed statement${proposed === 1 ? '' : 's'} awaiting your decision`,
      to: '/reviews',
      verb: 'Review them',
      tone: 'accent' as const,
    },
    decisions > 0 && {
      text: `${decisions} open decision${decisions === 1 ? '' : 's'}`,
      to: '/workspace',
      verb: 'Decide them',
      tone: 'attention' as const,
    },
    contradictions > 0 && {
      text: `${contradictions} unresolved contradiction${contradictions === 1 ? '' : 's'}`,
      to: '/reviews',
      verb: 'Resolve them',
      tone: 'blocking' as const,
    },
    lost && {
      text: 'Part of what you gave KAE was never read',
      to: '/ingestion',
      verb: 'See what',
      tone: 'attention' as const,
    },
  ].filter(Boolean) as {
    text: string
    to: string
    verb: string
    tone: 'accent' | 'attention' | 'blocking'
  }[]

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Needs you</PanelTitle>
        {items.length > 0 && <Badge tone="neutral">{items.length}</Badge>}
      </PanelHeader>
      <PanelBody>
        {/* Unknown is not zero (`D-158`). The panel's first row is now a second
            query, so every sentence below that says nothing is waiting is a
            claim about a queue this render may not have read. `D-38` is the same
            defect one panel earlier: a hedge that blamed KAE's perception for a
            gap KAE was displaying. */}
        {/* Alongside the rows rather than instead of them: the rows that did
            resolve are still true, and hiding them would remove information to
            report the absence of other information. */}
        {matters === undefined && (
          <p className="mb-2.5 text-[12.5px] text-ink-muted">
            {attention.isError
              ? 'What needs your judgment could not be read, so this list is incomplete.'
              : 'Still reading what needs your judgment.'}
          </p>
        )}
        {matters !== undefined && items.length === 0 ? (
          // Deliberately not "all clear". Nothing is waiting *that KAE can
          // see*, which is a narrower claim and the only one that is true —
          // three of the five review groups are not computed at all.
          //
          // And not even that when something else on this page is waiting.
          // `NeedsYou` counts attention, proposals, decisions, contradictions
          // and unread content; blockers and review findings arrived later and were not
          // added, so a project whose only outstanding item was a critical
          // blocker read "nothing is waiting on you" three inches beneath the
          // blocker (`D-38`). The careful hedge made it worse: it blamed KAE's
          // perception for a gap KAE was displaying.
          //
          // Pointed at rather than repeated — `§13`, and `D-37` was two lists
          // of one thing on one page coming to disagree.
          elsewhere > 0 ? (
            <p className="text-[12.5px] text-ink-muted">
              Nothing here needs a decision from you. The {elsewhere === 1 ? 'item' : 'items'} above{' '}
              {elsewhere === 1 ? 'is' : 'are'} waiting on somebody.
            </p>
          ) : (
            <p className="text-[12.5px] text-ink-muted">
              Nothing is waiting on you that KAE can currently detect.
            </p>
          )
        ) : items.length === 0 ? null : (
          /* **One of these is first** (`NAV-01` N5). Three rows of equal weight
             ask a person to rank their own work on the page that exists to
             answer *what now* — and the ordering that decides which is first is
             already here, in the order the rows are built. */
          <ul className="space-y-2">
            {items.map((item, index) => (
              <li key={item.to + item.text}>
                <Link
                  to={item.to}
                  className={
                    index === 0
                      ? 'flex items-center gap-2.5 rounded-md border border-accent-line bg-accent-soft px-3.5 py-3 text-[13px] font-medium text-ink transition-colors hover:bg-accent-soft/70'
                      : 'flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-[12.5px] text-ink transition-colors hover:bg-surface-sunken'
                  }
                >
                  <TriangleAlert
                    className={`size-3.5 shrink-0 ${
                      item.tone === 'blocking' ? 'text-blocking' : 'text-attention'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">{item.text}</span>
                  {/* The verb, on the one row that is first. The rest are a
                      list; this is what to do next. */}
                  {index === 0 && (
                    <span className="shrink-0 text-[12px] text-accent-ink">{item.verb}</span>
                  )}
                  <ArrowRight className="size-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PanelBody>
    </Panel>
  )
}

/**
 * Launchers with **truthful availability** — `§13`.
 *
 * The readiness comes from the registry, so a surface that is waiting on a
 * capability says what it is waiting for *before* somebody clicks it. That is
 * the difference between a considered product and a dead end with good
 * typography.
 *
 * ## Why this is not `ROOMS` any more (`HOME-ROOMS`)
 *
 * Doc 14 invariant 3: *"The Rooms grid must not duplicate the application
 * navigation without adding project-state value."* It listed the six surfaces
 * whose `kind` is `room`, and `NAV-01` then grouped the sidebar by whether a
 * surface can be **operated** — which moved Definition, Architecture and Plan
 * into Understanding. Home went on offering all six with equal weight, so the
 * two devices a first-time reader uses to learn how big this product is
 * disagreed about it, and the page that exists to answer *where do I go*
 * answered with three places where nothing can be done.
 *
 * `group`, not `kind`. `kind` says what a surface *is* — Architecture is a Room
 * by intent — and `group` says whether work happens there, which is the only
 * question a launcher grid is asking. Deliverables is `kind: 'surface'` and is
 * one of the four places somebody acts, so the panel is no longer called Rooms:
 * the honest name is what these have in common.
 *
 * Nothing is hidden. Every grouped surface is one click away in the sidebar,
 * at the path it always had, and the Understanding section says so — `§18`'s
 * guardrail, and the same argument `NAV-01` made against deleting them.
 *
 * Home is left out of its own grid. A launcher to the page you are reading is
 * the purest form of the duplication the invariant names.
 */
function WhereWorkHappens() {
  const surfaces = surfacesInGroup('primary').filter((surface) => surface.id !== 'dashboard')

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Where work happens</PanelTitle>
      </PanelHeader>
      <PanelBody>
        <ul className="grid gap-2 sm:grid-cols-2">
          {surfaces.map((surface) => (
            <SurfaceCard key={surface.id} surface={surface} />
          ))}
        </ul>
      </PanelBody>
    </Panel>
  )
}

/**
 * One launcher. Exported for its own test: the *waiting* branch is a state no
 * primary surface is in today, and a branch nothing can reach is a branch
 * nobody checks until the day it renders.
 */
export function SurfaceCard({ surface }: { surface: SurfaceDefinition }) {
  const subflows = SURFACES.filter((each) => each.partOf === surface.id)
  const waiting = surface.readiness === 'awaiting-capability'

  return (
    <li>
      <Link
        to={surface.route}
        className="block h-full rounded-md border border-line bg-surface px-3 py-2.5 transition-colors hover:bg-surface-sunken"
      >
        <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
          {waiting ? (
            <Clock className="size-3.5 text-ink-subtle" aria-hidden="true" />
          ) : (
            <CircleDot className="size-3.5 text-accent" aria-hidden="true" />
          )}
          {surface.title}
          {waiting && <Badge tone="neutral">Not yet</Badge>}
        </p>
        <p className="mt-1 text-[11.5px] leading-snug text-ink-muted">{surface.purpose}</p>
        {/* The limit, on the launcher. A person should not have to open a
            surface to learn it cannot do anything yet. */}
        {surface.limit && (
          <p className="mt-1 text-[11px] leading-snug text-ink-subtle">{surface.limit}</p>
        )}
        {subflows.length > 0 && (
          <p className="mt-1.5 text-[11px] text-ink-subtle">
            {subflows.map((each) => each.title).join(' · ')}
          </p>
        )}
      </Link>
    </li>
  )
}

/**
 * Coverage with a denominator, never a percentage.
 *
 * `§3` and `ADR-0003` agree: `7 of 10 areas` says what `70%` cannot, because
 * the reader can tell what the whole is.
 */
function Coverage({ projection }: { projection: ProjectProjection }) {
  const areas = projection.health.coverage
  const sufficient = areas.filter((area) => area.state === 'strong').length

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Understanding</PanelTitle>
      </PanelHeader>
      <PanelBody className="space-y-2">
        {areas.length === 0 ? (
          <p className="text-[12.5px] text-ink-muted">
            No area has been assessed yet. Nothing has classified what this project holds.
          </p>
        ) : (
          <>
            <p className="text-[13px] text-ink">
              <span className="font-medium">
                {sufficient} of {areas.length}
              </span>{' '}
              areas have enough confirmed evidence.
            </p>
            {projection.classification?.degraded && (
              // The number's provenance, beside the number. A percentage
              // produced by the offline ceiling looked exactly like one a model
              // produced until `AUD-039`.
              <p className="text-[11.5px] leading-relaxed text-ink-muted">
                {projection.classification.note}
              </p>
            )}
            <Button asChild variant="secondary" size="sm" className="mt-1">
              <Link to="/workspace">Continue discovery</Link>
            </Button>
          </>
        )}
      </PanelBody>
    </Panel>
  )
}
