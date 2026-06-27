<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 bg-background/80 z-50 flex items-center justify-center"
      @click="close"
    >
      <div
        :class="[
          'bg-card rounded-lg shadow-lg border w-full overflow-hidden max-h-[90vh] flex flex-col',
          step === 'preview' ? 'max-w-5xl' : 'max-w-lg'
        ]"
        @click.stop
      >
        <div class="p-6 overflow-y-auto">
          <!-- Header -->
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium">
              {{ step === 'upload' ? 'Import Variables' : 'Review Import' }}
            </h3>
            <button
              @click="close"
              class="text-muted-foreground hover:text-foreground"
              :disabled="importing"
            >
              <Icon name="lucide:x" class="h-5 w-5" />
            </button>
          </div>

          <!-- Step 1: Upload -->
          <div v-if="step === 'upload'" class="space-y-4">
            <FileDropZone
              @file-selected="handleFileSelected"
              @error="handleError"
            />

            <!-- Manual paste fallback -->
            <div class="relative">
              <div class="absolute inset-0 flex items-center">
                <span class="w-full border-t" />
              </div>
              <div class="relative flex justify-center text-xs uppercase">
                <span class="bg-card px-2 text-muted-foreground">Or paste content</span>
              </div>
            </div>

            <textarea
              v-model="pasteContent"
              rows="4"
              placeholder="KEY=value
ANOTHER_KEY=another_value"
              class="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 font-mono"
            />

            <div class="flex justify-end gap-2">
              <Button variant="outline" @click="close">Cancel</Button>
              <Button
                :disabled="!pasteContent.trim()"
                @click="handlePasteContent"
              >
                Parse Content
              </Button>
            </div>
          </div>

          <!-- Step 2: Preview -->
          <div v-else-if="step === 'preview'" class="space-y-4">
            <!-- File info -->
            <div class="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon name="lucide:file" class="h-4 w-4" />
              <span>{{ fileName }}</span>
              <span class="text-xs bg-muted px-2 py-0.5 rounded">{{ fileType }}</span>
            </div>

            <ImportPreview
              :variables="parsedVariables"
              :existing-keys="existingKeys"
              :errors="parseErrors"
              :warnings="parseWarnings"
              :naming-config="namingConfig"
              @update:variables="parsedVariables = $event"
              @naming-blocked="namingBlocked = $event"
            />

            <!-- Service selection -->
            <div v-if="props.services && props.services.length > 0" class="space-y-2">
              <label class="text-sm font-medium">Import to service:</label>
              <select
                v-model="importServiceId"
                class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option :value="null">Shared (no service)</option>
                <option v-for="svc in props.services" :key="svc.id" :value="svc.id">
                  {{ svc.name }}
                </option>
              </select>
            </div>

            <!-- Conflict Resolution -->
            <div v-if="conflictCount > 0" class="space-y-2">
              <label class="text-sm font-medium">Handle existing variables:</label>
              <div class="flex gap-4">
                <label class="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    v-model="conflictResolution"
                    value="skip"
                    class="text-primary focus:ring-primary"
                  />
                  Skip existing
                </label>
                <label class="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    v-model="conflictResolution"
                    value="overwrite"
                    class="text-primary focus:ring-primary"
                  />
                  Overwrite all
                </label>
              </div>
            </div>

            <div class="flex justify-between">
              <Button variant="outline" @click="step = 'upload'">
                <Icon name="lucide:arrow-left" class="mr-2 h-4 w-4" />
                Back
              </Button>
              <div class="flex gap-2">
                <Button variant="outline" @click="close" :disabled="importing">
                  Cancel
                </Button>
                <Button
                  @click="importVariables"
                  :loading="importing"
                  :disabled="importableCount === 0 || namingBlocked"
                >
                  Import {{ importableCount }} Variables
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import Button from '@/components/ui/Button.vue'
import FileDropZone from '@/components/import/FileDropZone.vue'
import ImportPreview from '@/components/import/ImportPreview.vue'
import type { NamingConventionConfig } from '@/utils/naming-conventions'
import {
  parseEnvFile,
  parseDotEnv,
  getFileTypeLabel,
  type ParsedVariable
} from '@/utils/parsers/envParser'

const props = defineProps<{
  modelValue: boolean
  environmentId: string
  organizationId: string
  projectId: string
  services?: readonly { id: string; name: string; color: string | null }[]
  defaultServiceId?: string | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'imported', count: number): void
}>()

const client = useSupabaseClient()
const { $toast } = useNuxtApp()
const { checkEnvironmentVariableLimit } = useLimits()

// State
const step = ref<'upload' | 'preview'>('upload')
const fileName = ref('')
const fileType = ref('')
const pasteContent = ref('')
const parsedVariables = ref<ParsedVariable[]>([])
const parseErrors = ref<string[]>([])
const parseWarnings = ref<string[]>([])
const existingKeys = ref<string[]>([])
const conflictResolution = ref<'skip' | 'overwrite'>('skip')
const importing = ref(false)
const namingConfig = ref<NamingConventionConfig | null>(null)
const namingBlocked = ref(false)
const importServiceId = ref<string | null>(props.defaultServiceId ?? null)

// Computed
const conflictCount = computed(() =>
  parsedVariables.value.filter(v => existingKeys.value.includes(v.key)).length
)

const importableCount = computed(() => {
  if (conflictResolution.value === 'skip') {
    return parsedVariables.value.filter(v => !existingKeys.value.includes(v.key)).length
  }
  return parsedVariables.value.length
})

// Methods
function close() {
  if (importing.value) return
  forceClose()
}

function forceClose() {
  emit('update:modelValue', false)
  reset()
}

function reset() {
  step.value = 'upload'
  fileName.value = ''
  fileType.value = ''
  pasteContent.value = ''
  parsedVariables.value = []
  parseErrors.value = []
  parseWarnings.value = []
  existingKeys.value = []
  conflictResolution.value = 'skip'
  namingBlocked.value = false
}

// Fetch naming rules when modal opens
watch(() => props.modelValue, async (open) => {
  if (open && props.organizationId) {
    const { getEffectiveRules } = useNamingConventions(computed(() => props.organizationId))
    try {
      namingConfig.value = await getEffectiveRules(props.projectId)
    } catch {
      namingConfig.value = null
    }
  }
})

function handleError(message: string) {
  $toast.error(message)
}

async function handleFileSelected(file: File) {
  fileName.value = file.name
  fileType.value = getFileTypeLabel(file.name)

  try {
    const content = await file.text()
    const result = parseEnvFile(content, file.name)

    parsedVariables.value = result.variables
    parseErrors.value = result.errors
    parseWarnings.value = result.warnings

    if (result.variables.length === 0 && result.errors.length === 0) {
      $toast.error('No variables found in file')
      return
    }

    if (result.warnings.length > 0) {
      $toast.warning(`${result.warnings.length} duplicate key${result.warnings.length === 1 ? '' : 's'} ignored`)
    }

    await fetchExistingKeys()
    step.value = 'preview'
  } catch (error) {
    $toast.error('Failed to read file')
  }
}

async function handlePasteContent() {
  fileName.value = 'pasted-content'
  fileType.value = '.env'

  const result = parseDotEnv(pasteContent.value)
  parsedVariables.value = result.variables
  parseErrors.value = result.errors
  parseWarnings.value = result.warnings

  if (result.variables.length === 0 && result.errors.length === 0) {
    $toast.error('No variables found in content')
    return
  }

  if (result.warnings.length > 0) {
    $toast.warning(`${result.warnings.length} duplicate key${result.warnings.length === 1 ? '' : 's'} ignored`)
  }

  await fetchExistingKeys()
  step.value = 'preview'
}

async function fetchExistingKeys() {
  const keys = parsedVariables.value.map(v => v.key)

  const { data, error } = await client
    .from('variables')
    .select('key')
    .eq('environment_id', props.environmentId)
    .in('key', keys)

  if (error) {
    console.error('Failed to fetch existing keys:', error)
    return
  }

  existingKeys.value = (data || []).map(v => v.key)
}

async function importVariables() {
  importing.value = true

  try {
    // Determine which variables to import
    let toImport = parsedVariables.value
    let skippedCount = 0
    let overwrittenCount = 0

    if (conflictResolution.value === 'skip') {
      skippedCount = conflictCount.value
      toImport = parsedVariables.value.filter(v => !existingKeys.value.includes(v.key))
    } else if (conflictResolution.value === 'overwrite' && conflictCount.value > 0) {
      // Delete existing variables that will be overwritten
      const keysToOverwrite = parsedVariables.value
        .filter(v => existingKeys.value.includes(v.key))
        .map(v => v.key)

      const { error: deleteError } = await client
        .from('variables')
        .delete()
        .eq('environment_id', props.environmentId)
        .in('key', keysToOverwrite)

      if (deleteError) throw deleteError
      overwrittenCount = keysToOverwrite.length
    }

    if (toImport.length === 0) {
      $toast.info('No new variables to import')
      forceClose()
      return
    }

    // Check limit
    const limitCheck = await checkEnvironmentVariableLimit(props.environmentId, toImport.length)
    if (!limitCheck.allowed) {
      $toast.error(`Import would exceed variable limit (${limitCheck.current + toImport.length}/${limitCheck.limit}). Upgrade your plan.`)
      importing.value = false
      return
    }

    // Separate secrets and regular variables, skip empty-value secrets
    const secretVars = toImport.filter(v => v.isSecret && v.value.trim() !== '')
    const skippedEmptySecrets = toImport.filter(v => v.isSecret && v.value.trim() === '')
    const regularVars = toImport.filter(v => !v.isSecret)

    if (skippedEmptySecrets.length > 0) {
      toImport = toImport.filter(v => !(v.isSecret && v.value.trim() === ''))
    }

    if (toImport.length === 0) {
      $toast.info('No variables to import (empty-value secrets were skipped)')
      forceClose()
      return
    }

    // Import secrets using bulk_insert_variables RPC
    if (secretVars.length > 0) {
      const { error: secretError } = await client.rpc('bulk_insert_variables', {
        variables_data: secretVars.map(v => ({ key: v.key, value: v.value })),
        environment_id_param: props.environmentId,
        organization_id_param: props.organizationId,
        import_as_secrets: true,
        service_id_param: importServiceId.value ?? undefined
      })

      if (secretError) throw secretError
    }

    // Import regular variables using bulk_insert_variables RPC
    if (regularVars.length > 0) {
      const { error: regularError } = await client.rpc('bulk_insert_variables', {
        variables_data: regularVars.map(v => ({ key: v.key, value: v.value })),
        environment_id_param: props.environmentId,
        organization_id_param: props.organizationId,
        import_as_secrets: false,
        service_id_param: importServiceId.value ?? undefined
      })

      if (regularError) throw regularError
    }

    // Log import history
    const currentUserId = (await client.auth.getUser()).data.user?.id
    if (currentUserId) {
      await client.from('import_history').insert({
        organization_id: props.organizationId,
        environment_id: props.environmentId,
        user_id: currentUserId,
        file_name: fileName.value,
        file_type: fileType.value,
        variables_imported: toImport.length,
        variables_skipped: skippedCount,
        variables_overwritten: overwrittenCount
      })
    }

    const feedbackParts = [`Imported ${toImport.length} variable${toImport.length === 1 ? '' : 's'}`]
    if (skippedCount > 0) feedbackParts.push(`${skippedCount} skipped`)
    if (overwrittenCount > 0) feedbackParts.push(`${overwrittenCount} overwritten`)
    if (skippedEmptySecrets.length > 0) feedbackParts.push(`${skippedEmptySecrets.length} empty secret${skippedEmptySecrets.length === 1 ? '' : 's'} skipped`)

    $toast.success(feedbackParts.join(', '))
    emit('imported', toImport.length)
    forceClose()
  } catch (error: any) {
    console.error('Import failed:', error)
    const message = error?.message || error?.details || 'Failed to import variables'
    $toast.error(message)
  } finally {
    importing.value = false
  }
}
</script>
