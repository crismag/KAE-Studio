/**
 * What to recommend when nothing has been ranked yet.
 *
 * Separated from the component that renders it because it is derivation, not
 * rendering — and because a file exporting both cannot be hot-reloaded, which
 * is what `react-refresh/only-export-components` was telling us.
 *
 * **The floor is deliberately blunt.** CIE ranks the next action (ADR-0002);
 * Memory refuses to, its `subjects` being "a stable order, not a recommended
 * one"; and anything sharper here would be Studio ranking, which is the failure
 * that ADR exists to prevent arriving as a fallback.
 *
 * So this reads the project's state through the actions-follow-state table in
 * `PLANNING_MODEL.md` and says nothing about *which area* matters most.
 */

import type { ProjectProjection } from '@/domain/types'

export interface RecommendedAction {
  kind: 'answer' | 'review' | 'decide' | 'configure' | 'generate'
  label: string
  reason: string
}

export function floorAction(projection: ProjectProjection): RecommendedAction {
  const proposed = projection.requirements?.length ?? 0
  const confirmed =
    projection.definition.objectives.length +
    projection.definition.stakeholders.length +
    projection.definition.constraints.length +
    projection.definition.assumptions.length

  if (confirmed === 0 && proposed === 0) {
    return {
      kind: 'answer',
      label: 'Describe what you are building',
      reason: 'Nothing has been established yet, so every other kind of work has nothing to read.',
    }
  }
  if (proposed > 0) {
    return {
      kind: 'review',
      label: `Review what KAE has derived`,
      reason:
        'Statements are waiting for a decision, and readiness counts what you have confirmed.',
    }
  }
  return {
    kind: 'answer',
    label: 'Keep going with KAE',
    reason: 'The conversation is where this project is being built.',
  }
}
