<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-lg font-medium">Naming Conventions</h3>
      <p class="text-sm text-muted-foreground">Configure variable naming rules for your organization.</p>
    </div>

    <!-- Loading -->
    <div v-if="loading && !loaded" class="flex items-center justify-center py-8">
      <Icon name="lucide:loader-2" class="h-5 w-5 animate-spin text-muted-foreground" />
    </div>

    <template v-else>
      <!-- Template selector -->
      <div class="space-y-2">
        <label class="text-sm font-medium">Template</label>
        <select
          v-model="selectedTemplate"
          class="w-full rounded-md border bg-background px-3 py-2 text-sm"
          @change="applyTemplate"
        >
          <option value="">Custom</option>
          <option value="standard">Standard</option>
          <option value="nextjs">Next.js</option>
          <option value="vite">Vite</option>
          <option value="strict">Strict</option>
        </select>
      </div>

      <!-- Enforcement mode -->
      <div class="space-y-2">
        <label class="text-sm font-medium">Enforcement Mode</label>
        <div class="flex items-center gap-4">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="radio" v-model="form.enforcement_mode" value="warn" class="accent-primary" />
            <span class="text-sm">Warn</span>
            <span class="text-xs text-muted-foreground">— show warnings but allow saving</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="radio" v-model="form.enforcement_mode" value="block" class="accent-primary" />
            <span class="text-sm">Block</span>
            <span class="text-xs text-muted-foreground">— prevent saving non-compliant names</span>
          </label>
        </div>
      </div>

      <!-- Case rule -->
      <div class="space-y-2">
        <label class="text-sm font-medium">Case Convention</label>
        <select v-model="form.rules.case" class="w-full rounded-md border bg-background px-3 py-2 text-sm">
          <option value="">No case requirement</option>
          <option value="SCREAMING_SNAKE_CASE">SCREAMING_SNAKE_CASE</option>
          <option value="snake_case">snake_case</option>
          <option value="PascalCase">PascalCase</option>
          <option value="camelCase">camelCase</option>
        </select>
      </div>

      <!-- Pattern rules -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <label class="text-sm font-medium">Required Patterns</label>
          <button @click="addPattern" class="text-xs text-primary hover:underline">+ Add pattern</button>
        </div>
        <div v-if="form.rules.patterns?.length" class="space-y-2">
          <div
            v-for="(pattern, index) in form.rules.patterns"
            :key="index"
            class="flex items-start gap-2 border rounded-md p-2"
          >
            <div class="flex-1 space-y-1">
              <input
                v-model="pattern.match"
                class="w-full rounded border bg-background px-2 py-1 text-sm font-mono"
                placeholder="Regex pattern (e.g., ^NEXT_PUBLIC_)"
              />
              <input
                v-model="pattern.description"
                class="w-full rounded border bg-background px-2 py-1 text-sm"
                placeholder="Description"
              />
            </div>
            <button @click="form.rules.patterns?.splice(index, 1)" class="text-muted-foreground hover:text-destructive mt-1">
              <Icon name="lucide:x" class="h-4 w-4" />
            </button>
          </div>
        </div>
        <p v-else class="text-xs text-muted-foreground">No required patterns</p>
      </div>

      <!-- Forbidden patterns -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <label class="text-sm font-medium">Forbidden Patterns</label>
          <button @click="addForbidden" class="text-xs text-primary hover:underline">+ Add rule</button>
        </div>
        <div v-if="form.rules.forbidden?.length" class="space-y-2">
          <div
            v-for="(rule, index) in form.rules.forbidden"
            :key="index"
            class="flex items-start gap-2 border rounded-md p-2"
          >
            <div class="flex-1 space-y-1">
              <input
                v-model="rule.match"
                class="w-full rounded border bg-background px-2 py-1 text-sm font-mono"
                placeholder="Regex pattern (e.g., ^password$)"
              />
              <input
                v-model="rule.reason"
                class="w-full rounded border bg-background px-2 py-1 text-sm"
                placeholder="Reason why this is forbidden"
              />
            </div>
            <button @click="form.rules.forbidden?.splice(index, 1)" class="text-muted-foreground hover:text-destructive mt-1">
              <Icon name="lucide:x" class="h-4 w-4" />
            </button>
          </div>
        </div>
        <p v-else class="text-xs text-muted-foreground">No forbidden patterns</p>
      </div>

      <!-- Preview -->
      <div class="space-y-2 border-t pt-4">
        <label class="text-sm font-medium">Preview</label>
        <p class="text-xs text-muted-foreground">Test a variable name against the current rules</p>
        <input
          v-model="testName"
          class="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
          placeholder="e.g., api_key"
        />
        <div v-if="testName && testResult" class="text-sm space-y-1">
          <div v-if="testResult.valid" class="text-success flex items-center gap-1">
            <Icon name="lucide:check-circle" class="h-4 w-4" />
            Valid
          </div>
          <div v-else class="text-destructive flex items-center gap-1">
            <Icon name="lucide:x-circle" class="h-4 w-4" />
            Invalid
          </div>
          <div v-for="issue in [...testResult.errors, ...testResult.warnings]" :key="issue.message" class="text-xs text-muted-foreground ml-5">
            {{ issue.message }}
            <span v-if="issue.suggestion" class="text-primary"> — try: {{ issue.suggestion }}</span>
          </div>
        </div>
      </div>

      <!-- Save button -->
      <div class="flex justify-end pt-2">
        <Button :loading="saving" @click="save">
          Save Rules
        </Button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/Button.vue'
import { validateVariableName, getTemplate, TEMPLATES, type NamingConventionConfig, type NamingRule } from '@/utils/naming-conventions'

const props = defineProps<{
  organizationId: string
}>()

const { $toast } = useNuxtApp()
const { getOrgRules, saveOrgRules, loading } = useNamingConventions(
  computed(() => props.organizationId)
)

const loaded = ref(false)
const saving = ref(false)
const selectedTemplate = ref('')
const testName = ref('')

const form = reactive<{
  rules: NamingRule
  enforcement_mode: 'warn' | 'block'
}>({
  rules: {
    case: undefined,
    patterns: [],
    forbidden: []
  },
  enforcement_mode: 'warn'
})

const testResult = computed(() => {
  if (!testName.value) return null
  return validateVariableName(testName.value, {
    rules: form.rules,
    enforcement_mode: form.enforcement_mode
  })
})

function applyTemplate() {
  if (!selectedTemplate.value) return
  const template = getTemplate(selectedTemplate.value)
  if (template) {
    form.rules = JSON.parse(JSON.stringify(template.rules))
    form.enforcement_mode = template.enforcement_mode
  }
}

function addPattern() {
  if (!form.rules.patterns) form.rules.patterns = []
  form.rules.patterns.push({ match: '', description: '' })
}

function addForbidden() {
  if (!form.rules.forbidden) form.rules.forbidden = []
  form.rules.forbidden.push({ match: '', reason: '' })
}

async function save() {
  saving.value = true
  try {
    await saveOrgRules({
      rules: form.rules,
      enforcement_mode: form.enforcement_mode,
      template_name: selectedTemplate.value || undefined
    })
    $toast.success('Naming rules saved')
  } catch (e: any) {
    $toast.error(e.message || 'Failed to save rules')
  } finally {
    saving.value = false
  }
}

// Load existing rules on mount
onMounted(async () => {
  try {
    const existing = await getOrgRules()
    if (existing) {
      form.rules = JSON.parse(JSON.stringify(existing.rules))
      form.enforcement_mode = existing.enforcement_mode
      selectedTemplate.value = existing.template_name || ''
    }
  } finally {
    loaded.value = true
  }
})
</script>
