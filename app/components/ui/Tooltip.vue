<template>
  <div class="relative inline-flex group/tooltip" v-bind="$attrs">
    <slot />
    <div
      v-if="content"
      :class="[
        'pointer-events-none absolute z-50 px-2.5 py-1.5 text-xs font-medium rounded-md',
        'bg-foreground text-background',
        'opacity-0 group-hover/tooltip:opacity-100',
        'transition-opacity duration-150',
        positions[side]
      ]"
      role="tooltip"
    >
      {{ content }}
      <div :class="['absolute w-2 h-2 bg-foreground rotate-45', arrows[side]]" />
    </div>
  </div>
</template>

<script setup>
defineOptions({
  inheritAttrs: false
})

defineProps({
  content: {
    type: String,
    default: ''
  },
  side: {
    type: String,
    default: 'top',
    validator: (val) => ['top', 'bottom', 'left', 'right'].includes(val)
  }
})

const positions = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2'
}

const arrows = {
  top: 'top-full left-1/2 -translate-x-1/2 -mt-1',
  bottom: 'bottom-full left-1/2 -translate-x-1/2 -mb-1',
  left: 'left-full top-1/2 -translate-y-1/2 -ml-1',
  right: 'right-full top-1/2 -translate-y-1/2 -mr-1'
}
</script>
