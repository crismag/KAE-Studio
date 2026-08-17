/**
 * An absent or unparseable timestamp, rendered as one.
 *
 * `Intl.DateTimeFormat.format` throws a RangeError on an Invalid Date, so a
 * single missing timestamp in a list takes down the whole route. That is the
 * wrong trade for a display helper: a row with an unknown date is still worth
 * reading, and a blank page tells nobody which record was at fault.
 *
 * An em dash rather than today's date or an empty string — the reader can see
 * that the value is unknown rather than being shown a plausible wrong one.
 */
const UNKNOWN_DATE = '—'

function parse(iso: string): Date | null {
  if (!iso) return null
  const date = new Date(iso)
  return Number.isFinite(date.getTime()) ? date : null
}

/**
 * Whether a timestamp is one this helper can render as a date.
 *
 * For callers that would rather say nothing than say *"valid until —"*: a
 * deadline is only worth a sentence when there is a deadline in it.
 */
export function isKnownTimestamp(iso: string): boolean {
  return parse(iso) !== null
}

/** Formats an ISO timestamp for display. Fixed locale for deterministic output. */
export function formatDateTime(iso: string): string {
  const date = parse(iso)
  if (!date) return UNKNOWN_DATE
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(date)
}

export function formatDate(iso: string): string {
  const date = parse(iso)
  if (!date) return UNKNOWN_DATE
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

/**
 * A byte count in kilobytes, to one decimal.
 *
 * Kilobytes at every size on purpose. The only place this is read is a file
 * list beside a ceiling those files are measured against, and *2.3 MB* over
 * *976.6 KB* asks a reader to convert units to answer *which is bigger* — the
 * one question the number is there for.
 */
export function kilobytes(bytes: number): string {
  return `${Math.round(bytes / 102.4) / 10} KB`
}
