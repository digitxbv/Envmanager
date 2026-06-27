/**
 * Inbucket Email Testing Helper
 * Inbucket runs at localhost:54434 as part of Supabase local dev
 */

const INBUCKET_BASE_URL = 'http://localhost:54434'

interface InbucketMessage {
  id: string
  from: string
  to: string[]
  subject: string
  date: string
  size: number
}

interface InbucketMessageContent {
  mailbox: string
  id: string
  from: string
  to: string[]
  subject: string
  date: string
  body: {
    text: string
    html: string
  }
}

/**
 * Get all emails for a mailbox (local part of email)
 * e.g., for "test@example.com" use localPart "test"
 */
export async function getMailbox(localPart: string): Promise<InbucketMessage[]> {
  const response = await fetch(`${INBUCKET_BASE_URL}/api/v1/mailbox/${localPart}`)
  if (!response.ok) {
    if (response.status === 404) return []
    throw new Error(`Failed to get mailbox: ${response.status}`)
  }
  return response.json()
}

/**
 * Get a specific email by ID
 */
export async function getEmail(localPart: string, messageId: string): Promise<InbucketMessageContent> {
  const response = await fetch(`${INBUCKET_BASE_URL}/api/v1/mailbox/${localPart}/${messageId}`)
  if (!response.ok) {
    throw new Error(`Failed to get email: ${response.status}`)
  }
  return response.json()
}

/**
 * Get the latest email for a mailbox
 */
export async function getLatestEmail(localPart: string): Promise<InbucketMessageContent | null> {
  const messages = await getMailbox(localPart)
  if (messages.length === 0) return null
  
  // Sort by date descending and get most recent
  const sorted = messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  return getEmail(localPart, sorted[0].id)
}

/**
 * Wait for an email to arrive (polling)
 */
export async function waitForEmail(
  localPart: string,
  options: { timeout?: number; pollInterval?: number; afterDate?: Date } = {}
): Promise<InbucketMessageContent> {
  const { timeout = 30000, pollInterval = 1000, afterDate } = options
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    const messages = await getMailbox(localPart)
    
    const filtered = afterDate
      ? messages.filter(m => new Date(m.date) > afterDate)
      : messages

    if (filtered.length > 0) {
      const sorted = filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      return getEmail(localPart, sorted[0].id)
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval))
  }

  throw new Error(`Timeout waiting for email to ${localPart}@* after ${timeout}ms`)
}

/**
 * Clear all emails in a mailbox
 */
export async function clearMailbox(localPart: string): Promise<void> {
  const response = await fetch(`${INBUCKET_BASE_URL}/api/v1/mailbox/${localPart}`, {
    method: 'DELETE'
  })
  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to clear mailbox: ${response.status}`)
  }
}

/**
 * Extract invitation link from email HTML body
 */
export function extractInviteLink(emailHtml: string): string | null {
  const match = emailHtml.match(/href="([^"]*\/auth\/accept-invite[^"]*)"/i)
  if (match) return match[1]
  
  const urlMatch = emailHtml.match(/(https?:\/\/[^\s<>"]*\/auth\/accept-invite[^\s<>"]*)/i)
  return urlMatch ? urlMatch[1] : null
}

/**
 * Generate a unique test email address
 */
export function generateTestEmail(prefix: string = 'test'): { email: string; localPart: string } {
  const localPart = `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`
  return {
    email: `${localPart}@example.com`,
    localPart
  }
}
