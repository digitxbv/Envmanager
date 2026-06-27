<template>
  <Dialog
    :open="open"
    max-width="default"
    :title="`Disconnect ${platform.name}?`"
    :description="`This will affect ${projects.length} ${projects.length === 1 ? 'project' : 'projects'}.`"
    @close="$emit('close')"
  >
    <div class="space-y-4">
      <div class="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-foreground">
        <p class="mb-2 font-medium">This action will:</p>
        <ul class="list-disc list-inside space-y-1 text-xs text-muted-foreground">
          <li>Disconnect {{ platform.name }} from your organization</li>
          <li>Stop all automatic syncing for affected projects</li>
          <li>Require manual reconnection per project</li>
        </ul>
      </div>

      <div>
        <p class="mb-2 text-sm font-medium">Affected projects:</p>
        <div class="max-h-48 overflow-y-auto rounded-md border border-border bg-muted/40 p-3">
          <ul class="space-y-2">
            <li
              v-for="project in projects"
              :key="project.id"
              class="flex items-center gap-2 text-sm text-foreground"
            >
              <Icon name="lucide:folder" class="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{{ project.name }}</span>
            </li>
          </ul>
        </div>
      </div>

      <div>
        <label class="mb-2 block text-sm font-medium">
          Type <code class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">DISCONNECT</code> to confirm
        </label>
        <Input
          v-model="confirmText"
          type="text"
          placeholder="Type DISCONNECT"
          @keydown.enter="handleConfirm"
        />
      </div>
    </div>

    <div class="mt-6 flex items-center justify-end gap-2 border-t border-border pt-4">
      <Button
        variant="outline"
        @click="$emit('close')"
      >
        Cancel
      </Button>
      <Button
        variant="destructive"
        :disabled="!isConfirmed"
        @click="handleConfirm"
      >
        <Icon name="lucide:unlink" class="mr-2 h-4 w-4" />
        Disconnect
      </Button>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import Button from '~/components/ui/Button.vue'
import Dialog from '~/components/ui/Dialog.vue'
import Input from '~/components/ui/Input.vue'
import type { PlatformConfig } from '~/types/integration.types'

interface Props {
  open: boolean
  platform: PlatformConfig
  projects: Array<{ id: string; name: string }>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  confirm: []
}>()

// =====================================================
// State
// =====================================================

const confirmText = ref('')

// =====================================================
// Computed
// =====================================================

const isConfirmed = computed(() => confirmText.value === 'DISCONNECT')

// =====================================================
// Watchers
// =====================================================

// Reset confirmation text when modal closes
watch(() => props.open, (newOpen) => {
  if (!newOpen) {
    confirmText.value = ''
  }
})

// =====================================================
// Methods
// =====================================================

function handleConfirm() {
  if (isConfirmed.value) {
    emit('confirm')
  }
}
</script>
