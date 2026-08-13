/**
 * A pointer to work in flight, so a refresh does not lose it.
 *
 * ## What this is not
 *
 * It is **not** pipeline state. `plan`, `run`, `approval` and `publication` all
 * live in KAE-Artifacts, which is authoritative for every one of them and can
 * be asked. What the browser held that nothing else did was the *identifiers* —
 * so a refresh after generating a package lost the package id, the approval and
 * the publication, with no list view to recover them, while
 * `GET /api/artifact-packages/{id}` and `GET /api/artifact-publications/{id}`
 * sat there answering (AUD-017).
 *
 * So this stores pointers and re-reads the authoritative state through them.
 * Storing the *state* here would be the defect this repository keeps finding:
 * a second copy that can disagree with the system that owns it.
 *
 * ## Why session rather than local storage
 *
 * A generation in flight belongs to the tab doing it. `localStorage` would
 * share it across every tab and outlive the browser session, which turns a
 * pointer into a stale claim about work somebody else finished.
 *
 * ## Why it is keyed by project
 *
 * Two projects generating packages in two tabs must not recover each other's.
 * The same reason `activeProjectStorage` is scoped the way it is.
 */

const PREFIX = 'kae-studio.pipeline.'

export interface PipelineHandle {
  packageId?: string
  previewId?: string
  approvalId?: string
  publicationId?: string
}

function key(projectId: string): string {
  return `${PREFIX}${projectId}`
}

export function readHandle(projectId: string): PipelineHandle {
  if (!projectId) return {}
  try {
    const raw = sessionStorage.getItem(key(projectId))
    return raw ? (JSON.parse(raw) as PipelineHandle) : {}
  } catch {
    // A malformed or unavailable store is not worth failing a page over, and
    // the consequence of returning nothing is exactly the old behaviour.
    return {}
  }
}

export function writeHandle(projectId: string, handle: PipelineHandle): void {
  if (!projectId) return
  try {
    const merged = { ...readHandle(projectId), ...handle }
    sessionStorage.setItem(key(projectId), JSON.stringify(merged))
  } catch {
    // Private browsing, a full quota, a disabled store. The pipeline still
    // works; it just stops being resumable, which is where it started.
  }
}

export function clearHandle(projectId: string): void {
  if (!projectId) return
  try {
    sessionStorage.removeItem(key(projectId))
  } catch {
    /* see above */
  }
}
