/**
 * 174 proposed statements as a queue rather than a wall (`NAV-01` N3).
 *
 * ## What this replaces
 *
 * One flat `<ul>` of every proposed statement. On the live project that is 174
 * rows, each with Confirm and Reject — **350 buttons on one page**, in an order
 * nobody chose, with no way to do all the constraints and stop.
 *
 * The customer's original problem is *"I have a pile of things and no idea what
 * to do with them"*. A page that hands back a pile of 174 is that problem
 * restated in the product's own words, which is the objection this whole slice
 * exists to answer.
 *
 * ## What it does instead
 *
 * **Groups by what a statement is** — rules together, actors together — because
 * that is the axis a person actually works along: deciding fifteen constraints
 * in a row needs one frame of mind, and deciding a constraint then an actor then
 * a goal needs three.
 *
 * **Opens the small groups and closes the large ones**, so the shape of the pile
 * is visible before any of it is. `R10`: KAE does not hand its organisational
 * burden back.
 *
 * **Shows a page at a time inside a group.** Fifty rows behind one heading is
 * the same wall with a lid on it.
 *
 * ## What it deliberately does not do
 *
 * No ranking. Ordering by *what a statement blocks* needs a blocking relation,
 * and whether KAE-Memory can say *this statement blocks that area* is
 * unverified (`OD-NAV-2`). An invented priority order is worse than the
 * project's own, because a reader believes it.
 *
 * Nothing is hidden. Every statement is one disclosure away, and the counts
 * beside each heading say exactly how many are behind it.
 */

import { useState } from 'react'

import {
  Badge,
  Button,
  Panel,
  PanelBody,
  PanelHeader,
  PanelTitle,
} from '@/components/ui/primitives'
import { plural } from '@/lib/plural'
import type { ReviewFinding } from '@/domain/types'

/** How many rows a group shows before asking. */
export const PAGE = 20

/** A group larger than this arrives closed, with its heading readable. */
export const LARGE_GROUP = 8

/**
 * KAE-Memory's knowledge kinds, in the words a person would use for a heading.
 *
 * Plural, because these label a group and not a row. A kind with no entry keeps
 * its own name rather than being folded into "Other" — an unlabelled group is a
 * gap in this map, and rendering the raw word is how somebody notices.
 */
const KIND_HEADING: Record<string, string> = {
  goal: 'Goals',
  rule: 'Rules',
  actor: 'Actors and stakeholders',
  constraint: 'Constraints',
  entity: 'Entities and data',
  unknown: 'Material unknowns',
  requirement: 'Requirements',
  assumption: 'Assumptions',
  decision: 'Decisions',
}

/** Ungrouped, when an adapter sends no kind. Never a guess at which kind. */
const UNGROUPED = 'Proposed statements'

export function groupByKind(
  findings: ReviewFinding[],
): { heading: string; items: ReviewFinding[] }[] {
  const groups = new Map<string, ReviewFinding[]>()
  for (const finding of findings) {
    const key = finding.statementKind ?? ''
    const heading = key ? (KIND_HEADING[key] ?? key) : UNGROUPED
    groups.set(heading, [...(groups.get(heading) ?? []), finding])
  }
  // Largest first. The biggest group is where the work is, and a reader
  // scanning headings should meet it before a group of one.
  return [...groups.entries()]
    .map(([heading, items]) => ({ heading, items }))
    .sort((a, b) => b.items.length - a.items.length || a.heading.localeCompare(b.heading))
}

export function ProposedStatements({
  findings,
  children,
}: {
  findings: ReviewFinding[]
  /** How to render one statement. The card belongs to the Room, not to this. */
  children: (finding: ReviewFinding) => React.ReactNode
}) {
  const groups = groupByKind(findings)

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <Group key={group.heading} heading={group.heading} items={group.items}>
          {children}
        </Group>
      ))}
    </div>
  )
}

function Group({
  heading,
  items,
  children,
}: {
  heading: string
  items: ReviewFinding[]
  children: (finding: ReviewFinding) => React.ReactNode
}) {
  const [shown, setShown] = useState(PAGE)
  const large = items.length > LARGE_GROUP
  const visible = items.slice(0, shown)
  const remaining = items.length - visible.length

  return (
    <Panel>
      <details open={!large}>
        <summary className="cursor-pointer list-none">
          <PanelHeader>
            <PanelTitle>{heading}</PanelTitle>
            {/* The number says what it counts. A bare "15" beside a heading is
                the sidebar's old badge problem one level down. */}
            <Badge tone="attention">{plural(items.length, 'to decide', 'to decide')}</Badge>
          </PanelHeader>
        </summary>
        <PanelBody className="px-0 py-0">
          <ul className="divide-y divide-line">{visible.map((finding) => children(finding))}</ul>
          {remaining > 0 && (
            <div className="border-t border-line px-5 py-3">
              <Button variant="ghost" size="sm" onClick={() => setShown(shown + PAGE)}>
                Show {Math.min(PAGE, remaining)} more
              </Button>
              {/* Said, not implied. Somebody who has decided twenty and sees a
                  button needs to know whether they are near the end. */}
              <span className="ml-2 text-[11.5px] text-ink-subtle">
                {remaining} more in this group
              </span>
            </div>
          )}
        </PanelBody>
      </details>
    </Panel>
  )
}
