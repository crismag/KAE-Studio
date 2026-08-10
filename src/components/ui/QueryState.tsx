/**
 * Loading, failed, empty — decided once instead of nine times.
 *
 * ## The defect this closes
 *
 * `App.tsx` configures React Query with `retry: false`. **No route renders an
 * error state.** Every data route guards with `isLoading || !data` and returns
 * a `Skeleton`, so a *failed* fetch is indistinguishable from a slow one: six
 * screens sit on a pulsing grey rectangle forever, and a person waits for
 * something that already finished.
 *
 * That is the audit's own subject in its most literal form — a surface showing
 * one thing while the truth is another — and it is worse than an empty panel,
 * because an empty panel at least stops.
 *
 * ## Why a component rather than a hook
 *
 * The failure has to be *rendered*, and rendering it in nine places is nine
 * chances to write "Something went wrong". A person who cannot see which call
 * failed cannot tell whether to retry, reload, or report it, so the port name
 * and the real message both appear.
 *
 * ## What it deliberately does not do
 *
 * It does not retry automatically. `retry: false` is a considered setting: a
 * write that failed must not be replayed by a library, and a read that failed
 * against an unreachable Memory will fail again in the same second. The retry
 * is a button, and a person presses it.
 */

import type { UseQueryResult } from '@tanstack/react-query'
import { AlertTriangle, RotateCw } from 'lucide-react'

import { Button, EmptyState, Skeleton } from '@/components/ui/primitives'

export function QueryState<T>({
  query,
  /** What failed, in the product's words: "the project's readiness", "your sources". */
  of,
  skeleton,
  /** Rendered when the query succeeded and there is genuinely nothing. */
  empty,
  children,
}: {
  query: UseQueryResult<T>
  of: string
  skeleton?: React.ReactNode
  empty?: React.ReactNode
  children: (data: T) => React.ReactNode
}) {
  if (query.isPending) return <>{skeleton ?? <Skeleton className="h-40" />}</>

  if (query.isError || query.data === undefined) {
    return <QueryFailed of={of} error={query.error} onRetry={() => void query.refetch()} />
  }

  if (empty !== undefined && isEmpty(query.data)) return <>{empty}</>

  return <>{children(query.data)}</>
}

function isEmpty(value: unknown): boolean {
  return Array.isArray(value) && value.length === 0
}

export function QueryFailed({
  of,
  error,
  onRetry,
}: {
  of: string
  error: unknown
  onRetry?: () => void
}) {
  const detail = error instanceof Error ? error.message : null
  return (
    <div role="alert" className="rounded-panel border border-attention-line bg-attention-soft p-4">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-attention" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-ink">{of} could not be read</p>
          {/* The distinction the whole component exists for. A person seeing a
              blank page assumes their project is empty; this says the opposite,
              and says it before offering an action. */}
          <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
            Nothing is being shown in its place, and nothing about your project has changed.
          </p>
          {detail && (
            // Verbatim. A summarised error is one a person cannot search for,
            // and the summary is usually written by whoever knows least.
            <p className="mt-2 break-words font-mono text-[11.5px] leading-relaxed text-ink-subtle">
              {detail}
            </p>
          )}
          {onRetry && (
            <Button size="sm" className="mt-3" onClick={onRetry}>
              <RotateCw className="size-3.5" aria-hidden="true" />
              Try again
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

/** The ordinary nothing-here state, for when the query succeeded. */
export function NothingYet({ title, children }: { title: string; children?: React.ReactNode }) {
  return <EmptyState title={title}>{children}</EmptyState>
}
