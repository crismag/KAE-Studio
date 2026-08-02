import { Check, CircleDashed, CircleHelp, Clock, MinusCircle, TriangleAlert, X } from 'lucide-react'
import { Badge } from '@/components/ui/primitives'
import type { NodeStatus, ReadinessValue } from '@/domain/types'

/**
 * One vocabulary for status across every screen.
 *
 * Every state carries an icon and a word, never colour alone — the visual
 * direction requires state to remain legible without colour perception.
 */

const STATUS_LABEL: Record<NodeStatus, string> = {
  proposed: 'Proposed',
  confirmed: 'Confirmed',
  contested: 'Needs clarification',
  superseded: 'Superseded',
  rejected: 'Rejected',
  deferred: 'Deferred',
}

export function StatusBadge({ status }: { status: NodeStatus }) {
  const label = STATUS_LABEL[status]
  switch (status) {
    case 'confirmed':
      return (
        <Badge tone="confirmed">
          <Check className="size-3" aria-hidden="true" />
          {label}
        </Badge>
      )
    case 'contested':
      return (
        <Badge tone="attention">
          <TriangleAlert className="size-3" aria-hidden="true" />
          {label}
        </Badge>
      )
    case 'proposed':
      return (
        <Badge tone="pending">
          <CircleDashed className="size-3" aria-hidden="true" />
          {label}
        </Badge>
      )
    case 'deferred':
      return (
        <Badge tone="neutral">
          <Clock className="size-3" aria-hidden="true" />
          {label}
        </Badge>
      )
    case 'rejected':
      return (
        <Badge tone="neutral">
          <X className="size-3" aria-hidden="true" />
          {label}
        </Badge>
      )
    case 'superseded':
      return (
        <Badge tone="neutral">
          <MinusCircle className="size-3" aria-hidden="true" />
          {label}
        </Badge>
      )
  }
}

const READINESS_LABEL: Record<ReadinessValue, string> = {
  complete: 'Complete',
  draft: 'Draft',
  incomplete: 'Incomplete',
  blocked: 'Blocked',
  not_applicable: 'Not applicable',
}

export function ReadinessBadge({ value }: { value: ReadinessValue }) {
  const label = READINESS_LABEL[value]
  switch (value) {
    case 'complete':
      return (
        <Badge tone="confirmed">
          <Check className="size-3" aria-hidden="true" />
          {label}
        </Badge>
      )
    case 'draft':
      return (
        <Badge tone="pending">
          <CircleDashed className="size-3" aria-hidden="true" />
          {label}
        </Badge>
      )
    case 'incomplete':
      return (
        <Badge tone="attention">
          <CircleHelp className="size-3" aria-hidden="true" />
          {label}
        </Badge>
      )
    case 'blocked':
      return (
        <Badge tone="blocking">
          <TriangleAlert className="size-3" aria-hidden="true" />
          {label}
        </Badge>
      )
    case 'not_applicable':
      return (
        <Badge tone="neutral">
          <MinusCircle className="size-3" aria-hidden="true" />
          {label}
        </Badge>
      )
  }
}
