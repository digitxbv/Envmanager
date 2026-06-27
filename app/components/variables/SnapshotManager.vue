<template>
  <div class="relative">
    <!-- Trigger button (hidden in headless mode — parent controls visibility) -->
    <template v-if="!headless">
      <button v-if="inline" class="dropdown-item" @click="showPanel = !showPanel">
        <Icon name="lucide:camera" class="h-4 w-4 text-muted-foreground" />
        Snapshots
      </button>
      <Button v-else variant="outline" @click="showPanel = !showPanel">
        <Icon name="lucide:camera" class="h-4 w-4 mr-2" />
        Snapshots
        <span v-if="snapshots.length" class="ml-1 text-xs text-muted-foreground">({{ snapshots.length }})</span>
      </Button>
    </template>

    <!-- Dropdown panel -->
    <Teleport to="body">
      <div
        v-if="showPanel"
        class="fixed inset-0 z-40"
        @click="showPanel = false"
      />
      <div
        v-if="showPanel"
        class="fixed right-4 top-48 z-50 bg-card rounded-lg shadow-lg border w-96 max-h-[500px] flex flex-col"
        @click.stop
      >
        <!-- Header -->
        <div class="flex items-center justify-between p-3 border-b">
          <h4 class="text-sm font-medium">Environment Snapshots</h4>
          <Button variant="ghost" size="sm" class="h-7" @click="showCreateForm = !showCreateForm">
            <Icon name="lucide:plus" class="h-3.5 w-3.5 mr-1" />
            Create
          </Button>
        </div>

        <!-- Create form -->
        <div v-if="showCreateForm" class="p-3 border-b bg-muted/30 space-y-2">
          <input
            v-model="createForm.name"
            class="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            placeholder="Snapshot name (e.g., pre-deployment)"
          />
          <input
            v-model="createForm.description"
            class="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            placeholder="Description (optional)"
          />
          <div class="flex justify-end gap-2">
            <Button variant="ghost" size="sm" class="h-7" @click="showCreateForm = false">Cancel</Button>
            <Button
              size="sm"
              class="h-7"
              :disabled="!createForm.name.trim()"
              :loading="creating"
              @click="handleCreate"
            >
              Save Snapshot
            </Button>
          </div>
        </div>

        <!-- Snapshot list -->
        <div class="flex-1 overflow-y-auto">
          <!-- Loading -->
          <div v-if="loading && !snapshots.length" class="flex items-center justify-center py-6">
            <Icon name="lucide:loader-2" class="h-4 w-4 animate-spin text-muted-foreground" />
          </div>

          <!-- Empty state -->
          <div v-else-if="!snapshots.length" class="text-center py-6 text-sm text-muted-foreground">
            <Icon name="lucide:camera-off" class="h-6 w-6 mx-auto mb-2 opacity-50" />
            <p>No snapshots yet</p>
          </div>

          <!-- List -->
          <div v-else class="divide-y">
            <div
              v-for="snapshot in snapshots"
              :key="snapshot.id"
              class="p-3 hover:bg-muted/50 transition-colors"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <div class="text-sm font-medium truncate">{{ snapshot.name }}</div>
                  <div class="text-xs text-muted-foreground">
                    {{ snapshot.variable_count }} variables &middot; {{ formatDate(snapshot.created_at) }}
                  </div>
                  <div v-if="snapshot.description" class="text-xs text-muted-foreground mt-0.5 truncate">
                    {{ snapshot.description }}
                  </div>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-7 text-xs"
                    @click="handleCompare(snapshot)"
                  >
                    Compare
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-7 text-xs"
                    @click="startRestore(snapshot)"
                  >
                    Restore
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Restore confirmation -->
        <div v-if="restoreTarget" class="border-t p-3 bg-muted/30">
          <p class="text-sm mb-2">
            Restore <span class="font-medium">{{ restoreTarget.name }}</span>?
          </p>
           <p v-if="isProtected" class="text-xs text-warning mb-2">
            Changes will be submitted for approval.
          </p>
          <input
            v-model="restoreReason"
            class="w-full rounded-md border bg-background px-3 py-1.5 text-sm mb-2"
            placeholder="Reason (optional)"
          />
          <div class="flex justify-end gap-2">
            <Button variant="ghost" size="sm" class="h-7" @click="restoreTarget = null">Cancel</Button>
            <Button size="sm" class="h-7" :loading="restoring" @click="handleRestore">
              {{ isProtected ? 'Submit for approval' : 'Restore' }}
            </Button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Compare view modal -->
    <SnapshotCompareView
      :open="!!compareData"
      :snapshot-name="compareSnapshotName"
      :loading="comparing"
      :diff="compareData"
      @close="compareData = null"
    />
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/Button.vue'
import SnapshotCompareView from './SnapshotCompareView.vue'

const props = defineProps<{
  environmentId: string
  organizationId: string
  isProtected: boolean
  inline?: boolean
  headless?: boolean
  open?: boolean
}>()

const emit = defineEmits<{
  restored: []
  close: []
}>()

const { $toast } = useNuxtApp()
const { snapshots, loading, createSnapshot, compareToCurrentState, restoreSnapshot, listSnapshots } = useEnvironmentSnapshots(
  computed(() => props.environmentId)
)

const showPanel = ref(false)

// In headless mode, parent controls visibility via `open` prop
watch(() => props.open, (val) => {
  if (val) showPanel.value = true
})

// When panel closes, notify parent
watch(showPanel, (val) => {
  if (!val) emit('close')
})
const showCreateForm = ref(false)
const creating = ref(false)
const createForm = reactive({ name: '', description: '' })

const restoreTarget = ref<any>(null)
const restoreReason = ref('')
const restoring = ref(false)

const compareData = ref<any>(null)
const compareSnapshotName = ref('')
const comparing = ref(false)

// Load snapshots when panel opens
watch(showPanel, (open) => {
  if (open) listSnapshots()
})

async function handleCreate() {
  if (!createForm.name.trim()) return
  creating.value = true
  try {
    await createSnapshot(createForm.name.trim(), createForm.description.trim() || undefined)
    $toast.success('Snapshot created')
    createForm.name = ''
    createForm.description = ''
    showCreateForm.value = false
  } catch (e: any) {
    $toast.error(e.message || 'Failed to create snapshot')
  } finally {
    creating.value = false
  }
}

async function handleCompare(snapshot: any) {
  comparing.value = true
  compareSnapshotName.value = snapshot.name
  compareData.value = null
  try {
    const diff = await compareToCurrentState(snapshot.id)
    compareData.value = diff
  } catch (e: any) {
    $toast.error(e.message || 'Failed to compare')
  } finally {
    comparing.value = false
  }
}

function startRestore(snapshot: any) {
  restoreTarget.value = snapshot
  restoreReason.value = ''
}

async function handleRestore() {
  if (!restoreTarget.value) return
  restoring.value = true
  try {
    const result = await restoreSnapshot(
      restoreTarget.value.id,
      restoreReason.value || `Restored from snapshot: ${restoreTarget.value.name}`
    )
    if (result.pending > 0) {
      $toast.success(`${result.pending} changes submitted for approval`)
    } else {
      $toast.success(`Restored: ${result.added} added, ${result.modified} modified`)
    }
    restoreTarget.value = null
    showPanel.value = false
    emit('restored')
  } catch (e: any) {
    $toast.error(e.message || 'Failed to restore')
  } finally {
    restoring.value = false
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>
