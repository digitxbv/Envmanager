<template>
  <div v-if="hasReferences" class="flex items-start gap-1.5 text-xs mt-1">
    <!-- Circular reference error -->
    <template v-if="resolved?.hasCircularRef">
      <Icon name="lucide:alert-octagon" class="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
      <span class="text-destructive dark:text-destructive/80">Circular reference detected</span>
    </template>
    <!-- Unresolved references -->
    <template v-else-if="resolved && resolved.unresolvedRefs.length > 0">
      <Icon name="lucide:alert-triangle" class="h-3.5 w-3.5 text-yellow-500 mt-0.5 shrink-0" />
      <span class="text-yellow-600 dark:text-yellow-400">
        Unresolved: <code class="bg-muted px-1 rounded" v-for="ref in resolved.unresolvedRefs" :key="ref">${{ ref }}</code>
      </span>
    </template>
    <!-- Successfully resolved -->
    <template v-else-if="resolved">
      <Icon name="lucide:check-circle" class="h-3.5 w-3.5 text-success mt-0.5 shrink-0" />
      <span class="text-muted-foreground">
        Resolves to: <code class="bg-muted px-1 rounded font-mono">{{ truncatedResolved }}</code>
      </span>
    </template>
  </div>
</template>

<script setup lang="ts">
import { parseReferences, resolveValue, type VariableInput } from '@/utils/variable-references'

const props = defineProps<{
  rawValue: string
  allVariables: VariableInput[]
  currentKey: string
}>()

const hasReferences = computed(() => {
  if (!props.rawValue) return false
  return parseReferences(props.rawValue).length > 0
})

const resolved = computed(() => {
  if (!hasReferences.value) return null

  const varMap = new Map<string, VariableInput>()
  for (const v of props.allVariables) {
    varMap.set(v.key, v)
  }
  // Add or override current variable with form value
  varMap.set(props.currentKey, { key: props.currentKey, value: props.rawValue })

  return resolveValue(props.currentKey, varMap)
})

const truncatedResolved = computed(() => {
  if (!resolved.value) return ''
  const val = resolved.value.resolvedValue
  return val.length > 80 ? val.slice(0, 80) + '...' : val
})
</script>
