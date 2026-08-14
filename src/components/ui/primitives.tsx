import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from '@radix-ui/react-slot'
import * as React from 'react'
import { cn } from '@/lib/cn'

/* --------------------------------------------------------------- Button */

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-45 whitespace-nowrap',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-white hover:bg-accent-hover',
        secondary: 'border border-line-strong bg-surface text-ink hover:bg-surface-sunken',
        ghost: 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
        subtle: 'bg-surface-sunken text-ink hover:bg-line',
        danger:
          'border border-blocking-line bg-blocking-soft text-blocking hover:bg-blocking hover:text-white',
      },
      size: {
        sm: 'h-8 px-3 text-body',
        md: 'h-9 px-4',
        lg: 'h-10 px-5',
        icon: 'h-8 w-8',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
}

/* ---------------------------------------------------------------- Panel */

export function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-panel border border-line bg-surface shadow-panel', className)}
      {...props}
    />
  )
}

export function PanelHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 border-b border-line px-5 py-3.5',
        className,
      )}
      {...props}
    />
  )
}

export function PanelTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-title font-semibold text-ink', className)} {...props} />
}

export function PanelBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-4', className)} {...props} />
}

/* ----------------------------------------------------------------- Badge */

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-caption font-medium leading-tight',
  {
    variants: {
      tone: {
        neutral: 'border-line-strong bg-surface-sunken text-ink-muted',
        accent: 'border-accent-line bg-accent-soft text-accent-ink',
        confirmed: 'border-confirmed-line bg-confirmed-soft text-confirmed',
        attention: 'border-attention-line bg-attention-soft text-attention',
        blocking: 'border-blocking-line bg-blocking-soft text-blocking',
        pending: 'border-pending-line bg-pending-soft text-pending',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}

/* -------------------------------------------------------------- Mono/ID */

export function Mono({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn('font-mono text-caption tracking-tight text-ink-subtle', className)}
      {...props}
    />
  )
}

/* -------------------------------------------------------------- Sections */

export function SectionHeading({
  title,
  description,
  action,
  className,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-end justify-between gap-6', className)}>
      <div className="min-w-0">
        <h2 className="text-lead font-semibold text-ink">{title}</h2>
        {description && <p className="mt-1 max-w-3xl text-body text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}

/* ------------------------------------------------------------ EmptyState */

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: React.ReactNode
  title: string
  children?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-panel border border-dashed border-line-strong bg-surface-sunken/60 px-6 py-8">
      {icon && <div className="text-ink-subtle">{icon}</div>}
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {children && <div className="max-w-2xl text-body text-ink-muted">{children}</div>}
      {action}
    </div>
  )
}

/* --------------------------------------------------------------- Skeleton */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded bg-surface-sunken', className)} aria-hidden="true" />
  )
}
