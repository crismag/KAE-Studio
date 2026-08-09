import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { PageLayout, FutureState } from '@/components/project/PageLayout'
import { StageReadiness, prerequisitesFor } from '@/components/project/StageReadiness'
import { useProjection } from '@/hooks/useProject'
import { Button } from '@/components/ui/primitives'

export function Plan() {
  const { data: projection } = useProjection()

  return (
    <PageLayout
      title="Plan"
      lead="Delivery phases, work packages, and sequencing. Availability is tied to a derivable build order."
    >
      {/* What this page is waiting for, read from the project rather than
          asserted. S-1 removed the prose that claimed to know; this is what
          replaces it with something true. */}
      {projection && (
        <StageReadiness stage="Development plan" prerequisites={prerequisitesFor(projection)} />
      )}

      <FutureState
        willContain={[
          'Delivery phases with entry and exit conditions',
          'Work packages scoped to one module and phase',
          'Dependency-ordered build sequence',
          'Milestones tied to module implementation readiness',
          'Risk register with owners',
          'Action items for unresolved decisions',
        ]}
        // Deliberately says nothing about *this* project.
        //
        // It used to: "Approval Workflow has a blocking dependency on Identity
        // and Access whose contract depends on an undecided authority model
        // (OD-011)" — prototype fixture prose, shown to every project as though
        // KAE had derived it. Until this page reads the projection (S-5), the
        // only honest thing it can say is what the stage needs in general.
        whyNotReady="A build order is derived from module decomposition and the dependencies between modules. Neither is available here yet, and a plan produced without them would schedule work whose shape is unknown."
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
