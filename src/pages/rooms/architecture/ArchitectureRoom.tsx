import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { PageLayout, FutureState } from '@/components/project/PageLayout'
import { StageReadiness } from '@/components/project/StageReadiness'
import { prerequisitesFor } from '@/components/project/stagePrerequisites'
import { useProjection } from '@/hooks/useProject'
import { Button, Panel, PanelBody, PanelHeader, PanelTitle } from '@/components/ui/primitives'
import { ArchitectureDiagram } from './ArchitectureDiagram'

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

      {/* The one part of an architecture this product actually holds, drawn
          (`ARC-1b`). It sits above the list of what is still unbuilt because a
          reader arrives asking what the structure *is*, and a page that opens
          with everything it cannot do buries the one thing it can. */}
      {projection?.architecture.available && projection.architecture.modules.length > 0 && (
        <Panel className="mb-6">
          <PanelHeader>
            <PanelTitle>Modules and what depends on what</PanelTitle>
            <Link
              to="/dependencies"
              className="text-[12px] text-accent-ink underline-offset-2 hover:underline"
            >
              Read it as a list
            </Link>
          </PanelHeader>
          <PanelBody>
            <ArchitectureDiagram graph={projection.architecture} />
          </PanelBody>
        </Panel>
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
        whyNotReady="The architecture interview has not been conducted. The module graph above is what a project has decomposed into and how the parts depend on each other; a component design, a data model and a deployment topology are none of those, and deriving them from what is here would present a design nobody has discussed as though it were decided."
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
