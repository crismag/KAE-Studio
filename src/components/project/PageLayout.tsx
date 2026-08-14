import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** Standard scrolling page frame for every route except Workspace. */
export function PageLayout({
  title,
  lead,
  actions,
  children,
  wide,
}: {
  title: string
  lead?: string
  actions?: ReactNode
  children: ReactNode
  wide?: boolean
}) {
  return (
    <div className="h-full overflow-y-auto kae-scrollbar">
      <div
        className={cn(
          'mx-auto px-4 py-6 sm:px-8 sm:py-8',
          wide ? 'max-w-[92rem]' : 'max-w-[64rem]',
        )}
      >
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
          <div className="min-w-0">
            <h1 className="text-page font-semibold tracking-tight text-ink">{title}</h1>
            {lead && <p className="mt-1.5 max-w-3xl text-lead text-ink-muted">{lead}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
        <div className="pt-6 pb-10">{children}</div>
      </div>
    </div>
  )
}

/** A designed partial state — used where the product genuinely has nothing yet. */
export function FutureState({
  willContain,
  whyNotReady,
  nextAction,
}: {
  willContain: string[]
  whyNotReady: string
  nextAction: ReactNode
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-panel border border-line bg-surface px-6 py-5 shadow-panel">
        <h2 className="text-body font-semibold text-ink">What this section will contain</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {willContain.map((item) => (
            <li key={item} className="flex gap-2.5 text-body text-ink-muted">
              <span
                className="mt-[7px] size-1 shrink-0 rounded-full bg-ink-subtle"
                aria-hidden="true"
              />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-panel border border-attention-line bg-attention-soft/50 px-6 py-5">
        <h2 className="text-body font-semibold text-ink">Why it is not ready</h2>
        <p className="mt-2 max-w-3xl text-body text-ink-muted">{whyNotReady}</p>
        <div className="mt-4">{nextAction}</div>
      </div>
    </div>
  )
}
