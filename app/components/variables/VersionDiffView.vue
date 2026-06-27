<template>
  <div class="space-y-3">
    <!-- Version labels -->
    <div class="flex items-center gap-3 text-sm">
      <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-destructive/10 text-destructive dark:bg-destructive/20">
        v{{ versionA.version_number }}
      </span>
      <Icon name="lucide:arrow-right" class="h-4 w-4 text-muted-foreground" />
      <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-success/10 text-success dark:bg-success/20">
        v{{ versionB.version_number }}
      </span>
    </div>

    <!-- Value diff -->
    <div class="rounded-md border overflow-hidden text-sm font-mono">
      <div class="bg-destructive/10 dark:bg-destructive/20 px-3 py-2 border-b">
        <span class="text-destructive dark:text-destructive/80">- {{ isSecret ? '[encrypted]' : (versionA.old_value || versionA.new_value || '(empty)') }}</span>
      </div>
      <div class="bg-success/10 dark:bg-success/20 px-3 py-2">
        <span class="text-success dark:text-success/80">+ {{ isSecret ? '[encrypted]' : (versionB.new_value || '(empty)') }}</span>
      </div>
    </div>

    <!-- Metadata -->
    <div class="text-xs text-muted-foreground space-y-1">
      <div v-if="versionB.user_email">
        Changed by <span class="font-medium">{{ versionB.user_email }}</span>
      </div>
      <div v-if="versionB.change_reason">
        Reason: <span class="italic">"{{ versionB.change_reason }}"</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  versionA: {
    version_number: number | null
    old_value: string | null
    new_value: string | null
    user_email: string | null
    change_reason: string | null
  }
  versionB: {
    version_number: number | null
    old_value: string | null
    new_value: string | null
    user_email: string | null
    change_reason: string | null
  }
  isSecret: boolean
}>()
</script>
