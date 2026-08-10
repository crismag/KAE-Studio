/**
 * One tab implementation, on Radix, keyboard-navigable by default.
 *
 * Studio has four disclosure idioms already (`<details>`, a hand-rolled expand
 * button, Radix `Collapsible`, and a status filter rendered as a button group)
 * and no tabs at all. Ingestion needs them — paste, sources, upload are three
 * ways to do one thing, and stacking them makes a page nobody scrolls.
 *
 * Radix rather than hand-rolled because arrow-key navigation, `aria-selected`
 * and roving tabindex are exactly the things a hand-rolled version omits and
 * nobody notices until somebody uses a keyboard.
 */

import * as RadixTabs from '@radix-ui/react-tabs'
import * as React from 'react'

import { cn } from '@/lib/cn'

export const Tabs = RadixTabs.Root

export function TabList({ className, ...props }: React.ComponentProps<typeof RadixTabs.List>) {
  return (
    <RadixTabs.List
      className={cn('flex items-center gap-1 border-b border-line', className)}
      {...props}
    />
  )
}

export function Tab({ className, ...props }: React.ComponentProps<typeof RadixTabs.Trigger>) {
  return (
    <RadixTabs.Trigger
      className={cn(
        'relative -mb-px border-b-2 border-transparent px-3 py-2 text-[13px] font-medium',
        'text-ink-muted transition-colors hover:text-ink',
        'data-[state=active]:border-accent data-[state=active]:text-ink',
        // Never colour alone: the active tab is also the only one whose label
        // reaches full ink, and the border gives it a second, non-colour signal.
        'disabled:cursor-not-allowed disabled:text-ink-subtle disabled:hover:text-ink-subtle',
        className,
      )}
      {...props}
    />
  )
}

export function TabPanel({ className, ...props }: React.ComponentProps<typeof RadixTabs.Content>) {
  return (
    <RadixTabs.Content className={cn('pt-4 focus-visible:outline-none', className)} {...props} />
  )
}
