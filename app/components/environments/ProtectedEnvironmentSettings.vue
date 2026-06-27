<template>
  <div class="space-y-4">
    <!-- Protection Toggle -->
    <div class="flex items-center gap-3">
      <input
        type="checkbox"
        :id="`protect-env-${environmentId}`"
        :checked="isProtected"
        @change="$emit('update:isProtected', ($event.target as HTMLInputElement).checked)"
        class="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-primary cursor-pointer"
      />
      <label :for="`protect-env-${environmentId}`" class="cursor-pointer">
        <span class="text-sm font-medium">Require Approval</span>
        <p class="text-xs text-muted-foreground">
          When enabled, all variable changes must be approved before taking effect.
        </p>
      </label>
    </div>

    <!-- Protected Settings (when enabled) -->
    <div v-if="isProtected" class="pl-4 border-l-2 border-muted space-y-4">
      <!-- Approval Mode -->
      <div class="space-y-2">
        <label :for="`approval-mode-${environmentId}`" class="text-sm font-medium">
          Approval Mode
        </label>
        <select
          :id="`approval-mode-${environmentId}`"
          :value="approvalMode"
          @change="$emit('update:approvalMode', ($event.target as HTMLSelectElement).value)"
          class="flex w-full rounded-md border border-input bg-card text-card-foreground px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-ring/50 focus:border-ring transition-all duration-200"
        >
          <option value="single">Single Approver - Any team member can approve</option>
          <option value="specific">Specific Approvers Only - Only designated users can approve</option>
          <option value="two_person">Two-Person Approval - Requires 2 different approvers</option>
        </select>
      </div>

      <!-- Approvers List (only for 'specific' mode) -->
      <div v-if="approvalMode === 'specific'" class="space-y-3">
        <label class="text-sm font-medium">Designated Approvers</label>

        <div v-if="approvers.length === 0" class="text-sm text-muted-foreground">
          No approvers configured. Add team members who can approve changes.
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="approver in approvers"
            :key="approver.id"
            class="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2"
          >
            <span class="text-sm">{{ approver.email || approver.user_id }}</span>
            <button
              type="button"
              @click="$emit('removeApprover', approver.id)"
              class="text-muted-foreground hover:text-destructive transition-colors"
            >
              <Icon name="lucide:x" class="h-4 w-4" />
            </button>
          </div>
        </div>

        <button
          type="button"
          @click="showAddApprover = true"
          class="text-sm text-primary hover:underline flex items-center gap-1"
        >
          <Icon name="lucide:plus" class="h-4 w-4" />
          Add Approver
        </button>
      </div>

      <!-- Auto-expire -->
      <div class="space-y-2">
        <label :for="`auto-expire-${environmentId}`" class="text-sm font-medium">
          Auto-expire Pending Changes
        </label>
        <select
          :id="`auto-expire-${environmentId}`"
          :value="autoExpireHours"
          @change="$emit('update:autoExpireHours', Number(($event.target as HTMLSelectElement).value))"
          class="flex w-full rounded-md border border-input bg-card text-card-foreground px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-ring/50 focus:border-ring transition-all duration-200"
        >
          <option :value="0">Never</option>
          <option :value="24">After 24 hours</option>
          <option :value="48">After 48 hours</option>
          <option :value="72">After 72 hours</option>
          <option :value="168">After 1 week</option>
        </select>
        <p class="text-xs text-muted-foreground">
          Pending changes that are not approved within this time will be automatically rejected.
        </p>
      </div>
    </div>

    <!-- Add Approver Modal -->
    <Teleport to="body">
      <div
        v-if="showAddApprover"
        class="fixed inset-0 bg-background/80 z-50 flex items-center justify-center"
        @click="showAddApprover = false"
      >
        <div
          class="bg-card rounded-lg shadow-lg border w-full max-w-sm overflow-hidden"
          @click.stop
        >
          <div class="p-6">
            <h3 class="text-lg font-medium mb-4">Add Approver</h3>
            <div class="space-y-4">
              <div class="space-y-2">
                <label for="approver-user-id" class="text-sm font-medium">User ID</label>
                <input
                  id="approver-user-id"
                  v-model="newApproverUserId"
                  type="text"
                  placeholder="Enter user ID"
                  class="flex w-full rounded-md border border-input bg-card text-card-foreground px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-ring/50 focus:border-ring transition-all duration-200"
                />
              </div>
              <div class="flex justify-end space-x-2">
                <button
                  type="button"
                  @click="showAddApprover = false"
                  class="inline-flex items-center justify-center rounded-md text-sm font-medium px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  @click="addApprover"
                  :disabled="!newApproverUserId.trim()"
                  class="inline-flex items-center justify-center rounded-md text-sm font-medium px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  environmentId: string
  isProtected: boolean
  approvalMode: 'single' | 'specific' | 'two_person' | null
  autoExpireHours: number
  approvers: Array<{ id: string; user_id: string; email?: string }>
}>()

const emit = defineEmits<{
  'update:isProtected': [value: boolean]
  'update:approvalMode': [value: string]
  'update:autoExpireHours': [value: number]
  'addApprover': [userId: string]
  'removeApprover': [approverId: string]
}>()

const showAddApprover = ref(false)
const newApproverUserId = ref('')

const addApprover = () => {
  if (newApproverUserId.value.trim()) {
    emit('addApprover', newApproverUserId.value.trim())
    newApproverUserId.value = ''
    showAddApprover.value = false
  }
}
</script>
