<template>
  <div class="space-y-4">
    <!-- Search -->
    <div v-if="proxyFunctions.length > 0" class="flex items-center gap-3">
      <div class="relative flex-1 max-w-sm">
        <Icon name="lucide:search" class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search proxies..."
          class="flex h-9 w-full rounded-md border border-input bg-card text-card-foreground pl-9 pr-3 py-2 text-sm ring-offset-background transition-all duration-200 placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-ring/50 focus:border-ring"
        />
      </div>
    </div>

    <!-- Loading -->
    <LoadingSpinner v-if="loading" class="py-12" />

    <!-- Empty state -->
    <EmptyState
      v-else-if="proxyFunctions.length === 0"
      icon="lucide:shield"
      title="No proxy functions yet"
      description="Proxy functions let you expose API calls from your static site without leaking secrets. Create your first proxy to get started."
    >
      <Button v-if="isAdmin" size="sm" @click="emit('create')">
        <Icon name="lucide:plus" class="mr-1.5 h-4 w-4" />
        Create Proxy Function
      </Button>
    </EmptyState>

    <!-- No search results -->
    <div v-else-if="filteredProxies.length === 0" class="text-center py-12">
      <p class="text-sm text-muted-foreground">No proxies matching "{{ searchQuery }}"</p>
    </div>

    <!-- Table -->
    <DataTable
      v-else
      :columns="tableColumns"
      :data="tableData"
      empty-message="No proxy functions found."
    >
      <!-- Name cell -->
      <template #cell-name="{ row }">
        <div>
          <span class="font-medium text-foreground">{{ row.name }}</span>
          <p v-if="row.description" class="text-xs text-muted-foreground truncate max-w-[200px]">
            {{ row.description }}
          </p>
        </div>
      </template>

      <!-- Target URL cell -->
      <template #cell-target_url="{ row }">
        <span class="font-mono text-sm text-muted-foreground truncate max-w-[200px] inline-block">
          {{ row.target_url }}
        </span>
      </template>

      <!-- Method cell -->
      <template #cell-method="{ row }">
        <div class="flex items-center gap-1.5">
          <Badge variant="default" size="sm">{{ row.http_method }}</Badge>
          <Badge v-if="row.rate_limit_per_minute != null" variant="outline" size="sm">
            <Icon name="lucide:gauge" class="h-3 w-3 mr-1" />
            {{ row.rate_limit_per_minute }}/min
          </Badge>
        </div>
      </template>

      <!-- Enabled cell -->
      <template #cell-enabled="{ row }">
        <div class="flex items-center gap-2">
          <span
            class="h-2 w-2 rounded-full"
            :class="row.enabled ? 'bg-green-500' : 'bg-red-400'"
          />
          <span class="text-sm" :class="row.enabled ? 'text-green-600' : 'text-muted-foreground'">
            {{ row.enabled ? 'Active' : 'Disabled' }}
          </span>
        </div>
      </template>

      <!-- Created cell -->
      <template #cell-created="{ row }">
        <span class="text-sm text-muted-foreground">{{ formatRelativeDate(String(row.created_at)) }}</span>
      </template>

      <!-- Template cell -->
      <template #cell-template="{ row }">
        <Badge v-if="row.template_id" variant="outline" size="sm">
          <Icon name="lucide:file-code" class="h-3 w-3 mr-1" />
          Template
        </Badge>
        <span v-else class="text-xs text-muted-foreground">Custom</span>
      </template>

      <!-- Actions cell -->
      <template #cell-actions="{ row }">
        <div class="flex items-center justify-end gap-1">
          <!-- Copy URL -->
          <Tooltip content="Copy proxy URL">
            <Button variant="ghost" size="icon" @click="copyUrl(toProxy(row))">
              <Icon name="lucide:link" class="h-4 w-4" />
            </Button>
          </Tooltip>

          <!-- Test -->
          <Tooltip content="Test proxy">
            <Button variant="ghost" size="icon" @click="emit('test', toProxy(row))">
              <Icon name="lucide:play" class="h-4 w-4" />
            </Button>
          </Tooltip>

          <!-- Overflow menu -->
          <Dropdown align="right" width="12rem">
            <template #trigger>
              <Button variant="ghost" size="icon">
                <Icon name="lucide:more-horizontal" class="h-4 w-4" />
              </Button>
            </template>
            <template #content="{ close }">
              <!-- Edit (admin only) -->
              <button
                v-if="isAdmin"
                class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
                @click="close(); emit('edit', toProxy(row))"
              >
                <Icon name="lucide:pencil" class="h-4 w-4 text-muted-foreground" />
                Edit
              </button>

              <!-- Enable/Disable (admin only) -->
              <button
                v-if="isAdmin"
                class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
                @click="close(); emit('toggle-enabled', toProxy(row))"
              >
                <Icon
                  :name="row.enabled ? 'lucide:pause' : 'lucide:play'"
                  class="h-4 w-4 text-muted-foreground"
                />
                {{ row.enabled ? 'Disable' : 'Enable' }}
              </button>

              <!-- Copy Token -->
              <button
                class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
                @click="close(); copyToken(toProxy(row))"
              >
                <Icon name="lucide:key" class="h-4 w-4 text-muted-foreground" />
                Copy Token
              </button>

              <!-- Download Code -->
              <button
                class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
                @click="close(); emit('download', toProxy(row))"
              >
                <Icon name="lucide:download" class="h-4 w-4 text-muted-foreground" />
                Download Code
              </button>

              <!-- Regenerate Token (admin only) -->
              <button
                v-if="isAdmin"
                class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
                @click="close(); emit('regenerate-token', toProxy(row))"
              >
                <Icon name="lucide:refresh-cw" class="h-4 w-4 text-muted-foreground" />
                Regenerate Token
              </button>

              <!-- Delete (admin only) -->
              <button
                v-if="isAdmin"
                class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors"
                @click="close(); emit('delete', toProxy(row))"
              >
                <Icon name="lucide:trash" class="h-4 w-4" />
                Delete
              </button>
            </template>
          </Dropdown>
        </div>
      </template>
    </DataTable>
  </div>
</template>

<script setup lang="ts">
import type { ProxyFunction } from '~/types/proxy.types'
import Button from '~/components/ui/Button.vue'
import Tooltip from '~/components/ui/Tooltip.vue'
import { formatRelativeDate } from '~/lib/date-utils'
import { getProxyHandlerUrl } from '~/lib/proxy-utils'

interface Props {
  proxyFunctions: readonly ProxyFunction[]
  loading: boolean
  isAdmin: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  create: []
  edit: [proxy: ProxyFunction]
  delete: [proxy: ProxyFunction]
  'toggle-enabled': [proxy: ProxyFunction]
  'regenerate-token': [proxy: ProxyFunction]
  test: [proxy: ProxyFunction]
  download: [proxy: ProxyFunction]
}>()

const config = useRuntimeConfig()
const { $toast } = useNuxtApp()

const searchQuery = ref('')

const tableColumns = [
  { key: 'name', label: 'Name' },
  { key: 'target_url', label: 'Target URL' },
  { key: 'method', label: 'Method / Rate' },
  { key: 'enabled', label: 'Status' },
  { key: 'created', label: 'Created' },
  { key: 'template', label: 'Template' },
  { key: 'actions', label: 'Actions', class: 'text-right' }
]

const filteredProxies = computed(() => {
  if (!searchQuery.value.trim()) return props.proxyFunctions
  const q = searchQuery.value.toLowerCase()
  return props.proxyFunctions.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.target_url.toLowerCase().includes(q)
  )
})

// Cast filtered proxies to Record<string, unknown>[] for DataTable generic constraint
const tableData = computed(() => {
  return filteredProxies.value as unknown as Record<string, unknown>[]
})

// Cast row back to ProxyFunction for typed operations
function toProxy(row: Record<string, unknown>): ProxyFunction {
  return row as unknown as ProxyFunction
}

async function copyUrl(proxy: ProxyFunction) {
  const supabaseUrl = config.public.supabase?.url || 'http://127.0.0.1:54431'
  const url = getProxyHandlerUrl(supabaseUrl, proxy.id)
  try {
    await navigator.clipboard.writeText(url)
    $toast.success('Proxy URL copied')
  } catch {
    $toast.error('Failed to copy URL')
  }
}

async function copyToken(proxy: ProxyFunction) {
  try {
    await navigator.clipboard.writeText(proxy.secret_token)
    $toast.success('Token copied')
  } catch {
    $toast.error('Failed to copy token')
  }
}
</script>
