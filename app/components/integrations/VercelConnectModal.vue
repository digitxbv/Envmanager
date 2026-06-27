<template>
  <Dialog
    :open="open"
    max-width="default"
    title="Connect Vercel"
    description="Enter your Vercel access token"
    @close="$emit('close')"
  >
    <div class="mb-4 flex items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2">
      <div class="flex h-9 w-9 items-center justify-center rounded-md bg-black text-white">
        <Icon name="lucide:globe" class="h-5 w-5" />
      </div>
      <span class="text-sm text-muted-foreground">Vercel organization and team access will be validated before connecting.</span>
    </div>

    <form @submit.prevent="handleSubmit" class="space-y-4">
      <div class="space-y-2">
        <label class="block text-sm font-medium">Connection Name</label>
        <Input
          v-model="form.name"
          placeholder="My Vercel Account"
          :disabled="isLoading"
        />
      </div>

      <div class="space-y-2">
        <label class="block text-sm font-medium">Access Token</label>
        <div class="relative">
          <Input
            v-model="form.token"
            :type="showToken ? 'text' : 'password'"
            placeholder="vc_pat_..."
            :disabled="isLoading"
            class="pr-10"
          />
          <button
            type="button"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            @click="showToken = !showToken"
          >
            <Icon :name="showToken ? 'lucide:eye-off' : 'lucide:eye'" class="h-4 w-4" />
          </button>
        </div>
        <p class="text-xs text-muted-foreground">
          Create a token at
          <a
            href="https://vercel.com/account/tokens"
            target="_blank"
            class="text-primary hover:underline"
          >
            vercel.com/account/tokens
          </a>
        </p>
      </div>

      <div v-if="validationResult" class="rounded-md border p-3" :class="validationResultClass">
        <div class="flex items-center gap-2">
          <Icon :name="validationResult.valid ? 'lucide:check-circle' : 'lucide:x-circle'" class="h-4 w-4" />
          <span class="text-sm font-medium">
            {{ validationResult.valid ? 'Token valid' : validationResult.error }}
          </span>
        </div>
        <div v-if="validationResult.valid && validationResult.user" class="mt-2 text-sm">
          <p>Account: {{ validationResult.user.username }}</p>
          <p v-if="validationResult.teams?.length">
            Teams: {{ validationResult.teams.map(t => t.name).join(', ') }}
          </p>
        </div>
      </div>

      <div class="flex justify-end gap-2 border-t border-border pt-4">
        <Button
          type="button"
          variant="outline"
          @click="$emit('close')"
          :disabled="isLoading"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          :loading="isLoading"
          :disabled="!form.token || !form.name"
        >
          {{ validationResult?.valid ? 'Connect' : 'Validate & Connect' }}
        </Button>
      </div>
    </form>
  </Dialog>
</template>

<script setup lang="ts">
import Button from '~/components/ui/Button.vue'
import Dialog from '~/components/ui/Dialog.vue'
import Input from '~/components/ui/Input.vue'
import { useVercelIntegration, type VercelValidationResult } from '~/composables/useVercelIntegration'

interface Props {
  open: boolean
  organizationId: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  connected: []
}>()

const { validateToken, connect, validating, loading } = useVercelIntegration()

// =====================================================
// State
// =====================================================

const form = reactive({
  name: '',
  token: ''
})
const showToken = ref(false)
const validationResult = ref<VercelValidationResult | null>(null)

// =====================================================
// Computed
// =====================================================

const isLoading = computed(() => validating.value || loading.value)

const validationResultClass = computed(() => {
  if (!validationResult.value) return ''
  return validationResult.value.valid
    ? 'border-success/30 bg-success/10 text-success'
    : 'border-destructive/30 bg-destructive/10 text-destructive'
})

// =====================================================
// Methods
// =====================================================

async function handleSubmit() {
  if (!form.token || !form.name) return

  // If not yet validated, validate first
  if (!validationResult.value?.valid) {
    const result = await validateToken(form.token)
    validationResult.value = result
    if (!result.valid) return
  }

  const success = await connect(props.organizationId, form.token, form.name)
  if (success) {
    emit('connected')
    emit('close')
  }
}

// Reset on open
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    form.name = ''
    form.token = ''
    validationResult.value = null
    showToken.value = false
  }
})
</script>
