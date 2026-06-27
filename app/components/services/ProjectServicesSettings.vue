<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 class="text-base font-semibold text-foreground">Services</h2>
        <p class="text-sm text-muted-foreground mt-0.5">
          Organize variables by service (e.g., backend, frontend, worker)
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        class-name="w-full sm:w-auto"
        @click="startAdd"
        :disabled="isAdding || !!editingId"
      >
        <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
        Add Service
      </Button>
    </div>

    <Card padding="sm" class="!p-0">
      <!-- Loading -->
      <div v-if="loading && services.length === 0" class="p-6 flex justify-center">
        <Icon name="lucide:loader-2" class="animate-spin h-5 w-5 text-primary" />
      </div>

      <!-- Empty state (no services and not adding) -->
      <div v-else-if="services.length === 0 && !isAdding" class="p-6 text-center">
        <Icon name="lucide:layers" class="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
        <p class="text-sm text-muted-foreground mb-3">
          No services defined. Services let you scope variables to specific parts of your stack (e.g., backend, frontend, worker).
        </p>
        <Button variant="outline" size="sm" @click="startAdd">
          <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
          Add Service
        </Button>
      </div>

      <!-- Service list -->
      <div v-else class="divide-y divide-border">
        <!-- Inline add form -->
        <div v-if="isAdding" class="p-4 bg-muted/30">
          <form @submit.prevent="saveNew" class="space-y-3">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div class="flex-1 space-y-3">
                <Input
                  v-model="form.name"
                  placeholder="Service name (e.g., backend)"
                  required
                  :disabled="actionLoading"
                />
                <Input
                  v-model="form.description"
                  placeholder="Optional description"
                  :disabled="actionLoading"
                />
              </div>
            </div>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5">
                <span class="text-xs text-muted-foreground mr-1">Color:</span>
                <button
                  v-for="color in SERVICE_COLORS"
                  :key="color"
                  type="button"
                  class="h-5 w-5 rounded-full border-2 transition-all"
                  :class="form.color === color ? 'border-foreground scale-110' : 'border-transparent hover:border-muted-foreground/50'"
                  :style="{ backgroundColor: color }"
                  @click="form.color = color"
                />
              </div>
              <div class="flex gap-2">
                <Button type="button" variant="outline" size="sm" @click="cancelAdd" :disabled="actionLoading">
                  Cancel
                </Button>
                <Button type="submit" size="sm" :loading="actionLoading">
                  Add
                </Button>
              </div>
            </div>
          </form>
        </div>

        <!-- Service rows -->
        <div v-for="(service, index) in services" :key="service.id" class="p-4">
          <!-- Edit mode -->
          <form v-if="editingId === service.id" @submit.prevent="saveEdit" class="space-y-3">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div class="flex-1 space-y-3">
                <Input
                  v-model="form.name"
                  placeholder="Service name"
                  required
                  :disabled="actionLoading"
                />
                <Input
                  v-model="form.description"
                  placeholder="Optional description"
                  :disabled="actionLoading"
                />
              </div>
            </div>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5">
                <span class="text-xs text-muted-foreground mr-1">Color:</span>
                <button
                  v-for="color in SERVICE_COLORS"
                  :key="color"
                  type="button"
                  class="h-5 w-5 rounded-full border-2 transition-all"
                  :class="form.color === color ? 'border-foreground scale-110' : 'border-transparent hover:border-muted-foreground/50'"
                  :style="{ backgroundColor: color }"
                  @click="form.color = color"
                />
              </div>
              <div class="flex gap-2">
                <Button type="button" variant="outline" size="sm" @click="cancelEdit" :disabled="actionLoading">
                  Cancel
                </Button>
                <Button type="submit" size="sm" :loading="actionLoading">
                  Save
                </Button>
              </div>
            </div>
          </form>

          <!-- Display mode -->
          <div v-else class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex items-center gap-3 min-w-0">
              <span
                class="h-3 w-3 rounded-full shrink-0"
                :style="{ backgroundColor: service.color || '#6B7280' }"
              />
              <div class="min-w-0">
                <p class="font-medium text-foreground truncate">{{ service.name }}</p>
                <p v-if="service.description" class="text-sm text-muted-foreground truncate">
                  {{ service.description }}
                </p>
              </div>
              <Badge size="sm">
                {{ variableCounts[service.id] ?? 0 }} vars
              </Badge>
            </div>
            <div class="flex w-full flex-wrap items-center gap-1 sm:w-auto sm:justify-end">
              <Tooltip content="Move up">
                <Button variant="ghost" size="sm" @click="moveUp(index)" :disabled="index === 0">
                  <Icon name="lucide:chevron-up" class="h-4 w-4" />
                </Button>
              </Tooltip>
              <Tooltip content="Move down">
                <Button variant="ghost" size="sm" @click="moveDown(index)" :disabled="index === services.length - 1">
                  <Icon name="lucide:chevron-down" class="h-4 w-4" />
                </Button>
              </Tooltip>
              <Tooltip content="Edit service">
                <Button variant="ghost" size="sm" @click="startEdit(service)">
                  <Icon name="lucide:pencil" class="h-4 w-4" />
                </Button>
              </Tooltip>
              <Tooltip content="Delete service">
                <Button variant="ghost" size="sm" @click="confirmDelete(service)">
                  <Icon name="lucide:trash" class="h-4 w-4" />
                </Button>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>
    </Card>

    <!-- Delete Confirmation Dialog -->
    <ClientOnly>
      <Dialog
        :open="!!deletingService"
        title="Delete Service"
        @close="deletingService = null"
      >
        <div class="space-y-3">
          <p class="text-sm text-muted-foreground">
            Are you sure you want to delete <span class="font-medium text-foreground">"{{ deletingService?.name }}"</span>?
          </p>
          <p v-if="deleteAffectedCount > 0" class="text-sm text-warning">
            This will unassign {{ deleteAffectedCount }} variable{{ deleteAffectedCount === 1 ? '' : 's' }} from this service (they become shared).
          </p>
          <p v-else class="text-sm text-muted-foreground">
            No variables are assigned to this service.
          </p>
          <div class="flex justify-end gap-2 pt-2">
            <Button variant="outline" @click="deletingService = null" :disabled="actionLoading">
              Cancel
            </Button>
            <Button variant="destructive" :loading="actionLoading" @click="executeDelete">
              Delete
            </Button>
          </div>
        </div>
      </Dialog>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Badge from '@/components/ui/Badge.vue'
import Tooltip from '@/components/ui/Tooltip.vue'
import type { Database } from '~/types/database.types'

type ServiceRow = Database['public']['Tables']['services']['Row']

const SERVICE_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
]

const props = defineProps<{
  projectId: string
  organizationId: string
}>()

const { $toast } = useNuxtApp()
const { services, loading, fetchServices, createService, updateService, deleteService, getServiceVariableCount, reorderServices } = useServices(() => props.projectId)

// Variable counts per service
const variableCounts = ref<Record<string, number>>({})

// Form state (shared between add and edit)
const form = reactive({
  name: '',
  description: '',
  color: '#3B82F6'
})
const isAdding = ref(false)
const editingId = ref<string | null>(null)
const actionLoading = ref(false)

// Delete state
const deletingService = ref<ServiceRow | null>(null)
const deleteAffectedCount = ref(0)

function resetForm() {
  form.name = ''
  form.description = ''
  form.color = '#3B82F6'
}

function startAdd() {
  editingId.value = null
  resetForm()
  isAdding.value = true
}

function cancelAdd() {
  isAdding.value = false
  resetForm()
}

function startEdit(service: ServiceRow) {
  isAdding.value = false
  editingId.value = service.id
  form.name = service.name
  form.description = service.description || ''
  form.color = service.color || '#3B82F6'
}

function cancelEdit() {
  editingId.value = null
  resetForm()
}

async function saveNew() {
  if (!form.name.trim()) {
    $toast.error('Service name is required')
    return
  }

  actionLoading.value = true
  const result = await createService(props.organizationId, {
    name: form.name,
    description: form.description || undefined,
    color: form.color
  })
  actionLoading.value = false

  if (result.error) {
    $toast.error(result.error)
    return
  }

  $toast.success(`Service "${form.name}" created`)
  isAdding.value = false
  resetForm()
  // Refresh counts for new service
  if (result.data) {
    variableCounts.value[result.data.id] = 0
  }
}

async function saveEdit() {
  if (!editingId.value || !form.name.trim()) {
    $toast.error('Service name is required')
    return
  }

  actionLoading.value = true
  const result = await updateService(editingId.value, {
    name: form.name,
    description: form.description,
    color: form.color
  })
  actionLoading.value = false

  if (result.error) {
    $toast.error(result.error)
    return
  }

  $toast.success(`Service "${form.name}" updated`)
  editingId.value = null
  resetForm()
}

async function confirmDelete(service: ServiceRow) {
  deletingService.value = service
  deleteAffectedCount.value = await getServiceVariableCount(service.id)
}

async function executeDelete() {
  if (!deletingService.value) return

  actionLoading.value = true
  const result = await deleteService(deletingService.value.id)
  actionLoading.value = false

  if (result.error) {
    $toast.error(result.error)
    return
  }

  $toast.success(`Service "${deletingService.value.name}" deleted`)
  delete variableCounts.value[deletingService.value.id]
  deletingService.value = null
}

async function moveUp(index: number) {
  if (index === 0) return
  const ids = services.value.map(s => s.id)
  const temp = ids[index]!
  ids[index] = ids[index - 1]!
  ids[index - 1] = temp
  await reorderServices(ids)
}

async function moveDown(index: number) {
  if (index === services.value.length - 1) return
  const ids = services.value.map(s => s.id)
  const temp = ids[index]!
  ids[index] = ids[index + 1]!
  ids[index + 1] = temp
  await reorderServices(ids)
}

async function fetchVariableCounts() {
  const counts: Record<string, number> = {}
  await Promise.all(
    services.value.map(async (s) => {
      counts[s.id] = await getServiceVariableCount(s.id)
    })
  )
  variableCounts.value = counts
}

// Fetch on mount
onMounted(async () => {
  await fetchServices()
  await fetchVariableCounts()
})
</script>
