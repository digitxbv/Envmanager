<template>
  <button
    type="button"
    role="tab"
    :class="[
      'inline-flex items-center gap-2 px-4 pb-3 -mb-px border-b-2 text-sm font-medium transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'disabled:opacity-50 disabled:pointer-events-none',
      isActive
        ? 'border-foreground text-foreground'
        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50',
      className
    ]"
    :aria-selected="isActive"
    :disabled="disabled"
    @click="setTab(value)"
    v-bind="$attrs"
  >
    <slot />
  </button>
</template>

<script setup>
defineOptions({
  inheritAttrs: false
})

const props = defineProps({
  value: {
    type: String,
    required: true
  },
  disabled: {
    type: Boolean,
    default: false
  },
  className: {
    type: String,
    default: ''
  }
})

const activeTab = inject('tabs-active')
const setTab = inject('tabs-set')

const isActive = computed(() => activeTab.value === props.value)
</script>
