/**
 * Stands in front of the application when a live backend is configured.
 *
 * Studio's backend holds the KAE-Memory credential and the browser holds only a
 * signed session cookie, so something has to exchange a password for that
 * cookie. This is that something, and it is deliberately the whole of Studio's
 * identity story today: one operator, one password, no accounts.
 *
 * Against the mock services this never renders — there is nothing to sign in to,
 * and a login screen in front of fixtures would be theatre.
 */

import { useEffect, useState, type ReactNode } from 'react'

import { Field, Input } from '@/components/ui/form'
import { Button, Mono, Panel, PanelBody } from '@/components/ui/primitives'

const API = (import.meta.env.VITE_STUDIO_API as string | undefined) ?? ''

type State = 'checking' | 'signed-out' | 'signed-in' | 'unreachable'

export function SignInGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>('checking')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [backend, setBackend] = useState<{ memory_reachable?: boolean; memory_url?: string }>({})

  // Bumped to re-run the check. The gate ran once on mount and never again, so
  // a backend restart of a few seconds pinned "unreachable" until someone
  // thought to reload — and the screen offered no reason to think that would
  // help.
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        // Status first, and unauthenticated on purpose: a locked door and a
        // missing building look identical from a 401 alone, and an operator
        // needs to know which one they are looking at.
        const status = await fetch(`${API}/api/status`, { credentials: 'include' })
        if (!status.ok) throw new Error('status unavailable')
        if (!cancelled) setBackend(await status.json())
        const session = await fetch(`${API}/api/session`, { credentials: 'include' })
        if (!cancelled) setState(session.ok ? 'signed-in' : 'signed-out')
      } catch {
        if (!cancelled) setState('unreachable')
      }
    }
    void check()
    return () => {
      cancelled = true
    }
  }, [attempt])

  function retry() {
    setState('checking')
    setAttempt((n) => n + 1)
  }

  async function signIn(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    const response = await fetch(`${API}/api/session`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (response.ok) {
      setPassword('')
      setState('signed-in')
    } else {
      setError(
        response.status === 401 ? 'Incorrect password.' : `Sign-in failed (${response.status}).`,
      )
    }
  }

  if (state === 'checking')
    return (
      <Centered>
        <p className="text-[13px] text-ink-muted">Checking Studio…</p>
      </Centered>
    )

  if (state === 'unreachable') {
    return (
      <Centered>
        <Panel className="max-w-md text-left">
          <PanelBody className="space-y-2">
            <h1 className="text-[15px] font-semibold text-ink">Studio backend unreachable</h1>
            <p className="text-[13px] leading-relaxed text-ink-muted">
              Nothing was loaded, and nothing on screen would be project truth. Expected it at{' '}
              <Mono>{API || '(same origin)'}</Mono>.
            </p>
            <p className="text-[12px] leading-relaxed text-ink-subtle">
              A restart looks exactly like this for the few seconds it takes. Nothing was written.
            </p>
            <Button type="button" onClick={retry} className="mt-1">
              Try again
            </Button>
          </PanelBody>
        </Panel>
      </Centered>
    )
  }

  if (state === 'signed-out') {
    return (
      <Centered>
        <Panel className="w-[22rem] text-left">
          <PanelBody>
            <form onSubmit={signIn} className="space-y-3">
              <h1 className="text-[15px] font-semibold text-ink">Sign in to KAE-Studio</h1>
              {/* Said before signing in rather than discovered after. Memory
                  being unreachable does not stop sign-in and does stop every
                  page behind it, which is the kind of thing a person should
                  learn at the door. */}
              <p className="text-[12px] leading-relaxed text-ink-muted">
                {backend.memory_reachable ? (
                  <>
                    Memory reachable at <Mono>{backend.memory_url}</Mono>
                  </>
                ) : (
                  'Memory is not reachable. Sign-in will work; nothing behind it will have data.'
                )}
              </p>
              <Field label="Operator password" error={error}>
                {(props) => (
                  <Input
                    {...props}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                  />
                )}
              </Field>
              <Button type="submit" variant="primary" className="w-full">
                Sign in
              </Button>
            </form>
          </PanelBody>
        </Panel>
      </Centered>
    )
  }

  return <>{children}</>
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas p-6">
      <div>{children}</div>
    </div>
  )
}
