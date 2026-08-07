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
      setError(response.status === 401 ? 'Incorrect password.' : `Sign-in failed (${response.status}).`)
    }
  }

  if (state === 'checking') return <Centered>Checking Studio…</Centered>

  if (state === 'unreachable') {
    return (
      <Centered>
        <h1 style={{ fontSize: 18, marginBottom: 8 }}>Studio backend unreachable</h1>
        <p style={{ opacity: 0.75, maxWidth: 460 }}>
          Nothing was loaded, and nothing on screen would be project truth. Expected it at{' '}
          <code>{API || '(same origin)'}</code>.
        </p>
        <p style={{ opacity: 0.6, maxWidth: 460, fontSize: 13, marginTop: 8 }}>
          A restart looks exactly like this for the few seconds it takes. Nothing was written.
        </p>
        <button type="button" onClick={retry} style={{ marginTop: 14, padding: '8px 14px', borderRadius: 6 }}>
          Try again
        </button>
      </Centered>
    )
  }

  if (state === 'signed-out') {
    return (
      <Centered>
        <form onSubmit={signIn} style={{ display: 'grid', gap: 12, width: 320 }}>
          <h1 style={{ fontSize: 18 }}>Sign in to KAE-Studio</h1>
          <p style={{ opacity: 0.7, fontSize: 13 }}>
            Memory:{' '}
            {backend.memory_reachable ? (
              <span>reachable at {backend.memory_url}</span>
            ) : (
              <span>not reachable — sign-in will work, data will not</span>
            )}
          </p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Operator password"
            autoFocus
            style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #8884' }}
          />
          {error && <span style={{ color: '#c33', fontSize: 13 }}>{error}</span>}
          <button type="submit" style={{ padding: '8px 10px', borderRadius: 6 }}>
            Sign in
          </button>
        </form>
      </Centered>
    )
  }

  return <>{children}</>
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        textAlign: 'center',
        padding: 24,
      }}
    >
      <div>{children}</div>
    </div>
  )
}
