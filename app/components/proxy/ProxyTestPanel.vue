<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex justify-end"
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/50"
        @click="$emit('close')"
      />

      <!-- Panel -->
      <div class="relative w-full max-w-lg bg-card border-l shadow-lg flex flex-col h-full overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h3 class="text-lg font-semibold text-foreground">Test Proxy</h3>
            <p class="text-sm text-muted-foreground">{{ proxyFunction?.name }}</p>
          </div>
          <button
            type="button"
            class="text-muted-foreground hover:text-foreground"
            @click="$emit('close')"
          >
            <Icon name="lucide:x" class="h-5 w-5" />
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          <!-- Request Info -->
          <div class="space-y-3">
            <h4 class="text-sm font-medium text-foreground">Request</h4>

            <div>
              <p class="text-xs font-medium text-muted-foreground mb-1">URL</p>
              <code class="block text-sm bg-muted rounded px-3 py-2 break-all">{{ hostedUrl }}</code>
            </div>

            <div>
              <p class="text-xs font-medium text-muted-foreground mb-1">Method</p>
              <Badge variant="default" size="sm">{{ proxyFunction?.http_method }}</Badge>
            </div>

            <div>
              <p class="text-xs font-medium text-muted-foreground mb-1">Required Headers</p>
              <code class="block text-sm bg-muted rounded px-3 py-2">
                x-proxy-token: {{ proxyFunction?.secret_token }}
              </code>
            </div>
          </div>

          <!-- Request Body -->
          <div v-if="proxyFunction?.http_method !== 'GET'">
            <label class="block text-sm font-medium mb-1">Request Body (JSON)</label>
            <textarea
              v-model="requestBody"
              rows="6"
              placeholder='{"key": "value"}'
              class="flex w-full rounded-md border border-input bg-card text-card-foreground px-4 py-2.5 text-sm font-mono leading-6 ring-offset-background transition-all duration-200 placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-ring/50 focus:border-ring"
            />
          </div>

          <!-- Send Button -->
          <Button
            :loading="sending"
            :disabled="sending"
            class="w-full"
            @click="sendTestRequest"
          >
            <Icon name="lucide:play" class="mr-1.5 h-4 w-4" />
            Send Test Request
          </Button>

          <!-- Response -->
          <div v-if="response" class="space-y-3">
            <h4 class="text-sm font-medium text-foreground">Response</h4>

            <div class="flex items-center gap-2">
              <Badge
                :variant="response.ok ? 'success' : 'destructive'"
                size="sm"
              >
                {{ response.status }} {{ response.statusText }}
              </Badge>
              <span class="text-xs text-muted-foreground">{{ response.duration }}ms</span>
            </div>

            <div>
              <p class="text-xs font-medium text-muted-foreground mb-1">Headers</p>
              <pre class="text-xs bg-muted rounded px-3 py-2 overflow-x-auto max-h-32 whitespace-pre-wrap">{{ response.headersText }}</pre>
            </div>

            <div>
              <p class="text-xs font-medium text-muted-foreground mb-1">Body</p>
              <pre class="text-sm bg-muted rounded px-3 py-2 overflow-x-auto max-h-64 whitespace-pre-wrap">{{ response.body }}</pre>
            </div>
          </div>

          <!-- Error -->
          <div v-if="errorMessage" class="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3">
            <p class="text-sm text-destructive">{{ errorMessage }}</p>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { ProxyFunction } from '~/types/proxy.types'
import Button from '~/components/ui/Button.vue'
import { getProxyHandlerUrl } from '~/lib/proxy-utils'

interface Props {
  open: boolean
  proxyFunction: ProxyFunction | null
}

const props = defineProps<Props>()

defineEmits<{
  close: []
}>()

const config = useRuntimeConfig()
const { $toast } = useNuxtApp()

const requestBody = ref('')
const sending = ref(false)
const errorMessage = ref('')
const response = ref<{
  ok: boolean
  status: number
  statusText: string
  headersText: string
  body: string
  duration: number
} | null>(null)

const hostedUrl = computed(() => {
  if (!props.proxyFunction) return ''
  const supabaseUrl = config.public.supabase?.url || 'http://127.0.0.1:54431'
  return getProxyHandlerUrl(supabaseUrl, props.proxyFunction.id)
})

async function sendTestRequest() {
  if (!props.proxyFunction) return

  sending.value = true
  errorMessage.value = ''
  response.value = null

  const start = performance.now()

  try {
    const method = props.proxyFunction.http_method
    const headers: Record<string, string> = {
      'x-proxy-token': props.proxyFunction.secret_token
    }

    const fetchOptions: RequestInit = {
      method,
      headers
    }

    if (method !== 'GET' && requestBody.value.trim()) {
      headers['Content-Type'] = 'application/json'
      // Validate JSON
      try {
        JSON.parse(requestBody.value)
      } catch {
        errorMessage.value = 'Invalid JSON in request body'
        sending.value = false
        return
      }
      fetchOptions.body = requestBody.value
    }

    const res = await fetch(hostedUrl.value, fetchOptions)
    const duration = Math.round(performance.now() - start)

    // Collect headers
    const headerLines: string[] = []
    res.headers.forEach((value, key) => {
      headerLines.push(`${key}: ${value}`)
    })

    // Parse body
    let bodyText: string
    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const json = await res.json()
      bodyText = JSON.stringify(json, null, 2)
    } else {
      bodyText = await res.text()
    }

    response.value = {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      headersText: headerLines.join('\n'),
      body: bodyText,
      duration
    }
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Request failed'
  } finally {
    sending.value = false
  }
}

// Reset state when panel opens
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    requestBody.value = ''
    response.value = null
    errorMessage.value = ''
  }
})
</script>
