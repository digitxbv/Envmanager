/**
 * Generate a URL-safe slug from a name.
 * Lowercase, replace non-alphanumeric with hyphens, trim, max 50 chars.
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}

/**
 * Build the hosted proxy handler URL from a Supabase URL and proxy ID.
 */
export function getProxyHandlerUrl(supabaseUrl: string, proxyId: string): string {
  return `${supabaseUrl}/functions/v1/proxy-handler/${proxyId}`
}
