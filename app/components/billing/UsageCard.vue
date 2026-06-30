<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Icon :name="icon || 'lucide:gauge'" class="h-4 w-4 text-muted-foreground" />
        <span class="text-sm font-medium">{{ title }}</span>
      </div>
      <span class="text-sm text-muted-foreground">
        {{ current }} / {{ isUnlimited ? '∞' : limit }}
      </span>
    </div>
    <div class="w-full bg-muted rounded-full h-2">
      <div
        class="h-2 rounded-full transition-all"
        :class="progressColor"
        :style="{ width: progressWidth }"
      />
    </div>
    <p v-if="!isUnlimited && percentage >= 90" class="text-xs text-destructive">
      <Icon name="lucide:alert-triangle" class="inline h-4 w-4 mr-1" />
      Approaching limit
    </p>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  title: string
  current: number
  limit: number
  icon: string
}>()

const isUnlimited = computed(() => props.limit === -1 || props.limit >= 999999)

const percentage = computed(() => {
  if (isUnlimited.value) return (props.current / 100) * 100
  return (props.current / props.limit) * 100
})

const progressWidth = computed(() => {
  if (isUnlimited.value) return '20%' // Show small bar for unlimited
  return `${Math.min(percentage.value, 100)}%`
})

const progressColor = computed(() => {
  if (isUnlimited.value) return 'bg-primary'
  if (percentage.value >= 100) return 'bg-destructive'
  if (percentage.value >= 90) return 'bg-warning'
  if (percentage.value >= 75) return 'bg-warning'
  return 'bg-primary'
})
</script>
