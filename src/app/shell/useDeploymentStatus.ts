/**
 * What this deployment actually is, from `/api/status`.
 *
 * The footer used to assert three things it could not know. `Prototype — mock
 * data` was a literal `<Badge>` on a page serving live KAE-Memory; `Memory:
 * synchronised` was a hard-coded string with no code path that could ever
 * render anything else, including a failure; and the revision came from a field
 * that stops moving whenever readiness stops being recalculated.
 *
 * A green label that cannot go red is not a status, it is decoration — and the
 * cost is worse than nothing, because a reader who has learned to trust it will
 * keep trusting it through an outage.
 *
 * Unauthenticated on purpose, matching the endpoint: a status that needs a
 * session cannot tell you why your session is failing.
 */

import { useEffect, useState } from 'react'

const API = (import.meta.env.VITE_STUDIO_API as string | undefined) ?? ''

export type DeploymentStatus = {
  memoryReachable: boolean
  /** Alembic revision the deployed KAE-Memory is migrated to, when it says. */
  migrationRevision?: string
  /** `disabled` means every route is open. Worth showing loudly. */
  authentication?: string
  interviewProvider?: string
  memoryUrl?: string
  /**
   * Whether this deployment can generate and publish packages at all.
   *
   * `/api/status` has reported it since the artifact routes existed and
   * nothing read it — so the workspace told every user "the project context
   * package can be generated" while every artifact route answered
   * `501 artifacts_not_configured`.
   */
  artifactsConfigured?: boolean
  /**
   * Whether KAE-Artifacts answered when Studio asked, as opposed to merely
   * having a URL set (`D-334`).
   *
   * Absent when nothing is configured — there is no service to be unreachable,
   * and an operator's unfilled setting is not an outage. A panel read
   * `artifactsConfigured` and promised a package on a deployment whose
   * KAE-Artifacts was stopped.
   */
  artifactsReachable?: boolean
  /**
   * The GitHub App's URL slug, when this deployment has one registered.
   *
   * Absent means there is nothing to install, which is why the Connect control
   * is omitted rather than linking somewhere that 404s (`D-79`).
   */
  githubAppSlug?: string
  /** Whether this host has a GitHub App id and key (`/api/status` `github_app`). */
  githubApp?: string
  /**
   * Whether this host holds a personal token (`STUDIO_GITHUB_SOURCE_TOKEN`).
   * That token is never shown and never typed in the browser.
   */
  githubSource?: string
  /** Which credential acquisition will actually use. */
  githubCredential?: string
  /** How many directories this deployment may read as sources (`D-67`). */
  localSources?: number
}

type State =
  { state: 'checking' } | { state: 'unavailable' } | { state: 'ready'; status: DeploymentStatus }

/**
 * Polls slowly. Connectivity is the only thing here that changes on its own,
 * and a footer that refetches every few seconds spends a request per reader per
 * minute to tell them what they already believe. Thirty seconds is late enough
 * to be cheap and early enough that nobody works long against a dead backend.
 */
const INTERVAL_MS = 30_000

export function useDeploymentStatus(): State {
  const [state, setState] = useState<State>({ state: 'checking' })

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        const response = await fetch(`${API}/api/status`, { credentials: 'include' })
        if (!response.ok) throw new Error(String(response.status))
        const raw = (await response.json()) as Record<string, unknown>
        if (cancelled) return
        const memory = (raw.memory ?? {}) as Record<string, unknown>
        const provider = (raw.interview_provider ?? {}) as Record<string, unknown>
        setState({
          state: 'ready',
          status: {
            memoryReachable: raw.memory_reachable === true,
            migrationRevision:
              typeof memory.migration_revision === 'string' ? memory.migration_revision : undefined,
            authentication: typeof raw.authentication === 'string' ? raw.authentication : undefined,
            interviewProvider: typeof provider.name === 'string' ? provider.name : undefined,
            memoryUrl: typeof raw.memory_url === 'string' ? raw.memory_url : undefined,
            artifactsConfigured: raw.artifacts === 'configured',
            artifactsReachable:
              typeof raw.artifacts_reachable === 'boolean' ? raw.artifacts_reachable : undefined,
            localSources: typeof raw.local_sources === 'number' ? raw.local_sources : undefined,
            githubAppSlug:
              typeof raw.github_app_slug === 'string' && raw.github_app_slug
                ? raw.github_app_slug
                : undefined,
            githubApp: typeof raw.github_app === 'string' ? raw.github_app : undefined,
            githubSource: typeof raw.github_source === 'string' ? raw.github_source : undefined,
            githubCredential:
              typeof raw.github_credential === 'string' ? raw.github_credential : undefined,
          },
        })
      } catch {
        // The backend being unreachable is itself a status, and a distinct one
        // from "reachable and reporting a problem". Collapsing the two would
        // hide exactly the case where the footer earns its place.
        if (!cancelled) setState({ state: 'unavailable' })
      }
    }

    void check()
    const timer = window.setInterval(() => void check(), INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  return state
}
