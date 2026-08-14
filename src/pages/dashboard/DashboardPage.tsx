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
import { ROOMS, SURFACES, type SurfaceDefinition } from '@/app/registries/rooms'
import { useProjection } from '@/hooks/useProject'
import type { ProjectProjection } from '@/domain/types'

export function Dashboard() {
  const projection = useProjection()

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
                <NeedsYou projection={data} />
                <Rooms />
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
 */
function NeedsYou({ projection }: { projection: ProjectProjection }) {
  const proposed = projection.findings.length
  const decisions = projection.openDecisions.filter((decision) => !decision.deferred).length
  const contradictions = projection.contradictions.count
  const lost = projection.extractionCoverage && !projection.extractionCoverage.complete
  // What is outstanding on this page but held by another panel. Only critical
  // review findings: every project of any size has minor ones, and a "needs
  // you" panel that is never empty is one nobody reads — which would destroy
  // the signal this exists to protect.
  const elsewhere =
    openBlockers(projection.blockers).length +
    projection.review.findings.filter((finding) => finding.severity === 'critical').length

  const items = [
    proposed > 0 && {
      text: `${proposed} proposed statement${proposed === 1 ? '' : 's'} awaiting your decision`,
      to: '/reviews',
      tone: 'accent' as const,
    },
    decisions > 0 && {
      text: `${decisions} open decision${decisions === 1 ? '' : 's'}`,
      to: '/workspace',
      tone: 'attention' as const,
    },
    contradictions > 0 && {
      text: `${contradictions} unresolved contradiction${contradictions === 1 ? '' : 's'}`,
      to: '/reviews',
      tone: 'blocking' as const,
    },
    lost && {
      text: 'Part of what you gave KAE was never read',
      to: '/ingestion',
      tone: 'attention' as const,
    },
  ].filter(Boolean) as { text: string; to: string; tone: 'accent' | 'attention' | 'blocking' }[]

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Needs you</PanelTitle>
        {items.length > 0 && <Badge tone="neutral">{items.length}</Badge>}
      </PanelHeader>
      <PanelBody>
        {items.length === 0 ? (
          // Deliberately not "all clear". Nothing is waiting *that KAE can
          // see*, which is a narrower claim and the only one that is true —
          // three of the five review groups are not computed at all.
          //
          // And not even that when something else on this page is waiting.
          // `NeedsYou` counts proposals, decisions, contradictions and unread
          // content; blockers and review findings arrived later and were not
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
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.to + item.text}>
                <Link
                  to={item.to}
                  className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-[12.5px] text-ink transition-colors hover:bg-surface-sunken"
                >
                  <TriangleAlert
                    className={`size-3.5 shrink-0 ${
                      item.tone === 'blocking' ? 'text-blocking' : 'text-attention'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">{item.text}</span>
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
 * Room launchers with **truthful availability** — `§13`.
 *
 * The readiness comes from the registry, so a Room that is waiting on a
 * capability says what it is waiting for *before* somebody clicks it. That is
 * the difference between a considered product and a dead end with good
 * typography.
 */
function Rooms() {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Rooms</PanelTitle>
      </PanelHeader>
      <PanelBody>
        <ul className="grid gap-2 sm:grid-cols-2">
          {ROOMS.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </ul>
      </PanelBody>
    </Panel>
  )
}

function RoomCard({ room }: { room: SurfaceDefinition }) {
  const subflows = SURFACES.filter((surface) => surface.partOf === room.id)
  const waiting = room.readiness === 'awaiting-capability'

  return (
    <li>
      <Link
        to={room.route}
        className="block h-full rounded-md border border-line bg-surface px-3 py-2.5 transition-colors hover:bg-surface-sunken"
      >
        <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
          {waiting ? (
            <Clock className="size-3.5 text-ink-subtle" aria-hidden="true" />
          ) : (
            <CircleDot className="size-3.5 text-accent" aria-hidden="true" />
          )}
          {room.title}
          {waiting && <Badge tone="neutral">Not yet</Badge>}
        </p>
        <p className="mt-1 text-[11.5px] leading-snug text-ink-muted">{room.purpose}</p>
        {/* The limit, on the launcher. A person should not have to open a Room
            to learn it cannot do anything yet. */}
        {room.limit && (
          <p className="mt-1 text-[11px] leading-snug text-ink-subtle">{room.limit}</p>
        )}
        {subflows.length > 0 && (
          <p className="mt-1.5 text-[11px] text-ink-subtle">
            {subflows.map((surface) => surface.title).join(' · ')}
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
