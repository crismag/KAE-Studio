import type { ReadinessValue } from '@/domain/types'

/** Shared label vocabulary. Kept apart from components so fast refresh works. */

const READINESS_LABEL: Record<ReadinessValue, string> = {
  complete: 'Complete',
  draft: 'Draft',
  incomplete: 'Incomplete',
  blocked: 'Blocked',
  not_applicable: 'Not applicable',
}

export function readinessLabel(value: ReadinessValue): string {
  return READINESS_LABEL[value]
}

export const DIMENSION_LABEL: Record<string, string> = {
  requirements: 'Requirements',
  interfaces: 'Interfaces',
  data_model: 'Data model',
  security: 'Security',
  operations: 'Operations',
  acceptance_tests: 'Acceptance tests',
  ui: 'User interface',
}

export const CATEGORY_LABEL: Record<string, string> = {
  functional: 'Functional requirements',
  integration: 'Integration requirements',
  security: 'Security requirements',
  operational: 'Operational requirements',
  quality: 'Quality expectations',
  business_rule: 'Business rules',
  user_need: 'Users and stakeholders',
  constraint: 'Constraints',
  assumption: 'Assumptions',
  decision: 'Decisions',
  // Last, and named as a question rather than a requirement. These are the
  // model reporting what it could not determine — the opposite of something the
  // project has decided.
  open_question: 'Open questions',
}
