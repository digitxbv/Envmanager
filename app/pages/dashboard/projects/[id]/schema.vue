<template>
  <div class="px-4 md:px-6 lg:px-8 py-6">
    <LoadingSpinner v-if="loading" class="py-20" />
    
    <template v-else-if="project">
      <div class="space-y-6">
        <!-- Header -->
        <PageHeader title="Environment Schema" description="Define validation rules for environment variables" />
        
        <!-- Environment Tabs -->
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
            :key="env.id"
            :value="env.id"
          >
            <div class="space-y-6">
              <LoadingSpinner v-if="schemaLoading" size="sm" class="py-10" />
              
              <template v-else>
                <SchemaEditor v-model="schema" />
                
                <div class="flex justify-end">
                  <Button :loading="saving" @click="saveSchema">
                    <Icon name="lucide:save" class="mr-2 h-4 w-4" />
                    Save Schema
                  </Button>
                </div>
              </template>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/Button.vue'
import SchemaEditor from '@/components/schema/SchemaEditor.vue'

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth']
})

interface Environment {
  id: string
  name: string
  project_id: string
}

interface Project {
  id: string
  name: string
  description: string | null
  organization_id: string
}

type EnvSchema = Record<string, {
  type: 'string' | 'number' | 'boolean' | 'url' | 'email' | 'port' | 'json' | 'enum'
  required?: boolean
  default?: string
  description?: string
  enum?: string[]
  pattern?: string
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
}>

const route = useRoute()
const projectId = route.params.id as string
const client = useSupabaseClient()
const { $toast } = useNuxtApp()

// Breadcrumbs
const breadcrumbs = inject('breadcrumbs', ref<Array<{ label: string; to?: string }>>([]))

const loading = ref(true)
const project = ref<Project | null>(null)
const environments = ref<Environment[]>([])
const activeEnvironment = ref<Environment | null>(null)
const activeTabId = ref('')
const schema = ref<EnvSchema>({})
const schemaLoading = ref(false)
const saving = ref(false)

// Watch tab changes to select environment
watch(activeTabId, (newId) => {
  if (!newId) return
  const env = environments.value.find(e => e.id === newId)
  if (env && env.id !== activeEnvironment.value?.id) {
    selectEnvironment(env)
  }
})

const fetchProject = async () => {
  loading.value = true

  try {
    const { data, error } = await client
      .from('projects')
      .select('id, name, description, organization_id')
      .eq('id', projectId)
      .single()

    if (error || !data) {
      $toast.error('Project not found or access denied')
      navigateTo('/dashboard', { replace: true })
      return
    }

    project.value = data

    // Set breadcrumbs
    breadcrumbs.value = [
      { label: 'Dashboard', to: '/dashboard' },
      { label: data.name, to: `/dashboard/projects/${projectId}` },
      { label: 'Schema' }
    ]
  } catch {
    $toast.error('Project not found or access denied')
    navigateTo('/dashboard', { replace: true })
  } finally {
    loading.value = false
  }
}

const fetchEnvironments = async () => {
  try {
    const { data, error } = await client
      .from('environments')
      .select('id, name, project_id')
      .eq('project_id', projectId)
      .order('name', { ascending: true })
    
    if (error) throw error
    
    environments.value = data || []
    
    if (environments.value.length > 0 && !activeEnvironment.value) {
      const firstEnvironment = environments.value[0]
      if (firstEnvironment) {
        activeTabId.value = firstEnvironment.id
        selectEnvironment(firstEnvironment)
      }
    }
  } catch {
    $toast.error('Failed to load environments')
  }
}

const fetchSchema = async () => {
  if (!activeEnvironment.value) return
  
  schemaLoading.value = true
  
  try {
    const { data, error } = await client.rpc('get_environment_schema', {
      p_environment_id: activeEnvironment.value.id
    })
    
    if (error) throw error
    
    schema.value = (data as unknown as EnvSchema) || {}
  } catch {
    $toast.error('Failed to load schema')
    schema.value = {}
  } finally {
    schemaLoading.value = false
  }
}

const selectEnvironment = (env: Environment) => {
  activeEnvironment.value = env
  fetchSchema()
}

const saveSchema = async () => {
  if (!activeEnvironment.value) return
  
  saving.value = true
  
  try {
    const { error } = await client.rpc('save_environment_schema', {
      p_environment_id: activeEnvironment.value.id,
      p_schema_json: schema.value
    })
    
    if (error) throw error
    
    $toast.success('Schema saved successfully')
  } catch {
    $toast.error('Failed to save schema')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await fetchProject()
  await fetchEnvironments()
})
</script>
