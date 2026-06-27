<template>
  <Dialog
    :open="open"
    max-width="default"
    title="Connect Render"
    description="Enter your Render API key"
    @close="$emit('close')"
  >
    <div class="mb-4 flex items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2">
      <div class="flex h-9 w-9 items-center justify-center rounded-md bg-[#46E3B7] text-black">
        <Icon name="lucide:server" class="h-5 w-5" />
      </div>
      <span class="text-sm text-muted-foreground">Validate your key, then select a workspace if Render returns more than one.</span>
    </div>

    <form @submit.prevent="handleSubmit" class="space-y-4">
      <div class="space-y-2">
        <label class="block text-sm font-medium">Connection Name</label>
        <Input
          v-model="form.name"
          placeholder="My Render Account"
          :disabled="isLoading"
        />
      </div>

      <div class="space-y-2">
        <label class="block text-sm font-medium">API Key</label>
        <div class="relative">
          <Input
            v-model="form.token"
            :type="showToken ? 'text' : 'password'"
            placeholder="Enter your Render API key"
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
          Create an API Key at
          <a
            href="https://dashboard.render.com/account/settings#api-keys"
            target="_blank"
            class="text-primary hover:underline"
          >
            dashboard.render.com/account/settings
          </a>.
        </p>
      </div>

      <div v-if="validationResult?.valid && availableOwners.length > 1" class="space-y-2">
        <label class="block text-sm font-medium">Workspace</label>
        <Select
          :model-value="form.ownerId"
          :options="ownerOptions"
          :disabled="isLoading"
          @update:model-value="(val: string) => form.ownerId = val"
        />
        <p class="text-xs text-muted-foreground">
          Select the workspace to sync services from.
        </p>
      </div>

      <div v-if="validationResult" class="rounded-md border p-3" :class="validationResultClass">
        <div class="flex items-center gap-2">
          <Icon :name="validationResult.valid ? 'lucide:check-circle' : 'lucide:x-circle'" class="h-4 w-4" />
          <span class="text-sm font-medium">
            {{ validationResult.valid ? 'API key valid' : validationResult.error }}
          </span>
        </div>
        <div v-if="validationResult.valid && availableOwners.length > 0" class="mt-2 text-sm">
          <p>Workspaces: {{ availableOwners.length }}</p>
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
          :disabled="!form.token"
          @click="handleValidate"
        >
          Validate Key
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
import Select from '~/components/ui/Select.vue'
import { useRenderIntegration, type RenderValidationResult } from '~/composables/useRenderIntegration'

interface Props {
  open: boolean
  organizationId: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  connected: []
}>()

const { validateToken, connect, validating, loading } = useRenderIntegration()

// =====================================================
// State
// =====================================================

const form = reactive({
  name: '',
  token: '',
  ownerId: ''
})
const showToken = ref(false)
const validationResult = ref<RenderValidationResult | null>(null)

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

// Available owners from validation result
const availableOwners = computed(() => validationResult.value?.owners || [])

const ownerOptions = computed(() => {
  return availableOwners.value.map(owner => ({
    label: `${owner.name} (${owner.type})`,
    value: owner.id
  }))
})

// Can connect when valid, has name, and has owner selected (if multiple)
const canConnect = computed(() => {
  if (!validationResult.value?.valid || !form.name) return false
  // If multiple owners, require selection
  if (availableOwners.value.length > 1 && !form.ownerId) return false
  return true
})

// Get selected owner object
const selectedOwner = computed(() => {
  if (!form.ownerId) return availableOwners.value[0] || null
  return availableOwners.value.find(o => o.id === form.ownerId) || null
})

// =====================================================
// Methods
// =====================================================

async function handleValidate() {
  if (!form.token) return
  validationResult.value = await validateToken(form.token)

  // Auto-select first owner if available
  if (validationResult.value?.valid && validationResult.value.owners?.length) {
    const firstOwner = validationResult.value.owners[0]
    if (firstOwner) {
      form.ownerId = firstOwner.id
    }
  }
}

async function handleSubmit() {
  if (!canConnect.value) return

  // Determine owner: selected one, or first available
  const owner = selectedOwner.value

  const success = await connect(
    props.organizationId,
    form.token,
    form.name,
    owner?.id,
    owner?.name
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
    form.token = ''
    form.ownerId = ''
    validationResult.value = null
    showToken.value = false
  }
})
</script>
