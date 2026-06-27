<template>
  <div v-if="hasRelationships" class="flex flex-wrap gap-x-3 gap-y-1 text-xs mt-1">
    <!-- References (what this variable depends on) -->
    <div v-if="references.length > 0" class="flex items-center gap-1 text-muted-foreground">
      <Icon name="lucide:arrow-right" class="h-3 w-3" />
      <span>References:</span>
      <span
        v-for="ref in references"
        :key="ref"
        class="font-mono bg-muted px-1.5 py-0.5 rounded"
      >{{ ref }}</span>
    </div>
    <!-- Referenced by (what depends on this variable) -->
    <div v-if="referencedBy.length > 0" class="flex items-center gap-1 text-muted-foreground">
      <Icon name="lucide:arrow-left" class="h-3 w-3" />
      <span>Used by:</span>
      <span
        v-for="ref in referencedBy"
        :key="ref"
        class="font-mono bg-muted px-1.5 py-0.5 rounded"
      >{{ ref }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { parseReferences, type VariableInput } from '@/utils/variable-references'

const props = defineProps<{
  variableKey: string
  allVariables: VariableInput[]
}>()

const references = computed(() => {
  const variable = props.allVariables.find(v => v.key === props.variableKey)
  if (!variable) return []
  const base = variable.value || variable.fallbackValue || ''
  return parseReferences(base)
})

const referencedBy = computed(() => {
  const result: string[] = []
  for (const v of props.allVariables) {
    if (v.key === props.variableKey) continue
    const base = v.value || v.fallbackValue || ''
    const refs = parseReferences(base)
    if (refs.includes(props.variableKey)) {
      result.push(v.key)
    }
  }
  return result
})

const hasRelationships = computed(() => references.value.length > 0 || referencedBy.value.length > 0)
</script>
