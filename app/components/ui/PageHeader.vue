<template>
  <div :class="$slots.actions ? 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between' : ''">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight text-foreground">{{ title }}</h1>
      <p v-if="description" class="text-sm text-muted-foreground mt-1">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup>
defineOptions({
  inheritAttrs: false
})

defineProps({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  }
})
</script>
