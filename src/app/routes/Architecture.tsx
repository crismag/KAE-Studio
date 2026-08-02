import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { PageLayout, FutureState } from '@/components/project/PageLayout'
import { Button } from '@/components/ui/primitives'

export function Architecture() {
  return (
    <PageLayout
      title="Architecture"
      lead="How this system will be designed, and why. Nothing here is generated until the architecture interview has been run."
    >
      <FutureState
        willContain={[
          'System context — the system and everything it talks to',
          'Component design derived from the accepted module decomposition',
          'Data model and entity ownership across modules',
          'Integration and deployment topology',
          'Architecture decision records with alternatives and consequences',
          'Constraints that bind the design',
        ]}
        whyNotReady="The architecture interview has not been conducted. Two module boundaries are still proposed rather than accepted, and the authority model that shapes the security design is undecided. Generating a component diagram now would present a design nobody has discussed as though it were decided."
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
