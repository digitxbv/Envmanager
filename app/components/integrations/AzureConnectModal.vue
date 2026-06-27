<template>
  <Dialog
    :open="open"
    max-width="default"
    title="Connect Azure Key Vault"
    description="Enter your Azure AD app registration credentials"
    @close="$emit('close')"
  >
    <div class="mb-4 flex items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2">
      <div class="flex h-9 w-9 items-center justify-center rounded-md bg-[#0078D4] text-white">
        <Icon name="simple-icons:microsoftazure" class="h-5 w-5" />
      </div>
      <span class="text-sm text-muted-foreground">Validate your Azure credentials, then connect to sync secrets.</span>
    </div>

    <form @submit.prevent="handleSubmit" class="space-y-4">
      <div class="space-y-2">
        <label class="block text-sm font-medium">Connection Name</label>
        <Input
          v-model="form.name"
          placeholder="Production Key Vault"
          :disabled="isLoading"
        />
      </div>

      <div class="space-y-2">
        <label class="block text-sm font-medium">Tenant ID</label>
        <Input
          v-model="form.tenantId"
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          :disabled="isLoading"
        />
        <p class="text-xs text-muted-foreground">
          Found in Azure AD &rarr; App registrations &rarr; Overview
        </p>
      </div>

      <div class="space-y-2">
        <label class="block text-sm font-medium">Client ID</label>
        <Input
          v-model="form.clientId"
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          :disabled="isLoading"
        />
        <p class="text-xs text-muted-foreground">
          Application (client) ID from your app registration
        </p>
      </div>

      <div class="space-y-2">
        <label class="block text-sm font-medium">Client Secret</label>
        <input
          v-model="form.clientSecret"
          type="password"
          placeholder="Client secret value"
          :disabled="isLoading"
          class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <p class="text-xs text-muted-foreground">
          Create one at Azure AD &rarr; App registrations &rarr; Certificates & secrets
        </p>
      </div>

      <div class="space-y-2">
        <label class="block text-sm font-medium">Vault URL</label>
        <Input
          v-model="form.vaultUrl"
          placeholder="https://myvault.vault.azure.net"
          :disabled="isLoading"
        />
        <p class="text-xs text-muted-foreground">
          Found in Key Vault &rarr; Overview &rarr; Vault URI
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
          <p>Vault: {{ validationResult.vault_name }}</p>
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
import { useAzureIntegration, type AzureValidationResult } from '~/composables/useAzureIntegration'

interface Props {
  open: boolean
  organizationId: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  connected: []
}>()

const { validateCredentials, connect, validating, loading } = useAzureIntegration()

// =====================================================
// State
// =====================================================

const form = reactive({
  name: '',
  tenantId: '',
  clientId: '',
  clientSecret: '',
  vaultUrl: ''
})
const validationResult = ref<AzureValidationResult | null>(null)

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

const canValidate = computed(() => {
  return !!form.tenantId
    && !!form.clientId
    && !!form.clientSecret
    && !!form.vaultUrl
    && form.vaultUrl.startsWith('https://')
    && form.vaultUrl.includes('.vault.azure.net')
})

const canConnect = computed(() => {
  return validationResult.value?.valid && !!form.name
})

// =====================================================
// Watchers
// =====================================================

// Reset validation when any credential field changes
watch(() => form.tenantId, () => {
  validationResult.value = null
})

watch(() => form.clientId, () => {
  validationResult.value = null
})

watch(() => form.clientSecret, () => {
  validationResult.value = null
})

watch(() => form.vaultUrl, () => {
  validationResult.value = null
})

// Reset on open
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    form.name = ''
    form.tenantId = ''
    form.clientId = ''
    form.clientSecret = ''
    form.vaultUrl = ''
    validationResult.value = null
  }
})

// =====================================================
// Methods
// =====================================================

async function handleValidate() {
  if (!canValidate.value) return
  validationResult.value = await validateCredentials(
    form.tenantId,
    form.clientId,
    form.clientSecret,
    form.vaultUrl
  )
}

async function handleSubmit() {
  if (!canConnect.value) return

  const success = await connect(
    props.organizationId,
    form.clientSecret,
    form.name,
    form.tenantId,
    form.clientId,
    form.vaultUrl
  )

  if (success) {
    emit('connected')
    emit('close')
  }
}
</script>
