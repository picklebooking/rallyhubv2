/**
 * Converts a `YYYY-MM-DD` picked in the browser to that local day's [from, to)
 * ISO instants, or `null` if `date` isn't a valid calendar date (this value
 * comes from a URL search param, so it can be anything — a stale or
 * hand-edited link, not just what the date picker produces). The discovery
 * list spans venues, so there's no single venue zone to filter in; the
 * filter uses the viewer's day (see the spec).
 */
function localDayRange(date: string): { from: string; to: string } | null {
  const start = new Date(`${date}T00:00:00`)
  if (Number.isNaN(start.getTime())) return null
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { from: start.toISOString(), to: end.toISOString() }
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function startsAtFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone,
      timeZoneName: "short",
    })
    formatters.set(timeZone, formatter)
  }
  return formatter
}

/**
 * Formats a game's start in the **venue's** timezone (with the zone
 * abbreviation), so it reads the same for every viewer. Falls back to the
 * browser zone only if the venue's zone string is invalid.
 */
function formatStartsAt(iso: string, timeZone: string): string {
  try {
    return startsAtFormatter(timeZone).format(new Date(iso))
  } catch {
    return new Date(iso).toLocaleString()
  }
}

export { formatStartsAt, localDayRange }
