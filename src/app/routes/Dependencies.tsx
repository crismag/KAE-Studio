/**
 * What must be built before what — from KAE-Memory's own graph (`D-19`).
 *
 * This page has rendered an empty state on every deployment since it was
 * written, and the reason it gave was true: *"KAE-Memory exposes the module
 * graph over MCP only."* An agent could read a project's architecture and the
 * person who owns the project could not. The routes now exist and this reads
 * them.
 *
 * ## What it stopped claiming
 *
 * The previous version was built on Studio's `ProjectModule`, which carries
 * blocking dependencies with reasons, interface directions and protocols, and
 * failure behaviour. **KAE-Memory holds none of that.** It holds a key, a name,
 * a summary, a status, and typed edges between them.
 *
 * So the blocking-dependency warning, the interface list and the dependency
 * rationales are gone rather than filled from a thinner source. Every one of
 * them would have had to be invented per module, and a page that invents the
 * reason a dependency blocks is worse than a page that never mentions
 * blocking — a reader can work around silence and cannot work around a
 * confident wrong sentence.
 */

import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { plural } from '@/lib/plural'
import { PageLayout } from '@/components/project/PageLayout'
import { CapabilityNote } from '@/components/project/CapabilityNote'
import {
  Badge,
  Mono,
  Panel,
  PanelBody,
  PanelHeader,
  PanelTitle,
  Skeleton,
  EmptyState,
} from '@/components/ui/primitives'
import { useProjection } from '@/hooks/useProject'
import { layersFrom } from './buildOrderLayers'

/**
 * How each module status reads (`D-28`).
 *
 * `retired` was toned as `pending` — a module confirmed and then deliberately
 * removed, coloured as one still waiting to be agreed. A status this build has
 * not heard of gets the neutral tone rather than the nearest guess, and its own
 * word still shows.
 */
const STATUS_TONE: Record<string, 'confirmed' | 'pending' | 'neutral'> = {
  confirmed: 'confirmed',
  proposed: 'pending',
  retired: 'neutral',
}

export function Dependencies() {
  const { data: projection, isLoading } = useProjection()
  const [selectedKey, setSelectedKey] = useState<string>('')

  if (isLoading || !projection) {
    return (
      <PageLayout title="Dependencies">
        <Skeleton className="h-96" />
      </PageLayout>
    )
  }

  const graph = projection.architecture

  // Could not be read. Distinct from a project with no modules, and the
  // distinction is the whole point of the capability — one is a fact about the
  // project and the other is a fact about this deployment.
  if (!graph.available) {
    return (
      <PageLayout title="Dependencies">
        <CapabilityNote
          reason={`The module graph could not be read. ${graph.reason || 'KAE-Memory did not answer.'}`}
        />
      </PageLayout>
    )
  }

  if (graph.modules.length === 0) {
    return (
      <PageLayout title="Dependencies">
        <EmptyState title="This project has no modules yet">
          Dependencies are drawn between modules, and nothing has proposed one. Modules are proposed
          while a project is decomposed — through KAE-Memory directly today, because Studio has no
          curation contract for defining one.
        </EmptyState>
      </PageLayout>
    )
  }

  const layers = layersFrom(graph)
  const selected = graph.modules.find((module) => module.key === selectedKey) ?? graph.modules[0]

  const dependsOn = graph.edges.filter(
    (edge) => edge.source === selected.key && edge.relation === 'depends_on' && edge.targetModule,
  )
  const dependents = graph.edges.filter(
    (edge) => edge.targetModule === selected.key && edge.relation === 'depends_on',
  )
  const statements = graph.edges.filter(
    (edge) => edge.source === selected.key && edge.targetKnowledge,
  )
  const other = graph.edges.filter(
    (edge) => edge.source === selected.key && edge.relation !== 'depends_on' && edge.targetModule,
  )

  const named = (key: string) => graph.modules.find((module) => module.key === key)?.name ?? key
  const countDependencies = (key: string) =>
    graph.edges.filter(
      (edge) => edge.source === key && edge.relation === 'depends_on' && edge.targetModule,
    ).length

  return (
    <PageLayout
      title="Dependencies"
      wide
      lead="What depends on what, and therefore in which order this system can be built."
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Panel>
          <PanelHeader>
            <PanelTitle>Build order</PanelTitle>
            <span className="text-[11.5px] text-ink-subtle">Earliest at the top</span>
          </PanelHeader>
          <PanelBody className="space-y-5">
            {layers.map((layer, index) => (
              <div key={index}>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                  Layer {index + 1}
                  {index === 0 && ' — nothing to build first'}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {layer.map((module) => (
                    <button
                      key={module.key}
                      type="button"
                      onClick={() => setSelectedKey(module.key)}
                      aria-pressed={module.key === selected.key}
                      className={cn(
                        'rounded-md border px-3.5 py-3 text-left transition-colors',
                        module.key === selected.key
                          ? 'border-accent bg-accent-soft'
                          : 'border-line bg-surface hover:bg-surface-sunken',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13.5px] font-medium text-ink">{module.name}</span>
                        {/* Where the module is in its own life, not how far
                            along its implementation is. */}
                        <Badge tone={STATUS_TONE[module.status] ?? 'neutral'}>
                          {module.status}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Mono>{module.key}</Mono>
                        <span className="text-[11.5px] text-ink-subtle">
                          {plural(countDependencies(module.key), 'dependency', 'dependencies')}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* Memory's own sentence about what this order does not mean. An
                order with nothing said about it reads as "ready to build in
                this sequence", which is a claim about knowledge the graph has
                not looked at. */}
            {graph.note && (
              <p className="border-t border-line pt-3 text-[11.5px] leading-relaxed text-ink-subtle">
                {graph.note}
              </p>
            )}
          </PanelBody>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelHeader>
              <PanelTitle>{selected.name}</PanelTitle>
              <Mono>{selected.key}</Mono>
            </PanelHeader>
            <PanelBody className="space-y-4">
              {selected.summary && (
                <p className="text-[12.5px] leading-relaxed text-ink-muted">{selected.summary}</p>
              )}

              <Relation title="Depends on" empty="Nothing.">
                {dependsOn.map((edge) => (
                  <li key={edge.targetModule} className="rounded-md border border-line px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <ArrowRight className="size-3 text-ink-subtle" aria-hidden="true" />
                      <Mono className="text-ink">{edge.targetModule}</Mono>
                      <span className="text-[12px] text-ink-muted">
                        {named(edge.targetModule ?? '')}
                      </span>
                    </div>
                  </li>
                ))}
              </Relation>

              <Relation title="Depended on by" empty="Nothing yet.">
                {dependents.map((edge) => (
                  <li key={edge.source} className="flex items-center gap-2 text-[12.5px]">
                    <Mono className="text-ink">{edge.source}</Mono>
                    <span className="text-ink-muted">{named(edge.source)}</span>
                  </li>
                ))}
              </Relation>

              {other.length > 0 && (
                <Relation title="Other relationships" empty="">
                  {other.map((edge) => (
                    <li
                      key={`${edge.relation}-${edge.targetModule}`}
                      className="flex flex-wrap items-center gap-1.5 text-[12.5px]"
                    >
                      <Badge tone="neutral">{edge.relation.replace(/_/g, ' ')}</Badge>
                      <Mono className="text-ink">{edge.targetModule}</Mono>
                    </li>
                  ))}
                </Relation>
              )}

              {statements.length > 0 && (
                <Relation title="Statements this module answers to" empty="">
                  {statements.map((edge) => (
                    <li
                      key={`${edge.relation}-${edge.targetKnowledge}`}
                      className="flex flex-wrap items-center gap-1.5 text-[12.5px]"
                    >
                      <Badge tone="neutral">{edge.relation.replace(/_/g, ' ')}</Badge>
                      {/* A statement, not a module — no link, because this is
                          an identifier a reader can search for and not a page
                          this route can open. */}
                      <Mono className="text-ink">{edge.targetKnowledge}</Mono>
                    </li>
                  ))}
                </Relation>
              )}
            </PanelBody>
          </Panel>
        </div>
      </div>
    </PageLayout>
  )
}

function Relation({
  title,
  empty,
  children,
}: {
  title: string
  empty: string
  children: React.ReactNode[]
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">{title}</p>
      {children.length === 0 ? (
        empty && <p className="mt-1.5 text-[12.5px] italic text-ink-subtle">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">{children}</ul>
      )}
    </div>
  )
}
