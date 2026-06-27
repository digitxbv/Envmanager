<template>
  <div :class="['flex items-center justify-center', props.class || 'py-20']">
    <Icon 
      name="lucide:loader-2" 
      :class="['animate-spin text-primary', size === 'sm' ? 'h-6 w-6' : 'h-8 w-8']" 
    />
  </div>
</template>

<script setup>
defineOptions({
  inheritAttrs: false
})

const props = defineProps({
  size: {
    type: String,
    default: 'md',
    validator: (val) => ['sm', 'md'].includes(val)
  },
  class: {
    type: String,
    default: ''
  }
})
</script>
