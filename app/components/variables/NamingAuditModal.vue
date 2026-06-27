<template>
  <Teleport to="body">
    <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="fixed inset-0 bg-black/50" @click="close" />
      <div class="relative z-10 bg-background rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between p-6 border-b">
          <h3 class="text-lg font-semibold">Naming Convention Audit</h3>
          <button @click="close" class="text-muted-foreground hover:text-foreground transition-colors">
            <Icon name="lucide:x" class="h-5 w-5" />
          </button>
        </div>

        <!-- Content (scrollable) -->
        <div class="flex-1 overflow-y-auto p-6 space-y-4">
          <!-- Loading -->
          <div v-if="auditing" class="flex items-center justify-center py-8">
            <Icon name="lucide:loader-2" class="h-5 w-5 animate-spin text-muted-foreground" />
          </div>

          <template v-else-if="auditResults">
            <!-- Summary -->
            <div class="flex items-center gap-4 p-4 rounded-lg border">
              <div class="text-center">
                <div class="text-2xl font-bold">{{ props.variables.length }}</div>
                <div class="text-xs text-muted-foreground">Total</div>
              </div>
              <div class="flex-1">
                <div class="flex justify-between text-sm mb-1">
                  <span class="text-success">{{ compliantCount }} compliant</span>
                  <span v-if="nonCompliantCount" class="text-yellow-600">{{ nonCompliantCount }} issues</span>
                </div>
                <div class="h-2 bg-muted rounded-full overflow-hidden">
                  <div class="h-full bg-success rounded-full" :style="{ width: compliancePercent + '%' }" />
                </div>
              </div>
            </div>

            <!-- All compliant message -->
            <div v-if="!nonCompliantCount" class="text-center py-6 text-success">
              <Icon name="lucide:check-circle" class="h-8 w-8 mx-auto mb-2" />
              <p class="font-medium">All variables comply with naming conventions!</p>
            </div>

            <!-- Non-compliant table -->
            <template v-else>
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium">Non-compliant variables</span>
                <button @click="toggleSelectAll" class="text-xs text-primary hover:underline transition-colors">
                  {{ allSelected ? 'Deselect All' : 'Select All' }}
                </button>
              </div>

              <div class="border rounded-lg overflow-hidden">
                <table class="w-full text-sm">
                  <thead class="bg-muted/50">
                    <tr>
                      <th class="w-8 px-3 py-2"></th>
                      <th class="text-left px-3 py-2 font-medium">Current Key</th>
                      <th class="text-left px-3 py-2 font-medium">Issue</th>
                      <th class="text-left px-3 py-2 font-medium">Suggested</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y">
                    <tr v-for="item in nonCompliantItems" :key="item.variable.id" class="hover:bg-muted/40 transition-colors">
                      <td class="px-3 py-2">
                        <input
                          type="checkbox"
                          v-model="selectedIds"
                          :value="item.variable.id"
                          :disabled="!item.suggestion"
                          class="accent-primary"
                        />
                      </td>
                      <td class="px-3 py-2 font-mono text-xs">{{ item.variable.key }}</td>
                      <td class="px-3 py-2 text-xs text-muted-foreground">{{ item.message }}</td>
                      <td class="px-3 py-2 font-mono text-xs text-primary">{{ item.suggestion || '\u2014' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Protected env notice -->
              <p v-if="isProtected" class="text-xs text-muted-foreground flex items-center gap-1">
                <Icon name="lucide:shield" class="h-3 w-3" />
                Renames will be submitted as pending changes for approval.
              </p>
            </template>
          </template>
        </div>

        <!-- Footer -->
        <div v-if="nonCompliantCount" class="flex justify-end gap-2 p-6 border-t">
          <Button variant="outline" @click="close">Close</Button>
          <Button :loading="applying" :disabled="!selectedIds.length" @click="applyRenames">
            Apply {{ selectedIds.length }} Rename{{ selectedIds.length !== 1 ? 's' : '' }}
          </Button>
        </div>
        <div v-else class="flex justify-end p-6 border-t">
          <Button variant="outline" @click="close">Close</Button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { validateVariableName, convertToCase } from '@/utils/naming-conventions'
import Button from '@/components/ui/Button.vue'

interface VariableItem {
  id: string
  key: string
  value: string
  is_secret: boolean
}

interface AuditResultItem {
  variable: VariableItem
  valid: boolean
  message: string
  suggestion: string | undefined
}

const props = defineProps<{
  modelValue: boolean
  environmentId: string
  organizationId: string
  projectId: string
  isProtected: boolean
  variables: VariableItem[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'renamed': []
}>()

const supabase = useSupabaseClient()
const { $toast } = useNuxtApp()
const { getEffectiveRules } = useNamingConventions(computed(() => props.organizationId))
const { submitChange } = usePendingChanges()

const auditing = ref(false)
const applying = ref(false)
const selectedIds = ref<string[]>([])
const auditResults = ref<AuditResultItem[] | null>(null)

const nonCompliantItems = computed(() => {
  if (!auditResults.value) return []
  return auditResults.value.filter(r => !r.valid)
})

const compliantCount = computed(() => {
  if (!auditResults.value) return 0
  return auditResults.value.filter(r => r.valid).length
})

const nonCompliantCount = computed(() => {
  return nonCompliantItems.value.length
})

const compliancePercent = computed(() => {
  if (!props.variables.length) return 100
  return Math.round((compliantCount.value / props.variables.length) * 100)
})

const selectableIds = computed(() => {
  return nonCompliantItems.value
    .filter(item => !!item.suggestion)
    .map(item => item.variable.id)
})

const allSelected = computed(() => {
  if (!selectableIds.value.length) return false
  return selectableIds.value.every(id => selectedIds.value.includes(id))
})

function toggleSelectAll() {
  if (allSelected.value) {
    selectedIds.value = []
  } else {
    selectedIds.value = [...selectableIds.value]
  }
}

function close() {
  emit('update:modelValue', false)
}

async function runAudit() {
  auditing.value = true
  selectedIds.value = []
  auditResults.value = null

  try {
    const config = await getEffectiveRules(props.projectId)

    if (!config) {
      // No naming rules configured, all are compliant
      auditResults.value = props.variables.map<AuditResultItem>(v => ({
        variable: v,
        valid: true,
        message: '',
        suggestion: undefined
      }))
      return
    }

    auditResults.value = props.variables.map<AuditResultItem>(v => {
      const result = validateVariableName(v.key, config)
      const allIssues = [...result.errors, ...result.warnings]

      if (allIssues.length === 0) {
        return {
          variable: v,
          valid: true,
          message: '',
          suggestion: undefined
        }
      }

      const firstIssue = allIssues[0]
      if (!firstIssue) {
        return {
          variable: v,
          valid: true,
          message: '',
          suggestion: undefined
        }
      }
      let suggestion = firstIssue.suggestion

      // If no suggestion from validation but it's a case issue, compute one
      if (!suggestion && firstIssue.type === 'case' && config.rules.case) {
        suggestion = convertToCase(v.key, config.rules.case)
      }

      return {
        variable: v,
        valid: false,
        message: firstIssue.message,
        suggestion
      }
    })
  } catch (err) {
    console.error('[NamingAuditModal] Failed to run audit:', err)
    $toast.error('Failed to run naming audit')
  } finally {
    auditing.value = false
  }
}

async function applyRenames() {
  if (!selectedIds.value.length) return

  applying.value = true

  try {
    const itemsToRename = nonCompliantItems.value.filter(
      item => selectedIds.value.includes(item.variable.id) && item.suggestion
    )

    if (props.isProtected) {
      for (const item of itemsToRename) {
        await submitChange({
          environmentId: props.environmentId,
          action: 'update',
          variableId: item.variable.id,
          key: item.suggestion!,
          value: item.variable.value,
          isSecret: item.variable.is_secret,
          comment: 'Renamed to comply with naming conventions'
        })
      }
      $toast.success(`${itemsToRename.length} rename(s) submitted for approval`)
    } else {
      for (const item of itemsToRename) {
        const { error } = await supabase
          .from('variables')
          .update({ key: item.suggestion! })
          .eq('id', item.variable.id)

        if (error) throw error
      }
      $toast.success(`${itemsToRename.length} variable(s) renamed successfully`)
    }

    emit('renamed')
    close()
  } catch (err) {
    console.error('[NamingAuditModal] Failed to apply renames:', err)
    $toast.error('Failed to apply renames')
  } finally {
    applying.value = false
  }
}

watch(() => props.modelValue, (open) => {
  if (open) {
    runAudit()
  }
})
</script>
