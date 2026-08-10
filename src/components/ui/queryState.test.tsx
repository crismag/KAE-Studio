/**
 * A failed read is not a slow read, and the product could not tell them apart.
 *
 * `App.tsx` sets `retry: false` and **no route renders an error state**. Every
 * data route guards with `isLoading || !data` and returns a `Skeleton`, so a
 * fetch that failed leaves six screens pulsing grey forever while a person
 * waits for something that already finished.
 *
 * Worse than an empty panel, because an empty panel at least stops. These
 * assert the three states are three states.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UseQueryResult } from '@tanstack/react-query'

import { QueryState } from './QueryState'

function query<T>(over: Partial<UseQueryResult<T>>): UseQueryResult<T> {
  return {
    isPending: false,
    isError: false,
    data: undefined,
    error: null,
    refetch: vi.fn(),
    ...over,
  } as unknown as UseQueryResult<T>
}

describe('while a read is in flight', () => {
  it('shows the skeleton it was given', () => {
    render(
      <QueryState
        query={query<string[]>({ isPending: true })}
        of="Your sources"
        skeleton={<p>loading…</p>}
      >
        {() => <p>never</p>}
      </QueryState>,
    )

    expect(screen.getByText('loading…')).toBeInTheDocument()
  })
})

describe('when a read fails', () => {
  const failed = query<string[]>({
    isError: true,
    error: new Error('Memory did not answer within 5s'),
  })

  it('says so, rather than looking like it is still loading', () => {
    render(
      <QueryState query={failed} of="Your sources" skeleton={<p>loading…</p>}>
        {() => <p>never</p>}
      </QueryState>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(/could not be read/i)
    expect(screen.queryByText('loading…')).not.toBeInTheDocument()
  })

  it('names what failed, so a person knows what they are missing', () => {
    render(
      <QueryState query={failed} of="Your sources">
        {() => <p>never</p>}
      </QueryState>,
    )

    expect(screen.getByText(/Your sources could not be read/i)).toBeInTheDocument()
  })

  it('carries the real message verbatim', () => {
    render(
      <QueryState query={failed} of="Your sources">
        {() => <p>never</p>}
      </QueryState>,
    )

    // A summarised error is one a person cannot search for, and the summary is
    // usually written by whoever knows least about the failure.
    expect(screen.getByText('Memory did not answer within 5s')).toBeInTheDocument()
  })

  it('says nothing about the project changed', () => {
    // The distinction that matters most. A blank screen reads as "your project
    // is empty"; this has to read as "we could not look".
    render(
      <QueryState query={failed} of="Your sources">
        {() => <p>never</p>}
      </QueryState>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(/nothing about your project has changed/i)
  })

  it('offers a retry that actually refetches', async () => {
    const user = userEvent.setup()
    const refetch = vi.fn()
    render(
      <QueryState query={query<string[]>({ isError: true, error: new Error('x'), refetch })} of="X">
        {() => <p>never</p>}
      </QueryState>,
    )

    await user.click(screen.getByRole('button', { name: /try again/i }))

    expect(refetch).toHaveBeenCalledOnce()
  })

  it('treats a resolved-but-undefined result as a failure too', () => {
    // The shape that produced the permanent skeleton: not an error, and no
    // data. `isLoading || !data` renders it as loading forever.
    render(
      <QueryState query={query<string[]>({ data: undefined })} of="X" skeleton={<p>loading…</p>}>
        {() => <p>never</p>}
      </QueryState>,
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})

describe('when a read succeeds', () => {
  it('renders the data', () => {
    render(
      <QueryState query={query({ data: ['a', 'b'] })} of="X">
        {(rows) => <p>{rows.join(',')}</p>}
      </QueryState>,
    )

    expect(screen.getByText('a,b')).toBeInTheDocument()
  })

  it('shows the empty state only when the answer is genuinely nothing', () => {
    render(
      <QueryState query={query({ data: [] as string[] })} of="X" empty={<p>none yet</p>}>
        {() => <p>never</p>}
      </QueryState>,
    )

    expect(screen.getByText('none yet')).toBeInTheDocument()
  })

  it('does not confuse empty with failed', () => {
    // Two opposite meanings — "you have none" and "we could not tell" — and
    // rendering them the same is the whole subject of the audit this repository
    // spent a week on.
    render(
      <QueryState query={query({ data: [] as string[] })} of="X" empty={<p>none yet</p>}>
        {() => <p>never</p>}
      </QueryState>,
    )

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
