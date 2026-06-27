<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 bg-background/80 z-50 flex items-center justify-center"
      @click="close"
    >
      <div
        class="bg-card rounded-lg shadow-lg border w-full max-w-3xl overflow-hidden max-h-[90vh] flex flex-col"
        @click.stop
      >
        <div class="p-6 overflow-y-auto">
          <!-- Header -->
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium">Download Proxy Code</h3>
            <button
              @click="close"
              class="text-muted-foreground hover:text-foreground"
            >
              <Icon name="lucide:x" class="h-5 w-5" />
            </button>
          </div>

          <div class="space-y-5">
            <!-- Platform Selector -->
            <div class="space-y-2">
              <label class="text-sm font-medium">Platform</label>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  v-for="p in platforms"
                  :key="p.id"
                  @click="selectedPlatform = p.id"
                  :class="[
                    'flex items-center justify-center rounded-md border p-3 text-sm transition-colors',
                    selectedPlatform === p.id
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-input hover:bg-muted text-muted-foreground'
                  ]"
                >
                  <Icon :name="p.icon" class="mr-2 h-4 w-4" />
                  {{ p.name }}
                </button>
              </div>
            </div>

            <!-- Code Preview -->
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <label class="text-sm font-medium">Generated Code</label>
                <span class="text-xs text-muted-foreground font-mono">{{ fileName }}</span>
              </div>
              <pre class="font-mono text-xs bg-muted p-4 rounded-md overflow-x-auto max-h-80 overflow-y-auto whitespace-pre">{{ generatedCode }}</pre>
            </div>

            <!-- Deployment Instructions -->
            <div class="rounded-md border bg-muted/30 px-4 py-3">
              <p class="text-sm text-muted-foreground">
                <Icon name="lucide:info" class="inline h-4 w-4 mr-1 -mt-0.5" />
                {{ deploymentInstructions }}
              </p>
            </div>

            <!-- Actions -->
            <div class="flex justify-end gap-2">
              <Button variant="outline" @click="close">
                Cancel
              </Button>
              <Button variant="outline" @click="copyCode">
                <Icon name="lucide:copy" class="mr-2 h-4 w-4" />
                Copy Code
              </Button>
              <Button @click="downloadCode">
                <Icon name="lucide:download" class="mr-2 h-4 w-4" />
                Download
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { ProxyFunction } from '~/types/proxy.types'
import type { Platform, VariableNameMap } from '~/lib/proxy-code-generators'
import {
  generateProxyCode,
  getFileName,
  getDeploymentInstructions
} from '~/lib/proxy-code-generators'
import Button from '~/components/ui/Button.vue'

interface VariableRef {
  id: string
  key: string
}

interface Props {
  modelValue: boolean
  proxyFunction: ProxyFunction | null
  variables: VariableRef[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const { $toast } = useNuxtApp()

const platforms = [
  { id: 'vercel' as Platform, name: 'Vercel Edge', icon: 'lucide:triangle' },
  { id: 'netlify' as Platform, name: 'Netlify', icon: 'lucide:globe' },
  { id: 'cloudflare' as Platform, name: 'Cloudflare', icon: 'lucide:cloud' },
  { id: 'aws-lambda' as Platform, name: 'AWS Lambda', icon: 'lucide:server' },
]

const selectedPlatform = ref<Platform>('vercel')

// Build variable name map from the variables array
const variableNameMap = computed<VariableNameMap>(() => {
  const map: VariableNameMap = {}
  for (const v of props.variables) {
    map[v.id] = v.key
  }
  return map
})

const generatedCode = computed(() => {
  if (!props.proxyFunction) return ''
  return generateProxyCode(selectedPlatform.value, props.proxyFunction, variableNameMap.value)
})

const fileName = computed(() => {
  if (!props.proxyFunction) return ''
  return getFileName(selectedPlatform.value, props.proxyFunction.slug)
})

const deploymentInstructions = computed(() => {
  if (!props.proxyFunction) return ''
  return getDeploymentInstructions(selectedPlatform.value, props.proxyFunction.slug)
})

function close() {
  emit('update:modelValue', false)
  selectedPlatform.value = 'vercel'
}

async function copyCode() {
  try {
    await navigator.clipboard.writeText(generatedCode.value)
    $toast.success('Code copied to clipboard')
  } catch {
    $toast.error('Failed to copy code')
  }
}

function downloadCode() {
  const blob = new Blob([generatedCode.value], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName.value
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  $toast.success(`Downloaded ${fileName.value}`)
}
</script>
