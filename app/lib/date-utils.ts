/**
 * Format a date string as a relative time (e.g. "5m ago", "2d ago").
 * Falls back to locale date string for dates older than 30 days.
 */
export function formatRelativeDate(dateString: string): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay < 30) return `${diffDay}d ago`
  return date.toLocaleDateString()
}
