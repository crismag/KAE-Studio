/**
 * The form half of the design system, which did not exist.
 *
 * `primitives.tsx` is 166 lines and has `Button`, `Panel`, `Badge`, `Mono`,
 * `SectionHeading`, `EmptyState` and `Skeleton`. There is **no `Input`, no
 * `Select`, no `Textarea`, no `Field` and no `Checkbox`**, so every screen that
 * takes input hand-rolls its own with a copy-pasted class string — compare
 * `ProjectSources.tsx:377`, `:386`, `:445` and `:454`, which use three
 * different widths, two different radii and two different type sizes for the
 * same kind of control.
 *
 * That was survivable while one page took input. Project Setup takes fifteen
 * fields, so it stops being survivable here.
 *
 * ## No new visual language
 *
 * Every class string below is lifted from a control already shipping. This is
 * extraction, not redesign: the goal is that the fifth form looks like the
 * first, not that any of them look different.
 *
 * ## What `Field` is for
 *
 * A label, a hint, and an error, wired to the control by id so a screen reader
 * reads them together. Studio's existing inputs are labelled by proximity —
 * a `<p>` above a `<input>` — which looks the same and is not the same.
 */

import * as React from 'react'

import { cn } from '@/lib/cn'

const CONTROL =
  'block w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink ' +
  'placeholder:text-ink-subtle disabled:cursor-not-allowed disabled:bg-surface-sunken ' +
  'disabled:text-ink-subtle aria-[invalid=true]:border-blocking-line'

/** A monospace control, for identifiers people compare character by character. */
const MONO = 'font-mono text-[12px]'

export interface FieldProps {
  label: string
  /** What this is for, in a sentence. Rendered above the control, not after it. */
  hint?: React.ReactNode
  /** What is wrong, from the server where possible. Replaces the hint when set. */
  error?: string | null
  /**
   * Why this control is unavailable. Renders the control disabled with the
   * reason beneath it — the `CapabilityNote` rule applied to one field, so an
   * input a person cannot use still says why.
   */
  unavailable?: string
  required?: boolean
  children: (props: {
    id: string
    'aria-describedby': string | undefined
    'aria-invalid': boolean | undefined
    disabled: boolean
  }) => React.ReactNode
}

export function Field({ label, hint, error, unavailable, required, children }: FieldProps) {
  const id = React.useId()
  const noteId = `${id}-note`
  const note = error ?? unavailable ?? hint
  return (
    <div>
      <label htmlFor={id} className="text-[12px] font-medium text-ink">
        {label}
        {required && (
          <span className="ml-1 text-ink-subtle" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <div className="mt-1">
        {children({
          id,
          'aria-describedby': note ? noteId : undefined,
          'aria-invalid': error ? true : undefined,
          disabled: Boolean(unavailable),
        })}
      </div>
      {note && (
        <p
          id={noteId}
          className={cn(
            'mt-1 text-[11.5px] leading-relaxed',
            error ? 'text-blocking' : 'text-ink-subtle',
          )}
        >
          {note}
        </p>
      )}
    </div>
  )
}

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }
>(function Input({ className, mono, ...props }, ref) {
  return <input ref={ref} className={cn(CONTROL, mono && MONO, className)} {...props} />
})

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, rows = 4, ...props }, ref) {
  return (
    <textarea ref={ref} rows={rows} className={cn(CONTROL, 'resize-y', className)} {...props} />
  )
})

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(CONTROL, 'pr-8', className)} {...props}>
      {children}
    </select>
  )
})

export function Checkbox({
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  return (
    <label className={cn('flex items-start gap-2 text-[12.5px] text-ink', className)}>
      <input
        type="checkbox"
        className="mt-0.5 size-3.5 shrink-0 rounded border-line accent-accent"
        {...props}
      />
      <span className="min-w-0">{label}</span>
    </label>
  )
}

/**
 * A group of fields under one heading, inside a `Panel`.
 *
 * Setup is long, and a long form without structure is a wall. This is the unit
 * a person reads as *one decision* — sources, or the destination, or scope.
 */
export function FieldSet({
  legend,
  description,
  children,
  className,
}: {
  legend: string
  description?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    // `min-w-0` because a `<fieldset>` has an intrinsic `min-inline-size:
    // min-content` that overrides `max-width`. Without it the destination form
    // on Setup rendered 508px past the right edge of a 1440px window — clipped,
    // not scrollable, so the Path field and Register button were unreachable.
    <fieldset className={cn('min-w-0 space-y-3', className)}>
      <legend className="text-[13px] font-semibold text-ink">{legend}</legend>
      {description && <p className="text-[12px] leading-relaxed text-ink-muted">{description}</p>}
      {children}
    </fieldset>
  )
}
