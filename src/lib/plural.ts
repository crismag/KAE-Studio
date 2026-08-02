/** "1 dependency" / "2 dependencies" — avoids the "1 dependencies" tell. */
export function plural(count: number, singular: string, pluralForm?: string): string {
  const word = count === 1 ? singular : (pluralForm ?? `${singular}s`)
  return `${count} ${word}`
}
