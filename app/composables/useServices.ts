import type { Database } from '~/types/database.types'

type ServiceRow = Database['public']['Tables']['services']['Row']

export function useServices(projectId: MaybeRefOrGetter<string>) {
  const supabase = useSupabaseClient<Database>()

  const services = ref<ServiceRow[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchServices() {
    loading.value = true
    error.value = null
    try {
      const { data, error: fetchError } = await supabase
        .from('services')
        .select('*')
        .eq('project_id', toValue(projectId))
        .order('sort_order', { ascending: true })

      if (fetchError) throw fetchError
      services.value = data || []
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch services'
    } finally {
      loading.value = false
    }
  }

  async function createService(orgId: string, data: { name: string; description?: string; color?: string }) {
    loading.value = true
    error.value = null
    try {
      const maxSort = services.value.reduce((max, s) => Math.max(max, s.sort_order ?? 0), 0)

      const { data: newService, error: insertError } = await supabase
        .from('services')
        .insert({
          project_id: toValue(projectId),
          organization_id: orgId,
          name: data.name.trim(),
          description: data.description?.trim() || null,
          color: data.color || null,
          sort_order: maxSort + 1
        })
        .select()
        .single()

      if (insertError) {
        if (insertError.code === '23505') {
          throw new Error(`Service "${data.name}" already exists in this project`)
        }
        throw insertError
      }

      services.value.push(newService)
      return { data: newService, error: null }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create service'
      error.value = msg
      return { data: null, error: msg }
    } finally {
      loading.value = false
    }
  }

  async function updateService(id: string, data: Partial<{ name: string; description: string; color: string; sort_order: number }>) {
    loading.value = true
    error.value = null
    try {
      const updatePayload: Record<string, unknown> = {}
      if (data.name !== undefined) updatePayload.name = data.name.trim()
      if (data.description !== undefined) updatePayload.description = data.description.trim() || null
      if (data.color !== undefined) updatePayload.color = data.color
      if (data.sort_order !== undefined) updatePayload.sort_order = data.sort_order

      const { data: updated, error: updateError } = await supabase
        .from('services')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single()

      if (updateError) {
        if (updateError.code === '23505') {
          throw new Error(`Service "${data.name}" already exists in this project`)
        }
        throw updateError
      }

      const index = services.value.findIndex(s => s.id === id)
      if (index >= 0) services.value[index] = updated

      return { data: updated, error: null }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update service'
      error.value = msg
      return { data: null, error: msg }
    } finally {
      loading.value = false
    }
  }

  async function getServiceVariableCount(serviceId: string): Promise<number> {
    const { count, error: countError } = await supabase
      .from('variables')
      .select('id', { count: 'exact', head: true })
      .eq('service_id', serviceId)

    if (countError) return 0
    return count || 0
  }

  async function deleteService(id: string) {
    loading.value = true
    error.value = null
    try {
      const { error: deleteError } = await supabase
        .from('services')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError

      services.value = services.value.filter(s => s.id !== id)
      return { error: null }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete service'
      error.value = msg
      return { error: msg }
    } finally {
      loading.value = false
    }
  }

  async function reorderServices(orderedIds: string[]) {
    loading.value = true
    error.value = null
    try {
      const updates = orderedIds.map((id, index) =>
        supabase
          .from('services')
          .update({ sort_order: index })
          .eq('id', id)
      )

      const results = await Promise.all(updates)
      const failed = results.find(r => r.error)
      if (failed?.error) throw failed.error

      services.value.forEach(s => {
        const newOrder = orderedIds.indexOf(s.id)
        if (newOrder >= 0) s.sort_order = newOrder
      })
      services.value.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

      return { error: null }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to reorder services'
      error.value = msg
      return { error: msg }
    } finally {
      loading.value = false
    }
  }

  return {
    services: readonly(services),
    loading: readonly(loading),
    error: readonly(error),
    fetchServices,
    createService,
    updateService,
    deleteService,
    getServiceVariableCount,
    reorderServices
  }
}
