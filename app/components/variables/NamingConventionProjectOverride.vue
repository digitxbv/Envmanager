<template>
  <div class="space-y-4">
    <div>
      <h3 class="text-lg font-medium">Naming Conventions</h3>
      <p class="text-sm text-muted-foreground">Override organization naming rules for this project.</p>
    </div>

    <!-- Loading -->
    <div v-if="loading && !loaded" class="flex items-center justify-center py-4">
      <Icon name="lucide:loader-2" class="h-5 w-5 animate-spin text-muted-foreground" />
    </div>

    <template v-else>
      <!-- Override toggle -->
      <div class="flex items-center gap-3">
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" v-model="useOverride" class="accent-primary" />
          <span class="text-sm font-medium">Override organization defaults</span>
        </label>
      </div>

      <!-- Inherited rules display -->
      <div v-if="!useOverride" class="rounded-md border p-3 bg-muted/30 text-sm">
        <div v-if="orgConfig">
          <p class="text-muted-foreground mb-1">Using organization rules:</p>
          <div class="space-y-1 text-xs">
            <div v-if="orgConfig.rules.case">Case: <span class="font-mono">{{ orgConfig.rules.case }}</span></div>
            <div>Mode: <span class="font-medium">{{ orgConfig.enforcement_mode }}</span></div>
            <div v-if="orgConfig.template_name">Template: <span class="font-medium">{{ orgConfig.template_name }}</span></div>
          </div>
        </div>
        <p v-else class="text-muted-foreground">No organization naming rules configured.</p>
      </div>

      <!-- Override form -->
      <template v-if="useOverride">
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
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" v-model="form.enforcement_mode" value="block" class="accent-primary" />
              <span class="text-sm">Block</span>
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

        <!-- Preview -->
        <div class="space-y-2 border-t pt-4">
          <label class="text-sm font-medium">Preview</label>
          <input
            v-model="testName"
            class="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
            placeholder="Test a variable name..."
          />
          <div v-if="testName && testResult" class="text-sm">
            <div v-if="testResult.valid" class="text-success flex items-center gap-1">
              <Icon name="lucide:check-circle" class="h-4 w-4" /> Valid
            </div>
            <div v-else class="text-destructive flex items-center gap-1">
              <Icon name="lucide:x-circle" class="h-4 w-4" /> Invalid
            </div>
            <div v-for="issue in [...testResult.errors, ...testResult.warnings]" :key="issue.message" class="text-xs text-muted-foreground ml-5">
              {{ issue.message }}
            </div>
          </div>
        </div>

        <!-- Save -->
        <div class="flex justify-end gap-2 pt-2">
          <Button variant="outline" @click="removeOverride" :loading="saving" v-if="hasExistingOverride">
            Remove Override
          </Button>
          <Button :loading="saving" @click="save">
            Save Override
          </Button>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/Button.vue'
import { validateVariableName, getTemplate, type NamingConventionConfig, type NamingRule } from '@/utils/naming-conventions'

const props = defineProps<{
  projectId: string
  organizationId: string
}>()

const { $toast } = useNuxtApp()
const { getOrgRules, getProjectRules, saveProjectRules, deleteProjectRules, loading } = useNamingConventions(
  computed(() => props.organizationId)
)

const loaded = ref(false)
const saving = ref(false)
const useOverride = ref(false)
const hasExistingOverride = ref(false)
const selectedTemplate = ref('')
const testName = ref('')
const orgConfig = ref<NamingConventionConfig | null>(null)

const form = reactive<{
  rules: NamingRule
  enforcement_mode: 'warn' | 'block'
}>({
  rules: { case: undefined, patterns: [], forbidden: [] },
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

async function save() {
  saving.value = true
  try {
    await saveProjectRules(props.projectId, {
      rules: form.rules,
      enforcement_mode: form.enforcement_mode,
      template_name: selectedTemplate.value || undefined
    })
    hasExistingOverride.value = true
    $toast.success('Project naming rules saved')
  } catch (e: any) {
    $toast.error(e.message || 'Failed to save')
  } finally {
    saving.value = false
  }
}

async function removeOverride() {
  saving.value = true
  try {
    await deleteProjectRules(props.projectId)
    useOverride.value = false
    hasExistingOverride.value = false
    $toast.success('Project override removed')
  } catch (e: any) {
    $toast.error(e.message || 'Failed to remove')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    orgConfig.value = await getOrgRules()
    const projectRules = await getProjectRules(props.projectId)
    if (projectRules) {
      useOverride.value = true
      hasExistingOverride.value = true
      form.rules = JSON.parse(JSON.stringify(projectRules.rules))
      form.enforcement_mode = projectRules.enforcement_mode
      selectedTemplate.value = projectRules.template_name || ''
    }
  } finally {
    loaded.value = true
  }
})
</script>
