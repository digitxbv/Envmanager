<template>
  <Dialog
    :open="open"
    max-width="default"
    title="Connect Dokploy"
    description="Connect your self-hosted Dokploy instance"
    @close="$emit('close')"
  >
    <div class="mb-4 flex items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2">
      <div class="flex h-9 w-9 items-center justify-center rounded-md bg-[#2496ED] text-white">
        <Icon name="lucide:server" class="h-5 w-5" />
      </div>
      <span class="text-sm text-muted-foreground">Provide instance URL and token, then validate before connecting.</span>
    </div>

    <form @submit.prevent="handleSubmit" class="space-y-4">
      <div class="space-y-2">
        <label class="block text-sm font-medium">Connection Name</label>
        <Input
          v-model="form.name"
          placeholder="My Dokploy Instance"
          :disabled="isLoading"
        />
      </div>

      <div class="space-y-2">
        <label class="block text-sm font-medium">Instance URL</label>
        <Input
          v-model="form.instanceUrl"
          type="text"
          placeholder="app.dokploy.com or https://dokploy.example.com"
          :disabled="isLoading"
        />
        <p class="text-xs text-muted-foreground">
          The URL of your Dokploy instance (no trailing slash)
        </p>
      </div>

      <div class="space-y-2">
        <label class="block text-sm font-medium">API Token</label>
        <div class="relative">
          <Input
            v-model="form.token"
            :type="showToken ? 'text' : 'password'"
            placeholder="Enter your Dokploy API token"
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
          Create a token at Settings > Profile > API Keys in your Dokploy dashboard.
        </p>
      </div>

      <div class="space-y-3 rounded-md border border-border bg-muted/20 p-3">
        <label class="flex items-center gap-2 text-sm font-medium text-foreground">
          <input
            id="allowSelfSigned"
            v-model="form.allowSelfSigned"
            type="checkbox"
            class="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
            :disabled="isLoading"
          >
          Allow self-signed certificate
        </label>

        <div v-if="form.allowSelfSigned" class="space-y-2">
          <label class="block text-sm font-medium">CA Certificate (optional)</label>
          <textarea
            v-model="form.caCert"
            class="min-h-[100px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            placeholder="-----BEGIN CERTIFICATE-----
...
-----END CERTIFICATE-----"
            :disabled="isLoading"
          />
          <p class="text-xs text-muted-foreground">
            Paste your CA certificate (PEM format) for self-signed SSL.
          </p>
        </div>
      </div>

      <div v-if="validationResult" class="rounded-md border p-3" :class="validationResultClass">
        <div class="flex items-center gap-2">
          <Icon :name="validationResult.valid ? 'lucide:check-circle' : 'lucide:x-circle'" class="h-4 w-4" />
          <span class="text-sm font-medium">
            {{ validationResult.valid ? 'Connection valid' : validationResult.error }}
          </span>
        </div>
        <div v-if="validationResult.valid && validationResult.user" class="mt-2 text-sm">
          <p>Account: {{ validationResult.user.name || validationResult.user.email }}</p>
        </div>
        <div v-if="!validationResult.valid && isSslError && !form.allowSelfSigned" class="mt-2 text-sm">
          <p>Tip: If using a self-signed certificate, check the box above and provide the CA certificate.</p>
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
          v-if="!validationResult?.valid"
          type="button"
          :loading="validating"
          :disabled="!canValidate"
          @click="handleValidate"
        >
          Validate Connection
        </Button>
        <Button
          v-else
          type="submit"
          :loading="loading"
          :disabled="!canConnect"
        >
          Connect
        </Button>
      </div>
    </form>
  </Dialog>
</template>

<script setup lang="ts">
import Button from '~/components/ui/Button.vue'
import Dialog from '~/components/ui/Dialog.vue'
import Input from '~/components/ui/Input.vue'
import { useDokployIntegration, type DokployValidationResult } from '~/composables/useDokployIntegration'

interface Props {
  open: boolean
  organizationId: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  connected: []
}>()

const { validateToken, connect, validating, loading } = useDokployIntegration()

// =====================================================
// State
// =====================================================

const form = reactive({
  name: '',
  instanceUrl: '',
  token: '',
  allowSelfSigned: false,
  caCert: ''
})
const showToken = ref(false)
const validationResult = ref<DokployValidationResult | null>(null)

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

// Check if error is SSL-related
const isSslError = computed(() => {
  if (!validationResult.value?.error) return false
  const errorLower = validationResult.value.error.toLowerCase()
  return errorLower.includes('ssl') ||
    errorLower.includes('certificate') ||
    errorLower.includes('cert') ||
    errorLower.includes('tls') ||
    errorLower.includes('self-signed') ||
    errorLower.includes('unable to verify')
})

// Can validate when instance URL and token are provided
const canValidate = computed(() => {
  return form.instanceUrl.trim() !== '' && form.token.trim() !== ''
})

// Can connect when valid and has name
const canConnect = computed(() => {
  return validationResult.value?.valid && form.name.trim() !== ''
})

// =====================================================
// Methods
// =====================================================

async function handleValidate() {
  if (!canValidate.value) return

  // Pass CA cert only if checkbox is checked
  const caCert = form.allowSelfSigned ? form.caCert.trim() || undefined : undefined

  validationResult.value = await validateToken(
    form.instanceUrl.trim(),
    form.token.trim(),
    caCert
  )
}

async function handleSubmit() {
  if (!canConnect.value) return

  // Pass CA cert only if checkbox is checked
  const caCert = form.allowSelfSigned ? form.caCert.trim() || undefined : undefined

  const success = await connect(
    props.organizationId,
    form.instanceUrl.trim(),
    form.token.trim(),
    form.name.trim(),
    caCert
  )

  if (success) {
    emit('connected')
    emit('close')
  }
}

// Reset on open
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    form.name = ''
    form.instanceUrl = ''
    form.token = ''
    form.allowSelfSigned = false
    form.caCert = ''
    validationResult.value = null
    showToken.value = false
  }
})
</script>
