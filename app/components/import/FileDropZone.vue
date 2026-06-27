<template>
  <div
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
    @click="openFilePicker"
    :class="[
      'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
      isDragging
        ? 'border-primary bg-primary/10'
        : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
    ]"
  >
    <input
      ref="fileInput"
      type="file"
      :accept="acceptedExtensions"
      class="hidden"
      @change="onFileSelect"
    />

    <div class="flex flex-col items-center gap-3">
      <div :class="[
        'rounded-full p-3 transition-colors',
        isDragging ? 'bg-primary/20' : 'bg-muted'
      ]">
        <Icon name="lucide:upload" class="h-6 w-6 text-muted-foreground" />
      </div>

      <div>
        <p class="font-medium">
          {{ isDragging ? 'Drop file here' : 'Drag and drop or click to upload' }}
        </p>
        <p class="text-sm text-muted-foreground mt-1">
          Supports .env, .json, .yml, .yaml files
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { isSupportedFile, SUPPORTED_EXTENSIONS } from '@/utils/parsers/envParser'

const emit = defineEmits<{
  (e: 'file-selected', file: File): void
  (e: 'error', message: string): void
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)

const acceptedExtensions = SUPPORTED_EXTENSIONS.join(',')

function onDragOver() {
  isDragging.value = true
}

function onDragLeave() {
  isDragging.value = false
}

function onDrop(event: DragEvent) {
  isDragging.value = false

  const files = event.dataTransfer?.files
  if (!files || files.length === 0) return

  const file = files[0]
  if (!file) return
  processFile(file)
}

function openFilePicker() {
  fileInput.value?.click()
}

function onFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0) return

  const file = files[0]
  if (!file) return
  processFile(file)

  // Reset input so the same file can be selected again
  target.value = ''
}

function processFile(file: File) {
  // Validate file type
  if (!isSupportedFile(file.name)) {
    emit('error', 'Unsupported file type. Please use .env, .json, .yml, or .yaml files.')
    return
  }

  // Validate file size (max 1MB)
  if (file.size > 1024 * 1024) {
    emit('error', 'File too large. Maximum size is 1MB.')
    return
  }

  emit('file-selected', file)
}
</script>
