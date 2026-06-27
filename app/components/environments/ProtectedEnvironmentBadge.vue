<template>
  <span
    v-if="isProtected"
    :class="['inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
      'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
    ]"
  >
    <Icon name="lucide:shield-check" class="h-3 w-3" />
    Protected
  </span>
</template>

<script setup lang="ts">
defineProps<{
  isProtected: boolean
}>()
</script>
