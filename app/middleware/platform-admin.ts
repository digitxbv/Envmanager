export default defineNuxtRouteMiddleware(async () => {
  const client = useSupabaseClient()

  const { data: { user } } = await client.auth.getUser()

  if (!user) {
    return navigateTo('/auth/login')
  }

  const { data, error } = await client
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.warn('[platform-admin middleware] Failed to verify platform admin access:', error)
    return navigateTo('/dashboard')
  }

  if (!data) {
    return navigateTo('/dashboard')
  }
})
