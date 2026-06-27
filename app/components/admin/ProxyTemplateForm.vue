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
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-lg font-medium">
              {{ isEditing ? 'Edit Template' : 'Create Template' }}
            </h3>
            <button
              @click="close"
              class="text-muted-foreground hover:text-foreground"
              :disabled="saving"
            >
              <Icon name="lucide:x" class="h-5 w-5" />
            </button>
          </div>

          <form @submit.prevent="handleSubmit" class="space-y-6">
            <!-- Basic Info -->
            <div class="space-y-4">
              <h4 class="text-sm font-medium text-muted-foreground uppercase tracking-wide">Basic Info</h4>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="mb-1.5 block text-sm font-medium">Name <span class="text-destructive">*</span></label>
                  <Input v-model="form.name" placeholder="e.g. SendGrid" required @input="autoGenerateSlug" />
                </div>
                <div>
                  <label class="mb-1.5 block text-sm font-medium">Slug <span class="text-destructive">*</span></label>
                  <Input v-model="form.slug" placeholder="e.g. sendgrid" required />
                </div>
              </div>

              <div>
                <label class="mb-1.5 block text-sm font-medium">Description</label>
                <textarea
                  v-model="form.description"
                  rows="2"
                  placeholder="Brief description of what this template proxies"
                  class="flex w-full rounded-md border border-input bg-card text-card-foreground px-4 py-2.5 text-base leading-6 ring-offset-background transition-all duration-200 placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-ring/50 focus:border-ring"
                />
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="mb-1.5 block text-sm font-medium">Icon</label>
                  <div class="flex items-center gap-2">
                    <Input v-model="form.icon" placeholder="e.g. lucide:mail" class="flex-1" />
                    <div class="flex items-center justify-center h-11 w-11 rounded-md border border-input bg-muted/50">
                      <Icon v-if="form.icon" :name="form.icon" class="h-5 w-5 text-foreground" />
                      <Icon v-else name="lucide:image" class="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>
                <div>
                  <label class="mb-1.5 block text-sm font-medium">Category</label>
                  <select
                    v-model="form.category"
                    class="flex h-11 w-full rounded-md border border-input bg-card text-card-foreground px-4 py-2.5 text-base leading-6 ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-ring/50 focus:border-ring"
                  >
                    <option value="general">General</option>
                    <option value="email">Email</option>
                    <option value="payment">Payment</option>
                    <option value="ai">AI</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Pre-fill Config -->
            <div class="space-y-4">
              <h4 class="text-sm font-medium text-muted-foreground uppercase tracking-wide">Pre-fill Config</h4>

              <div>
                <label class="mb-1.5 block text-sm font-medium">Target URL <span class="text-destructive">*</span></label>
                <Input v-model="form.target_url" placeholder="https://api.example.com/v1/endpoint" required />
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="mb-1.5 block text-sm font-medium">HTTP Method</label>
                  <select
                    v-model="form.http_method"
                    class="flex h-11 w-full rounded-md border border-input bg-card text-card-foreground px-4 py-2.5 text-base leading-6 ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-ring/50 focus:border-ring"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>
                <div class="flex items-end gap-4">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" v-model="form.pass_through_body" class="rounded border-input" />
                    <span class="text-sm font-medium">Pass through body</span>
                  </label>
                </div>
              </div>

              <!-- Target Headers -->
              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <label class="text-sm font-medium">Target Headers</label>
                  <button
                    type="button"
                    @click="addHeader"
                    class="text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    + Add header
                  </button>
                </div>
                <div v-if="headers.length === 0" class="text-sm text-muted-foreground py-2">
                  No headers configured.
                </div>
                <div v-else class="space-y-2">
                  <div v-for="(header, index) in headers" :key="index" class="flex items-center gap-2">
                    <Input v-model="header.key" placeholder="Header name" class="flex-1" />
                    <Input v-model="header.value" placeholder="Header value" class="flex-1" />
                    <button
                      type="button"
                      @click="removeHeader(index)"
                      class="text-muted-foreground hover:text-destructive transition-colors p-1"
                    >
                      <Icon name="lucide:x" class="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <!-- Secret Hints -->
              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <label class="text-sm font-medium">Secret Hints</label>
                  <button
                    type="button"
                    @click="addSecretHint"
                    class="text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    + Add hint
                  </button>
                </div>
                <div v-if="secretHints.length === 0" class="text-sm text-muted-foreground py-2">
                  No secret hints configured.
                </div>
                <div v-else class="space-y-3">
                  <div
                    v-for="(hint, index) in secretHints"
                    :key="index"
                    class="rounded-md border border-border p-3 space-y-2"
                  >
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-medium text-muted-foreground">Hint {{ index + 1 }}</span>
                      <button
                        type="button"
                        @click="removeSecretHint(index)"
                        class="text-muted-foreground hover:text-destructive transition-colors p-1"
                      >
                        <Icon name="lucide:x" class="h-4 w-4" />
                      </button>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                      <div>
                        <label class="mb-1 block text-xs text-muted-foreground">Inject As</label>
                        <select
                          v-model="hint.inject_as"
                          class="flex h-9 w-full rounded-md border border-input bg-card text-card-foreground px-3 py-1 text-sm ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          <option value="header">Header</option>
                          <option value="query">Query</option>
                          <option value="body">Body</option>
                        </select>
                      </div>
                      <div>
                        <label class="mb-1 block text-xs text-muted-foreground">Key</label>
                        <Input v-model="hint.key" placeholder="e.g. Authorization" class="!h-9 !text-sm" />
                      </div>
                      <div>
                        <label class="mb-1 block text-xs text-muted-foreground">Template</label>
                        <Input v-model="hint.template" placeholder="e.g. Bearer {{secret}}" class="!h-9 !text-sm" />
                      </div>
                      <div>
                        <label class="mb-1 block text-xs text-muted-foreground">Variable Name Hint</label>
                        <Input v-model="hint.variable_name_hint" placeholder="e.g. SENDGRID_API_KEY" class="!h-9 !text-sm" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Request Body Template -->
              <div v-if="!form.pass_through_body">
                <label class="mb-1.5 block text-sm font-medium">Request Body Template (JSON)</label>
                <textarea
                  v-model="form.request_body_template"
                  rows="4"
                  placeholder='{"key": "value"}'
                  class="flex w-full rounded-md border border-input bg-card text-card-foreground px-4 py-2.5 text-sm leading-6 ring-offset-background transition-all duration-200 placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-ring/50 focus:border-ring font-mono"
                />
              </div>
            </div>

            <!-- Admin -->
            <div class="space-y-4">
              <h4 class="text-sm font-medium text-muted-foreground uppercase tracking-wide">Admin</h4>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="mb-1.5 block text-sm font-medium">Sort Order</label>
                  <input
                    v-model.number="form.sort_order"
                    type="number"
                    min="0"
                    class="flex h-11 w-full rounded-md border border-input bg-card text-card-foreground px-4 py-2.5 text-base leading-6 ring-offset-background transition-all duration-200 placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-ring/50 focus:border-ring"
                  />
                </div>
                <div class="flex items-end">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" v-model="form.is_active" class="rounded border-input" />
                    <span class="text-sm font-medium">Active</span>
                  </label>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" type="button" @click="close">Cancel</Button>
              <Button type="submit" :loading="saving">
                {{ isEditing ? 'Save Changes' : 'Create Template' }}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { Database, Json } from '~/types/database.types'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'

import type { ProxyTemplate } from '~/types/proxy.types'
import { generateSlug } from '~/lib/proxy-utils'
type ProxyTemplateRow = ProxyTemplate

interface SecretHint {
  inject_as: string
  key: string
  template: string
  variable_name_hint: string
}

interface HeaderEntry {
  key: string
  value: string
}

const props = defineProps<{
  modelValue: boolean
  template?: ProxyTemplateRow | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: []
}>()

const client = useSupabaseClient<Database>()
const { $toast } = useNuxtApp()

const saving = ref(false)

const isEditing = computed(() => !!props.template)

const form = reactive({
  name: '',
  slug: '',
  description: '',
  icon: '',
  category: 'general',
  target_url: '',
  http_method: 'POST',
  pass_through_body: true,
  request_body_template: '',
  sort_order: 0,
  is_active: true
})

const headers = ref<HeaderEntry[]>([])
const secretHints = ref<SecretHint[]>([])

// Track whether slug has been manually edited
const slugManuallyEdited = ref(false)

const autoGenerateSlug = () => {
  if (!isEditing.value && !slugManuallyEdited.value) {
    form.slug = generateSlug(form.name)
  }
}

watch(() => form.slug, (newVal, oldVal) => {
  // If user manually changed slug (not from autoGenerate), mark as manually edited
  if (oldVal !== undefined && newVal !== generateSlug(form.name)) {
    slugManuallyEdited.value = true
  }
})

const addHeader = () => {
  headers.value.push({ key: '', value: '' })
}

const removeHeader = (index: number) => {
  headers.value.splice(index, 1)
}

const addSecretHint = () => {
  secretHints.value.push({ inject_as: 'header', key: '', template: '', variable_name_hint: '' })
}

const removeSecretHint = (index: number) => {
  secretHints.value.splice(index, 1)
}

const parseHeaders = (raw: Json): HeaderEntry[] => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
  const entries: HeaderEntry[] = []
  for (const [key, value] of Object.entries(raw)) {
    entries.push({ key, value: String(value) })
  }
  return entries
}

const parseSecretHints = (raw: Json): SecretHint[] => {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const obj = item as Record<string, unknown>
    return {
      inject_as: String(obj.inject_as ?? 'header'),
      key: String(obj.key ?? ''),
      template: String(obj.template ?? ''),
      variable_name_hint: String(obj.variable_name_hint ?? '')
    }
  })
}

const resetForm = () => {
  form.name = ''
  form.slug = ''
  form.description = ''
  form.icon = ''
  form.category = 'general'
  form.target_url = ''
  form.http_method = 'POST'
  form.pass_through_body = true
  form.request_body_template = ''
  form.sort_order = 0
  form.is_active = true
  headers.value = []
  secretHints.value = []
  slugManuallyEdited.value = false
}

const populateFromTemplate = (t: ProxyTemplateRow) => {
  form.name = t.name
  form.slug = t.slug
  form.description = t.description ?? ''
  form.icon = t.icon ?? ''
  form.category = t.category
  form.target_url = t.target_url
  form.http_method = t.http_method
  form.pass_through_body = t.pass_through_body
  form.request_body_template = t.request_body_template ? JSON.stringify(t.request_body_template, null, 2) : ''
  form.sort_order = t.sort_order
  form.is_active = t.is_active
  headers.value = parseHeaders(t.target_headers)
  secretHints.value = parseSecretHints(t.secret_hints)
  slugManuallyEdited.value = true
}

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    if (props.template) {
      populateFromTemplate(props.template)
    } else {
      resetForm()
    }
  }
})

const buildPayload = () => {
  const headersObj: Record<string, string> = {}
  for (const h of headers.value) {
    if (h.key.trim()) {
      headersObj[h.key.trim()] = h.value
    }
  }

  const hints = secretHints.value
    .filter(h => h.key.trim())
    .map(h => ({
      inject_as: h.inject_as,
      key: h.key.trim(),
      template: h.template || null,
      variable_name_hint: h.variable_name_hint || null
    }))

  let requestBodyTemplate: Json | null = null
  if (!form.pass_through_body && form.request_body_template.trim()) {
    try {
      requestBodyTemplate = JSON.parse(form.request_body_template)
    } catch {
      $toast.error('Request body template is not valid JSON')
      return null
    }
  }

  return {
    name: form.name.trim(),
    slug: form.slug.trim(),
    description: form.description.trim() || null,
    icon: form.icon.trim() || null,
    category: form.category,
    target_url: form.target_url.trim(),
    http_method: form.http_method,
    pass_through_body: form.pass_through_body,
    request_body_template: requestBodyTemplate,
    target_headers: headersObj as unknown as Json,
    secret_hints: hints as unknown as Json,
    sort_order: form.sort_order,
    is_active: form.is_active
  }
}

const handleSubmit = async () => {
  const payload = buildPayload()
  if (!payload) return

  saving.value = true

  try {
    if (isEditing.value && props.template) {
      const { error } = await client
        .from('proxy_templates')
        .update(payload)
        .eq('id', props.template.id)

      if (error) throw error
      $toast.success('Template updated')
    } else {
      const { error } = await client
        .from('proxy_templates')
        .insert(payload)

      if (error) throw error
      $toast.success('Template created')
    }

    emit('saved')
    emit('update:modelValue', false)
  } catch (err) {
    console.error('[ProxyTemplateForm] Failed to save template:', err)
    const message = err instanceof Error ? err.message : 'Failed to save template'
    $toast.error(message)
  } finally {
    saving.value = false
  }
}

const close = () => {
  if (saving.value) return
  emit('update:modelValue', false)
}
</script>
