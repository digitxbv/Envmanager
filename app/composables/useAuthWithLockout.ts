export function useAuthWithLockout() {
  const supabase = useSupabaseClient()

  async function signInWithLockout(email: string, password: string) {
    // Check if account is locked before attempting login
    const { data: lockStatus, error: lockError } = await supabase
      .rpc('check_account_lock', { target_email: email })

    if (lockError) {
      console.error('Lock check failed:', lockError)
      // Don't block login if lock check fails - fall through to normal auth
    }

    const lockInfo = lockStatus?.[0]

    if (lockInfo?.is_locked) {
      const mins = Math.ceil(
        (new Date(lockInfo.locked_until).getTime() - Date.now()) / 60000
      )
      throw new Error(`Account temporarily locked. Try again in ${mins} minute${mins !== 1 ? 's' : ''}.`)
    }

    // Attempt login
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    // Record the attempt (fire and forget - don't block on this)
    supabase.rpc('record_login_attempt', {
      target_email: email,
      attempt_ip: null,
      was_successful: !error
    }).then(({ error: rpcErr }) => {
      if (rpcErr) console.error('Failed to record login attempt:', rpcErr)
    })

    if (error) {
      const remaining = (lockInfo?.attempts_remaining ?? 5) - 1
      if (remaining <= 0) {
        throw new Error('Account locked due to too many failed attempts. Try again in 15 minutes.')
      }
      if (remaining <= 3) {
        throw new Error(`Invalid credentials. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining before lockout.`)
      }
      throw error
    }

    return data
  }

  return { signInWithLockout }
}
