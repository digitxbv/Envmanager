<template>
  <div class="relative">
    <Input
      :model-value="modelValue"
      @update:model-value="handleInput"
      v-bind="$attrs"
      ref="inputRef"
      @keydown="handleKeydown"
    />
    <!-- Autocomplete dropdown -->
    <div
      v-if="showDropdown && filteredSuggestions.length > 0"
      class="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-md border bg-card shadow-md"
    >
      <button
        v-for="(suggestion, index) in filteredSuggestions"
        :key="suggestion.key"
        :class="[
          'w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted transition-colors text-left',
          index === highlightedIndex ? 'bg-muted' : ''
        ]"
        @mousedown.prevent="selectSuggestion(suggestion.key)"
      >
        <span class="font-mono font-medium">{{ suggestion.key }}</span>
        <span class="text-muted-foreground truncate ml-2 max-w-[200px]">{{ truncateValue(suggestion.value) }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import Input from '@/components/ui/Input.vue'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  modelValue: string
  availableVariables: { key: string; value: string }[]
  currentKey: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const inputRef = ref()
const showDropdown = ref(false)
const highlightedIndex = ref(0)
const searchPrefix = ref('')
const insertPosition = ref<{ start: number; end: number } | null>(null)

function truncateValue(val: string) {
  if (!val) return ''
  return val.length > 30 ? val.slice(0, 30) + '...' : val
}

const filteredSuggestions = computed(() => {
  const prefix = searchPrefix.value.toUpperCase()
  return props.availableVariables
    .filter(v => v.key !== props.currentKey && v.key.toUpperCase().startsWith(prefix))
    .slice(0, 10)
})

function handleInput(value: string) {
  emit('update:modelValue', value)

  // Check if cursor is inside a ${ pattern
  nextTick(() => {
    const inputEl = inputRef.value?.$el?.querySelector('input') as HTMLInputElement | null
    if (!inputEl) return

    const cursorPos = inputEl.selectionStart ?? value.length
    const textBefore = value.slice(0, cursorPos)

    // Find the last unmatched ${ before cursor
    const lastOpen = textBefore.lastIndexOf('${')
    if (lastOpen === -1) {
      showDropdown.value = false
      return
    }

    const afterOpen = textBefore.slice(lastOpen + 2)
    // If there's a closing } between ${ and cursor, no autocomplete
    if (afterOpen.includes('}')) {
      showDropdown.value = false
      return
    }

    searchPrefix.value = afterOpen
    insertPosition.value = { start: lastOpen, end: cursorPos }
    highlightedIndex.value = 0
    showDropdown.value = true
  })
}

function selectSuggestion(key: string) {
  if (!insertPosition.value) return

  const before = props.modelValue.slice(0, insertPosition.value.start)
  const after = props.modelValue.slice(insertPosition.value.end)
  const newValue = `${before}\${${key}}${after}`

  emit('update:modelValue', newValue)
  showDropdown.value = false
  insertPosition.value = null
}

function handleKeydown(e: KeyboardEvent) {
  if (!showDropdown.value || filteredSuggestions.value.length === 0) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    highlightedIndex.value = Math.min(highlightedIndex.value + 1, filteredSuggestions.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0)
  } else if (e.key === 'Enter' && showDropdown.value) {
    e.preventDefault()
    const selectedSuggestion = filteredSuggestions.value[highlightedIndex.value]
    if (selectedSuggestion) {
      selectSuggestion(selectedSuggestion.key)
    }
  } else if (e.key === 'Escape') {
    showDropdown.value = false
  }
}
</script>
