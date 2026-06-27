<template>
  <div class="px-4 md:px-6 lg:px-8 py-6">
    <!-- Loading -->
    <LoadingSpinner v-if="loading" class="py-20" />

    <template v-else-if="project">
      <div class="space-y-6">
        <!-- Header -->
        <PageHeader title="Proxy Functions" description="Secure API proxies for your static sites">
          <template #actions>
            <div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Button variant="outline" size="sm" @click="navigateTo(`/dashboard/projects/${project.id}`)">
                <Icon name="lucide:arrow-left" class="mr-1.5 h-4 w-4" />
                Back to Project
              </Button>
              <Button v-if="isAdmin && activePageTab === 'proxies'" size="sm" @click="handleCreateProxy">
                <Icon name="lucide:plus" class="mr-1.5 h-4 w-4" />
                Create Proxy
              </Button>
            </div>
          </template>
        </PageHeader>

        <!-- Top-level tabs: Proxies / Analytics -->
        <Tabs v-model="activePageTab">
          <TabsList>
            <TabsTrigger value="proxies">
              <Icon name="lucide:shield" class="mr-1.5 h-4 w-4" />
              Proxies
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <Icon name="lucide:bar-chart-2" class="mr-1.5 h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <!-- Proxies tab -->
          <TabsContent value="proxies">
            <!-- Environment Selector -->
            <div v-if="environments.length > 0" class="mt-4">
              <Tabs v-model="activeTabId">
                <TabsList>
                  <TabsTrigger
                    v-for="env in environments"
                    :key="env.id"
                    :value="env.id"
                  >
                    {{ env.name }}
                  </TabsTrigger>
                </TabsList>

                <TabsContent
                  v-for="env in environments"
                  :key="'proxy-content-' + env.id"
                  :value="env.id"
                >
                  <ProxyFunctionList
                    :proxy-functions="proxyFunctions"
                    :loading="proxyLoading"
                    :is-admin="isAdmin"
                    @create="handleCreateProxy"
                    @edit="handleEditProxy"
                    @delete="confirmDeleteProxy"
                    @toggle-enabled="handleToggleEnabled"
                    @regenerate-token="confirmRegenerateToken"
                    @test="openTestPanel"
                    @download="openDownloadModal"
                  />
                </TabsContent>
              </Tabs>
            </div>

            <!-- No environments -->
            <EmptyState
              v-else
              class="mt-4"
              icon="lucide:layers"
              title="No environments"
              description="Create environments in project settings first."
            >
              <Button variant="outline" size="sm" @click="navigateTo(`/dashboard/projects/${project.id}/settings`)">
                <Icon name="lucide:settings" class="mr-1.5 h-4 w-4" />
                Go to Settings
              </Button>
            </EmptyState>
          </TabsContent>

          <!-- Analytics tab -->
          <TabsContent value="analytics">
            <div class="mt-4">
              <ProxyAnalyticsDashboard
                :organization-id="project.organization_id"
                :proxies="allProxiesForFilter"
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <!-- Builder Modal -->
      <ProxyBuilderModal
        v-model="showBuilderModal"
        :environment-id="activeEnvironment?.id || ''"
        :organization-id="project.organization_id"
        :edit-proxy="editingProxy"
        @saved="handleProxySaved"
      />

      <!-- Delete Confirmation -->
      <ClientOnly>
        <Dialog
          :open="!!deletingProxy"
          title="Delete Proxy Function"
          :description="`Are you sure you want to delete '${deletingProxy?.name}'? This will permanently remove the proxy endpoint.`"
          max-width="sm"
          @close="deletingProxy = null"
        >
          <div class="flex justify-end gap-2 pt-2">
            <Button variant="outline" @click="deletingProxy = null">Cancel</Button>
            <Button variant="destructive" :loading="actionLoading" @click="handleDeleteProxy">Delete</Button>
          </div>
        </Dialog>
      </ClientOnly>

      <!-- Regenerate Token Confirmation -->
      <ClientOnly>
        <Dialog
          :open="!!regeneratingProxy"
          title="Regenerate Token"
          description="This will invalidate the current token. Any clients using the old token will stop working immediately."
          max-width="sm"
          @close="regeneratingProxy = null"
        >
          <div class="flex justify-end gap-2 pt-2">
            <Button variant="outline" @click="regeneratingProxy = null">Cancel</Button>
            <Button variant="destructive" :loading="actionLoading" @click="handleRegenerateToken">Regenerate</Button>
          </div>
        </Dialog>
      </ClientOnly>

      <!-- Test Panel -->
      <ProxyTestPanel
        :open="!!testingProxy"
        :proxy-function="testingProxy"
        @close="testingProxy = null"
      />

      <!-- Download Modal -->
      <ProxyDownloadModal
        v-model="showDownloadModal"
        :proxy-function="downloadingProxy"
        :variables="environmentVariables"
      />

    </template>
  </div>
</template>

<script setup lang="ts">
import type { Database } from '~/types/database.types'
import type { ProxyFunction } from '~/types/proxy.types'
import Button from '~/components/ui/Button.vue'
import Dialog from '~/components/ui/Dialog.vue'
import ProxyBuilderModal from '~/components/proxy/ProxyBuilderModal.vue'
import ProxyFunctionList from '~/components/proxy/ProxyFunctionList.vue'
import ProxyTestPanel from '~/components/proxy/ProxyTestPanel.vue'
import ProxyDownloadModal from '~/components/proxy/ProxyDownloadModal.vue'
import ProxyAnalyticsDashboard from '~/components/proxy/ProxyAnalyticsDashboard.vue'

type ProjectRow = Database['public']['Tables']['projects']['Row']
type EnvironmentRow = Database['public']['Tables']['environments']['Row']

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth']
})

const route = useRoute()
const projectId = String(route.params.id)
const client = useSupabaseClient<Database>()
const user = useSupabaseUser()
const { $toast } = useNuxtApp()

// Breadcrumbs
const breadcrumbs = inject('breadcrumbs', ref<Array<{ label: string; to?: string }>>([]))

// Page-level tab (Proxies vs Analytics)
const activePageTab = ref<'proxies' | 'analytics'>('proxies')

// State
const loading = ref(true)
const project = ref<ProjectRow | null>(null)
const environments = ref<EnvironmentRow[]>([])
const activeEnvironment = ref<EnvironmentRow | null>(null)
const organizationMembers = ref<{ user_id: string; email: string; role: string }[]>([])

// Proxy state
const showBuilderModal = ref(false)
const editingProxy = ref<ProxyFunction | null>(null)
const deletingProxy = ref<ProxyFunction | null>(null)
const regeneratingProxy = ref<ProxyFunction | null>(null)
const testingProxy = ref<ProxyFunction | null>(null)
const showDownloadModal = ref(false)
const downloadingProxy = ref<ProxyFunction | null>(null)
const environmentVariables = ref<{ id: string; key: string }[]>([])
const actionLoading = ref(false)
// Composable
const activeEnvironmentId = computed(() => activeEnvironment.value?.id || '')
const {
  proxyFunctions: proxyFunctionsRaw,
  loading: proxyLoading,
  fetchProxyFunctions,
  deleteProxyFunction,
  toggleEnabled,
  regenerateToken
} = useProxyFunctions(activeEnvironmentId)

// Unwrap deeply readonly type for component props
const proxyFunctions = computed<ProxyFunction[]>(() => proxyFunctionsRaw.value as unknown as ProxyFunction[])

// All proxies in the org for the analytics filter dropdown
const allProxiesForFilter = ref<{ id: string; name: string }[]>([])

async function fetchAllProxiesForFilter() {
  if (!project.value?.organization_id) return
  const { data } = await client
    .from('proxy_functions')
    .select('id, name')
    .eq('organization_id', project.value.organization_id)
    .order('name', { ascending: true })
  allProxiesForFilter.value = data ?? []
}

// Role
const currentUserRole = computed(() => {
  const userId = user.value?.id ?? user.value?.sub
  const member = organizationMembers.value.find(m => m.user_id === userId)
  return member?.role || null
})

const isAdmin = computed(() => {
  return currentUserRole.value === 'owner' || currentUserRole.value === 'admin'
})

// Environment tab bridge
const activeTabId = computed({
  get: () => activeEnvironment.value?.id || '',
  set: (id: string) => {
    const env = environments.value.find(e => e.id === id)
    if (env) {
      activeEnvironment.value = env
    }
  }
})

// Billing limits
const { checkLimit } = useLimits()

async function handleCreateProxy() {
  if (!activeEnvironment.value) {
    $toast.error('Please create an environment first')
    return
  }
  const limitResult = await checkLimit('proxy_functions')
  if (!limitResult.allowed) {
    const event = new CustomEvent('billing:limit-reached', {
      detail: limitResult
    })
    window.dispatchEvent(event)
    return
  }
  editingProxy.value = null
  showBuilderModal.value = true
}

function handleEditProxy(proxy: ProxyFunction) {
  editingProxy.value = proxy
  showBuilderModal.value = true
}

function confirmDeleteProxy(proxy: ProxyFunction) {
  deletingProxy.value = proxy
}

async function handleDeleteProxy() {
  if (!deletingProxy.value) return
  actionLoading.value = true
  const { error } = await deleteProxyFunction(deletingProxy.value.id)
  actionLoading.value = false
  if (!error) {
    deletingProxy.value = null
  }
}

async function handleToggleEnabled(proxy: ProxyFunction) {
  await toggleEnabled(proxy.id, !proxy.enabled)
}

function confirmRegenerateToken(proxy: ProxyFunction) {
  regeneratingProxy.value = proxy
}

async function handleRegenerateToken() {
  if (!regeneratingProxy.value) return
  actionLoading.value = true
  const { error } = await regenerateToken(regeneratingProxy.value.id)
  actionLoading.value = false
  if (!error) {
    regeneratingProxy.value = null
  }
}

function openTestPanel(proxy: ProxyFunction) {
  testingProxy.value = proxy
}

async function openDownloadModal(proxy: ProxyFunction) {
  downloadingProxy.value = proxy
  // Fetch variables for the current environment to resolve names from IDs
  if (activeEnvironment.value) {
    const { data } = await client
      .from('variables')
      .select('id, key')
      .eq('environment_id', activeEnvironment.value.id)
    environmentVariables.value = data || []
  }
  showDownloadModal.value = true
}

function handleProxySaved() {
  fetchProxyFunctions()
  fetchAllProxiesForFilter()
}

// Fetch project
async function fetchProject() {
  try {
    const { data, error } = await client
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (error || !data) {
      $toast.error('Project not found or access denied')
      navigateTo('/dashboard', { replace: true })
      return
    }
    project.value = data
  } catch {
    $toast.error('Project not found or access denied')
    navigateTo('/dashboard', { replace: true })
  }
}

// Fetch environments
async function fetchEnvironments() {
  try {
    const { data, error } = await client
      .from('environments')
      .select('*')
      .eq('project_id', projectId)
      .order('name', { ascending: true })

    if (error) throw error
    environments.value = data || []

    if (environments.value.length > 0 && !activeEnvironment.value) {
      activeEnvironment.value = environments.value[0] ?? null
    }
  } catch {
    $toast.error('Failed to load environments')
  }
}

// Fetch organization members for role checking
async function fetchOrganizationMembers() {
  if (!project.value?.organization_id) return
  try {
    const { data, error } = await client.rpc('get_organization_members_with_emails', { org_id: project.value.organization_id })
    if (error) throw error
    organizationMembers.value = data || []
  } catch {
    console.error('Failed to fetch organization members')
  }
}

// Watch environment changes to reload proxies
watch(activeEnvironment, () => {
  if (activeEnvironment.value) {
    fetchProxyFunctions()
  }
})

// Mount
onMounted(async () => {
  await fetchProject()

  if (project.value) {
    breadcrumbs.value = [
      { label: 'Dashboard', to: '/dashboard' },
      { label: project.value.name, to: `/dashboard/projects/${projectId}` },
      { label: 'Proxies' }
    ]
  }

  await Promise.all([
    fetchEnvironments(),
    fetchOrganizationMembers(),
    fetchAllProxiesForFilter(),
  ])

  // Initial fetch of proxies for the first environment
  if (activeEnvironment.value) {
    await fetchProxyFunctions()
  }

  loading.value = false
})
</script>
