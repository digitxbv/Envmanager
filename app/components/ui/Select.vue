<template>
  <div class="relative" ref="selectRef" v-bind="$attrs">
    <button
      type="button"
      :class="[
        'flex h-11 w-full items-center justify-between rounded-md border border-input bg-card text-card-foreground px-4 py-2.5 text-sm leading-6 ring-offset-background transition-all duration-200',
        'placeholder:text-muted-foreground/60',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'hover:border-ring/50',
        'disabled:cursor-not-allowed disabled:opacity-50',
        !selectedLabel && 'text-muted-foreground/60'
      ]"
      :disabled="disabled"
      @click="toggle"
      @keydown.escape="close"
      @keydown.enter.prevent="toggle"
      @keydown.space.prevent="toggle"
      @keydown.down.prevent="openAndFocusFirst"
    >
      <span class="truncate">{{ selectedLabel || placeholder }}</span>
      <Icon
        name="lucide:chevrons-up-down"
        class="h-4 w-4 text-muted-foreground shrink-0 ml-2"
      />
    </button>

    <Teleport to="body">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-40"
        @click="close"
      />
      <div
        v-if="isOpen"
        ref="dropdownRef"
        :style="dropdownStyle"
        class="z-50 min-w-[var(--select-width)] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
      >
        <div class="max-h-60 overflow-auto p-1">
          <button
            v-for="option in options"
            :key="option.value"
            type="button"
            :class="[
              'relative flex w-full cursor-pointer select-none items-center rounded-sm px-3 py-2 text-sm transition-colors',
              'hover:bg-muted focus:bg-muted outline-none',
              modelValue === option.value && 'bg-muted font-medium'
            ]"
            @click="select(option.value)"
            @keydown.escape="close"
          >
            <Icon
              v-if="modelValue === option.value"
              name="lucide:check"
              class="h-4 w-4 mr-2 text-primary shrink-0"
            />
            <span :class="modelValue === option.value ? '' : 'pl-6'">
              {{ option.label }}
            </span>
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
defineOptions({
  inheritAttrs: false
})

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: ''
  },
  options: {
    type: Array,
    required: true,
    validator: (val) => val.every((o) => 'label' in o && 'value' in o)
  },
  placeholder: {
    type: String,
    default: 'Select an option...'
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])

const selectRef = ref(null)
const dropdownRef = ref(null)
const isOpen = ref(false)
const dropdownStyle = ref({})

const selectedLabel = computed(() => {
  const option = props.options.find((o) => o.value === props.modelValue)
  return option?.label || ''
})

function updatePosition() {
  if (!selectRef.value) return
  const rect = selectRef.value.getBoundingClientRect()
  dropdownStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
    '--select-width': `${rect.width}px`
  }
}

function toggle() {
  if (props.disabled) return
  isOpen.value ? close() : open()
}

function open() {
  updatePosition()
  isOpen.value = true
}

function openAndFocusFirst() {
  if (!isOpen.value) open()
}

function close() {
  isOpen.value = false
}

function select(value) {
  emit('update:modelValue', value)
  close()
}
</script>
