// =====================================================
// Proxy Templates Composable
// =====================================================
// Read-only composable for fetching active proxy templates.
// Templates are admin-managed via the proxy_templates table.

import type { ProxyTemplate } from '~/types/proxy.types'

// Separate fetch logic to avoid deep type instantiation from Supabase client generics
async function _fetchTemplatesFromDb(): Promise<ProxyTemplate[]> {
  const client = useSupabaseClient()
  const { data, error } = await client
    .from('proxy_templates')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return (data as ProxyTemplate[]) ?? []
}

export function useProxyTemplates(): {
  templates: Ref<ProxyTemplate[]>
  loading: Ref<boolean>
  fetchTemplates: () => Promise<void>
} {
  // useState must be called inside a composable/setup context, not at module scope
  const _templates = useState<ProxyTemplate[]>('proxy-templates', () => [])
  const _loading = useState('proxy-templates-loading', () => false)

  async function fetchTemplates() {
    if (_templates.value.length > 0) return
    _loading.value = true
    try {
      _templates.value = await _fetchTemplatesFromDb()
    } catch (err) {
      console.error('[useProxyTemplates] Failed to fetch templates:', err)
      _templates.value = []
    } finally {
      _loading.value = false
    }
  }

  return {
    templates: _templates,
    loading: _loading,
    fetchTemplates
  }
}
