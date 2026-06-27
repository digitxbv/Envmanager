<template>
  <div v-if="config && variableName" class="flex items-center gap-2 text-xs mt-1">
    <!-- Valid -->
    <template v-if="result && result.valid && result.errors.length === 0 && result.warnings.length === 0">
      <Icon name="lucide:check-circle" class="h-3.5 w-3.5 text-success" />
      <span class="text-success">Valid</span>
    </template>
    <!-- Warnings -->
    <template v-else-if="result && result.warnings.length > 0">
      <Icon name="lucide:alert-triangle" class="h-3.5 w-3.5 text-yellow-500" />
      <span class="text-yellow-600">{{ firstWarningMessage }}</span>
      <button
        v-if="firstSuggestion"
        class="text-primary hover:underline font-mono"
        @click="$emit('apply-suggestion', firstSuggestion)"
      >
        Use <code class="bg-muted px-1 rounded">{{ firstSuggestion }}</code>
      </button>
    </template>
    <!-- Errors -->
    <template v-else-if="result && result.errors.length > 0">
      <Icon name="lucide:x-circle" class="h-3.5 w-3.5 text-destructive" />
      <span class="text-destructive">{{ firstErrorMessage }}</span>
      <button
        v-if="firstSuggestion"
        class="text-primary hover:underline font-mono"
        @click="$emit('apply-suggestion', firstSuggestion)"
      >
        Use <code class="bg-muted px-1 rounded">{{ firstSuggestion }}</code>
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { validateVariableName, type NamingConventionConfig } from '@/utils/naming-conventions'

const props = defineProps<{
  variableName: string
  organizationId: string
  projectId: string
}>()

const emit = defineEmits<{
  'apply-suggestion': [suggestion: string]
  'validation-change': [state: { valid: boolean; hasErrors: boolean }]
}>()

const config = ref<NamingConventionConfig | null>(null)
const { getEffectiveRules } = useNamingConventions(computed(() => props.organizationId))

const result = computed(() => {
  if (!config.value || !props.variableName) return null
  return validateVariableName(props.variableName, config.value)
})

const firstWarningMessage = computed(() => result.value?.warnings[0]?.message ?? '')
const firstErrorMessage = computed(() => result.value?.errors[0]?.message ?? '')
const firstSuggestion = computed(() => result.value?.suggestions[0] ?? null)

watch(result, (val) => {
  if (val) {
    emit('validation-change', { valid: val.valid, hasErrors: val.errors.length > 0 })
  }
})

onMounted(async () => {
  try {
    config.value = await getEffectiveRules(props.projectId)
  } catch {
    // No rules configured — badge stays hidden
  }
})
</script>
