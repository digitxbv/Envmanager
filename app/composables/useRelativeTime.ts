// =====================================================
// Relative Time Composable
// =====================================================
// Formats timestamps as relative time ("5 minutes ago")
// with absolute time available for hover tooltips

/**
 * Returns relative and absolute time strings for a date
 * @param dateGetter - Reactive getter for date string
 * @returns { relativeTime, absoluteTime } computed refs
 *
 * Usage:
 * const { relativeTime, absoluteTime } = useRelativeTime(() => syncConfig.last_synced_at)
 * <span :title="absoluteTime">{{ relativeTime }}</span>
 */
export function useRelativeTime(dateGetter: () => string | null | undefined) {
  const relativeTime = computed(() => {
    const dateString = dateGetter()
    if (!dateString) return null

    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffSecs / 60)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffSecs < 60) return 'just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  })

  const absoluteTime = computed(() => {
    const dateString = dateGetter()
    if (!dateString) return ''

    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  })

  return { relativeTime, absoluteTime }
}
