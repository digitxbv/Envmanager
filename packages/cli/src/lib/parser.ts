import { parse as parseDotenv } from 'dotenv'
import chalk from 'chalk'

export interface ParsedEnvVar {
  key: string
  value: string
}

/**
 * Parse a .env file string using dotenv. Returns a Map<string, string>.
 * Warns when duplicate keys are detected (dotenv uses last-wins).
 */
export function parseEnvFile(content: string): Map<string, string> {
  const parsed = parseDotenv(content)

  // Detect duplicates by scanning raw lines
  const seen = new Set<string>()
  const duplicates: string[] = []
  for (const line of content.split('\n')) {
    const match = line.match(/^\s*([^#=\s][^=]*?)\s*=/)
    if (match) {
      const key = match[1]
      if (seen.has(key)) {
        duplicates.push(key)
      }
      seen.add(key)
    }
  }

  if (duplicates.length > 0) {
    console.warn(
      chalk.yellow(`Warning: Duplicate keys detected (last value wins): ${duplicates.join(', ')}`)
    )
  }

  return new Map(Object.entries(parsed))
}

/**
 * Parse a .env file string and return as an array of {key, value} pairs.
 * Convenience wrapper for commands that need array format (e.g., push).
 */
export function parseEnvFileAsArray(content: string): ParsedEnvVar[] {
  const map = parseEnvFile(content)
  return Array.from(map.entries()).map(([key, value]) => ({ key, value }))
}
