<template>
  <div class="rounded-lg border bg-card p-6">
    <!-- Header -->
    <div class="flex items-start justify-between">
      <div class="flex items-center gap-4">
        <!-- Platform Icon -->
        <div
          class="flex h-12 w-12 items-center justify-center rounded-lg text-white"
          :style="{ backgroundColor: platform.color }"
        >
          <Icon :name="platform.icon || 'lucide:server'" class="h-5 w-5" />
        </div>

        <!-- Platform Info -->
        <div>
          <h3 class="text-lg font-semibold">{{ platform.name }}</h3>
          <p class="text-sm text-muted-foreground">
            {{ platform.description }}
          </p>
        </div>
      </div>

      <!-- Connected Badge -->
      <div v-if="connection" class="flex items-center gap-2">
        <span class="inline-flex items-center rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-medium text-success">
          <Icon name="lucide:check-circle" class="mr-1 h-4 w-4" />
          Connected
        </span>
      </div>
    </div>

    <!-- Connected State -->
    <div v-if="connection" class="mt-6 space-y-4">
      <!-- Connection Info Bar -->
      <div class="flex items-center gap-3 rounded-md bg-muted/50 p-3">
        <Icon name="lucide:link" class="h-5 w-5 text-muted-foreground" />
        <div class="flex-1 min-w-0">
          <p class="font-medium truncate">{{ connection.name }}</p>
          <p v-if="connection.instance_url" class="text-xs text-muted-foreground truncate">
            {{ connection.instance_url }}
          </p>
        </div>

        <!-- Project Count Badge -->
         <div class="shrink-0">
           <span class="inline-flex items-center rounded-full bg-info/15 px-2.5 py-0.5 text-xs font-medium text-info">
             <Icon name="lucide:folder" class="mr-1 h-4 w-4" />
             Used by {{ projectCount }} {{ projectCount === 1 ? 'project' : 'projects' }}
           </span>
         </div>
      </div>

      <!-- Actions (only if canManage) -->
      <div v-if="canManage" class="flex items-center justify-end">
        <!-- Dropdown Menu -->
        <Menu as="div" class="relative">
          <MenuButton as="template">
            <Button variant="outline" size="sm">
              <Icon name="lucide:more-horizontal" class="h-4 w-4" />
            </Button>
          </MenuButton>

          <transition
            enter-active-class="transition duration-100 ease-out"
            enter-from-class="transform scale-95 opacity-0"
            enter-to-class="transform scale-100 opacity-100"
            leave-active-class="transition duration-75 ease-in"
            leave-from-class="transform scale-100 opacity-100"
            leave-to-class="transform scale-95 opacity-0"
          >
            <MenuItems
              class="absolute right-0 mt-2 w-48 origin-top-right rounded-md border bg-popover shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10"
            >
              <div class="py-1">
                <MenuItem v-slot="{ active }">
                  <button
                    type="button"
                    class="w-full flex items-center px-4 py-2 text-sm text-destructive"
                    :class="active ? 'bg-muted' : ''"
                    @click="showDisconnectModal = true"
                  >
                    <Icon name="lucide:unlink" class="mr-2 h-4 w-4" />
                    Disconnect
                  </button>
                </MenuItem>
              </div>
            </MenuItems>
          </transition>
        </Menu>
      </div>

      <!-- No Manage Permission -->
      <div v-else class="text-sm text-muted-foreground">
        <Icon name="lucide:shield" class="inline h-4 w-4 mr-1" />
        Contact an admin to manage this integration
      </div>
    </div>

    <!-- Disconnected State -->
    <div v-else class="mt-6">
      <Button
        v-if="canManage"
        @click="$emit('connect')"
        :loading="loading"
      >
        <Icon :name="platform.icon || 'lucide:server'" class="mr-2 h-4 w-4" />
        Connect {{ platform.name }}
      </Button>
      <Button
        v-else
        variant="outline"
        disabled
      >
        <Icon name="lucide:shield" class="mr-2 h-4 w-4" />
        Admin required
      </Button>
      <p class="mt-2 text-xs text-muted-foreground">
        Connect your {{ platform.name }} account to use across all organization projects
      </p>
    </div>

    <Dialog
      :open="showDisconnectModal"
      max-width="default"
      :title="`Disconnect ${platform.name}?`"
      :description="`This will remove the ${platform.name} connection from your organization.`"
      @close="showDisconnectModal = false"
    >
      <div v-if="projectCount > 0" class="rounded-md border border-warning/30 bg-warning/10 p-3">
        <div class="flex items-start gap-2">
          <Icon name="lucide:alert-circle" class="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div class="text-sm text-foreground">
            <p class="font-medium">
              This will disable {{ projectCount }} project {{ projectCount === 1 ? 'configuration' : 'configurations' }}
            </p>
            <p class="mt-1 text-muted-foreground">
              All project sync configurations using this connection will be permanently deleted.
            </p>
          </div>
        </div>
      </div>

      <div class="mt-6 flex justify-end gap-2 border-t border-border pt-4">
        <Button
          variant="outline"
          @click="showDisconnectModal = false"
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          :loading="disconnecting"
          @click="handleDisconnect"
        >
          Disconnect
        </Button>
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue'
import Button from '~/components/ui/Button.vue'
import Dialog from '~/components/ui/Dialog.vue'
import type { PlatformConfig, PlatformConnection } from '~/types/integration.types'

interface Props {
  platform: PlatformConfig
  connection: PlatformConnection | null
  projectCount: number
  canManage?: boolean
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  canManage: true,
  loading: false
})

const emit = defineEmits<{
  connect: []
  disconnect: []
}>()

// =====================================================
// State
// =====================================================

const showDisconnectModal = ref(false)
const disconnecting = ref(false)

// =====================================================
// Methods
// =====================================================

async function handleDisconnect() {
  disconnecting.value = true
  try {
    emit('disconnect')
    showDisconnectModal.value = false
  } finally {
    disconnecting.value = false
  }
}
</script>
