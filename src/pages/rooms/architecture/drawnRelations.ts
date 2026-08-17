/**
 * What the picture does with each of `ModuleRelation`'s six members, and why.
 *
 * `ArchitectureDiagram` kept `edge.relation === 'depends_on'` and dropped the
 * other five, and the file's docstring argued for two of them. A comparison
 * against one word cannot record five different reasons, and it cannot be
 * checked: a seventh relation added in KAE-Memory would arrive over
 * `/modules/graph`, fail the comparison, and vanish without failing anything
 * (`D-219`, and `D-213`'s shape).
 *
 * Three lists instead, each holding a reason, and a guard asserting they cover
 * `MEMORY_MODULE_RELATIONS` exactly and overlap nowhere. A new relation then
 * has to be placed by somebody before the diagram compiles a decision about it.
 */

/**
 * The one relation the picture draws.
 *
 * Position carries depth in build order and build order follows `depends_on`
 * alone, so this is not a subset of what could be drawn — it is the relation
 * the layout *is*.
 */
export const DRAWN = ['depends_on']

/**
 * Relations with no node to point at.
 *
 * These run to statements rather than modules. There is no box to draw one to,
 * and drawing it to a module's box would say that module depends on another
 * when it does not. Argued for when the diagram was written, and still right.
 */
export const NOT_DRAWABLE = ['satisfies', 'verified_by']

/**
 * Module-to-module relations the picture does not draw yet.
 *
 * Each has a box at both ends, so `NOT_DRAWABLE`'s reasoning does not reach
 * them — they were dropped by a filter that named `depends_on`, without a word.
 * A second line style would have to say what the difference is, and the
 * diagram's rule is that every visual property not carrying information stays
 * constant; choosing one is a decision about what the picture may say rather
 * than a rendering detail, and it is still open.
 *
 * Until it is made the caption names the ones a project actually records, which
 * is the difference between a partial drawing and a drawing that looks
 * complete.
 */
export const UNDRAWN_STRUCTURAL = ['owns', 'exposes', 'consumes']
