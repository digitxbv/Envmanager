import type { Database } from '@/types/database.types'
import type { NamingConventionConfig, NamingRule } from '@/utils/naming-conventions'

interface NamingConventionRow {
  id: string
  organization_id: string
  project_id: string | null
  rules: NamingRule
  enforcement_mode: 'warn' | 'block'
  template_name: string | null
  created_at: string
  updated_at: string
  created_by: string | null
}

export function useNamingConventions(organizationId: MaybeRef<string>) {
  const client = useSupabaseClient<Database>()

  const orgRules = ref<NamingConventionConfig | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function getOrgRules(): Promise<NamingConventionConfig | null> {
    const orgId = toValue(organizationId)
    if (!orgId) return null

    loading.value = true
    error.value = null
    try {
      const { data, error: queryError } = await client
        .from('naming_conventions')
        .select('*')
        .eq('organization_id', orgId)
        .is('project_id', null)
        .limit(1)

      if (queryError) throw queryError

      const row = data?.[0] as NamingConventionRow | undefined

      if (row) {
        const config: NamingConventionConfig = {
          rules: row.rules,
          enforcement_mode: row.enforcement_mode as 'warn' | 'block',
          template_name: row.template_name || undefined
        }
        orgRules.value = config
        return config
      }
      orgRules.value = null
      return null
    } catch (e: any) {
      error.value = e.message || 'Failed to load naming rules'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function getProjectRules(projectId: string): Promise<NamingConventionConfig | null> {
    const orgId = toValue(organizationId)
    if (!orgId) return null

    loading.value = true
    error.value = null
    try {
      const { data, error: queryError } = await client
        .from('naming_conventions')
        .select('*')
        .eq('organization_id', orgId)
        .eq('project_id', projectId)
        .limit(1)

      if (queryError) throw queryError

      const row = data?.[0] as NamingConventionRow | undefined

      if (row) {
        return {
          rules: row.rules,
          enforcement_mode: row.enforcement_mode as 'warn' | 'block',
          template_name: row.template_name || undefined
        }
      }
      return null
    } catch (e: any) {
      error.value = e.message || 'Failed to load project rules'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function getEffectiveRules(projectId?: string): Promise<NamingConventionConfig | null> {
    if (projectId) {
      const projectRules = await getProjectRules(projectId)
      if (projectRules) return projectRules
    }
    return await getOrgRules()
  }

  async function saveOrgRules(config: NamingConventionConfig) {
    const orgId = toValue(organizationId)
    if (!orgId) return

    loading.value = true
    error.value = null
    try {
      // Try upsert: check if org rules exist
      const { data: existingRows, error: existingError } = await client
        .from('naming_conventions')
        .select('id')
        .eq('organization_id', orgId)
        .is('project_id', null)
        .limit(1)

      if (existingError) throw existingError

      const existing = existingRows?.[0]

      if (existing) {
        const { error: updateError } = await client
          .from('naming_conventions')
          .update({
            rules: config.rules as any,
            enforcement_mode: config.enforcement_mode,
            template_name: config.template_name || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await client
          .from('naming_conventions')
          .insert({
            organization_id: orgId,
            project_id: null,
            rules: config.rules as any,
            enforcement_mode: config.enforcement_mode,
            template_name: config.template_name || null
          })
        if (insertError) throw insertError
      }
      orgRules.value = config
    } catch (e: any) {
      error.value = e.message || 'Failed to save rules'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function saveProjectRules(projectId: string, config: NamingConventionConfig) {
    const orgId = toValue(organizationId)
    if (!orgId) return

    loading.value = true
    error.value = null
    try {
      const { data: existingRows, error: existingError } = await client
        .from('naming_conventions')
        .select('id')
        .eq('organization_id', orgId)
        .eq('project_id', projectId)
        .limit(1)

      if (existingError) throw existingError

      const existing = existingRows?.[0]

      if (existing) {
        const { error: updateError } = await client
          .from('naming_conventions')
          .update({
            rules: config.rules as any,
            enforcement_mode: config.enforcement_mode,
            template_name: config.template_name || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await client
          .from('naming_conventions')
          .insert({
            organization_id: orgId,
            project_id: projectId,
            rules: config.rules as any,
            enforcement_mode: config.enforcement_mode,
            template_name: config.template_name || null
          })
        if (insertError) throw insertError
      }
    } catch (e: any) {
      error.value = e.message || 'Failed to save project rules'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteProjectRules(projectId: string) {
    const orgId = toValue(organizationId)
    if (!orgId) return

    loading.value = true
    error.value = null
    try {
      const { error: deleteError } = await client
        .from('naming_conventions')
        .delete()
        .eq('organization_id', orgId)
        .eq('project_id', projectId)
      if (deleteError) throw deleteError
    } catch (e: any) {
      error.value = e.message || 'Failed to delete project rules'
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    orgRules: readonly(orgRules),
    loading: readonly(loading),
    error: readonly(error),
    getOrgRules,
    getProjectRules,
    getEffectiveRules,
    saveOrgRules,
    saveProjectRules,
    deleteProjectRules
  }
}
