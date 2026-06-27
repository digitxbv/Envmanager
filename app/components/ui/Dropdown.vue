<template>
  <div class="relative inline-block" ref="dropdownRef" v-bind="$attrs">
    <div @click="toggle">
      <slot name="trigger" />
    </div>

    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="isOpen"
        :class="[
          'absolute z-50 mt-1 rounded-md border border-border bg-popover text-popover-foreground shadow-md',
          'min-w-[8rem] overflow-hidden p-1',
          align === 'right' ? 'right-0' : 'left-0'
        ]"
        :style="width ? { width } : {}"
      >
        <slot name="content" :close="close" />
      </div>
    </Transition>
  </div>
</template>

<script setup>
defineOptions({
  inheritAttrs: false
})

defineProps({
  align: {
    type: String,
    default: 'left',
    validator: (val) => ['left', 'right'].includes(val)
  },
  width: {
    type: String,
    default: ''
  }
})

const dropdownRef = ref(null)
const isOpen = ref(false)

function toggle() {
  isOpen.value = !isOpen.value
}

function close() {
  isOpen.value = false
}

function onClickOutside(e) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target)) {
    close()
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside, true)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside, true)
})

defineExpose({ close })
</script>

<style>
.dropdown-item {
  @apply flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground hover:bg-muted transition-colors;
}

.dropdown-item-destructive {
  @apply text-destructive hover:bg-destructive/10 hover:text-destructive;
}
</style>
