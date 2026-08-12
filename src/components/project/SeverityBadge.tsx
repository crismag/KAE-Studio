/**
 * How much an open question matters, in Memory's own grading.
 *
 * `D-17`. This exists because the grade used to arrive in a field called
 * `whyItMatters` and render in the position an interface reserves for *why this
 * matters* — so a reader met the words "Severity: major" where a reason
 * belonged, and supplied the difference themselves.
 *
 * Nothing was invented then and nothing is added now. The severity is real;
 * this renders it as what it is. There is no reason beside it because Memory's
 * clarification candidates carry a grade and no rationale, and an absent reason
 * claims less than a grade wearing a reason's label.
 */

import { Badge } from '@/components/ui/primitives'

/**
 * `critical` is Memory's own word and the only grade that reads as *stop*. The
 * rest are graded but not blocking, and a page where every question is toned
 * for attention has no way left to say which one is.
 */
export function SeverityBadge({ severity }: { severity: string }) {
  return <Badge tone={severity === 'critical' ? 'attention' : 'neutral'}>{severity}</Badge>
}
