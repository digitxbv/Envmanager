<template>
  <div class="border rounded-lg p-4 overflow-x-auto">
    <div class="flex items-center justify-center gap-0 min-w-[300px]">
      <!-- Left: References (what this var uses) -->
      <div v-if="leftNodes.length > 0" class="flex flex-col gap-2 items-end shrink-0">
        <div
          v-for="node in leftNodes"
          :key="node.key"
          class="border rounded px-3 py-1.5 text-xs font-mono whitespace-nowrap"
          :class="node.isCircular ? 'border-destructive/40 bg-destructive/10 dark:bg-destructive/20 text-destructive dark:text-destructive/80' : 'bg-muted'"
        >
          {{ node.key }}
        </div>
      </div>

      <!-- Left connectors -->
      <div v-if="leftNodes.length > 0" class="flex flex-col items-center justify-center px-2 shrink-0">
        <svg :width="40" :height="Math.max(leftNodes.length * 32, 40)" class="overflow-visible">
          <line
            v-for="(_, i) in leftNodes"
            :key="i"
            :x1="0"
            :y1="leftNodes.length === 1 ? 20 : i * 32 + 12"
            :x2="40"
            :y2="Math.max(leftNodes.length * 32, 40) / 2"
            stroke="currentColor"
            stroke-width="1"
            class="text-muted-foreground/50"
            marker-end="url(#arrowRight)"
          />
          <defs>
            <marker id="arrowRight" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M 0 0 L 6 3 L 0 6 Z" class="fill-muted-foreground/50" />
            </marker>
            <marker id="arrowLeft" markerWidth="6" markerHeight="6" refX="1" refY="3" orient="auto">
              <path d="M 6 0 L 0 3 L 6 6 Z" class="fill-muted-foreground/50" />
            </marker>
          </defs>
        </svg>
      </div>

      <!-- Center: Current variable -->
      <div class="border-2 border-primary rounded-lg px-4 py-2 text-sm font-mono font-medium bg-primary/5 shrink-0 whitespace-nowrap">
        {{ centerVariable }}
      </div>

      <!-- Right connectors -->
      <div v-if="rightNodes.length > 0" class="flex flex-col items-center justify-center px-2 shrink-0">
        <svg :width="40" :height="Math.max(rightNodes.length * 32, 40)" class="overflow-visible">
          <line
            v-for="(_, i) in rightNodes"
            :key="i"
            :x1="0"
            :y1="Math.max(rightNodes.length * 32, 40) / 2"
            :x2="40"
            :y2="rightNodes.length === 1 ? 20 : i * 32 + 12"
            stroke="currentColor"
            stroke-width="1"
            class="text-muted-foreground/50"
            marker-end="url(#arrowRight)"
          />
        </svg>
      </div>

      <!-- Right: Referenced by (what uses this var) -->
      <div v-if="rightNodes.length > 0" class="flex flex-col gap-2 items-start shrink-0">
        <div
          v-for="node in rightNodes"
          :key="node.key"
          class="border rounded px-3 py-1.5 text-xs font-mono whitespace-nowrap"
          :class="node.isCircular ? 'border-destructive/40 bg-destructive/10 dark:bg-destructive/20 text-destructive dark:text-destructive/80' : 'bg-muted'"
        >
          {{ node.key }}
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-if="leftNodes.length === 0 && rightNodes.length === 0"
      class="text-center text-sm text-muted-foreground py-2"
    >
      No dependencies
    </div>
  </div>
</template>

<script setup lang="ts">
import { resolveAll, type ResolvedVariable, type VariableInput } from '@/utils/variable-references'

const props = defineProps<{
  centerVariable: string
  allVariables: ResolvedVariable[] | VariableInput[]
}>()

const resolved = computed<ResolvedVariable[]>(() => {
  if (props.allVariables.length === 0) return []
  // Check if already resolved (has referencedBy property)
  const firstVariable = props.allVariables[0]
  if (firstVariable && 'referencedBy' in firstVariable) {
    return props.allVariables as ResolvedVariable[]
  }
  return resolveAll(props.allVariables as VariableInput[])
})

const center = computed(() => resolved.value.find(r => r.key === props.centerVariable))

// Detect which keys are in a circular relationship with center
const circularKeys = computed(() => {
  if (!center.value?.hasCircularRef) return new Set<string>()
  const keys = new Set<string>()
  // If center references X and X references center, that's circular
  for (const ref of center.value.references) {
    const refVar = resolved.value.find(r => r.key === ref)
    if (refVar && refVar.references.includes(props.centerVariable)) {
      keys.add(ref)
    }
  }
  return keys
})

const leftNodes = computed(() => {
  if (!center.value) return []
  return center.value.references.slice(0, 8).map(key => ({
    key,
    isCircular: circularKeys.value.has(key),
  }))
})

const rightNodes = computed(() => {
  if (!center.value) return []
  return center.value.referencedBy.slice(0, 8).map(key => ({
    key,
    isCircular: circularKeys.value.has(key),
  }))
})
</script>
