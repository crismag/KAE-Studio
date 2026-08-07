import { useState } from 'react'
import { ArrowRight, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'
import { plural } from '@/lib/plural'
import { PageLayout } from '@/components/project/PageLayout'
import { StatusBadge } from '@/components/project/statusVocabulary'
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
import type { ProjectModule } from '@/domain/types'

/**
 * Dependency relationships are rendered as a layered list rather than a
 * free-form graph. Build order is the question this screen answers, and a
 * layered reading answers it more legibly than an arbitrary node layout.
 */
function computeLayers(modules: ProjectModule[]): ProjectModule[][] {
  const byId = new Map(modules.map((m) => [m.id, m]))
  const layers: ProjectModule[][] = []
  const placed = new Set<string>()

  let guard = 0
  while (placed.size < modules.length && guard < 12) {
    guard += 1
    const layer = modules.filter(
      (m) =>
        !placed.has(m.id) &&
        m.dependencies.every((d) => !byId.has(d.moduleId) || placed.has(d.moduleId)),
    )
    if (layer.length === 0) break // a cycle would land here
    layer.forEach((m) => placed.add(m.id))
    layers.push(layer)
  }

  const unplaced = modules.filter((m) => !placed.has(m.id))
  if (unplaced.length > 0) layers.push(unplaced)
  return layers
}

export function Dependencies() {
  const { data: projection, isLoading } = useProjection()
  const [selectedId, setSelectedId] = useState<string>('MOD-APR')

  if (isLoading || !projection) {
    return (
      <PageLayout title="Dependencies">
        <Skeleton className="h-96" />
      </PageLayout>
    )
  }

  // A project can genuinely have no modules — a young one has not been
  // decomposed yet, and this deployment does not expose them over HTTP at all.
  // Falling through to `modules[0]` crashed the route on both.
  if (projection.modules.length === 0) {
    return (
      <PageLayout title="Dependencies">
        <EmptyState title="No module graph for this project">
          Dependencies are drawn between modules, and this project has none that Studio can see.
          KAE-Memory exposes the module graph over MCP only — its consumer is a coding agent
          implementing one module, and Studio's curation flow is a separate contract that has not
          been reconciled yet. Nothing is missing from the project; this view has nothing to draw.
        </EmptyState>
      </PageLayout>
    )
  }

  const layers = computeLayers(projection.modules)
  const selected = projection.modules.find((m) => m.id === selectedId) ?? projection.modules[0]
  const dependents = projection.modules.filter((m) =>
    m.dependencies.some((d) => d.moduleId === selected.id),
  )
  const blockingCount = projection.modules.reduce(
    (n, m) => n + m.dependencies.filter((d) => d.blocking).length,
    0,
  )

  return (
    <PageLayout
      title="Dependencies"
      wide
      lead="What depends on what, and therefore in which order this system can be built. A blocking dependency stops build order from being derivable past it."
      actions={
        blockingCount > 0 ? (
          <Badge tone="blocking">
            <TriangleAlert className="size-3" aria-hidden="true" />
            {blockingCount} blocking
          </Badge>
        ) : null
      }
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
                  {index === 0 && ' — no dependencies'}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {layer.map((m) => {
                    const hasBlocking = m.dependencies.some((d) => d.blocking)
                    const isSelected = m.id === selected.id
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedId(m.id)}
                        aria-pressed={isSelected}
                        className={cn(
                          'rounded-md border px-3.5 py-3 text-left transition-colors',
                          isSelected
                            ? 'border-accent bg-accent-soft'
                            : hasBlocking
                              ? 'border-blocking-line bg-blocking-soft/40 hover:bg-blocking-soft'
                              : 'border-line bg-surface hover:bg-surface-sunken',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13.5px] font-medium text-ink">{m.name}</span>
                          {hasBlocking && (
                            <TriangleAlert
                              className="size-3.5 shrink-0 text-blocking"
                              aria-hidden="true"
                            />
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <Mono>{m.key}</Mono>
                          <span className="text-[11.5px] text-ink-subtle">
                            {plural(m.dependencies.length, 'dependency', 'dependencies')}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            <div className="rounded-md border border-attention-line bg-attention-soft/50 px-4 py-3">
              <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-muted">
                <TriangleAlert
                  className="mt-0.5 size-3.5 shrink-0 text-attention"
                  aria-hidden="true"
                />
                <span>
                  Build order past layer 1 is provisional. Approval Workflow has a blocking
                  dependency on Identity and Access, and the authority model it needs is undecided (
                  <span className="font-mono">OD-011</span>). Scheduling delivery on this order
                  would assume an answer nobody has given.
                </span>
              </p>
            </div>
          </PanelBody>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelHeader>
              <PanelTitle>{selected.name}</PanelTitle>
              <Mono>{selected.key}</Mono>
            </PanelHeader>
            <PanelBody className="space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                  Depends on
                </p>
                {selected.dependencies.length === 0 ? (
                  <p className="mt-1.5 text-[12.5px] italic text-ink-subtle">Nothing.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {selected.dependencies.map((d) => (
                      <li
                        key={d.moduleId}
                        className={cn(
                          'rounded-md border px-3 py-2',
                          d.blocking ? 'border-blocking-line bg-blocking-soft/50' : 'border-line',
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <ArrowRight className="size-3 text-ink-subtle" aria-hidden="true" />
                          <Mono className="text-ink">{d.moduleId}</Mono>
                          <Badge tone="neutral">{d.nature}</Badge>
                        </div>
                        <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
                          {d.reason}
                        </p>
                        {d.blockingReason && (
                          <p className="mt-1 text-[11.5px] leading-relaxed text-blocking">
                            {d.blockingReason}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                  Depended on by
                </p>
                {dependents.length === 0 ? (
                  <p className="mt-1.5 text-[12.5px] italic text-ink-subtle">Nothing yet.</p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {dependents.map((m) => (
                      <li
                        key={m.id}
                        className="flex items-center gap-2 text-[12.5px] text-ink-muted"
                      >
                        <Mono className="text-ink">{m.key}</Mono>
                        {m.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                  External and cross-module interfaces
                </p>
                <ul className="mt-2 space-y-1.5">
                  {selected.interfaces.map((i) => (
                    <li key={`${i.id}-${i.direction}`} className="text-[12.5px]">
                      <span className="text-ink">{i.name}</span>{' '}
                      <span className="text-ink-subtle">
                        ({i.direction}, {i.protocol})
                      </span>
                      {i.status === 'contested' && (
                        <span className="ml-1.5 inline-block align-middle">
                          <StatusBadge status="contested" />
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </PanelBody>
          </Panel>
        </div>
      </div>
    </PageLayout>
  )
}
