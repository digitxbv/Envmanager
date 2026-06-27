<template>
  <div class="px-4 md:px-6 lg:px-8 py-6">
    <div class="space-y-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-semibold">Proxy Templates</h1>
          <p class="text-sm text-muted-foreground mt-1">
            Manage template presets for the proxy creation wizard
          </p>
        </div>
        <Button @click="openCreateForm">
          <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
          Create Template
        </Button>
      </div>

      <Card padding="sm">
        <label class="mb-2 block text-sm font-medium">Search</label>
        <Input
          v-model="searchTerm"
          placeholder="Search by template name"
        />
      </Card>

      <Card v-if="error" class-name="!border-destructive/20 !bg-destructive/5">
        <p class="text-sm text-destructive">{{ error }}</p>
      </Card>

      <Card v-else padding="sm" class="!p-0 overflow-hidden">
        <DataTable
          :columns="templateColumns"
          :data="filteredTemplates"
          :loading="loading"
          empty-message="No templates found."
          class="!border-0 !rounded-none [&_table]:min-w-[800px]"
        >
          <template #empty>
            <EmptyState
              icon="lucide:layout-template"
              title="No templates found"
              :description="searchTerm ? 'Try adjusting your search term' : 'Create your first proxy template'"
            />
          </template>
          <template #cell-sort_order="{ value }">
            <span class="text-muted-foreground font-mono text-sm">{{ value }}</span>
          </template>
          <template #cell-icon="{ row }">
            <div class="flex items-center justify-center h-8 w-8 rounded-md bg-muted/50">
              <Icon v-if="row.icon" :name="row.icon" class="h-4 w-4 text-foreground" />
              <Icon v-else name="lucide:box" class="h-4 w-4 text-muted-foreground" />
            </div>
          </template>
          <template #cell-name="{ row }">
            <div>
              <span class="font-medium text-foreground">{{ row.name }}</span>
              <p v-if="row.description" class="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {{ row.description }}
              </p>
            </div>
          </template>
          <template #cell-category="{ value }">
            <Badge :variant="getCategoryVariant(String(value))">
              {{ value }}
            </Badge>
          </template>
          <template #cell-target_url="{ value }">
            <span class="text-sm text-muted-foreground truncate max-w-[200px] block">{{ value }}</span>
          </template>
          <template #cell-is_active="{ row }">
            <button
              @click="toggleActive(row)"
              :disabled="togglingId === row.id"
              class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              :class="row.is_active ? 'bg-primary' : 'bg-muted-foreground/30'"
            >
              <span
                class="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform"
                :class="row.is_active ? 'translate-x-[18px]' : 'translate-x-1'"
              />
            </button>
          </template>
          <template #cell-actions="{ row }">
            <div class="flex items-center gap-2">
              <button
                class="text-sm text-primary hover:text-primary/80 transition-colors"
                @click="openEditForm(row)"
              >
                Edit
              </button>
              <button
                class="text-sm text-destructive hover:text-destructive/80 transition-colors"
                @click="confirmDelete(row)"
              >
                Delete
              </button>
            </div>
          </template>
        </DataTable>
      </Card>
    </div>

    <!-- Create/Edit Modal -->
    <ProxyTemplateForm
      v-model="showForm"
      :template="editingTemplate"
      @saved="loadTemplates"
    />

    <!-- Delete Confirmation -->
    <Teleport to="body">
      <div
        v-if="showDeleteConfirm"
        class="fixed inset-0 bg-background/80 z-50 flex items-center justify-center"
        @click="showDeleteConfirm = false"
      >
        <div
          class="bg-card rounded-lg shadow-lg border w-full max-w-md overflow-hidden"
          @click.stop
        >
          <div class="p-6 space-y-4">
            <div class="flex items-center gap-3">
              <div class="flex items-center justify-center h-10 w-10 rounded-full bg-destructive/10">
                <Icon name="lucide:trash-2" class="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h3 class="text-lg font-medium">Delete Template</h3>
              </div>
            </div>
            <p class="text-sm text-muted-foreground">
              Delete template "{{ deletingTemplate?.name }}"? Existing proxy functions that used this template will not be affected (they keep their configuration).
            </p>
            <div class="flex justify-end gap-2 pt-2">
              <Button variant="outline" @click="showDeleteConfirm = false">Cancel</Button>
              <Button variant="destructive" :loading="deleting" @click="handleDelete">Delete</Button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { Database } from '~/types/database.types'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'

import type { ProxyTemplate } from '~/types/proxy.types'
type ProxyTemplateRow = ProxyTemplate

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'platform-admin']
})

const breadcrumbs = inject('breadcrumbs', ref<Array<{ label: string; to?: string }>>([]))

const client = useSupabaseClient<Database>()
const { $toast } = useNuxtApp()

const loading = ref(true)
const error = ref<string | null>(null)
const searchTerm = ref('')
const templates = ref<ProxyTemplateRow[]>([])

const showForm = ref(false)
const editingTemplate = ref<ProxyTemplateRow | null>(null)

const showDeleteConfirm = ref(false)
const deletingTemplate = ref<ProxyTemplateRow | null>(null)
const deleting = ref(false)

const togglingId = ref<string | null>(null)

const templateColumns = [
  { key: 'sort_order', label: 'Order', class: 'w-16' },
  { key: 'icon', label: 'Icon', class: 'w-16' },
  { key: 'name', label: 'Name' },
  { key: 'category', label: 'Category', class: 'w-24' },
  { key: 'target_url', label: 'Target URL' },
  { key: 'is_active', label: 'Active', class: 'w-20' },
  { key: 'actions', label: '', class: 'w-28' }
]

const filteredTemplates = computed(() => {
  const search = searchTerm.value.trim().toLowerCase()
  if (!search) return templates.value
  return templates.value.filter((t) => t.name.toLowerCase().includes(search))
})

const getCategoryVariant = (category: string): string => {
  if (category === 'email') return 'default'
  if (category === 'payment') return 'success'
  if (category === 'ai') return 'warning'
  return 'outline'
}

const openCreateForm = () => {
  editingTemplate.value = null
  showForm.value = true
}

const openEditForm = (template: ProxyTemplateRow) => {
  editingTemplate.value = template
  showForm.value = true
}

const confirmDelete = (template: ProxyTemplateRow) => {
  deletingTemplate.value = template
  showDeleteConfirm.value = true
}

const handleDelete = async () => {
  if (!deletingTemplate.value) return

  deleting.value = true
  try {
    const { error: deleteError } = await client
      .from('proxy_templates')
      .delete()
      .eq('id', deletingTemplate.value.id)

    if (deleteError) throw deleteError

    $toast.success('Template deleted')
    showDeleteConfirm.value = false
    deletingTemplate.value = null
    await loadTemplates()
  } catch (err) {
    console.error('[proxy-templates] Failed to delete template:', err)
    const message = err instanceof Error ? err.message : 'Failed to delete template'
    $toast.error(message)
  } finally {
    deleting.value = false
  }
}

const toggleActive = async (template: ProxyTemplateRow) => {
  togglingId.value = template.id
  try {
    const { error: updateError } = await client
      .from('proxy_templates')
      .update({ is_active: !template.is_active })
      .eq('id', template.id)

    if (updateError) throw updateError

    // Update local state
    template.is_active = !template.is_active
    $toast.success(`Template ${template.is_active ? 'activated' : 'deactivated'}`)
  } catch (err) {
    console.error('[proxy-templates] Failed to toggle active:', err)
    $toast.error('Failed to update template status')
  } finally {
    togglingId.value = null
  }
}

const loadTemplates = async () => {
  loading.value = true
  error.value = null

  try {
    const { data, error: fetchError } = await client
      .from('proxy_templates')
      .select('*')
      .order('sort_order', { ascending: true })

    if (fetchError) throw fetchError
    templates.value = (data as ProxyTemplateRow[]) ?? []
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load templates'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  breadcrumbs.value = [
    { label: 'Admin', to: '/admin' },
    { label: 'Proxy Templates' }
  ]
  loadTemplates()
})
</script>
