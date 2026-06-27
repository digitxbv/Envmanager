<template>
  <div class="flex items-center gap-2">
    <!-- State 1: Hidden (default) -->
    <template v-if="!showConfirm && !isRevealed">
      <span class="bg-muted rounded-md px-2 py-1 text-sm">••••••••</span>
      <Button
        v-if="!isExpired"
        size="sm"
        variant="secondary"
        @click="confirmReveal"
      >
        <Icon name="lucide:eye" class="h-4 w-4 mr-1" />
        Reveal
      </Button>
      <span v-else class="text-sm text-muted-foreground">Access expired</span>
    </template>

    <!-- State 2: Confirm inline -->
    <template v-else-if="showConfirm && !isRevealed">
      <span class="text-sm text-muted-foreground">
        This action will be logged for audit. Value visible for 30s.
      </span>
      <Button size="sm" variant="ghost" @click="cancelConfirm">
        Cancel
      </Button>
      <Button size="sm" variant="default" :loading="isLoading" @click="doReveal">
        Confirm Reveal
      </Button>
    </template>

    <!-- State 3: Revealed -->
    <template v-else-if="isRevealed">
      <code class="font-mono bg-warning-50 dark:bg-warning-950/30 border border-warning-200 dark:border-warning-800 px-2 py-1 rounded text-sm">
        {{ value }}
      </code>
      <Button size="sm" variant="ghost" @click="copyToClipboard">
        <Icon name="lucide:clipboard" class="h-4 w-4" />
      </Button>
      <span class="text-sm text-warning-600 dark:text-warning-400 font-medium tabular-nums">
        {{ countdown }}s
      </span>
      <Button size="sm" variant="ghost" @click="hideValue">
        <Icon name="lucide:eye-off" class="h-4 w-4" />
      </Button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import Button from '@/components/ui/Button.vue'

interface Props {
  variableId: string
  grantExpiresAt: string
  revealFn: () => Promise<{ value?: string; error?: string }>
}

const props = defineProps<Props>()

const { $toast } = useNuxtApp()

// State
const showConfirm = ref(false)
const isRevealed = ref(false)
const isLoading = ref(false)
const value = ref('')
const revealStartTime = ref<number | null>(null)
const countdown = ref(30)
let countdownInterval: ReturnType<typeof setInterval> | null = null

// Computed
const isExpired = computed(() => {
  return new Date(props.grantExpiresAt) < new Date()
})

// Methods
function confirmReveal() {
  if (isExpired.value) return
  showConfirm.value = true
}

function cancelConfirm() {
  showConfirm.value = false
}

async function doReveal() {
  if (isExpired.value) return

  isLoading.value = true
  try {
    const result = await props.revealFn()

    if (result.error) {
      $toast.error(result.error)
      showConfirm.value = false
      return
    }

    if (result.value !== undefined) {
      value.value = result.value
      isRevealed.value = true
      showConfirm.value = false
      startCountdown()
    }
  } catch (err) {
    $toast.error('Failed to reveal secret value')
    showConfirm.value = false
  } finally {
    isLoading.value = false
  }
}

function startCountdown() {
  revealStartTime.value = Date.now()
  countdown.value = 30

  countdownInterval = setInterval(() => {
    if (revealStartTime.value === null) {
      clearCountdown()
      return
    }

    const elapsed = (Date.now() - revealStartTime.value) / 1000
    const remaining = Math.ceil(30 - elapsed)
    countdown.value = remaining

    if (remaining <= 0) {
      hideValue()
    }
  }, 1000)
}

function clearCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval)
    countdownInterval = null
  }
  revealStartTime.value = null
}

function hideValue() {
  clearCountdown()
  value.value = ''
  isRevealed.value = false
  countdown.value = 30
}

async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(value.value)
    $toast.success('Copied to clipboard')
  } catch {
    $toast.error('Failed to copy to clipboard')
  }
}

// Security: Clear sensitive data on unmount
onUnmounted(() => {
  clearCountdown()
  value.value = ''
})
</script>
