import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { PageLayout, FutureState } from '@/components/project/PageLayout'
import { Button } from '@/components/ui/primitives'

export function Plan() {
  return (
    <PageLayout
      title="Plan"
      lead="Delivery phases, work packages, and sequencing. Availability is tied to a derivable build order."
    >
      <FutureState
        willContain={[
          'Delivery phases with entry and exit conditions',
          'Work packages scoped to one module and phase',
          'Dependency-ordered build sequence',
          'Milestones tied to module implementation readiness',
          'Risk register with owners',
          'Action items for unresolved decisions',
        ]}
        whyNotReady="Build order cannot be derived past the first layer. Approval Workflow has a blocking dependency on Identity and Access whose contract depends on an undecided authority model (OD-011). A plan produced now would schedule work whose shape is unknown."
        nextAction={
          <Button variant="secondary" size="sm" asChild>
            <Link to="/dependencies">
              See what blocks the build order
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </Button>
        }
      />
    </PageLayout>
  )
}
