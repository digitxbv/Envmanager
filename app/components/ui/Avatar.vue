<template>
  <div
    :class="[
      'inline-flex items-center justify-center rounded-full bg-muted text-muted-foreground font-medium select-none shrink-0',
      sizes[size]
    ]"
    :style="{ backgroundColor: bgColor }"
    :title="name || email"
    v-bind="$attrs"
  >
    <span :class="textSizes[size]" class="text-white/90">
      {{ initials }}
    </span>
  </div>
</template>

<script setup>
defineOptions({
  inheritAttrs: false
})

const props = defineProps({
  email: {
    type: String,
    default: ''
  },
  name: {
    type: String,
    default: ''
  },
  size: {
    type: String,
    default: 'default',
    validator: (val) => ['sm', 'default', 'lg'].includes(val)
  }
})

const sizes = {
  sm: 'h-7 w-7',
  default: 'h-9 w-9',
  lg: 'h-11 w-11'
}

const textSizes = {
  sm: 'text-xs',
  default: 'text-sm',
  lg: 'text-base'
}

const initials = computed(() => {
  if (props.name) {
    const parts = props.name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return parts[0].substring(0, 2).toUpperCase()
  }
  if (props.email) {
    return props.email.substring(0, 2).toUpperCase()
  }
  return '?'
})

// Theme-aware color palette: works in both light and dark modes
const colorPalette = [
  'hsl(142, 70%, 44%)',    // primary-600
  'hsl(143, 64%, 36%)',    // primary-700
  'hsl(174, 42%, 38%)',    // secondary
  'hsl(210, 80%, 55%)',    // info
  'hsl(36, 77%, 50%)',     // warning
  'hsl(156, 60%, 38%)',    // success
  'hsl(142, 72%, 52%)',    // primary-500
  'hsl(0, 72%, 51%)'       // destructive
]

const bgColor = computed(() => {
  const str = props.name || props.email || ''
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % colorPalette.length
  return colorPalette[index]
})
</script>
