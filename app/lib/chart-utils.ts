/**
 * Generate date labels for the last N days (default 7).
 */
export function generateEmptyLabels(days = 7): string[] {
  const labels = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
  }
  return labels
}

/**
 * Generate an array of zeros for empty chart data.
 */
export function generateEmptyData(length = 7): number[] {
  return Array(length).fill(0)
}
