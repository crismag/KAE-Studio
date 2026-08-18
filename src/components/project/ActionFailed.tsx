/**
 * An action somebody took did not work, said out loud (`§17`, `D-42`).
 *
 * > screen-reader announcements for **meaningful workflow state changes**
 *
 * Nine failure renderings across the Interview Room and the package screen put
 * their message on the page with no live region. The sharpest read:
 *
 * > *That message did not go through: … Nothing was recorded, so sending it
 * > again is safe.*
 *
 * A careful sentence — what happened, what it cost, exactly what to do — and
 * somebody using a screen reader was told none of it. `§16` was satisfied and
 * `§17` was not, which is why the package lists them separately.
 *
 * **It was also untrue, and this docstring admiring it is part of why nobody
 * re-read it** (`D-284`). CIE records the message before it asks the model, so
 * the ordinary failure leaves it durable and the advice to send it again was
 * the duplicate two other comments in this codebase exist to prevent. Quoted
 * here as it was, because the point it illustrates is about the announcement
 * and not about the wording; the room says something true now.
 *
 * ## `alert`, not `status`
 *
 * A failed action is assertive by definition: the person is waiting on it, and
 * a polite region can be swallowed by whatever else is speaking.
 *
 * ## Only actions somebody took
 *
 * A section that could not be read is a condition of the page, not the outcome
 * of a gesture — that is `CapabilityNote`, which stays quiet. Announcing every
 * degraded panel on load would make the assertive channel useless for the case
 * it exists for.
 */

import { TriangleAlert } from 'lucide-react'

import { cn } from '@/lib/cn'

export function ActionFailed({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <p
      role="alert"
      className={cn(
        'flex items-start gap-2 text-[12.5px] leading-relaxed text-blocking',
        className,
      )}
    >
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}
