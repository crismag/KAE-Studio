/**
 * "1 dependency" / "2 dependencies" — avoids the "1 dependencies" tell.
 *
 * The doc comment promised *dependencies* and the code produced **dependencys**:
 * appending `s` is wrong for every English word ending in a consonant + `y`, and
 * `plural(68, 'repository')` put *"68 repositorys available"* on the GitHub
 * settings page of a live deployment. A caller could pass the plural explicitly
 * and most did not, because the helper reads as though it handles this.
 */
export function plural(count: number, singular: string, pluralForm?: string): string {
  const word = count === 1 ? singular : (pluralForm ?? pluraliseEnglish(singular))
  return `${count} ${word}`
}

/**
 * The two rules that cover the words this product counts.
 *
 * Deliberately not a full inflector: nothing here counts *children* or *analyses*,
 * and a caller with an irregular word passes it rather than growing a table
 * nobody maintains.
 */
function pluraliseEnglish(singular: string): string {
  // consonant + y → ies. `day` keeps its `s`; `repository` does not.
  if (/[^aeiou]y$/i.test(singular)) return `${singular.slice(0, -1)}ies`
  // A trailing `s`, `x`, `z`, `ch` or `sh` needs the extra syllable.
  if (/(s|x|z|ch|sh)$/i.test(singular)) return `${singular}es`
  return `${singular}s`
}
