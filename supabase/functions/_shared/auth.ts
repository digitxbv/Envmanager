import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface AuthResult {
  user: { id: string; email?: string } | null
  userClient: SupabaseClient
  serviceClient: SupabaseClient
  error: string | null
}

/**
 * Verify authentication from request Authorization header
 * Returns both user-scoped client (for RLS) and service client (for privileged ops)
 */
export async function verifyAuth(
  req: Request,
  supabaseUrl: string,
  supabaseAnonKey: string,
  supabaseServiceKey: string
): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization')

  // Create service client (always available for privileged operations)
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

  // Create user client with auth header for RLS-protected queries
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: authHeader ? { Authorization: authHeader } : {} },
  })

  if (!authHeader) {
    return {
      user: null,
      userClient,
      serviceClient,
      error: 'Missing authorization header',
    }
  }

  // Verify the token by getting the user
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser()

  if (authError || !user) {
    return {
      user: null,
      userClient,
      serviceClient,
      error: authError?.message || 'Invalid authentication',
    }
  }

  return {
    user: { id: user.id, email: user.email },
    userClient,
    serviceClient,
    error: null,
  }
}
