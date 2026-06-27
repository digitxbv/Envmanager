<template>
  <Dialog
    :open="open"
    max-width="default"
    title="Connect Google Cloud"
    description="Enter your GCP service account credentials"
    @close="$emit('close')"
  >
    <div class="mb-4 flex items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2">
      <div class="flex h-9 w-9 items-center justify-center rounded-md bg-[#4285F4] text-white">
        <Icon name="simple-icons:googlecloud" class="h-5 w-5" />
      </div>
      <span class="text-sm text-muted-foreground">Validate your service account key, then connect to sync secrets.</span>
    </div>

    <form @submit.prevent="handleSubmit" class="space-y-4">
      <div class="space-y-2">
        <label class="block text-sm font-medium">Connection Name</label>
        <Input
          v-model="form.name"
          placeholder="My GCP Project"
          :disabled="isLoading"
        />
      </div>

      <div class="space-y-2">
        <label class="block text-sm font-medium">Service Account JSON</label>
        <textarea
          v-model="form.serviceAccountJson"
          placeholder="Paste your service account JSON key file contents here..."
          :disabled="isLoading"
          rows="6"
          autocomplete="off"
          spellcheck="false"
          class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
        />
        <p class="text-xs text-muted-foreground">
          Create a service account key at
          <a
            href="https://console.cloud.google.com/iam-admin/serviceaccounts"
            target="_blank"
            class="text-primary hover:underline"
          >
            Google Cloud Console
          </a>.
          The service account needs the <strong>Secret Manager Admin</strong> role.
        </p>
      </div>

      <!-- Auto-extracted info -->
      <div v-if="extractedEmail" class="rounded-md border border-border bg-muted/30 px-3 py-2">
        <p class="text-xs text-muted-foreground">
          <span class="font-medium">Service Account:</span> {{ extractedEmail }}
        </p>
      </div>

      <div class="space-y-2">
        <label class="block text-sm font-medium">Project ID</label>
        <Input
          v-model="form.projectId"
          placeholder="my-gcp-project-123"
          :disabled="isLoading"
        />
        <p class="text-xs text-muted-foreground">
          The GCP project with Secret Manager API enabled. Auto-filled from JSON if available.
        </p>
      </div>

      <!-- Validation result -->
      <div v-if="validationResult" class="rounded-md border p-3" :class="validationResultClass">
        <div class="flex items-center gap-2">
          <Icon :name="validationResult.valid ? 'lucide:check-circle' : 'lucide:x-circle'" class="h-4 w-4" />
          <span class="text-sm font-medium">
            {{ validationResult.valid ? 'Credentials valid' : validationResult.error }}
          </span>
        </div>
        <div v-if="validationResult.valid" class="mt-2 text-sm">
          <p>Project: {{ validationResult.project_id }}</p>
          <p>Account: {{ validationResult.service_account_email }}</p>
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
          Validate Credentials
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
import { useGcpIntegration, type GcpValidationResult } from '~/composables/useGcpIntegration'

interface Props {
  open: boolean
  organizationId: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  connected: []
}>()

const { validateCredentials, connect, validating, loading } = useGcpIntegration()

// =====================================================
// State
// =====================================================

const form = reactive({
  name: '',
  serviceAccountJson: '',
  projectId: ''
})
const validationResult = ref<GcpValidationResult | null>(null)

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

// Auto-extract client_email and project_id from pasted JSON
const extractedEmail = computed(() => {
  try {
    const parsed = JSON.parse(form.serviceAccountJson)
    return parsed.client_email || null
  } catch {
    return null
  }
})

const canValidate = computed(() => {
  return !!form.serviceAccountJson && !!form.projectId
})

const canConnect = computed(() => {
  return validationResult.value?.valid && !!form.name
})

// =====================================================
// Watchers
// =====================================================

// Auto-fill project ID from pasted JSON
watch(() => form.serviceAccountJson, (json) => {
  try {
    const parsed = JSON.parse(json)
    if (parsed.project_id && !form.projectId) {
      form.projectId = parsed.project_id
    }
  } catch {
    // Ignore parse errors during typing
  }
  // Reset validation when credentials change
  validationResult.value = null
})

// Reset validation when project ID changes
watch(() => form.projectId, () => {
  validationResult.value = null
})

// =====================================================
// Methods
// =====================================================

async function handleValidate() {
  if (!canValidate.value) return
  validationResult.value = await validateCredentials(form.serviceAccountJson, form.projectId)
}

async function handleSubmit() {
  if (!canConnect.value) return

  const success = await connect(
    props.organizationId,
    form.serviceAccountJson,
    form.name,
    form.projectId
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
    form.serviceAccountJson = ''
    form.projectId = ''
    validationResult.value = null
  }
})
</script>
