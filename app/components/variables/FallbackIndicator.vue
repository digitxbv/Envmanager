<template>
  <div v-if="showIndicator" class="inline-flex items-center gap-1 text-xs">
    <!-- Fallback active: value is empty, fallback exists -->
    <template v-if="isFallbackActive">
      <Icon name="lucide:arrow-down-circle" class="h-3.5 w-3.5 text-blue-500" />
      <span class="text-blue-600 dark:text-blue-400 font-medium">
        Fallback: {{ isSecret ? '********' : truncated }}
      </span>
    </template>
    <!-- Fallback available: value is set but fallback also exists -->
    <template v-else-if="hasFallbackAvailable">
      <Icon name="lucide:shield" class="h-3.5 w-3.5 text-muted-foreground/60" title="Fallback value configured" />
    </template>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  value: string | null
  fallbackValue: string | null
  isSecret: boolean
}>()

const hasValue = computed(() => props.value !== null && props.value !== undefined && props.value !== '')
const hasFallback = computed(() => props.fallbackValue !== null && props.fallbackValue !== undefined && props.fallbackValue !== '')

const isFallbackActive = computed(() => !hasValue.value && hasFallback.value)
const hasFallbackAvailable = computed(() => hasValue.value && hasFallback.value)
const showIndicator = computed(() => isFallbackActive.value || hasFallbackAvailable.value)

const truncated = computed(() => {
  if (!props.fallbackValue) return ''
  return props.fallbackValue.length > 30 ? props.fallbackValue.slice(0, 30) + '...' : props.fallbackValue
})
</script>
