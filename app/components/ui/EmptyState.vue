<template>
  <div
    class="flex flex-col items-center justify-center py-16 space-y-4"
    v-bind="$attrs"
  >
    <div v-if="icon" class="bg-muted rounded-full p-4">
      <Icon :name="icon || 'lucide:circle'" class="h-5 w-5 text-muted-foreground" />
    </div>
    <div class="text-center space-y-2">
      <h3 v-if="title" class="text-lg font-medium text-foreground">
        {{ title }}
      </h3>
      <p v-if="description" class="text-sm text-muted-foreground max-w-md">
        {{ description }}
      </p>
    </div>
    <div v-if="$slots.default" class="pt-2">
      <slot />
    </div>
  </div>
</template>

<script setup>
defineOptions({
  inheritAttrs: false
})

defineProps({
  icon: {
    type: String,
    default: ''
  },
  title: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  }
})
</script>
