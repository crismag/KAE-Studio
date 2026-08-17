/**
 * The architecture, drawn — `ARC-1b`, and the owner's own words:
 *
 * > *"we should be able to display a graphical and textual information about
 * > the architecture and modules."*
 *
 * The textual half is `/dependencies`. This is the picture, and it is drawn
 * from exactly the same graph: the same modules, the same edges, and the same
 * build order, laid out by the same `layersFrom`. Two views that could disagree
 * about what depends on what would be worse than one.
 *
 * ## What the picture is allowed to say
 *
 * Position carries **one** meaning — depth in build order — and nothing else.
 * Left-to-right order inside a row is Memory's tie-break by key and means
 * nothing; box size is uniform because Memory holds nothing that would justify
 * making one bigger. Every visual property that is not carrying information is
 * deliberately constant, because a reader will find meaning in any variation a
 * diagram offers them.
 *
 * Only `depends_on` edges are drawn, and `ModuleRelation` has six members. What
 * happens to the other five is `drawnRelations.ts`, three lists rather than one
 * comparison: the reason differs by member, only two of the five exclusions
 * were ever argued for, and the three the argument did not reach were dropped
 * silently until `D-219`. Those three are named in the caption when a project
 * records them, because a drawing that omits without a word is read as a
 * complete one.
 */

import { cn } from '@/lib/cn'
import { layersFrom } from './buildOrderLayers'
import { DRAWN, UNDRAWN_STRUCTURAL } from './drawnRelations'
import type { ArchitectureGraph } from '@/domain/types'

/**
 * How each module status is drawn (`D-28`).
 *
 * `retired` was drawn identically to `proposed`, under a caption saying a
 * dashed outline means *"a module nobody has confirmed"* — so the one module a
 * reader most needs to recognise, one that was confirmed and then deliberately
 * removed, was described as a proposal.
 *
 * A status this build has not heard of falls to the `proposed` outline **and**
 * shows its own word beside the box, so it is never silently drawn as
 * something it is not.
 */
const OUTLINE: Record<string, string | undefined> = {
  confirmed: undefined,
  proposed: '3 2',
  // Long dashes, distinct from a proposal's short ones at a glance.
  retired: '8 4',
}

/**
 * The dash pattern for a status, or `undefined` for a solid outline.
 *
 * A lookup with `??` cannot express this: `confirmed` maps to *no dashes*,
 * which is `undefined`, which is indistinguishable from *not found* — so a
 * confirmed module took the fallback and was drawn as a proposal. Membership is
 * the question, not the value.
 */
function outlineFor(status: string): string | undefined {
  return Object.hasOwn(OUTLINE, status) ? OUTLINE[status] : OUTLINE.proposed
}

const BOX_WIDTH = 148
const BOX_HEIGHT = 46
const GAP_X = 26
const GAP_Y = 58
const PADDING = 14

interface Placed {
  key: string
  name: string
  status: string
  x: number
  y: number
}

export function ArchitectureDiagram({
  graph,
  selectedKey,
  onSelect,
  className,
}: {
  graph: ArchitectureGraph
  selectedKey?: string
  onSelect?: (key: string) => void
  className?: string
}) {
  const layers = layersFrom(graph)
  if (layers.length === 0) return null

  const widest = Math.max(...layers.map((layer) => layer.length))
  const width = PADDING * 2 + widest * BOX_WIDTH + (widest - 1) * GAP_X
  const height = PADDING * 2 + layers.length * BOX_HEIGHT + (layers.length - 1) * GAP_Y

  const placed = new Map<string, Placed>()
  layers.forEach((layer, row) => {
    // Centred within the widest row, so a row of one sits over the middle of a
    // row of three rather than in its left corner — which would read as an
    // alignment nobody intended.
    const rowWidth = layer.length * BOX_WIDTH + (layer.length - 1) * GAP_X
    const left = (width - rowWidth) / 2
    layer.forEach((module, column) => {
      placed.set(module.key, {
        key: module.key,
        name: module.name,
        status: module.status,
        x: left + column * (BOX_WIDTH + GAP_X),
        y: PADDING + row * (BOX_HEIGHT + GAP_Y),
      })
    })
  })

  const edges = graph.edges
    .filter((edge) => DRAWN.includes(edge.relation) && edge.targetModule)
    .map((edge) => ({ from: placed.get(edge.source), to: placed.get(edge.targetModule!) }))
    .filter((edge): edge is { from: Placed; to: Placed } => !!edge.from && !!edge.to)

  // Named only when this project has them, so the common graph carries no
  // standing disclaimer and the sentence is always about edges that exist.
  const undrawn = UNDRAWN_STRUCTURAL.filter((relation) =>
    graph.edges.some((edge) => edge.relation === relation && edge.targetModule),
  )

  return (
    <div className={cn('overflow-x-auto', className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className="max-w-full"
        role="img"
        aria-label={`Build order for ${graph.modules.length} modules, dependencies at the top`}
      >
        <title>Module dependencies, laid out in build order</title>
        <defs>
          <marker
            id="architecture-arrow"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 8 4 L 0 8 z" className="fill-line-strong" />
          </marker>
        </defs>

        {edges.map(({ from, to }) => (
          // Drawn from the dependent up to what it depends on, and arrowed
          // that way. An unarrowed line between two boxes states a
          // relationship and hides its direction, which is the whole content
          // of a dependency.
          <line
            key={`${from.key}-${to.key}`}
            x1={from.x + BOX_WIDTH / 2}
            y1={from.y}
            x2={to.x + BOX_WIDTH / 2}
            y2={to.y + BOX_HEIGHT}
            className="stroke-line-strong"
            strokeWidth={1}
            markerEnd="url(#architecture-arrow)"
          />
        ))}

        {[...placed.values()].map((module) => {
          const selected = module.key === selectedKey
          return (
            <g
              key={module.key}
              onClick={onSelect ? () => onSelect(module.key) : undefined}
              className={onSelect ? 'cursor-pointer' : undefined}
            >
              <rect
                x={module.x}
                y={module.y}
                width={BOX_WIDTH}
                height={BOX_HEIGHT}
                rx={6}
                className={cn(
                  selected ? 'fill-accent-soft stroke-accent' : 'fill-surface stroke-line',
                )}
                // Dashed for a module nobody has confirmed. The one visual
                // variation here that carries meaning, and it carries the
                // meaning Memory actually holds.
                strokeDasharray={outlineFor(module.status)}
                strokeWidth={selected ? 1.5 : 1}
              />
              <text
                x={module.x + BOX_WIDTH / 2}
                y={module.y + 19}
                textAnchor="middle"
                className="fill-ink text-[11px] font-medium"
              >
                {truncate(module.name, 20)}
              </text>
              <text
                x={module.x + BOX_WIDTH / 2}
                y={module.y + 33}
                textAnchor="middle"
                className="fill-ink-subtle font-mono text-[9.5px]"
              >
                {truncate(module.key, 22)}
              </text>
            </g>
          )
        })}
      </svg>

      <p className="mt-2 text-[11.5px] leading-relaxed text-ink-subtle">
        An arrow points from a module to what it depends on, and height is build order — nothing
        else in this drawing means anything. A short-dashed outline is a module nobody has
        confirmed; a long-dashed one was confirmed and then retired, and is still shown in build
        order because that is the order KAE-Memory gives.
      </p>

      {undrawn.length > 0 && (
        // Stated once for the drawing rather than marked per edge — a picture
        // that omits something without saying so is read as a complete one
        // (`D-219`, `AUD-009`).
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-subtle">
          This project also records {undrawn.join(', ')} between modules, which this drawing leaves
          out. They are listed under <em>Other relationships</em> in the dependency view.
        </p>
      )}
    </div>
  )
}

/**
 * Cut a label that will not fit, with an ellipsis so a reader knows it was cut.
 *
 * SVG does not wrap text, and a name silently overrunning its box reads as a
 * rendering fault rather than a long name.
 */
function truncate(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`
}
