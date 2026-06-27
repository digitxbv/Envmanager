/**
 * Get a required environment variable or throw a descriptive error.
 * Replaces non-null assertions (!) on Deno.env.get() calls.
 */
export function requireEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}
