<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 bg-background/80 z-50 flex items-center justify-center"
      @click="close"
    >
      <div
        class="bg-card rounded-lg shadow-lg border w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col"
        @click.stop
      >
        <div class="p-6 overflow-y-auto">
          <!-- Header -->
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium">Export Variables</h3>
            <button
              @click="close"
              class="text-muted-foreground hover:text-foreground"
            >
              <Icon name="lucide:x" class="h-5 w-5" />
            </button>
          </div>

          <div class="space-y-6">
            <!-- Format Selection -->
            <div class="space-y-2">
              <label class="text-sm font-medium">Export Format</label>
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="format in formatOptions"
                  :key="format.id"
                  @click="selectedFormat = format.id"
                  :class="[
                    'flex items-center justify-center rounded-md border p-3 text-sm',
                    selectedFormat === format.id
                      ? 'border-primary bg-primary/10'
                      : 'border-input hover:bg-muted'
                  ]"
                >
                  <Icon :name="format.icon || 'lucide:file-text'" class="mr-2 h-4 w-4" />
                  {{ format.name }}
                </button>
              </div>
            </div>

            <!-- K8s Configuration (conditional) -->
            <div v-if="isK8sFormat" class="space-y-4 p-4 bg-muted/50 rounded-md">
              <h4 class="text-sm font-medium">Kubernetes Configuration</h4>
              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                  <label for="k8s-namespace" class="text-sm text-muted-foreground">Namespace</label>
                  <Input
                    id="k8s-namespace"
                    v-model="config.namespace"
                    placeholder="default"
                  />
                </div>
                <div class="space-y-2">
                  <label for="k8s-name" class="text-sm text-muted-foreground">Resource Name</label>
                  <Input
                    id="k8s-name"
                    v-model="config.name"
                    :placeholder="defaultK8sName"
                  />
                </div>
              </div>
            </div>

            <!-- CLI Info Panel -->
            <template v-if="isCliFormat">
              <div class="space-y-4 rounded-lg border bg-muted/30 p-5">
                <p class="text-sm text-muted-foreground">
                  Pull environment variables directly into your local <code class="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">.env</code> file using the EnvManager CLI.
                </p>

                <!-- Install command -->
                <div class="space-y-1.5">
                  <label class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Install</label>
                  <div class="flex items-center gap-2">
                    <code class="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono select-all">{{ cliInstallCommand }}</code>
                    <Button variant="outline" size="sm" @click="copyCommand(cliInstallCommand)">
                      <Icon name="lucide:copy" class="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <!-- Pull command -->
                <div class="space-y-1.5">
                  <label class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pull variables</label>
                  <div class="flex items-center gap-2">
                    <code class="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono select-all">{{ cliPullCommand }}</code>
                    <Button variant="outline" size="sm" @click="copyCommand(cliPullCommand)">
                      <Icon name="lucide:copy" class="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <!-- Docs link -->
                <div class="pt-1">
                  <NuxtLink
                    to="/docs/cli/overview"
                    target="_blank"
                    class="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <Icon name="lucide:external-link" class="h-3.5 w-3.5" />
                    View CLI documentation
                  </NuxtLink>
                </div>
              </div>

              <!-- Close button -->
              <div class="flex justify-end">
                <Button variant="outline" @click="close">Close</Button>
              </div>
            </template>

            <!-- Standard export flow -->
            <template v-else>
              <!-- Variable Selection -->
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <label class="text-sm font-medium">Variables to Export</label>
                  <div class="flex gap-2">
                    <button
                      @click="selectAll"
                      class="text-xs text-primary hover:underline"
                    >
                      Select all
                    </button>
                    <span class="text-muted-foreground">|</span>
                    <button
                      @click="selectNone"
                      class="text-xs text-primary hover:underline"
                    >
                      Select none
                    </button>
                  </div>
                </div>
                <div class="border rounded-md max-h-40 overflow-y-auto">
                  <div
                    v-for="variable in variables"
                    :key="variable.id"
                    class="flex items-center gap-2 px-3 py-2 border-b last:border-b-0 hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      :id="`var-${variable.id}`"
                      :checked="selectedIds.has(variable.id)"
                      :disabled="variable.is_secret && !includeSecrets"
                      @change="toggleVariable(variable.id)"
                      class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50"
                    />
                    <label
                      :for="`var-${variable.id}`"
                      :class="[
                        'text-sm font-mono flex-1',
                        variable.is_secret && !includeSecrets ? 'text-muted-foreground' : ''
                      ]"
                    >
                      {{ variable.key }}
                    </label>
                    <span
                      v-if="variable.is_secret"
                      class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-destructive/10 text-destructive"
                    >
                      Secret
                    </span>
                  </div>
                  <div v-if="variables.length === 0" class="px-3 py-4 text-center text-muted-foreground text-sm">
                    No variables available
                  </div>
                </div>
              </div>

              <!-- Include Secrets Toggle -->
              <div v-if="hasSecrets" class="space-y-2">
                <div class="flex items-center gap-2">
                  <input
                    id="include-secrets"
                    type="checkbox"
                    v-model="includeSecrets"
                    class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <label for="include-secrets" class="text-sm font-medium">
                    Include secrets
                  </label>
                </div>
                <p v-if="includeSecrets" class="text-xs text-amber-600 dark:text-amber-500 flex items-center gap-1">
                  <Icon name="lucide:alert-triangle" class="h-4 w-4" />
                  Secret values will be visible in the output
                </p>
              </div>

              <!-- Decrypting indicator -->
              <div v-if="decrypting" class="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon name="lucide:loader-2" class="h-4 w-4 animate-spin" />
                Decrypting secrets...
              </div>

              <!-- Preview Panel -->
              <div class="space-y-2">
                <label class="text-sm font-medium">Preview</label>
                <pre class="font-mono text-xs bg-muted p-4 rounded overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">{{ preview }}</pre>
              </div>

              <!-- Actions -->
              <div class="flex justify-end gap-2">
                <Button variant="outline" @click="close">
                  Cancel
                </Button>
                <Button variant="outline" @click="copyToClipboard" :disabled="selectedIds.size === 0">
                  <Icon name="lucide:copy" class="mr-2 h-4 w-4" />
                  Copy
                </Button>
                <Button @click="downloadFile" :disabled="selectedIds.size === 0">
                  <Icon name="lucide:download" class="mr-2 h-4 w-4" />
                  Download
                </Button>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'
import type { ExportFormat, ExportVariable, K8sExportConfig } from '~/types/export'
import {
  sanitizeK8sName,
  toKubernetesSecret,
  toKubernetesConfigMap,
  toDockerCompose,
  toDotEnv,
  toVercelCLI,
  toRailwayCLI,
  toRenderCLI
} from '~/utils/formatters/containerExport'

interface Variable {
  id: string
  key: string
  value: string
  is_secret: boolean
}

const props = defineProps<{
  modelValue: boolean
  variables: Variable[]
  projectSlug: string
  environmentName?: string
  projectFriendlyId?: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const client = useSupabaseClient()
const { $toast } = useNuxtApp()

// Format options
const formatOptions = [
  { id: 'dotenv' as ExportFormat, name: '.env', icon: 'lucide:file-text' },
  { id: 'envmanager-cli' as ExportFormat, name: 'EnvManager CLI', icon: 'lucide:terminal' },
  { id: 'docker-compose' as ExportFormat, name: 'Docker Compose', icon: 'lucide:box' },
  { id: 'k8s-secret' as ExportFormat, name: 'K8s Secret', icon: 'lucide:shield' },
  { id: 'k8s-configmap' as ExportFormat, name: 'K8s ConfigMap', icon: 'lucide:file-cog' },
  { id: 'vercel-cli' as ExportFormat, name: 'Vercel CLI', icon: 'lucide:terminal' },
  { id: 'railway-cli' as ExportFormat, name: 'Railway CLI', icon: 'lucide:terminal' },
  { id: 'render-cli' as ExportFormat, name: 'Render CLI', icon: 'lucide:terminal' }
]

// State
const selectedFormat = ref<ExportFormat>('dotenv')
const config = reactive<K8sExportConfig>({
  namespace: 'default',
  name: ''
})
const includeSecrets = ref(false)
const selectedIds = ref<Set<string>>(new Set())
const decryptedSecrets = ref<Map<string, string>>(new Map())
const decrypting = ref(false)

// Computed
const defaultK8sName = computed(() => sanitizeK8sName(props.projectSlug))

const isK8sFormat = computed(() =>
  selectedFormat.value === 'k8s-secret' || selectedFormat.value === 'k8s-configmap'
)

const isCliFormat = computed(() => selectedFormat.value === 'envmanager-cli')

const cliInstallCommand = 'npm install -g @envmanager-cli/cli'
const cliPullCommand = computed(() =>
  `envmanager pull -p '#${props.projectFriendlyId ?? 1}' -e ${props.environmentName || 'development'}`
)

const hasSecrets = computed(() =>
  props.variables.some(v => v.is_secret)
)

const preview = computed(() => {
  if (isCliFormat.value) return ''

  const selectedVars = props.variables.filter(v => selectedIds.value.has(v.id))

  if (selectedVars.length === 0) {
    return 'No variables selected'
  }

  const exportVars: ExportVariable[] = selectedVars.map(v => ({
    key: v.key,
    value: v.is_secret
      ? (decryptedSecrets.value.get(v.id) || '***ENCRYPTED***')
      : v.value,
    isSecret: v.is_secret
  }))

  const k8sConfig: K8sExportConfig = {
    name: config.name || defaultK8sName.value,
    namespace: config.namespace || 'default'
  }

  switch (selectedFormat.value) {
    case 'k8s-secret':
      return toKubernetesSecret(exportVars, k8sConfig)
    case 'k8s-configmap':
      return toKubernetesConfigMap(exportVars, k8sConfig)
    case 'docker-compose':
      return toDockerCompose(exportVars)
    case 'vercel-cli':
      return toVercelCLI(exportVars)
    case 'railway-cli':
      return toRailwayCLI(exportVars)
    case 'render-cli':
      return toRenderCLI(exportVars)
    case 'dotenv':
    default:
      return toDotEnv(exportVars)
  }
})

// Methods
function close() {
  emit('update:modelValue', false)
  reset()
}

async function copyCommand(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    $toast.success('Copied to clipboard')
  } catch {
    $toast.error('Failed to copy')
  }
}

function reset() {
  selectedFormat.value = 'dotenv'
  config.namespace = 'default'
  config.name = ''
  includeSecrets.value = false
  selectedIds.value = new Set()
  decryptedSecrets.value = new Map()
}

function selectAll() {
  selectedIds.value = new Set(
    props.variables
      .filter(v => !v.is_secret || includeSecrets.value)
      .map(v => v.id)
  )
}

function selectNone() {
  selectedIds.value = new Set()
}

function toggleVariable(id: string) {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id)
  } else {
    selectedIds.value.add(id)
  }
  // Force reactivity
  selectedIds.value = new Set(selectedIds.value)
}

async function decryptSecrets() {
  const secretIds = [...selectedIds.value].filter(id => {
    const v = props.variables.find(v => v.id === id)
    return v?.is_secret && !decryptedSecrets.value.has(id)
  })

  if (secretIds.length === 0) return

  decrypting.value = true
  try {
    for (const id of secretIds) {
      const { data, error } = await client.rpc('decrypt_variable_value', { variable_id: id })
      if (error) {
        console.error('Failed to decrypt:', id, error)
        continue
      }
      if (data) {
        decryptedSecrets.value.set(id, data)
      }
    }
    // Force reactivity
    decryptedSecrets.value = new Map(decryptedSecrets.value)
  } finally {
    decrypting.value = false
  }
}

function getFilename(): string {
  if (isCliFormat.value) return ''

  const baseName = props.projectSlug || 'export'
  const k8sName = config.name || defaultK8sName.value

  switch (selectedFormat.value) {
    case 'k8s-secret':
      return `${k8sName}-secret.yaml`
    case 'k8s-configmap':
      return `${k8sName}-configmap.yaml`
    case 'docker-compose':
      return `${baseName}-compose-env.yml`
    case 'vercel-cli':
      return `${baseName}-vercel-commands.sh`
    case 'railway-cli':
      return `${baseName}-railway-commands.sh`
    case 'render-cli':
      return `${baseName}-render-commands.sh`
    case 'dotenv':
    default:
      return `${baseName}.env`
  }
}

function downloadFileBlob(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url) // Cleanup to prevent memory leak
}

async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(preview.value)
    $toast.success('Copied to clipboard')
  } catch {
    $toast.error('Failed to copy to clipboard')
  }
}

async function downloadFile() {
  downloadFileBlob(preview.value, getFilename())
  $toast.success(`Downloaded ${getFilename()}`)
}

// Watch for include secrets toggle
watch(includeSecrets, async (newVal) => {
  if (newVal) {
    // Add secrets to selection if they weren't selected
    const secretVars = props.variables.filter(v => v.is_secret)
    for (const v of secretVars) {
      selectedIds.value.add(v.id)
    }
    selectedIds.value = new Set(selectedIds.value)

    // Decrypt selected secrets
    await decryptSecrets()
  } else {
    // Remove secrets from selection when unchecked
    const secretIds = props.variables.filter(v => v.is_secret).map(v => v.id)
    for (const id of secretIds) {
      selectedIds.value.delete(id)
    }
    selectedIds.value = new Set(selectedIds.value)
  }
})

// Watch for selectedIds changes to decrypt any newly selected secrets
watch(selectedIds, async () => {
  if (includeSecrets.value) {
    await decryptSecrets()
  }
}, { deep: true })

// Initialize selected variables when modal opens
watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    // Select all non-secret variables by default
    selectedIds.value = new Set(
      props.variables
        .filter(v => !v.is_secret)
        .map(v => v.id)
    )
    // Set default K8s name from project slug
    config.name = defaultK8sName.value
  }
})
</script>
