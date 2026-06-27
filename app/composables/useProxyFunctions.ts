// =====================================================
// Proxy Functions Composable
// =====================================================
// CRUD composable for managing proxy functions per environment.

import type { Database } from '~/types/database.types'
import type { ProxyFunction, ProxyFunctionForm } from '~/types/proxy.types'
import { generateSlug } from '~/lib/proxy-utils'

/**
 * Generate a random secret token for proxy function authentication.
 */
function generateSecretToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('')
}

export function useProxyFunctions(environmentId: Ref<string>) {
  const client = useSupabaseClient<Database>()
  const user = useSupabaseUser()
  const organizationStore = useOrganizationStore()
  const { $toast } = useNuxtApp()
  const { checkLimit } = useLimits()

  const proxyFunctions = ref<ProxyFunction[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchProxyFunctions() {
    loading.value = true
    error.value = null
    try {
      const { data, error: fetchError } = await client
        .from('proxy_functions')
        .select('*')
        .eq('environment_id', environmentId.value)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError
      proxyFunctions.value = (data ?? []) as unknown as ProxyFunction[]
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch proxy functions'
      error.value = msg
      console.error('[useProxyFunctions] Fetch error:', err)
    } finally {
      loading.value = false
    }
  }

  async function createProxyFunction(form: ProxyFunctionForm) {
    loading.value = true
    error.value = null
    try {
      // Check billing limits
      const limitResult = await checkLimit('proxy_functions')
      if (!limitResult.allowed) {
        const event = new CustomEvent('billing:limit-reached', {
          detail: limitResult
        })
        window.dispatchEvent(event)
        return { data: null, error: 'Proxy function limit reached' }
      }

      const orgId = organizationStore.selectedOrganizationId
      if (!orgId) throw new Error('No organization selected')

      const userId = user.value?.id ?? user.value?.sub
      if (!userId) throw new Error('Not authenticated')

      const slug = generateSlug(form.name)
      const secretToken = generateSecretToken()

      const { data, error: insertError } = await client
        .from('proxy_functions')
        .insert({
          organization_id: orgId,
          environment_id: environmentId.value,
          name: form.name.trim(),
          slug,
          description: form.description?.trim() || null,
          service_id: form.service_id,
          target_url: form.target_url.trim(),
          http_method: form.http_method,
          target_headers: form.target_headers as unknown as Database['public']['Tables']['proxy_functions']['Insert']['target_headers'],
          secret_mappings: form.secret_mappings as unknown as Database['public']['Tables']['proxy_functions']['Insert']['secret_mappings'],
          allowed_origins: form.allowed_origins as unknown as Database['public']['Tables']['proxy_functions']['Insert']['allowed_origins'],
          request_body_template: form.request_body_template as unknown as Database['public']['Tables']['proxy_functions']['Insert']['request_body_template'],
          pass_through_body: form.pass_through_body,
          rate_limit_per_minute: form.rate_limit_per_minute ?? null,
          template_id: form.template_id,
          secret_token: secretToken,
          created_by: userId
        })
        .select()
        .single()

      if (insertError) {
        if (insertError.code === '23505') {
          throw new Error(`A proxy function with this name already exists`)
        }
        throw insertError
      }

      const created = data as unknown as ProxyFunction
      proxyFunctions.value.unshift(created)
      $toast.success('Proxy function created')
      return { data: created, error: null }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create proxy function'
      error.value = msg
      $toast.error(msg)
      return { data: null, error: msg }
    } finally {
      loading.value = false
    }
  }

  async function updateProxyFunction(id: string, form: Partial<ProxyFunctionForm>) {
    loading.value = true
    error.value = null
    try {
      const updatePayload: Record<string, unknown> = {}

      if (form.name !== undefined) {
        updatePayload.name = form.name.trim()
        updatePayload.slug = generateSlug(form.name)
      }
      if (form.description !== undefined) updatePayload.description = form.description.trim() || null
      if (form.service_id !== undefined) updatePayload.service_id = form.service_id
      if (form.target_url !== undefined) updatePayload.target_url = form.target_url.trim()
      if (form.http_method !== undefined) updatePayload.http_method = form.http_method
      if (form.target_headers !== undefined) updatePayload.target_headers = form.target_headers
      if (form.secret_mappings !== undefined) updatePayload.secret_mappings = form.secret_mappings
      if (form.allowed_origins !== undefined) updatePayload.allowed_origins = form.allowed_origins
      if (form.request_body_template !== undefined) updatePayload.request_body_template = form.request_body_template
      if (form.pass_through_body !== undefined) updatePayload.pass_through_body = form.pass_through_body
      if (form.rate_limit_per_minute !== undefined) updatePayload.rate_limit_per_minute = form.rate_limit_per_minute
      if (form.template_id !== undefined) updatePayload.template_id = form.template_id

      const { data, error: updateError } = await client
        .from('proxy_functions')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single()

      if (updateError) {
        if (updateError.code === '23505') {
          throw new Error('A proxy function with this name already exists')
        }
        throw updateError
      }

      const updated = data as unknown as ProxyFunction
      const index = proxyFunctions.value.findIndex(p => p.id === id)
      if (index >= 0) proxyFunctions.value[index] = updated

      $toast.success('Proxy function updated')
      return { data: updated, error: null }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update proxy function'
      error.value = msg
      $toast.error(msg)
      return { data: null, error: msg }
    } finally {
      loading.value = false
    }
  }

  async function deleteProxyFunction(id: string) {
    loading.value = true
    error.value = null
    try {
      const { error: deleteError } = await client
        .from('proxy_functions')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError

      proxyFunctions.value = proxyFunctions.value.filter(p => p.id !== id)
      $toast.success('Proxy function deleted')
      return { error: null }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete proxy function'
      error.value = msg
      $toast.error(msg)
      return { error: msg }
    } finally {
      loading.value = false
    }
  }

  async function toggleEnabled(id: string, enabled: boolean) {
    loading.value = true
    error.value = null
    try {
      const { data, error: updateError } = await client
        .from('proxy_functions')
        .update({ enabled })
        .eq('id', id)
        .select()
        .single()

      if (updateError) throw updateError

      const updated = data as unknown as ProxyFunction
      const index = proxyFunctions.value.findIndex(p => p.id === id)
      if (index >= 0) proxyFunctions.value[index] = updated

      $toast.success(enabled ? 'Proxy function enabled' : 'Proxy function disabled')
      return { data: updated, error: null }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to toggle proxy function'
      error.value = msg
      $toast.error(msg)
      return { data: null, error: msg }
    } finally {
      loading.value = false
    }
  }

  async function regenerateToken(id: string) {
    loading.value = true
    error.value = null
    try {
      const newToken = generateSecretToken()

      const { data, error: updateError } = await client
        .from('proxy_functions')
        .update({ secret_token: newToken })
        .eq('id', id)
        .select()
        .single()

      if (updateError) throw updateError

      const updated = data as unknown as ProxyFunction
      const index = proxyFunctions.value.findIndex(p => p.id === id)
      if (index >= 0) proxyFunctions.value[index] = updated

      $toast.success('Secret token regenerated')
      return { data: updated, error: null }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to regenerate token'
      error.value = msg
      $toast.error(msg)
      return { data: null, error: msg }
    } finally {
      loading.value = false
    }
  }

  return {
    proxyFunctions: readonly(proxyFunctions),
    loading: readonly(loading),
    error: readonly(error),
    fetchProxyFunctions,
    createProxyFunction,
    updateProxyFunction,
    deleteProxyFunction,
    toggleEnabled,
    regenerateToken
  }
}
