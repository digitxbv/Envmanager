<template>
  <div
    class="inline-flex items-center border-b border-border w-full"
    role="tablist"
    v-bind="$attrs"
  >
    <slot />
  </div>
</template>

<script setup>
defineOptions({
  inheritAttrs: false
})
</script>
