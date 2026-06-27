<template>
  <div v-bind="$attrs">
    <slot />
  </div>
</template>

<script setup>
defineOptions({
  inheritAttrs: false
})

const props = defineProps({
  modelValue: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['update:modelValue'])

const activeTab = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

provide('tabs-active', activeTab)
provide('tabs-set', (val) => { activeTab.value = val })
</script>
