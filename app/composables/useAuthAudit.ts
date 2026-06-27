import type { Database } from '~/types/database.types'

export function useAuthAudit() {
  const supabase = useSupabaseClient<Database>()

  async function logAuthEvent(
    eventType: string,
    success: boolean,
    metadata?: Record<string, any>,
    email?: string
  ) {
    try {
      await supabase.rpc('log_auth_event', {
        p_event_type: eventType,
        p_success: success,
        p_metadata: metadata || {},
        p_email: email,
      })
    } catch {
      // Never break auth flow for logging
    }
  }

  return { logAuthEvent }
}
