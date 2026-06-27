<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-semibold">Schema Fields</h3>
      <Button size="sm" @click="addField">
        <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
        Add Field
      </Button>
    </div>

    <div v-if="fields.length === 0" class="text-center py-12 border border-dashed rounded-lg bg-muted/30">
      <Icon name="lucide:file-json" class="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
      <p class="text-muted-foreground">No schema fields defined</p>
      <p class="text-sm text-muted-foreground/70 mt-1">Add fields to define validation rules for your environment variables</p>
    </div>

    <div v-else class="space-y-4">
      <div
        v-for="(field, index) in fields"
        :key="field.id"
        class="border rounded-lg bg-card p-4 shadow-sm"
      >
        <div class="flex items-start gap-4">
          <div class="flex-1 space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium mb-1.5">Key</label>
                <Input
                  v-model="field.key"
                  placeholder="VARIABLE_NAME"
                  class-name="font-mono uppercase"
                  @input="emitUpdate"
                />
              </div>
              <div>
                <label class="block text-sm font-medium mb-1.5">Type</label>
                <select
                  v-model="field.config.type"
                  class="flex h-11 w-full rounded-md border border-input bg-card text-card-foreground px-4 py-2.5 text-base leading-6 ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-ring/50 focus:border-ring"
                  @change="onTypeChange(field)"
                >
                  <option v-for="t in fieldTypes" :key="t.value" :value="t.value">
                    {{ t.label }}
                  </option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium mb-1.5">Description</label>
                <Input
                  v-model="field.config.description"
                  placeholder="Describe this variable"
                  @input="emitUpdate"
                />
              </div>
              <div>
                <label class="block text-sm font-medium mb-1.5">Default Value</label>
                <Input
                  v-model="field.config.default"
                  placeholder="Optional default"
                  @input="emitUpdate"
                />
              </div>
            </div>

            <div class="flex items-center gap-6">
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  v-model="field.config.required"
                  class="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background cursor-pointer"
                  @change="emitUpdate"
                />
                <span class="text-sm font-medium">Required</span>
              </label>
            </div>

            <div v-if="showStringValidation(field.config.type)" class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium mb-1.5">Min Length</label>
                <Input
                  v-model.number="field.config.minLength"
                  type="number"
                  placeholder="0"
                  @input="emitUpdate"
                />
              </div>
              <div>
                <label class="block text-sm font-medium mb-1.5">Max Length</label>
                <Input
                  v-model.number="field.config.maxLength"
                  type="number"
                  placeholder="No limit"
                  @input="emitUpdate"
                />
              </div>
            </div>

            <div v-if="field.config.type === 'string'" class="space-y-1.5">
              <label class="block text-sm font-medium">Pattern (Regex)</label>
              <Input
                v-model="field.config.pattern"
                placeholder="^[a-zA-Z0-9]+$"
                class-name="font-mono text-sm"
                @input="emitUpdate"
              />
            </div>

            <div v-if="field.config.type === 'number' || field.config.type === 'port'" class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium mb-1.5">Minimum</label>
                <Input
                  v-model.number="field.config.minimum"
                  type="number"
                  :placeholder="field.config.type === 'port' ? '1' : 'No minimum'"
                  @input="emitUpdate"
                />
              </div>
              <div>
                <label class="block text-sm font-medium mb-1.5">Maximum</label>
                <Input
                  v-model.number="field.config.maximum"
                  type="number"
                  :placeholder="field.config.type === 'port' ? '65535' : 'No maximum'"
                  @input="emitUpdate"
                />
              </div>
            </div>

            <div v-if="field.config.type === 'enum'" class="space-y-2">
              <div class="flex items-center justify-between">
                <label class="block text-sm font-medium">Allowed Values</label>
                <button
                  type="button"
                  class="text-xs text-primary hover:underline"
                  @click="addEnumValue(field)"
                >
                  + Add Value
                </button>
              </div>
              <div v-if="!field.config.enum?.length" class="text-sm text-muted-foreground py-2">
                No values defined. Add at least one allowed value.
              </div>
              <div v-else class="flex flex-wrap gap-2">
                <div
                  v-for="(enumVal, enumIndex) in field.config.enum"
                  :key="enumIndex"
                  class="flex items-center gap-1 bg-muted rounded-md px-2 py-1"
                >
                  <input
                    v-model="field.config.enum[enumIndex]"
                    class="bg-transparent border-none outline-none text-sm w-24"
                    placeholder="value"
                    @input="emitUpdate"
                  />
                  <button
                    type="button"
                    class="text-muted-foreground hover:text-destructive transition-colors"
                    @click="removeEnumValue(field, enumIndex)"
                  >
                    <Icon name="lucide:x" class="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            class="text-muted-foreground hover:text-destructive transition-colors p-1"
            @click="removeField(index)"
            aria-label="Remove field"
          >
            <Icon name="lucide:trash-2" class="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>

    <div class="border-t pt-6">
      <div class="flex items-center justify-between mb-3">
        <h4 class="text-sm font-semibold text-muted-foreground">JSON Preview</h4>
        <button
          type="button"
          class="text-xs text-primary hover:underline flex items-center gap-1"
          @click="copySchema"
        >
          <Icon name="lucide:copy" class="h-3 w-3" />
          Copy
        </button>
      </div>
      <div class="bg-muted/50 border rounded-lg p-4 overflow-x-auto">
        <pre class="text-sm font-mono text-foreground/80">{{ jsonPreview }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'

interface SchemaField {
  type: 'string' | 'number' | 'boolean' | 'url' | 'email' | 'port' | 'json' | 'enum'
  required?: boolean
  default?: string
  description?: string
  enum?: string[]
  pattern?: string
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
}

type EnvSchema = Record<string, SchemaField>

interface InternalField {
  id: string
  key: string
  config: SchemaField
}

interface Props {
  modelValue?: EnvSchema
}

interface Emits {
  (e: 'update:modelValue', value: EnvSchema): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => ({})
})

const emit = defineEmits<Emits>()

const fieldTypes = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'url', label: 'URL' },
  { value: 'email', label: 'Email' },
  { value: 'port', label: 'Port' },
  { value: 'json', label: 'JSON' },
  { value: 'enum', label: 'Enum' }
] as const

const fields = ref<InternalField[]>([])

const initializeFields = () => {
  const schemaEntries = Object.entries(props.modelValue || {})
  fields.value = schemaEntries.map(([key, config]) => ({
    id: crypto.randomUUID(),
    key,
    config: { ...config }
  }))
}

watch(() => props.modelValue, initializeFields, { immediate: true, deep: true })

const buildSchema = (): EnvSchema => {
  const schema: EnvSchema = {}
  for (const field of fields.value) {
    if (field.key.trim()) {
      const config: SchemaField = { type: field.config.type }

      if (field.config.required) config.required = true
      if (field.config.default) config.default = field.config.default
      if (field.config.description) config.description = field.config.description

      if (field.config.type === 'string') {
        if (field.config.minLength !== undefined && field.config.minLength !== null) {
          config.minLength = field.config.minLength
        }
        if (field.config.maxLength !== undefined && field.config.maxLength !== null) {
          config.maxLength = field.config.maxLength
        }
        if (field.config.pattern) config.pattern = field.config.pattern
      }

      if (field.config.type === 'number' || field.config.type === 'port') {
        if (field.config.minimum !== undefined && field.config.minimum !== null) {
          config.minimum = field.config.minimum
        }
        if (field.config.maximum !== undefined && field.config.maximum !== null) {
          config.maximum = field.config.maximum
        }
      }

      if (field.config.type === 'enum' && field.config.enum?.length) {
        config.enum = field.config.enum.filter(v => v.trim())
      }

      schema[field.key.trim()] = config
    }
  }
  return schema
}

const jsonPreview = computed(() => {
  const schema = buildSchema()
  return JSON.stringify(schema, null, 2)
})

const emitUpdate = () => {
  emit('update:modelValue', buildSchema())
}

const addField = () => {
  fields.value.push({
    id: crypto.randomUUID(),
    key: '',
    config: {
      type: 'string',
      required: false
    }
  })
}

const removeField = (index: number) => {
  fields.value.splice(index, 1)
  emitUpdate()
}

const onTypeChange = (field: InternalField) => {
  if (field.config.type === 'port') {
    field.config.minimum = 1
    field.config.maximum = 65535
  } else if (field.config.type === 'enum') {
    field.config.enum = field.config.enum || []
  }
  emitUpdate()
}

const showStringValidation = (type: SchemaField['type']): boolean => {
  return type === 'string' || type === 'url' || type === 'email'
}

const addEnumValue = (field: InternalField) => {
  if (!field.config.enum) {
    field.config.enum = []
  }
  field.config.enum.push('')
  emitUpdate()
}

const removeEnumValue = (field: InternalField, index: number) => {
  field.config.enum?.splice(index, 1)
  emitUpdate()
}

const copySchema = async () => {
  try {
    await navigator.clipboard.writeText(jsonPreview.value)
  } catch {
    // Silently fail if clipboard not available
  }
}
</script>
