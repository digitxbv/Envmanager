<template>
  <Dialog
    :open="modelValue"
    max-width="default"
    title="Save Your Recovery Codes"
    description="These codes can be used to access your account if you lose your authenticator device. Each code can only be used once. Store them in a safe place."
    @close="handleDialogClose"
  >
    <div class="mb-4 flex items-center gap-2 rounded-md border border-warning/25 bg-warning/10 px-3 py-2 text-warning">
      <Icon name="lucide:shield-alert" class="h-4 w-4" />
      <span class="text-sm font-medium">Keep these codes private and secure</span>
    </div>

    <div class="mb-4 grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/40 p-4 font-mono text-sm">
      <div
        v-for="(code, index) in codes"
        :key="index"
        class="select-all rounded border border-border bg-card px-3 py-2 text-center text-foreground"
      >
        {{ code }}
      </div>
    </div>

    <div class="mb-4 flex flex-wrap gap-2">
      <Button variant="outline" size="sm" @click="downloadCodes">
        <Icon name="lucide:download" class="mr-2 h-4 w-4" />
        Download .txt
      </Button>
      <Button variant="outline" size="sm" @click="copyCodes">
        <Icon name="lucide:copy" class="mr-2 h-4 w-4" />
        {{ copied ? 'Copied!' : 'Copy to clipboard' }}
      </Button>
    </div>

    <label class="mb-5 flex cursor-pointer items-center gap-2 text-sm text-foreground">
      <input
        v-model="confirmed"
        type="checkbox"
        class="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
      />
      I have saved these codes in a safe place
    </label>

    <Button
      class="w-full"
      :disabled="!confirmed"
      @click="close"
    >
      Done
    </Button>
  </Dialog>
</template>

<script setup lang="ts">
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/ui/Dialog.vue'

interface Props {
  modelValue: boolean
  codes: string[]
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { $toast } = useNuxtApp()
const confirmed = ref(false)
const copied = ref(false)

const close = () => {
  if (!confirmed.value) return
  confirmed.value = false
  copied.value = false
  emit('update:modelValue', false)
}

const handleDialogClose = () => {
  close()
}

const downloadCodes = () => {
  const text = [
    'EnvManager Recovery Codes',
    `Generated: ${new Date().toISOString()}`,
    '',
    'Each code can only be used once.',
    '',
    ...props.codes.map((code, i) => `${i + 1}. ${code}`)
  ].join('\n')

  const blob = new Blob([text], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'envmanager-recovery-codes.txt'
  a.click()
  URL.revokeObjectURL(url)
  $toast.success('Recovery codes downloaded')
}

const copyCodes = async () => {
  try {
    await navigator.clipboard.writeText(props.codes.join('\n'))
    copied.value = true
    $toast.success('Recovery codes copied to clipboard')
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    $toast.error('Failed to copy to clipboard')
  }
}

// Reset state when modal opens
watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    confirmed.value = false
    copied.value = false
  }
})
</script>
