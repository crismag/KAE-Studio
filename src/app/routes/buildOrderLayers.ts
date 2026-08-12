/**
 * Where the line falls between one build-order layer and the next (`D-19`).
 *
 * Its own file because `/dependencies` renders it and the tests exercise it
 * directly — the same reason `sectionsNotRead` sits beside `SectionsNotRead`.
 */

import type { ArchitectureGraph, ModuleSummary } from '@/domain/types'

/**
 * Modules grouped into layers, dependencies first.
 *
 * Derived from **Memory's build order** rather than recomputed: the order is
 * stable there and ties break by key, so two orders that disagree is a question
 * nobody could answer from the screen. This only decides where the line falls
 * between one layer and the next — a module sits one layer below the deepest
 * thing it depends on.
 */
export function layersFrom(graph: ArchitectureGraph): ModuleSummary[][] {
  const byKey = new Map(graph.modules.map((module) => [module.key, module]))
  const dependencies = new Map<string, string[]>()
  for (const edge of graph.edges) {
    if (edge.relation !== 'depends_on' || !edge.targetModule) continue
    dependencies.set(edge.source, [...(dependencies.get(edge.source) ?? []), edge.targetModule])
  }

  const depth = new Map<string, number>()
  // Walking build order means every dependency has a depth before its
  // dependent needs one — which is exactly the property build order has.
  for (const key of graph.buildOrder) {
    const deepest = (dependencies.get(key) ?? []).reduce(
      (level, target) => Math.max(level, (depth.get(target) ?? -1) + 1),
      0,
    )
    depth.set(key, deepest)
  }

  const layers: ModuleSummary[][] = []
  for (const key of graph.buildOrder) {
    const module = byKey.get(key)
    if (!module) continue
    const level = depth.get(key) ?? 0
    while (layers.length <= level) layers.push([])
    layers[level].push(module)
  }

  // A module Memory did not put in build order — it would have to be in a
  // cycle, which the write path refuses, so this is defensive rather than
  // expected. Shown at the end rather than dropped: a module missing from this
  // page is a module a reader believes does not exist.
  const ordered = new Set(graph.buildOrder)
  const unplaced = graph.modules.filter((module) => !ordered.has(module.key))
  if (unplaced.length > 0) layers.push(unplaced)

  return layers.filter((layer) => layer.length > 0)
}
