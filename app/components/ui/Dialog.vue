<template>
  <Teleport to="body">
    <Transition
      enter-active-class="duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center"
      >
        <!-- Backdrop -->
        <div
          class="fixed inset-0 bg-background/80 backdrop-blur-sm"
          @click="handleBackdropClick"
        />

        <!-- Panel -->
        <div
          ref="panelRef"
          :class="[
            'relative z-50 w-full rounded-lg border border-border bg-card p-6 shadow-lg',
            'animate-in fade-in-0 zoom-in-95',
            maxWidths[maxWidth]
          ]"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="title ? 'dialog-title' : undefined"
          :aria-describedby="description ? 'dialog-description' : undefined"
          @keydown.escape="emitClose"
          tabindex="-1"
          v-bind="$attrs"
        >
          <!-- Close button -->
          <button
            type="button"
            class="absolute right-4 top-4 rounded-sm text-muted-foreground hover:text-foreground transition-colors"
            @click="emitClose"
          >
            <Icon name="lucide:x" class="h-4 w-4" />
            <span class="sr-only">Close</span>
          </button>

          <!-- Header -->
          <div v-if="title || description" class="mb-4">
            <h2
              v-if="title"
              id="dialog-title"
              class="text-lg font-semibold text-foreground"
            >
              {{ title }}
            </h2>
            <p
              v-if="description"
              id="dialog-description"
              class="mt-1.5 text-sm text-muted-foreground"
            >
              {{ description }}
            </p>
          </div>

          <!-- Content -->
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
defineOptions({
  inheritAttrs: false
})

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  maxWidth: {
    type: String,
    default: 'default',
    validator: (val) => ['sm', 'default', 'lg', 'xl'].includes(val)
  }
})

const emit = defineEmits(['close'])

const panelRef = ref(null)

const maxWidths = {
  sm: 'max-w-sm mx-4',
  default: 'max-w-lg mx-4',
  lg: 'max-w-2xl mx-4',
  xl: 'max-w-4xl mx-4'
}

function emitClose() {
  emit('close')
}

function handleBackdropClick() {
  emitClose()
}

// Focus trap: focus the panel when opened
watch(() => props.open, (val) => {
  if (val) {
    nextTick(() => {
      panelRef.value?.focus()
    })
  }
})

// Handle escape key globally when open
function onKeydown(e) {
  if (e.key === 'Escape' && props.open) {
    emitClose()
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
})

if (import.meta.client) {
  // Prevent body scroll when open
  watch(() => props.open, (val) => {
    if (val) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  }, { immediate: true })

  onUnmounted(() => {
    document.body.style.overflow = ''
  })
}
</script>
