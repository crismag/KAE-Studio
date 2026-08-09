/**
 * What a downstream stage is waiting for, read from the project.
 *
 * Separated from the component that renders it: derivation is not rendering,
 * and a file exporting both cannot be hot-reloaded.
 *
 * **It lists and never ranks.** Which prerequisite matters most is a judgement
 * and judgement is CIE's (ADR-0002). This says what is met; the navigator says
 * what to do about it.
 */

import type { ProjectProjection } from '@/domain/types'

export type PrerequisiteState = 'met' | 'developing' | 'absent'

export interface Prerequisite {
  label: string
  state: PrerequisiteState
  /** Why it is not met yet. Shown only when there is something to say. */
  detail?: string
}

/**
 * The prerequisites every downstream stage shares.
 *
 * Deliberately the same list for all four. They genuinely do depend on the same
 * things, and inventing a distinct set per page would be four sets of prose
 * nobody derived — which is how the fixture text got there in the first place.
 */
export function prerequisitesFor(projection: ProjectProjection): Prerequisite[] {
  const { definition } = projection
  const count = (n: number): PrerequisiteState =>
    n === 0 ? 'absent' : n < 3 ? 'developing' : 'met'

  return [
    {
      label: 'Problem understood',
      state: definition.problem ? 'met' : 'absent',
      // Now a fact about the project rather than about the API. Until the
      // knowledge listing returned each statement's areas, this row said
      // "absent" for every project in existence and had to explain that it was
      // the product that could not tell, not the project that had nothing.
      detail: definition.problem
        ? undefined
        : 'No confirmed statement has been classified as the problem yet.',
    },
    {
      label: 'Users understood',
      state: count(definition.stakeholders.length),
      detail: definition.stakeholders.length === 0 ? 'Nobody has been identified yet.' : undefined,
    },
    {
      label: 'Scope developing',
      state: count(definition.objectives.length),
      detail: definition.objectives.length === 0 ? 'No objectives are recorded.' : undefined,
    },
    {
      label: 'Constraints known',
      state: count(definition.constraints.length),
      detail:
        definition.constraints.length === 0
          ? 'Nothing yet says what bounds this work.'
          : undefined,
    },
  ]
}
