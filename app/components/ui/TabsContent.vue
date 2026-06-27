<template>
  <div
    v-if="isActive"
    role="tabpanel"
    :tabindex="0"
    class="mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    v-bind="$attrs"
  >
    <slot />
  </div>
</template>

<script setup>
defineOptions({
  inheritAttrs: false
})

const props = defineProps({
  value: {
    type: String,
    required: true
  }
})

const activeTab = inject('tabs-active')

const isActive = computed(() => activeTab.value === props.value)
</script>
