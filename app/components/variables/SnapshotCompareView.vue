<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 bg-background/80 z-50 flex items-center justify-center"
      @click="$emit('close')"
    >
      <div
        class="bg-card rounded-lg shadow-lg border w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
        @click.stop
      >
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b">
          <div>
            <h3 class="text-lg font-medium">Snapshot Comparison</h3>
            <p class="text-sm text-muted-foreground">{{ snapshotName }}</p>
          </div>
          <Button variant="ghost" size="icon" @click="$emit('close')">
            <Icon name="lucide:x" class="h-4 w-4" />
          </Button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-4 space-y-4">
          <!-- Loading -->
          <div v-if="loading" class="flex items-center justify-center py-8">
            <Icon name="lucide:loader-2" class="h-5 w-5 animate-spin text-muted-foreground" />
          </div>

          <template v-else-if="diff">
            <!-- Summary -->
            <div class="flex items-center gap-3 text-sm">
              <span v-if="diff.added.length" class="inline-flex items-center gap-1 px-2 py-1 rounded bg-success/10 text-success dark:bg-success/20">
                <Icon name="lucide:plus" class="h-3 w-3" />
                {{ diff.added.length }} added
              </span>
              <span v-if="diff.removed.length" class="inline-flex items-center gap-1 px-2 py-1 rounded bg-destructive/10 text-destructive dark:bg-destructive/20">
                <Icon name="lucide:minus" class="h-3 w-3" />
                {{ diff.removed.length }} removed
              </span>
              <span v-if="diff.modified.length" class="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                <Icon name="lucide:pencil" class="h-3 w-3" />
                {{ diff.modified.length }} modified
              </span>
              <span class="text-muted-foreground">
                {{ diff.unchanged }} unchanged
              </span>
            </div>

            <!-- No changes -->
            <div v-if="!diff.added.length && !diff.removed.length && !diff.modified.length" class="text-center py-6 text-muted-foreground">
              <Icon name="lucide:check-circle" class="h-8 w-8 mx-auto mb-2 text-success" />
              <p>Snapshot matches current state</p>
            </div>

            <!-- Added (in snapshot, not in current) -->
            <div v-if="diff.added.length">
              <h4 class="text-sm font-medium mb-2 text-success">
                <Icon name="lucide:plus-circle" class="h-4 w-4 inline mr-1" />
                Would be added
              </h4>
              <div class="space-y-1">
                <div
                  v-for="item in diff.added"
                  :key="item.key"
                  class="flex items-center justify-between rounded border border-success/30 dark:border-success/40 bg-success/10 dark:bg-success/20 px-3 py-2 text-sm"
                >
                  <span class="font-mono font-medium">{{ item.key }}</span>
                  <span class="font-mono text-muted-foreground truncate ml-4 max-w-[300px]">{{ item.snapshot_value }}</span>
                </div>
              </div>
            </div>

            <!-- Removed (in current, not in snapshot) -->
            <div v-if="diff.removed.length">
              <h4 class="text-sm font-medium mb-2 text-destructive">
                <Icon name="lucide:minus-circle" class="h-4 w-4 inline mr-1" />
                Not in snapshot (kept as-is)
              </h4>
              <div class="space-y-1">
                <div
                  v-for="item in diff.removed"
                  :key="item.key"
                  class="flex items-center justify-between rounded border border-destructive/30 dark:border-destructive/40 bg-destructive/10 dark:bg-destructive/20 px-3 py-2 text-sm"
                >
                  <span class="font-mono font-medium">{{ item.key }}</span>
                  <span class="font-mono text-muted-foreground truncate ml-4 max-w-[300px]">{{ item.current_value }}</span>
                </div>
              </div>
            </div>

            <!-- Modified -->
            <div v-if="diff.modified.length">
              <h4 class="text-sm font-medium mb-2 text-blue-600">
                <Icon name="lucide:arrow-right-left" class="h-4 w-4 inline mr-1" />
                Would be modified
              </h4>
              <div class="space-y-2">
                <div
                  v-for="item in diff.modified"
                  :key="item.key"
                  class="rounded border px-3 py-2 text-sm"
                >
                  <div class="font-mono font-medium mb-1">{{ item.key }}</div>
                  <div class="text-xs font-mono">
                    <div class="text-destructive/70">current: {{ item.current_value }}</div>
                    <div class="text-success">snapshot: {{ item.snapshot_value }}</div>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import Button from '@/components/ui/Button.vue'

const props = defineProps<{
  open: boolean
  snapshotName: string
  loading: boolean
  diff: {
    added: Array<{ key: string; snapshot_value: string }>
    removed: Array<{ key: string; current_value: string }>
    modified: Array<{ key: string; snapshot_value: string; current_value: string; is_secret?: boolean }>
    unchanged: number
  } | null
}>()

defineEmits<{
  close: []
}>()
</script>
