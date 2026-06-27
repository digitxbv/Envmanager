<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 bg-background/80 z-50 flex items-center justify-center"
      @click="$emit('close')"
    >
      <div
        class="bg-card rounded-lg shadow-lg border w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
        @click.stop
      >
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b">
          <div>
            <h3 class="text-lg font-medium">Bulk Update</h3>
            <p class="text-sm text-muted-foreground">
              {{ stepLabels[step] }}
            </p>
          </div>
          <button class="text-muted-foreground hover:text-foreground transition-colors" @click="$emit('close')">
            <Icon name="lucide:x" class="h-5 w-5" />
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-4">
          <!-- Step 1: Search -->
          <div v-if="step === 'search'" class="space-y-4">
            <Input
              v-model="searchQuery"
              placeholder="Search variable key (e.g. STRIPE, DATABASE)..."
              @input="debouncedSearch"
            />

            <div v-if="loading" class="flex justify-center py-6">
              <Icon name="lucide:loader-2" class="h-5 w-5 animate-spin text-muted-foreground" />
            </div>

            <div v-else-if="searchResults.length === 0 && searchQuery.length > 0" class="text-center py-6 text-muted-foreground">
              No variables found matching "{{ searchQuery }}"
            </div>

            <div v-else class="space-y-2">
              <button
                v-for="result in searchResults"
                :key="result.key"
                class="w-full text-left border rounded-lg p-3 hover:bg-muted/40 transition-colors"
                @click="selectKey(result)"
              >
                <div class="flex items-center justify-between">
                  <span class="font-mono font-medium">{{ result.key }}</span>
                  <span class="text-xs text-muted-foreground">{{ result.environments.length }} environment{{ result.environments.length > 1 ? 's' : '' }}</span>
                </div>
              </button>
            </div>
          </div>

          <!-- Step 2: Select environments -->
          <div v-if="step === 'select'" class="space-y-4">
            <p class="text-sm text-muted-foreground">
              Select which environments to update <span class="font-mono font-medium">{{ selectedKey }}</span> in:
            </p>

            <div class="space-y-2">
              <label
                v-for="env in selectedResult!.environments"
                :key="env.id"
                class="flex items-center gap-3 border rounded-lg p-3 cursor-pointer hover:bg-muted/40 transition-colors"
              >
                <input
                  type="checkbox"
                  :value="env.variable_id"
                  v-model="selectedVariableIds"
                  class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="font-medium text-sm">{{ env.name }}</span>
                     <span
                       v-if="env.is_protected"
                       class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-warning/10 text-warning dark:bg-warning/20"
                     >
                      <Icon name="lucide:shield" class="h-3 w-3" />
                      Protected
                    </span>
                  </div>
                  <div class="text-xs text-muted-foreground font-mono truncate">
                    {{ env.is_secret ? '[encrypted]' : (env.value || '(empty)') }}
                  </div>
                </div>
              </label>
            </div>
          </div>

          <!-- Step 3: Configure values -->
          <div v-if="step === 'configure'" class="space-y-4">
            <div class="flex items-center gap-1 bg-muted/50 rounded-lg p-1 w-fit">
              <button
                @click="updateMode = 'same'"
                :class="[
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  updateMode === 'same' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                ]"
              >
                Same value for all
              </button>
              <button
                @click="updateMode = 'different'"
                :class="[
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  updateMode === 'different' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                ]"
              >
                Different per environment
              </button>
            </div>

            <div v-if="updateMode === 'same'" class="space-y-2">
              <label class="text-sm font-medium">New value for all selected environments</label>
              <Input
                v-model="sameValue"
                :type="isSecretKey ? 'password' : 'text'"
                placeholder="Enter new value..."
              />
            </div>

            <div v-else class="space-y-3">
              <div v-for="env in selectedEnvironments" :key="env.variable_id" class="space-y-1">
                <label class="text-sm font-medium flex items-center gap-2">
                  {{ env.name }}
                  <span
                    v-if="env.is_protected"
                    class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-warning/10 text-warning dark:bg-warning/20"
                  >
                    <Icon name="lucide:shield" class="h-3 w-3" />
                    Protected
                  </span>
                </label>
                <Input
                  :model-value="perEnvValues[env.variable_id] ?? ''"
                  @update:model-value="perEnvValues[env.variable_id] = $event"
                  :type="isSecretKey ? 'password' : 'text'"
                  :placeholder="env.is_secret ? '[encrypted]' : (env.value || '(empty)')"
                />
              </div>
            </div>
          </div>

          <!-- Step 4: Preview -->
          <div v-if="step === 'preview'" class="space-y-4">
            <div class="text-sm text-muted-foreground mb-2">
              Review changes before applying:
            </div>

            <div class="border rounded-lg overflow-hidden">
              <table class="w-full text-sm">
                <thead class="bg-muted text-muted-foreground text-xs uppercase">
                  <tr>
                    <th class="px-3 py-2 text-left">Environment</th>
                    <th class="px-3 py-2 text-left">Old Value</th>
                    <th class="px-3 py-2 text-left">New Value</th>
                    <th class="px-3 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in previewItems" :key="item.variable_id" class="border-t hover:bg-muted/40 transition-colors">
                    <td class="px-3 py-2 font-medium">
                      {{ item.envName }}
                    </td>
                    <td class="px-3 py-2 font-mono text-xs text-destructive/70 truncate max-w-[150px]">
                      {{ item.is_secret ? '[encrypted]' : (item.oldValue || '(empty)') }}
                    </td>
                    <td class="px-3 py-2 font-mono text-xs text-success truncate max-w-[150px]">
                      {{ isSecretKey ? '••••••••' : item.newValue }}
                    </td>
                    <td class="px-3 py-2">
                      <span
                        :class="[
                           'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                           item.is_protected
                             ? 'bg-warning/10 text-warning dark:bg-warning/20'
                             : 'bg-success/10 text-success dark:bg-success/20'
                         ]"
                      >
                        {{ item.is_protected ? 'Pending approval' : 'Will apply' }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium">Reason for change (optional)</label>
              <Input v-model="reason" placeholder="e.g. Rotating API keys" />
            </div>
          </div>

          <!-- Step 5: Result -->
          <div v-if="step === 'result'" class="space-y-4">
            <div class="flex items-center gap-3 p-4 rounded-lg bg-success/10 dark:bg-success/20 border border-success/30 dark:border-success/40">
              <Icon name="lucide:check-circle" class="h-6 w-6 text-success" />
              <div>
                <p class="font-medium text-success">Bulk update complete</p>
                <p class="text-sm text-success/80">
                  {{ updateResult?.applied || 0 }} applied, {{ updateResult?.pending || 0 }} pending approval
                </p>
              </div>
            </div>

            <div v-if="updateResult?.errors?.length" class="p-4 rounded-lg bg-destructive/10 dark:bg-destructive/20 border border-destructive/30 dark:border-destructive/40">
              <p class="font-medium text-destructive mb-1">Errors:</p>
              <ul class="text-sm text-destructive/80 list-disc list-inside">
                <li v-for="(err, i) in updateResult.errors" :key="i">{{ err }}</li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between p-4 border-t">
          <Button
            v-if="step !== 'search' && step !== 'result'"
            variant="outline"
            @click="goBack"
          >
            Back
          </Button>
          <div v-else />

          <div class="flex gap-2">
            <Button v-if="step === 'result'" variant="outline" @click="$emit('close')">
              Close
            </Button>
            <Button
              v-else-if="step === 'select'"
              :disabled="selectedVariableIds.length === 0"
              @click="step = 'configure'"
            >
              Next
            </Button>
            <Button
              v-else-if="step === 'configure'"
              :disabled="!hasValidValues"
              @click="step = 'preview'"
            >
              Preview
            </Button>
            <Button
              v-else-if="step === 'preview'"
              :loading="applying"
              @click="applyUpdate"
            >
              Update {{ previewItems.length }} environment{{ previewItems.length > 1 ? 's' : '' }}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'

const props = defineProps<{
  open: boolean
  projectId: string
}>()

const emit = defineEmits<{
  close: []
  updated: []
}>()

const { $toast } = useNuxtApp()
const { searchVariablesAcrossEnvironments, applyBulkUpdate, searchResults, loading } = useBulkUpdate(computed(() => props.projectId))

type Step = 'search' | 'select' | 'configure' | 'preview' | 'result'

const step = ref<Step>('search')
const stepLabels: Record<Step, string> = {
  search: 'Step 1 — Search for a variable key',
  select: 'Step 2 — Select environments',
  configure: 'Step 3 — Configure new values',
  preview: 'Step 4 — Preview changes',
  result: 'Step 5 — Results',
}

const searchQuery = ref('')
const selectedKey = ref('')
const selectedResult = ref<typeof searchResults.value[0] | null>(null)
const selectedVariableIds = ref<string[]>([])
const updateMode = ref<'same' | 'different'>('same')
const sameValue = ref('')
const perEnvValues = reactive<Record<string, string>>({})
const reason = ref('')
const applying = ref(false)
const updateResult = ref<{ applied: number; pending: number; errors: string[] } | null>(null)

const isSecretKey = computed(() => {
  return selectedResult.value?.environments.some(e => e.is_secret) ?? false
})

const selectedEnvironments = computed(() => {
  if (!selectedResult.value) return []
  return selectedResult.value.environments.filter(e =>
    selectedVariableIds.value.includes(e.variable_id)
  )
})

const hasValidValues = computed(() => {
  if (updateMode.value === 'same') return sameValue.value.length > 0
  return selectedEnvironments.value.every(env => (perEnvValues[env.variable_id] ?? '').length > 0)
})

const previewItems = computed(() => {
  return selectedEnvironments.value.map(env => ({
    variable_id: env.variable_id,
    environment_id: env.id,
    envName: env.name,
    oldValue: env.value,
    newValue: updateMode.value === 'same' ? sameValue.value : (perEnvValues[env.variable_id] ?? ''),
    is_protected: env.is_protected,
    is_secret: env.is_secret,
  }))
})

let searchTimeout: ReturnType<typeof setTimeout> | null = null
function debouncedSearch() {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(async () => {
    if (searchQuery.value.trim()) {
      try {
        await searchVariablesAcrossEnvironments(searchQuery.value)
      } catch { /* error shown via composable */ }
    }
  }, 300)
}

function selectKey(result: typeof searchResults.value[0]) {
  selectedKey.value = result.key
  selectedResult.value = result
  selectedVariableIds.value = result.environments.map(e => e.variable_id)
  step.value = 'select'
}

function goBack() {
  const steps: Step[] = ['search', 'select', 'configure', 'preview']
  const idx = steps.indexOf(step.value)
  const previousStep = steps[idx - 1]
  if (idx > 0 && previousStep) {
    step.value = previousStep
  }
}

async function applyUpdate() {
  applying.value = true
  try {
    const updates = previewItems.value.map(item => ({
      variable_id: item.variable_id,
      environment_id: item.environment_id,
      new_value: item.newValue,
    }))

    const res = await applyBulkUpdate(updates, reason.value || 'Bulk update')
    updateResult.value = res
    step.value = 'result'
    emit('updated')
  } catch (e: any) {
    $toast.error(e.message || 'Bulk update failed')
  } finally {
    applying.value = false
  }
}

// Reset state when modal opens
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    step.value = 'search'
    searchQuery.value = ''
    selectedKey.value = ''
    selectedResult.value = null
    selectedVariableIds.value = []
    updateMode.value = 'same'
    sameValue.value = ''
    Object.keys(perEnvValues).forEach((k) => {
      delete perEnvValues[k]
    })
    reason.value = ''
    updateResult.value = null
  }
})
</script>
