<template>
  <div class="rounded-lg border border-border bg-muted/20 p-6 text-center space-y-4">
    <div class="space-y-1">
      <h3 class="text-base font-medium text-foreground">Add your variables</h3>
      <p class="text-sm text-muted-foreground">
        Import your existing <span class="font-mono text-xs">.env</span>, or add variables one at a time.
      </p>
    </div>

    <div v-if="canWrite" class="flex flex-wrap items-center justify-center gap-2">
      <Button size="sm" @click="$emit('import')">
        <Icon name="lucide:upload" class="mr-1.5 h-4 w-4" />
        Import your .env
      </Button>
      <Button variant="outline" size="sm" @click="$emit('add')">
        <Icon name="lucide:plus" class="mr-1.5 h-4 w-4" />
        Add manually
      </Button>
    </div>

    <p class="text-xs text-muted-foreground">
      Then connect Vercel, GitHub Actions, Dokploy and more to push them where they run.
    </p>
  </div>
</template>

<script setup lang="ts">
defineProps<{ canWrite: boolean }>()
defineEmits<{ import: []; add: [] }>()

const { track } = usePostHog()
onMounted(() => track('empty_project_guide_shown', {}))
</script>
