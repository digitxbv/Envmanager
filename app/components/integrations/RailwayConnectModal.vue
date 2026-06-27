<template>
  <Dialog
    :open="open"
    max-width="default"
    title="Connect Railway"
    description="Enter your Railway API token"
    @close="$emit('close')"
  >
    <div class="mb-4 flex items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2">
      <div class="flex h-9 w-9 items-center justify-center rounded-md bg-[#0B0D0E] text-white">
        <Icon name="lucide:git-branch" class="h-5 w-5" />
      </div>
      <span class="text-sm text-muted-foreground">Validate your Railway token, then choose a workspace if needed.</span>
    </div>

    <form @submit.prevent="handleSubmit" class="space-y-4">
      <div class="space-y-2">
        <label class="block text-sm font-medium">Connection Name</label>
        <Input
          v-model="form.name"
          placeholder="My Railway Account"
          :disabled="isLoading"
        />
      </div>

      <div class="space-y-2">
        <label class="block text-sm font-medium">API Token</label>
        <div class="relative">
          <Input
            v-model="form.token"
            :type="showToken ? 'text' : 'password'"
            placeholder="Enter your Railway API token"
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
          Create an Account Token at
          <a
            href="https://railway.app/account/tokens"
            target="_blank"
            class="text-primary hover:underline"
          >
            railway.app/account/tokens
          </a>.
          <br>
          <strong>Important:</strong> Leave "Workspace" unselected when creating the token for full access.
        </p>
      </div>

      <div v-if="validationResult?.valid && availableWorkspaces.length > 1" class="space-y-2">
        <label class="block text-sm font-medium">Workspace</label>
        <Select
          :model-value="form.workspaceId"
          :options="workspaceOptions"
          :disabled="isLoading"
          @update:model-value="(val: string) => form.workspaceId = val"
        />
        <p class="text-xs text-muted-foreground">
          Select the workspace to sync projects from.
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
          <p>Account: {{ validationResult.user.email }}</p>
          <p v-if="validationResult.workspaces?.length">
            Workspaces: {{ validationResult.workspaces.length }}
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
          v-if="!validationResult?.valid"
          type="button"
          :loading="validating"
          :disabled="!form.token"
          @click="handleValidate"
        >
          Validate Token
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
import { useRailwayIntegration, type RailwayValidationResult } from '~/composables/useRailwayIntegration'

interface Props {
  open: boolean
  organizationId: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  connected: []
}>()

const { validateToken, connect, validating, loading } = useRailwayIntegration()

// =====================================================
// State
// =====================================================

const form = reactive({
  name: '',
  token: '',
  workspaceId: ''
})
const showToken = ref(false)
const validationResult = ref<RailwayValidationResult | null>(null)

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

// Available workspaces from validation result
const availableWorkspaces = computed(() => validationResult.value?.workspaces || [])

const workspaceOptions = computed(() => {
  return availableWorkspaces.value.map(ws => ({
    label: ws.name,
    value: ws.id
  }))
})

// Can connect when valid, has name, and has workspace selected (if multiple)
const canConnect = computed(() => {
  if (!validationResult.value?.valid || !form.name) return false
  // If multiple workspaces, require selection
  if (availableWorkspaces.value.length > 1 && !form.workspaceId) return false
  return true
})

// =====================================================
// Methods
// =====================================================

async function handleValidate() {
  if (!form.token) return
  validationResult.value = await validateToken(form.token)

  // Auto-select first workspace if available
  if (validationResult.value?.valid && validationResult.value.workspaces?.length) {
    const firstWorkspace = validationResult.value.workspaces[0]
    if (firstWorkspace) {
      form.workspaceId = firstWorkspace.id
    }
  }
}

async function handleSubmit() {
  if (!canConnect.value) return

  // Determine workspace ID: selected one, or first available, or empty
  const workspaceId = form.workspaceId || availableWorkspaces.value[0]?.id

  const success = await connect(
    props.organizationId,
    form.token,
    form.name,
    workspaceId
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
    form.workspaceId = ''
    validationResult.value = null
    showToken.value = false
  }
})
</script>
