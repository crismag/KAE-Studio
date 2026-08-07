/**
 * Keeps one failing view from taking the application with it.
 *
 * Without this, React Router replaces the whole tree with a stack trace: the
 * navigation disappears, and moving to a working page means editing the URL.
 * A view that cannot render is a bounded problem and should look like one.
 *
 * It matters more against a live backend than against fixtures. The prototype's
 * views were written for a project where every field was populated; a real
 * young project has empty ones, and the difference surfaces as exactly this
 * kind of error. Keeping the shell alive is what makes those findable one after
 * another rather than one per reload.
 */

import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { EmptyState } from '@/components/ui/primitives'

export function RouteError() {
  const error = useRouteError()

  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : String(error)

  // `CapabilityUnavailable` is thrown by the live services when this deployment
  // genuinely lacks something. That is not a fault, and saying "went wrong"
  // about it would send someone looking for a bug that does not exist.
  const isCapability = error instanceof Error && error.name === 'CapabilityUnavailable'

  return (
    <EmptyState title={isCapability ? 'Not available in this deployment' : 'This view could not render'}>
      <p className="mb-2">{detail}</p>
      {!isCapability && (
        <p className="opacity-75">
          The rest of Studio is unaffected — use the navigation to continue. Nothing was written,
          and no project state changed.
        </p>
      )}
    </EmptyState>
  )
}
