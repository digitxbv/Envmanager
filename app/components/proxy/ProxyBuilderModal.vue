<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 flex items-center justify-center"
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/50"
        @click="handleClose"
      />

      <!-- Modal -->
      <div class="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg border bg-card p-6 shadow-lg">
        <!-- Header -->
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon name="lucide:shield" class="h-5 w-5" />
            </div>
            <div>
              <h2 class="text-lg font-semibold">
                {{ isEditMode ? 'Edit Proxy Function' : 'Create Proxy Function' }}
              </h2>
              <p class="text-sm text-muted-foreground">
                {{ isEditMode ? 'Update proxy configuration' : 'Set up a secure API proxy' }}
              </p>
            </div>
          </div>
          <button
            type="button"
            class="text-muted-foreground hover:text-foreground"
            @click="handleClose"
          >
            <Icon name="lucide:x" class="h-5 w-5" />
          </button>
        </div>

        <!-- Step 1: Template Selector -->
        <ProxyTemplateSelector
          v-if="showTemplateStep"
          @select="handleTemplateSelect"
          @skip="showTemplateStep = false"
        />

        <!-- Step 2: Form -->
        <form v-else @submit.prevent="handleSave" class="space-y-6">

          <!-- Basic Info -->
          <fieldset class="space-y-4">
            <legend class="text-base font-medium">Basic Info</legend>

            <div>
              <label class="block text-sm font-medium mb-1">Name <span class="text-destructive">*</span></label>
              <input
                v-model="form.name"
                type="text"
                required
                placeholder="e.g. Brevo Email Sender"
                class="flex h-11 w-full rounded-md border border-input bg-card text-card-foreground px-4 py-2.5 text-base leading-6 ring-offset-background transition-all duration-200 placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-ring/50 focus:border-ring"
              />
            </div>

            <div>
              <label class="block text-sm font-medium mb-1">Slug</label>
              <input
                :value="computedSlug"
                type="text"
                disabled
                class="flex h-11 w-full rounded-md border border-input bg-muted text-muted-foreground px-4 py-2.5 text-base leading-6 cursor-not-allowed opacity-70"
              />
              <p class="text-xs text-muted-foreground mt-1">Auto-generated from name</p>
            </div>

            <div>
              <label class="block text-sm font-medium mb-1">Description</label>
              <textarea
                v-model="form.description"
                placeholder="What does this proxy do?"
                rows="2"
                class="flex w-full rounded-md border border-input bg-card text-card-foreground px-4 py-2.5 text-base leading-6 ring-offset-background transition-all duration-200 placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-ring/50 focus:border-ring"
              />
            </div>

            <ServiceScopeSelect
              v-model="form.service_id"
              :services="services"
            />
          </fieldset>

          <!-- Target API -->
          <fieldset class="space-y-4">
            <legend class="text-base font-medium">Target API</legend>

            <div>
              <label class="block text-sm font-medium mb-1">Target URL <span class="text-destructive">*</span></label>
              <input
                v-model="form.target_url"
                type="url"
                required
                placeholder="https://api.example.com/v1/endpoint"
                class="flex h-11 w-full rounded-md border border-input bg-card text-card-foreground px-4 py-2.5 text-base leading-6 ring-offset-background transition-all duration-200 placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-ring/50 focus:border-ring"
              />
            </div>

            <div>
              <label class="block text-sm font-medium mb-1">HTTP Method</label>
              <select
                v-model="form.http_method"
                class="w-full rounded-md border border-input bg-card text-card-foreground px-3 py-2 text-sm ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-ring/50 focus:border-ring"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>

            <!-- Static Headers -->
            <div>
              <label class="block text-sm font-medium mb-1">Static Headers</label>
              <div class="space-y-2">
                <div
                  v-for="(header, index) in headerRows"
                  :key="index"
                  class="flex items-center gap-2"
                >
                  <input
                    :value="header.key"
                    type="text"
                    placeholder="Header name"
                    class="flex h-9 flex-1 rounded-md border border-input bg-card text-card-foreground px-3 py-2 text-sm ring-offset-background transition-all duration-200 placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-ring/50 focus:border-ring"
                    @input="header.key = ($event.target as HTMLInputElement).value; syncHeadersToForm()"
                  />
                  <input
                    :value="header.value"
                    type="text"
                    placeholder="Header value"
                    class="flex h-9 flex-1 rounded-md border border-input bg-card text-card-foreground px-3 py-2 text-sm ring-offset-background transition-all duration-200 placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-ring/50 focus:border-ring"
                    @input="header.value = ($event.target as HTMLInputElement).value; syncHeadersToForm()"
                  />
                  <button
                    type="button"
                    class="text-muted-foreground hover:text-destructive transition-colors"
                    @click="headerRows.splice(index, 1); syncHeadersToForm()"
                  >
                    <Icon name="lucide:trash-2" class="h-4 w-4" />
                  </button>
                </div>
              </div>
              <button
                type="button"
                class="mt-2 flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
                @click="headerRows.push({ key: '', value: '' })"
              >
                <Icon name="lucide:plus" class="h-4 w-4" />
                Add header
              </button>
            </div>
          </fieldset>

          <!-- Secret Mapping -->
          <fieldset class="space-y-4">
            <legend class="text-base font-medium">Secret Mapping</legend>
            <p class="text-sm text-muted-foreground -mt-2">
              Map secret variables to inject into the proxied request
            </p>

            <div class="space-y-3">
              <SecretMappingRow
                v-for="(mapping, index) in form.secret_mappings"
                :key="index"
                :model-value="mapping"
                :variables="secretVariables"
                @update:model-value="updateMapping(index, $event)"
                @remove="removeMapping(index)"
              />
            </div>

            <button
              type="button"
              class="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
              @click="addMapping"
            >
              <Icon name="lucide:plus" class="h-4 w-4" />
              Add secret mapping
            </button>
          </fieldset>

          <!-- CORS Origins -->
          <fieldset class="space-y-4">
            <legend class="text-base font-medium">CORS Origins</legend>
            <p class="text-sm text-muted-foreground -mt-2">
              Allowed origins that can call this proxy. Use * to allow all.
            </p>

            <div class="space-y-2">
              <div
                v-for="(origin, index) in form.allowed_origins"
                :key="index"
                class="flex items-center gap-2"
              >
                <input
                  :value="origin"
                  type="text"
                  placeholder="https://example.com or *"
                  class="flex h-9 flex-1 rounded-md border border-input bg-card text-card-foreground px-3 py-2 text-sm ring-offset-background transition-all duration-200 placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-ring/50 focus:border-ring"
                  @input="form.allowed_origins[index] = ($event.target as HTMLInputElement).value"
                />
                <button
                  type="button"
                  class="text-muted-foreground hover:text-destructive transition-colors"
                  @click="form.allowed_origins.splice(index, 1)"
                >
                  <Icon name="lucide:trash-2" class="h-4 w-4" />
                </button>
              </div>
            </div>

            <button
              type="button"
              class="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
              @click="form.allowed_origins.push('')"
            >
              <Icon name="lucide:plus" class="h-4 w-4" />
              Add origin
            </button>
          </fieldset>

          <!-- Rate Limiting -->
          <fieldset class="space-y-4">
            <legend class="text-base font-medium">Rate Limiting</legend>

            <label class="flex items-center justify-between rounded-lg border p-4 cursor-pointer hover:bg-muted/30">
              <div>
                <p class="font-medium text-sm">Enable rate limiting</p>
                <p class="text-xs text-muted-foreground">
                  Limit the number of requests per minute to prevent abuse. Leave disabled for no limit.
                </p>
              </div>
              <input
                v-model="rateLimitEnabled"
                type="checkbox"
                class="h-5 w-5 rounded border-input"
              />
            </label>

            <div v-if="rateLimitEnabled">
              <label class="block text-sm font-medium mb-1">Requests per minute</label>
              <input
                v-model.number="form.rate_limit_per_minute"
                type="number"
                min="1"
                max="10000"
                placeholder="60"
                class="flex h-11 w-full rounded-md border border-input bg-card text-card-foreground px-4 py-2.5 text-base leading-6 ring-offset-background transition-all duration-200 placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-ring/50 focus:border-ring"
              />
            </div>
          </fieldset>

          <!-- Request Body -->
          <fieldset class="space-y-4">
            <legend class="text-base font-medium">Request Body</legend>

            <label class="flex items-center justify-between rounded-lg border p-4 cursor-pointer hover:bg-muted/30">
              <div>
                <p class="font-medium text-sm">Pass through client body</p>
                <p class="text-xs text-muted-foreground">
                  Forward the request body from the client as-is
                </p>
              </div>
              <input
                v-model="form.pass_through_body"
                type="checkbox"
                class="h-5 w-5 rounded border-input"
              />
            </label>

            <div v-if="!form.pass_through_body">
              <label class="block text-sm font-medium mb-1">Body template (JSON)</label>
              <textarea
                v-model="bodyTemplateJson"
                rows="5"
                placeholder='{"key": "value"}'
                class="flex w-full rounded-md border border-input bg-card text-card-foreground px-4 py-2.5 text-sm font-mono leading-6 ring-offset-background transition-all duration-200 placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-ring/50 focus:border-ring"
              />
              <p v-if="bodyTemplateError" class="text-xs text-destructive mt-1">{{ bodyTemplateError }}</p>
            </div>
          </fieldset>

          <!-- Code Preview (after save / edit mode) -->
          <div v-if="savedProxy" class="space-y-3">
            <button
              type="button"
              class="flex items-center justify-between w-full text-sm font-medium text-muted-foreground hover:text-foreground"
              @click="showCodePreview = !showCodePreview"
            >
              <span class="text-base font-medium text-foreground">Code Preview</span>
              <Icon
                name="lucide:chevron-down"
                class="h-4 w-4 transition-transform"
                :class="showCodePreview && 'rotate-180'"
              />
            </button>

            <div v-if="showCodePreview" class="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div>
                <p class="text-xs font-medium text-muted-foreground mb-1">Proxy URL</p>
                <code class="block text-sm bg-card rounded px-3 py-2 border break-all">
                  {{ proxyUrl }}
                </code>
              </div>
              <div>
                <p class="text-xs font-medium text-muted-foreground mb-1">Token Header</p>
                <code class="block text-sm bg-card rounded px-3 py-2 border">
                  x-proxy-token: {{ savedProxy.secret_token }}
                </code>
              </div>
              <div>
                <p class="text-xs font-medium text-muted-foreground mb-1">Example curl</p>
                <pre class="text-sm bg-card rounded px-3 py-2 border overflow-x-auto whitespace-pre-wrap">{{ curlExample }}</pre>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              @click="handleClose"
              :disabled="saving"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              :loading="saving"
              :disabled="!canSave"
            >
              {{ isEditMode ? 'Update Proxy' : 'Create Proxy' }}
            </Button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { Database } from '~/types/database.types'
import type { ProxyFunction, ProxyFunctionForm, SecretMapping } from '~/types/proxy.types'
import Button from '~/components/ui/Button.vue'
import ServiceScopeSelect from '~/components/services/ServiceScopeSelect.vue'
import SecretMappingRow from './SecretMappingRow.vue'
import ProxyTemplateSelector from './ProxyTemplateSelector.vue'
import { generateSlug, getProxyHandlerUrl } from '~/lib/proxy-utils'

import type { ProxyTemplate } from '~/types/proxy.types'
type ProxyTemplateRow = ProxyTemplate

interface PreSelectedVariable {
  variable_id: string
  variable_name: string
}

interface Props {
  modelValue: boolean
  environmentId: string
  organizationId: string
  editProxy?: ProxyFunction | null
  preSelectedVariable?: PreSelectedVariable | null
}

const props = withDefaults(defineProps<Props>(), {
  editProxy: null,
  preSelectedVariable: null
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'saved': []
}>()

const config = useRuntimeConfig()
const client = useSupabaseClient<Database>()
const { $toast } = useNuxtApp()

// Composables
const environmentIdRef = computed(() => props.environmentId)
const { createProxyFunction, updateProxyFunction } = useProxyFunctions(environmentIdRef)

// Fetch services for the service scope selector.
// The project ID comes from the route, same pattern as VercelConfigureModal.
const route = useRoute()
const projectId = computed(() => String(route.params.id))
const { services, fetchServices } = useServices(projectId)

// =====================================================
// State
// =====================================================

const saving = ref(false)
const showTemplateStep = ref(false)
const showCodePreview = ref(false)
const savedProxy = ref<ProxyFunction | null>(null)
const secretVariables = ref<{ id: string; key: string }[]>([])
const headerRows = reactive<{ key: string; value: string }[]>([])

const form = reactive<ProxyFunctionForm>({
  name: '',
  description: '',
  service_id: null,
  target_url: '',
  http_method: 'POST',
  target_headers: {},
  secret_mappings: [],
  allowed_origins: ['*'],
  request_body_template: null,
  pass_through_body: true,
  rate_limit_per_minute: null,
  template_id: null
})

const rateLimitEnabled = computed({
  get: () => form.rate_limit_per_minute !== null,
  set: (val: boolean) => {
    form.rate_limit_per_minute = val ? 60 : null
  }
})

const bodyTemplateJson = ref('')
const bodyTemplateError = ref('')

// =====================================================
// Computed
// =====================================================

const isEditMode = computed(() => !!props.editProxy)

const computedSlug = computed(() => {
  return props.editProxy?.slug ?? generateSlug(form.name)
})

const canSave = computed(() => {
  return form.name.trim().length > 0 && form.target_url.trim().length > 0
})

const proxyUrl = computed(() => {
  if (!savedProxy.value) return ''
  const supabaseUrl = config.public.supabase?.url || 'http://127.0.0.1:54431'
  return getProxyHandlerUrl(supabaseUrl, savedProxy.value.id)
})

const curlExample = computed(() => {
  if (!savedProxy.value) return ''
  const method = form.http_method
  const token = savedProxy.value.secret_token
  let cmd = `curl -X ${method} "${proxyUrl.value}" \\\n  -H "x-proxy-token: ${token}"`
  if (method === 'POST' || method === 'PUT') {
    cmd += ` \\\n  -H "Content-Type: application/json" \\\n  -d '{"key": "value"}'`
  }
  return cmd
})

// =====================================================
// Methods
// =====================================================

function handleClose() {
  if (!saving.value) {
    emit('update:modelValue', false)
  }
}

function resetForm() {
  form.name = ''
  form.description = ''
  form.service_id = null
  form.target_url = ''
  form.http_method = 'POST'
  form.target_headers = {}
  form.secret_mappings = []
  form.allowed_origins = ['*']
  form.request_body_template = null
  form.pass_through_body = true
  form.rate_limit_per_minute = null
  form.template_id = null
  headerRows.length = 0
  bodyTemplateJson.value = ''
  bodyTemplateError.value = ''
  savedProxy.value = null
  showCodePreview.value = false
}

function populateFormFromProxy(proxy: ProxyFunction) {
  form.name = proxy.name
  form.description = proxy.description || ''
  form.service_id = proxy.service_id
  form.target_url = proxy.target_url
  form.http_method = proxy.http_method
  form.target_headers = { ...proxy.target_headers }
  loadHeaderRows(proxy.target_headers)
  form.secret_mappings = proxy.secret_mappings.map(m => ({ ...m }))
  form.allowed_origins = [...proxy.allowed_origins]
  form.request_body_template = proxy.request_body_template
  form.pass_through_body = proxy.pass_through_body
  form.rate_limit_per_minute = proxy.rate_limit_per_minute ?? null
  form.template_id = proxy.template_id

  if (proxy.request_body_template) {
    bodyTemplateJson.value = JSON.stringify(proxy.request_body_template, null, 2)
  }

  savedProxy.value = proxy
}

function handleTemplateSelect(template: ProxyTemplateRow) {
  form.name = template.name
  form.target_url = template.target_url
  form.http_method = template.http_method as ProxyFunctionForm['http_method']
  const headers = (template.target_headers && typeof template.target_headers === 'object' && !Array.isArray(template.target_headers))
    ? { ...(template.target_headers as Record<string, string>) }
    : {}
  form.target_headers = headers
  loadHeaderRows(headers)
  form.pass_through_body = template.pass_through_body
  form.template_id = template.id

  if (template.request_body_template) {
    form.request_body_template = template.request_body_template as object
    bodyTemplateJson.value = JSON.stringify(template.request_body_template, null, 2)
  }

  // Convert secret_hints to mapping rows with key/template pre-filled
  const hints = Array.isArray(template.secret_hints)
    ? (template.secret_hints as Array<{ inject_as?: string; key?: string; template?: string }>)
    : []

  const templateMappings = hints.map(hint => ({
    variable_id: '',
    inject_as: (hint.inject_as as SecretMapping['inject_as']) || 'header',
    key: hint.key || '',
    template: hint.template || undefined
  }))

  // If a variable was pre-selected, fill it into the first matching mapping or prepend it
  if (props.preSelectedVariable) {
    if (templateMappings.length > 0 && templateMappings[0]) {
      templateMappings[0].variable_id = props.preSelectedVariable.variable_id
    } else {
      templateMappings.unshift({
        variable_id: props.preSelectedVariable.variable_id,
        inject_as: 'header',
        key: '',
        template: undefined
      })
    }
  }

  form.secret_mappings = templateMappings

  showTemplateStep.value = false
}

// Header management — uses headerRows array for reactivity, syncs to form.target_headers
function syncHeadersToForm() {
  const result: Record<string, string> = {}
  for (const row of headerRows) {
    if (row.key) result[row.key] = row.value
  }
  form.target_headers = result
}

function loadHeaderRows(headers: Record<string, string>) {
  headerRows.length = 0
  for (const [k, v] of Object.entries(headers)) {
    headerRows.push({ key: k, value: v })
  }
}

// Secret mapping management
function addMapping() {
  form.secret_mappings.push({
    variable_id: '',
    inject_as: 'header',
    key: '',
    template: undefined
  })
}

function updateMapping(index: number, mapping: SecretMapping) {
  form.secret_mappings[index] = mapping
}

function removeMapping(index: number) {
  form.secret_mappings.splice(index, 1)
}

// Fetch secret variables for the dropdown
async function fetchSecretVariables() {
  const { data } = await client
    .from('variables')
    .select('id, key')
    .eq('environment_id', props.environmentId)
    .eq('is_secret', true)
    .order('key', { ascending: true })

  secretVariables.value = data ?? []
}

// Save handler
async function handleSave() {
  saving.value = true

  try {
    // Parse body template JSON if not pass-through
    if (!form.pass_through_body && bodyTemplateJson.value.trim()) {
      try {
        form.request_body_template = JSON.parse(bodyTemplateJson.value)
        bodyTemplateError.value = ''
      } catch {
        bodyTemplateError.value = 'Invalid JSON'
        return
      }
    } else if (form.pass_through_body) {
      form.request_body_template = null
    }

    // Filter out empty mappings
    const cleanMappings = form.secret_mappings.filter(m => m.variable_id && m.key)
    const formData: ProxyFunctionForm = {
      ...form,
      secret_mappings: cleanMappings,
      allowed_origins: form.allowed_origins.filter(o => o.trim().length > 0)
    }

    if (isEditMode.value && props.editProxy) {
      const { data } = await updateProxyFunction(props.editProxy.id, formData)
      if (data) {
        savedProxy.value = data
        emit('saved')
        emit('update:modelValue', false)
      }
    } else {
      const { data } = await createProxyFunction(formData)
      if (data) {
        savedProxy.value = data
        emit('saved')
        emit('update:modelValue', false)
      }
    }
  } finally {
    saving.value = false
  }
}

// =====================================================
// Lifecycle
// =====================================================

watch(() => props.modelValue, async (isOpen) => {
  if (isOpen) {
    resetForm()

    // Determine which step to show
    if (props.editProxy) {
      // Edit mode: populate form, skip template step
      showTemplateStep.value = false
      populateFormFromProxy(props.editProxy)
    } else if (props.preSelectedVariable) {
      // From variable row action: show template step (same as header button)
      showTemplateStep.value = true
      form.secret_mappings = [{
        variable_id: props.preSelectedVariable.variable_id,
        inject_as: 'header',
        key: '',
        template: undefined
      }]
    } else {
      // From proxies page: show template step
      showTemplateStep.value = true
    }

    // Fetch data
    await Promise.all([
      fetchSecretVariables(),
      fetchServices()
    ])
  }
})
</script>
