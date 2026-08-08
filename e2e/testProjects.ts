/**
 * The fixed set of projects this suite is allowed to create.
 *
 * **Bounded by construction, not by cleanup working.** The previous version
 * named each project with a timestamp, so every run created eleven new ones and
 * relied on teardown to remove them. Teardown then had a bug that removed only
 * one, and nobody noticed until there were a hundred and one projects in a real
 * deployment.
 *
 * A fixed name cannot do that. `create_project` in KAE-Memory is idempotent by
 * the key derived from the name, so running the suite a thousand times reuses
 * these and creates nothing. Teardown still removes them — but it is now belt
 * and braces rather than the only thing standing between a test run and an
 * unusable project list.
 *
 * The prefix is deliberate and ugly. Anyone looking at a project list should be
 * able to tell at a glance which entries are machinery and which are somebody's
 * work.
 */

const PREFIX = 'ZZ automated test'

/** The project most tests run against. */
export const MAIN = `${PREFIX} — main`

/** A second and third, for proving one project does not show another's content. */
export const LEFT = `${PREFIX} — left`
export const RIGHT = `${PREFIX} — right`

/** Recovery path, when a context has lost its remembered project. */
export const RECOVERY = `${PREFIX} — recovery`

/** Every name the suite may create. Nothing outside this list is ours. */
export const ALL = [MAIN, LEFT, RIGHT, RECOVERY]
