<template>
  <div class="space-y-4">
    <!-- Summary -->
    <div class="flex items-center gap-4 text-sm">
      <span class="flex items-center gap-1">
        <span class="inline-block w-2 h-2 rounded-full bg-green-500"></span>
        <span>{{ newCount }} new</span>
      </span>
      <span v-if="existingCount > 0" class="flex items-center gap-1">
        <span class="inline-block w-2 h-2 rounded-full bg-yellow-500"></span>
        <span>{{ existingCount }} existing</span>
      </span>
      <span class="flex items-center gap-1">
        <span class="inline-block w-2 h-2 rounded-full bg-destructive"></span>
        <span>{{ secretCount }} secrets</span>
      </span>
      <span v-if="namingConfig && hasBlockingErrors" class="flex items-center gap-1 text-red-600">
        <Icon name="lucide:x-circle" class="h-3 w-3" />
        <span>naming errors</span>
      </span>
    </div>

    <!-- Variables Table -->
    <div class="relative overflow-x-auto rounded-lg border max-h-72 overflow-y-auto">
      <table class="w-full table-fixed text-sm">
        <thead class="bg-muted text-muted-foreground text-xs uppercase sticky top-0">
          <tr>
            <th class="px-3 py-2 text-left w-[28%]">Key</th>
            <th class="px-3 py-2 text-left w-[28%]">Value</th>
            <th class="px-3 py-2 text-left w-[16%]">Status</th>
            <th v-if="namingConfig" class="px-3 py-2 text-left w-[22%]">Naming</th>
            <th class="px-3 py-2 text-center w-[6%]">Secret</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(variable, index) in variables"
            :key="index"
            class="border-b bg-card hover:bg-muted/30 transition-colors"
          >
            <td class="px-3 py-2 font-mono text-xs break-all">{{ variable.key }}</td>
            <td class="px-3 py-2 font-mono text-xs text-muted-foreground truncate">
              {{ maskValue(variable.value) }}
            </td>
            <td class="px-3 py-2">
              <span
                :class="[
                  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                  getStatusClass(variable.key)
                ]"
              >
                {{ getStatusLabel(variable.key) }}
              </span>
            </td>
            <td v-if="namingConfig" class="px-3 py-2">
              <template v-if="validationResults.get(variable.key)">
                <span v-if="getFirstValidationError(variable.key)" class="text-red-600 text-xs flex items-center gap-1 min-w-0">
                  <Icon name="lucide:x-circle" class="h-3 w-3" />
                  <span class="truncate flex-1 min-w-0" :title="getFirstValidationError(variable.key)">
                    {{ getFirstValidationError(variable.key) }}
                  </span>
                </span>
                <span v-else-if="getFirstValidationWarning(variable.key)" class="text-yellow-600 text-xs flex items-center gap-1 min-w-0">
                  <Icon name="lucide:alert-triangle" class="h-3 w-3" />
                  <span class="truncate flex-1 min-w-0" :title="getFirstValidationWarning(variable.key)">
                    {{ getFirstValidationWarning(variable.key) }}
                  </span>
                </span>
                <span v-else class="text-green-600 text-xs flex items-center gap-1">
                  <Icon name="lucide:check-circle" class="h-3 w-3" />
                </span>
              </template>
            </td>
            <td class="px-3 py-2 text-center">
              <input
                type="checkbox"
                :checked="variable.isSecret"
                @change="toggleSecret(index)"
                class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Parse Errors -->
    <div v-if="warnings.length > 0" class="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900 dark:border-yellow-900/50 dark:bg-yellow-900/20 dark:text-yellow-200">
      <p class="font-medium">Import warnings:</p>
      <ul class="list-disc list-inside">
        <li v-for="warning in warnings" :key="warning">{{ warning }}</li>
      </ul>
    </div>

    <div v-if="errors.length > 0" class="text-sm text-destructive">
      <p class="font-medium">Parsing errors:</p>
      <ul class="list-disc list-inside">
        <li v-for="error in errors" :key="error">{{ error }}</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ParsedVariable } from '@/utils/parsers/envParser'
import { validateVariableName, type NamingConventionConfig, type NamingValidationResult } from '@/utils/naming-conventions'

const props = defineProps<{
  variables: ParsedVariable[]
  existingKeys: string[]
  errors: string[]
  warnings?: string[]
  namingConfig?: NamingConventionConfig | null
}>()

const emit = defineEmits<{
  (e: 'update:variables', variables: ParsedVariable[]): void
  (e: 'naming-blocked', blocked: boolean): void
}>()

const warnings = computed(() => props.warnings ?? [])

const validationResults = computed(() => {
  if (!props.namingConfig) return new Map<string, NamingValidationResult>()
  const results = new Map<string, NamingValidationResult>()
  for (const v of props.variables) {
    results.set(v.key, validateVariableName(v.key, props.namingConfig))
  }
  return results
})

const hasBlockingErrors = computed(() => {
  if (!props.namingConfig || props.namingConfig.enforcement_mode !== 'block') return false
  return [...validationResults.value.values()].some(r => r.errors.length > 0)
})

watch(hasBlockingErrors, (blocked) => {
  emit('naming-blocked', blocked)
}, { immediate: true })

const newCount = computed(() =>
  props.variables.filter(v => !props.existingKeys.includes(v.key)).length
)

const existingCount = computed(() =>
  props.variables.filter(v => props.existingKeys.includes(v.key)).length
)

const secretCount = computed(() =>
  props.variables.filter(v => v.isSecret).length
)

function maskValue(value: string): string {
  if (value.length <= 4) return '****'
  return value.substring(0, 4) + '****'
}

function getStatusLabel(key: string): string {
  return props.existingKeys.includes(key) ? 'Exists' : 'New'
}

function getStatusClass(key: string): string {
  return props.existingKeys.includes(key)
    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
    : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
}

function toggleSecret(index: number) {
  const updated = [...props.variables]
  const variable = updated[index]
  if (!variable) return
  updated[index] = {
    ...variable,
    isSecret: !variable.isSecret
  }
  emit('update:variables', updated)
}

function getFirstValidationError(key: string): string | undefined {
  const firstError = validationResults.value.get(key)?.errors[0]
  return firstError?.message
}

function getFirstValidationWarning(key: string): string | undefined {
  const firstWarning = validationResults.value.get(key)?.warnings[0]
  return firstWarning?.message
}
</script>
