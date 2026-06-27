/**
 * Apply prefix to variable key with smart duplicate detection.
 * - Normalizes prefix to uppercase
 * - Adds underscore separator
 * - Skips prefixing if variable already starts with the prefix
 */
export function applyPrefix(variableKey: string, prefix: string | null): string {
  if (!prefix) return variableKey

  const normalizedPrefix = prefix.toUpperCase()
  const separator = '_'
  const fullPrefix = `${normalizedPrefix}${separator}`

  // Smart duplicate detection - case-insensitive
  if (variableKey.toUpperCase().startsWith(fullPrefix)) {
    return variableKey // Already has prefix, don't double-prefix
  }

  return `${fullPrefix}${variableKey}`
}
