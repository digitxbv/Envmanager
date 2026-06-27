<template>
  <span
    :class="[
      'inline-flex items-center font-medium transition-colors',
      variants[variant],
      sizes[size]
    ]"
    v-bind="$attrs"
  >
    <slot />
  </span>
</template>

<script setup>
defineOptions({
  inheritAttrs: false
})

defineProps({
  variant: {
    type: String,
    default: 'default',
    validator: (val) => ['default', 'success', 'warning', 'destructive', 'outline'].includes(val)
  },
  size: {
    type: String,
    default: 'default',
    validator: (val) => ['sm', 'default'].includes(val)
  }
})

const variants = {
  default: 'bg-muted text-muted-foreground',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  destructive: 'bg-destructive/15 text-destructive',
  outline: 'border border-border text-muted-foreground bg-transparent'
}

const sizes = {
  sm: 'px-1.5 py-0.5 text-[10px] leading-tight rounded',
  default: 'px-2.5 py-0.5 text-xs rounded-full'
}
</script>
