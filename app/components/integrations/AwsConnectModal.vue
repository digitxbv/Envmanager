<template>
  <Dialog
    :open="open"
    max-width="default"
    title="Connect AWS Secrets Manager"
    description="Enter your AWS IAM credentials"
    @close="$emit('close')"
  >
    <div class="mb-4 flex items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2">
      <div class="flex h-9 w-9 items-center justify-center rounded-md bg-[#FF9900] text-white">
        <Icon name="simple-icons:amazonaws" class="h-5 w-5" />
      </div>
      <span class="text-sm text-muted-foreground">Validate your AWS credentials, then connect to sync secrets.</span>
    </div>

    <form @submit.prevent="handleSubmit" class="space-y-4">
      <div class="space-y-2">
        <label class="block text-sm font-medium">Connection Name</label>
        <Input
          v-model="form.name"
          placeholder="Production Secrets Manager"
          :disabled="isLoading"
        />
      </div>

      <div class="space-y-2">
        <label class="block text-sm font-medium">Access Key ID</label>
        <Input
          v-model="form.accessKeyId"
          placeholder="AKIA..."
          :disabled="isLoading"
        />
        <p class="text-xs text-muted-foreground">
          Found in IAM &rarr; Users &rarr; Security credentials
        </p>
      </div>

      <div class="space-y-2">
        <label class="block text-sm font-medium">Secret Access Key</label>
        <input
          v-model="form.secretAccessKey"
          type="password"
          placeholder="Secret access key value"
          :disabled="isLoading"
          class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <p class="text-xs text-muted-foreground">
          Created alongside the access key ID
        </p>
      </div>

      <div class="space-y-2">
        <label class="block text-sm font-medium">Region</label>
        <select
          v-model="form.region"
          :disabled="isLoading"
          class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="" disabled>Select a region</option>
          <option v-for="region in AWS_REGIONS" :key="region.value" :value="region.value">
            {{ region.label }}
          </option>
        </select>
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
          <p>Account: {{ validationResult.account_id }}</p>
          <p>Region: {{ form.region }}</p>
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
import { useAwsIntegration, type AwsValidationResult } from '~/composables/useAwsIntegration'

const AWS_REGIONS = [
  { value: 'us-east-1', label: 'US East (N. Virginia)' },
  { value: 'us-east-2', label: 'US East (Ohio)' },
  { value: 'us-west-1', label: 'US West (N. California)' },
  { value: 'us-west-2', label: 'US West (Oregon)' },
  { value: 'eu-west-1', label: 'Europe (Ireland)' },
  { value: 'eu-west-2', label: 'Europe (London)' },
  { value: 'eu-west-3', label: 'Europe (Paris)' },
  { value: 'eu-central-1', label: 'Europe (Frankfurt)' },
  { value: 'eu-north-1', label: 'Europe (Stockholm)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
  { value: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
  { value: 'ap-northeast-2', label: 'Asia Pacific (Seoul)' },
  { value: 'ap-south-1', label: 'Asia Pacific (Mumbai)' },
  { value: 'sa-east-1', label: 'South America (Sao Paulo)' },
  { value: 'ca-central-1', label: 'Canada (Central)' },
]

interface Props {
  open: boolean
  organizationId: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  connected: []
}>()

const { validateCredentials, connect, validating, loading } = useAwsIntegration()

// =====================================================
// State
// =====================================================

const form = reactive({
  name: '',
  accessKeyId: '',
  secretAccessKey: '',
  region: ''
})
const validationResult = ref<AwsValidationResult | null>(null)

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
  return !!form.accessKeyId
    && !!form.secretAccessKey
    && !!form.region
    && !!form.name
})

const canConnect = computed(() => {
  return validationResult.value?.valid && !!form.name
})

// =====================================================
// Watchers
// =====================================================

// Reset validation when any credential field changes
watch(() => form.accessKeyId, () => {
  validationResult.value = null
})

watch(() => form.secretAccessKey, () => {
  validationResult.value = null
})

watch(() => form.region, () => {
  validationResult.value = null
})

// Reset on open
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    form.name = ''
    form.accessKeyId = ''
    form.secretAccessKey = ''
    form.region = ''
    validationResult.value = null
  }
})

// =====================================================
// Methods
// =====================================================

async function handleValidate() {
  if (!canValidate.value) return
  validationResult.value = await validateCredentials(
    form.accessKeyId,
    form.secretAccessKey,
    form.region
  )
}

async function handleSubmit() {
  if (!canConnect.value) return

  const success = await connect(
    props.organizationId,
    form.secretAccessKey,
    form.name,
    form.accessKeyId,
    form.region,
    validationResult.value?.account_id
  )

  if (success) {
    emit('connected')
    emit('close')
  }
}
</script>
