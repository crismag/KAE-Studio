import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { PageLayout, FutureState } from '@/components/project/PageLayout'
import { StageReadiness } from '@/components/project/StageReadiness'
import { prerequisitesFor } from '@/components/project/stagePrerequisites'
import { useProjection } from '@/hooks/useProject'
import { Button } from '@/components/ui/primitives'

export function Architecture() {
  const { data: projection } = useProjection()

  return (
    <PageLayout
      title="Architecture"
      lead="How this system will be designed, and why. Nothing here is generated until the architecture interview has been run."
    >
      {/* What this page is waiting for, read from the project rather than
          asserted. S-1 removed the prose that claimed to know; this is what
          replaces it with something true. */}
      {projection && (
        <StageReadiness stage="Architecture" prerequisites={prerequisitesFor(projection)} />
      )}

      <FutureState
        willContain={[
          'System context — the system and everything it talks to',
          'Component design derived from the accepted module decomposition',
          'Data model and entity ownership across modules',
          'Integration and deployment topology',
          'Architecture decision records with alternatives and consequences',
          'Constraints that bind the design',
        ]}
        // Says nothing about *this* project, for the reason given in Plan.tsx:
        // the second and third sentences here were fixture prose about module
        // boundaries and an authority model belonging to a project that does
        // not exist. The first sentence was always true of every project.
        whyNotReady="The architecture interview has not been conducted. Generating a component diagram before one would present a design nobody has discussed as though it were decided."
        nextAction={
          <Button variant="secondary" size="sm" asChild>
            <Link to="/workspace">
              Continue discovery in the Workspace
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </Button>
        }
      />
    </PageLayout>
  )
}
