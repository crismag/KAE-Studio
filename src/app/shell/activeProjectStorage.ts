/**
 * The one thing about a project that lives in the browser.
 *
 * **Only the preference.** The project itself, its conversation and its
 * knowledge are Memory's. What `localStorage` holds is one id — "the one I was
 * last looking at" — which is a UI preference and survives being wrong: if that
 * project is gone, the picker comes back.
 *
 * Its own module because it is storage access rather than rendering. A file
 * exporting both cannot be hot-reloaded, which is what
 * `react-refresh/only-export-components` was pointing at, and the separation is
 * the better shape anyway.
 */

export const STORAGE_KEY = 'kae-studio.active-project'

export function readActiveProject(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    // Private browsing, or storage disabled. Losing the preference is a worse
    // session, not a broken one — the picker simply appears every time.
    return null
  }
}
