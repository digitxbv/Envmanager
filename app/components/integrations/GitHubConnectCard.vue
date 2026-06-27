<template>
  <div class="rounded-lg border bg-card p-6">
    <div class="flex items-start justify-between">
      <div class="flex items-center gap-4">
        <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-[#24292f] text-white">
          <Icon name="lucide:github" class="h-5 w-5" />
        </div>
        <div>
          <h3 class="text-lg font-semibold">GitHub</h3>
          <p class="text-sm text-muted-foreground">
            Sync environment variables and secrets to GitHub Actions
          </p>
        </div>
      </div>

      <div v-if="isConnected" class="flex items-center gap-2">
        <span class="inline-flex items-center rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-medium text-success">
          <Icon name="lucide:check-circle" class="mr-1 h-4 w-4" />
          Connected
        </span>
      </div>
    </div>

    <!-- Connection details when connected -->
    <div v-if="isConnected && normalizedInstallations.length > 0" class="mt-6 space-y-4">
      <div class="space-y-2">
        <div
          v-for="item in normalizedInstallations"
          :key="item.id"
          class="flex items-center gap-3 rounded-md bg-muted/50 p-3"
        >
          <Icon
            :name="item.account_type === 'Organization' ? 'lucide:building-2' : 'lucide:user'"
            class="h-5 w-5 text-muted-foreground"
          />
          <div class="flex-1 min-w-0">
            <p class="font-medium truncate">{{ item.account_login }}</p>
            <p class="text-xs text-muted-foreground">
              {{ item.account_type }} account
            </p>
          </div>
          <div class="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
            <Icon name="lucide:calendar" class="h-4 w-4" />
            Connected {{ formatDate(item.installed_at) }}
          </div>

          <Menu as="div" class="relative shrink-0">
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
                class="absolute right-0 mt-2 w-52 origin-top-right rounded-md border bg-popover shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10"
              >
                <div class="py-1">
                  <MenuItem v-slot="{ active }">
                    <a
                      :href="manageOnGitHubUrl(item)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="w-full flex items-center px-4 py-2 text-sm"
                      :class="active ? 'bg-muted' : ''"
                    >
                      <Icon name="lucide:external-link" class="mr-2 h-4 w-4" />
                      Manage on GitHub
                    </a>
                  </MenuItem>
                  <MenuItem v-slot="{ active }">
                    <button
                      type="button"
                      class="w-full flex items-center px-4 py-2 text-sm text-destructive"
                      :class="active ? 'bg-muted' : ''"
                      @click="openDisconnectModal(item)"
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
      </div>

      <div class="flex justify-end">
        <Button variant="outline" size="sm" @click="handleConnect">
          <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
          Add account or organization
        </Button>
      </div>
    </div>

    <!-- Connect button when not connected -->
    <div v-else class="mt-6">
      <Button
        @click="handleConnect"
        :loading="loading"
      >
        <Icon name="lucide:github" class="mr-2 h-4 w-4" />
        Connect GitHub
      </Button>
      <p class="mt-2 text-xs text-muted-foreground">
        Install the EnvManager GitHub App for a personal account or organization
      </p>
    </div>

    <Dialog
      :open="showDisconnectModal"
      max-width="default"
      title="Disconnect GitHub?"
      :description="disconnectDescription"
      @close="showDisconnectModal = false"
    >
      <div class="rounded-md border border-warning/30 bg-warning/10 p-3">
        <div class="flex items-start gap-2">
          <Icon name="lucide:alert-circle" class="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <p class="text-sm text-foreground">
            All project sync configurations using this connection will be permanently deleted.
          </p>
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

const props = defineProps<{
  organizationId: string
  installation: {
    id: string
    installation_id: number
    account_login: string
    account_type: string
    installed_at: string
  } | null
  installations?: Array<{
    id: string
    installation_id: number
    account_login: string
    account_type: string
    installed_at: string
  }>
  isConnected: boolean
  loading: boolean
}>()

const emit = defineEmits<{
  connect: []
  disconnect: [installationId?: string]
}>()

// =====================================================
// State
// =====================================================

const showDisconnectModal = ref(false)
const disconnecting = ref(false)
const pendingDisconnect = ref<{
  id: string
  account_login: string
} | null>(null)

const normalizedInstallations = computed(() => {
  if (props.installations?.length) return props.installations
  return props.installation ? [props.installation] : []
})

const disconnectDescription = computed(() => {
  if (!pendingDisconnect.value) return 'This will remove the GitHub connection from your organization.'
  return `This will remove ${pendingDisconnect.value.account_login} from your EnvManager organization.`
})

const manageOnGitHubUrl = (item: {
  installation_id: number
  account_login: string
  account_type: string
}) => {
  const { installation_id, account_login, account_type } = item
  if (account_type === 'Organization') {
    return `https://github.com/organizations/${account_login}/settings/installations/${installation_id}`
  }
  return `https://github.com/settings/installations/${installation_id}`
}

// =====================================================
// Methods
// =====================================================

const handleConnect = () => {
  emit('connect')
}

const openDisconnectModal = (item: { id: string; account_login: string }) => {
  pendingDisconnect.value = item
  showDisconnectModal.value = true
}

const handleDisconnect = async () => {
  disconnecting.value = true
  try {
    emit('disconnect', pendingDisconnect.value?.id)
    showDisconnectModal.value = false
    pendingDisconnect.value = null
  } finally {
    disconnecting.value = false
  }
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  })
}
</script>
