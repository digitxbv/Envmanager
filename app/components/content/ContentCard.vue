<template>
  <NuxtLink
    :to="to"
    class="group block rounded-lg border bg-card p-5 transition-all hover:border-primary/50 hover:shadow-md"
  >
    <div class="flex items-start gap-4">
      <div v-if="icon" class="flex-shrink-0 rounded-lg bg-primary/10 p-2.5 text-primary">
        <Icon :name="icon" class="h-5 w-5" />
      </div>
      <div class="flex-1 min-w-0 card-content">
        <slot />
      </div>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
defineProps<{
  to: string
  icon?: string
}>()
</script>

<style scoped>
.card-content :deep(h3) {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 0.25rem 0;
}

.card-content :deep(p) {
  font-size: 0.875rem;
  opacity: 0.7;
  margin: 0;
}
</style>
