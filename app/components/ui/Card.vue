<template>
  <div
    :class="[
      'rounded-lg border border-border bg-card text-card-foreground transition-all duration-150',
      paddings[padding],
      hover && 'hover:shadow-md hover:border-ring/30 cursor-pointer',
      className
    ]"
    v-bind="$attrs"
  >
    <div v-if="$slots.header" class="pb-4 border-b border-border mb-4">
      <slot name="header" />
    </div>
    <slot />
    <div v-if="$slots.footer" class="pt-4 border-t border-border mt-4">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup>
defineOptions({
  inheritAttrs: false
})

defineProps({
  padding: {
    type: String,
    default: 'default',
    validator: (val) => ['sm', 'default', 'lg'].includes(val)
  },
  hover: {
    type: Boolean,
    default: false
  },
  className: {
    type: String,
    default: ''
  }
})

const paddings = {
  sm: 'p-4',
  default: 'p-6',
  lg: 'p-8'
}
</script>
