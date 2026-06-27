<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 bg-background/80 z-50 flex justify-end"
      @click="$emit('close')"
    >
      <div
        class="bg-card border-l shadow-lg w-full max-w-[480px] h-full flex flex-col"
        @click.stop
      >
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b">
          <div>
            <h3 class="text-lg font-medium">Dependencies</h3>
            <p class="text-sm text-muted-foreground font-mono">{{ variableKey }}</p>
          </div>
          <Button variant="ghost" size="icon" @click="$emit('close')">
            <Icon name="lucide:x" class="h-4 w-4" />
          </Button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-4 space-y-6">
          <!-- References Section -->
          <div>
            <h4 class="text-sm font-medium mb-2 flex items-center gap-2">
              <Icon name="lucide:arrow-right" class="h-4 w-4 text-blue-500" />
              This variable references
            </h4>
            <div v-if="deps.references.length === 0" class="text-sm text-muted-foreground pl-6">
              No references
            </div>
            <div v-else class="space-y-1 pl-6">
              <button
                v-for="ref in deps.references"
                :key="ref"
                class="flex items-center gap-2 text-sm font-mono text-blue-600 dark:text-blue-400 hover:underline"
                @click="$emit('navigate', ref)"
              >
                <Icon name="lucide:link" class="h-3 w-3" />
                {{ ref }}
              </button>
            </div>
          </div>

          <!-- Referenced By Section -->
          <div>
            <h4 class="text-sm font-medium mb-2 flex items-center gap-2">
              <Icon name="lucide:arrow-left" class="h-4 w-4 text-success" />
              Referenced by
            </h4>
            <div v-if="deps.referencedBy.length === 0" class="text-sm text-muted-foreground pl-6">
              Not referenced by any variable
            </div>
            <div v-else class="space-y-1 pl-6">
              <button
                v-for="ref in deps.referencedBy"
                :key="ref"
                class="flex items-center gap-2 text-sm font-mono text-success dark:text-success/80 hover:underline"
                @click="$emit('navigate', ref)"
              >
                <Icon name="lucide:link" class="h-3 w-3" />
                {{ ref }}
              </button>
            </div>
          </div>

          <!-- Circular Warning -->
          <div
            v-if="deps.hasCircular"
            class="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 dark:bg-destructive/20 border border-destructive/30 dark:border-destructive/40"
          >
            <Icon name="lucide:alert-triangle" class="h-4 w-4 text-destructive" />
            <span class="text-sm text-destructive dark:text-destructive/80">Circular reference detected</span>
          </div>

          <!-- Access Stats Section -->
          <div v-if="accessStats && accessStats.length > 0">
            <h4 class="text-sm font-medium mb-2 flex items-center gap-2">
              <Icon name="lucide:activity" class="h-4 w-4 text-purple-500" />
              Access Stats (last 7 days)
            </h4>
            <div class="grid grid-cols-3 gap-3 pl-6">
              <div
                v-for="stat in accessStats"
                :key="stat.access_type"
                class="border rounded-lg p-2 text-center"
              >
                <div class="text-lg font-semibold">{{ stat.access_count }}</div>
                <div class="text-xs text-muted-foreground">{{ formatAccessType(stat.access_type) }}</div>
              </div>
            </div>
            <div v-if="lastAccessed" class="text-xs text-muted-foreground mt-2 pl-6">
              Last accessed: {{ formatRelativeTime(lastAccessed) }}
            </div>
          </div>

          <!-- Impact Summary -->
          <div v-if="deps.referencedBy.length > 0">
            <h4 class="text-sm font-medium mb-2 flex items-center gap-2">
              <Icon name="lucide:alert-circle" class="h-4 w-4 text-warning" />
              Impact Summary
            </h4>
            <p class="text-sm text-muted-foreground pl-6">
              Changing this variable will affect <strong>{{ deps.referencedBy.length }}</strong> dependent variable{{ deps.referencedBy.length > 1 ? 's' : '' }}.
            </p>
          </div>

          <!-- Dependency Graph -->
          <div v-if="deps.references.length > 0 || deps.referencedBy.length > 0">
            <h4 class="text-sm font-medium mb-2 flex items-center gap-2">
              <Icon name="lucide:git-branch" class="h-4 w-4" />
              Dependency Graph
            </h4>
            <DependencyGraph
              :center-variable="variableKey"
              :all-variables="allVariables"
            />
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import Button from '@/components/ui/Button.vue'
import DependencyGraph from '@/components/variables/DependencyGraph.vue'
import type { ResolvedVariable } from '@/utils/variable-references'

const props = defineProps<{
  open: boolean
  variableKey: string
  allVariables: ResolvedVariable[]
  accessStats: { access_type: string; access_count: number; last_access: string; unique_users: number }[] | null
}>()

defineEmits<{
  close: []
  navigate: [key: string]
}>()

const deps = computed(() => {
  const resolved = props.allVariables.find(r => r.key === props.variableKey)
  if (!resolved) return { references: [], referencedBy: [], hasCircular: false }
  return {
    references: resolved.references,
    referencedBy: resolved.referencedBy,
    hasCircular: resolved.hasCircularRef,
  }
})

const lastAccessed = computed(() => {
  if (!props.accessStats || props.accessStats.length === 0) return null
  const sorted = [...props.accessStats].sort((a, b) => new Date(b.last_access).getTime() - new Date(a.last_access).getTime())
  return sorted[0]?.last_access ?? null
})

function formatAccessType(type: string): string {
  const labels: Record<string, string> = {
    cli_pull: 'CLI pulls',
    web_view: 'Web views',
    web_decrypt: 'Decryptions',
  }
  return labels[type] || type
}

function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `${diffDays}d ago`
  return date.toLocaleDateString()
}
</script>
