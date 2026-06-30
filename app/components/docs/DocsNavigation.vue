<template>
  <div class="flex items-center justify-between border-t pt-6">
    <NuxtLink
      v-if="prev"
      :to="prev.path"
      class="group flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
    >
      <Icon name="lucide:arrow-left" class="h-4 w-4" />
      <div class="text-sm">
        <div class="text-xs text-muted-foreground">Previous</div>
        <div class="font-medium group-hover:text-foreground">{{ prev.title }}</div>
      </div>
    </NuxtLink>
    <div v-else />

    <NuxtLink
      v-if="next"
      :to="next.path"
      class="group flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-right"
    >
      <div class="text-sm">
        <div class="text-xs text-muted-foreground">Next</div>
        <div class="font-medium group-hover:text-foreground">{{ next.title }}</div>
      </div>
      <Icon name="lucide:arrow-right" class="h-4 w-4" />
    </NuxtLink>
    <div v-else />
  </div>
</template>

<script setup lang="ts">
interface NavPage {
  title: string
  path: string
}

defineProps<{
  prev: NavPage | null
  next: NavPage | null
}>()
</script>
