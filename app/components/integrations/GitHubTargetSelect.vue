<template>
  <div class="space-y-4">
    <!-- Sync Level Selector -->
    <div class="space-y-2">
      <label class="block text-sm font-medium">Sync Level</label>
      <select
        v-model="localConfig.sync_level"
        class="flex h-11 w-full rounded-md border border-input bg-card px-4 py-2.5 text-base ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-ring/50 focus:border-ring"
        @change="handleSyncLevelChange"
      >
        <option value="repository">Repository Secrets/Variables</option>
        <option value="environment">Environment Secrets/Variables</option>
        <option value="organization">Organization Secrets/Variables</option>
      </select>
      <p class="text-xs text-muted-foreground">
        {{ syncLevelDescription }}
      </p>
    </div>

    <!-- Repository Selector (for repository and environment levels) -->
    <div v-if="localConfig.sync_level !== 'organization'" class="space-y-2">
      <label class="block text-sm font-medium">Repository</label>
      <div v-if="loadingRepos" class="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon name="lucide:loader-2" class="h-4 w-4 animate-spin" />
        Loading repositories...
      </div>
      <select
        v-else-if="repositories.length > 0"
        v-model="selectedRepo"
        class="flex h-11 w-full rounded-md border border-input bg-card px-4 py-2.5 text-base ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-ring/50 focus:border-ring"
        @change="handleRepoChange"
      >
        <option :value="null" disabled>Select a repository</option>
        <option
          v-for="repo in repositories"
          :key="repo.id"
          :value="repo.full_name"
        >
          {{ repo.full_name }}
          <template v-if="repo.private"> (private)</template>
        </option>
      </select>
      <div v-else class="text-sm text-muted-foreground">
        No repositories found. Ensure the GitHub App has access to your repositories.
      </div>
    </div>

    <!-- Organization Selector (for organization level) -->
    <div v-else class="space-y-2">
      <label class="block text-sm font-medium">Organization</label>
      <Input
        v-model="repoOwnerInput"
        placeholder="e.g., my-org"
        @input="emitChange"
      />
      <p class="text-xs text-muted-foreground">
        The GitHub organization to sync secrets to.
      </p>
    </div>

    <div v-if="localConfig.sync_level === 'organization'" class="space-y-2">
      <label class="block text-sm font-medium">Repository Access</label>
      <select
        v-model="githubOrgVisibility"
        class="flex h-11 w-full rounded-md border border-input bg-card px-4 py-2.5 text-base ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-ring/50 focus:border-ring"
        @change="emitChange"
      >
        <option value="all">All repositories</option>
        <option value="private">Private repositories only</option>
      </select>
      <p class="text-xs text-muted-foreground">
        Controls which organization repositories can use the synced Actions secrets and variables.
      </p>
    </div>

    <!-- GitHub Environment Name (for environment level) -->
    <div v-if="localConfig.sync_level === 'environment'" class="space-y-2">
      <label class="block text-sm font-medium">GitHub Environment</label>
      <Input
        v-model="githubEnvironmentInput"
        placeholder="e.g., production, staging"
        @input="emitChange"
      />
      <p class="text-xs text-muted-foreground">
        The GitHub Actions environment name. Create environments in your repository settings.
      </p>
    </div>

    <!-- Selected Target Summary -->
    <div v-if="hasTarget" class="rounded-md border bg-muted/30 p-3">
      <div class="flex items-center gap-2">
        <Icon name="lucide:github" class="h-5 w-5" />
        <span class="font-medium">{{ targetSummary }}</span>
      </div>
      <p class="text-xs text-muted-foreground mt-1">
        {{ targetDescription }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import Input from '~/components/ui/Input.vue'
import type { GitHubRepository } from '~/composables/useGitHubIntegration'

interface TargetConfig {
  sync_level: 'repository' | 'environment' | 'organization'
  repo_owner: string | null
  repo_name: string | null
  github_environment: string | null
  github_org_visibility?: 'all' | 'private'
}

interface Props {
  modelValue: TargetConfig | null
  repositories: GitHubRepository[]
  loadingRepos?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loadingRepos: false
})

const emit = defineEmits<{
  'update:modelValue': [value: TargetConfig | null]
}>()

// =====================================================
// State
// =====================================================

const localConfig = ref<TargetConfig>({
  sync_level: props.modelValue?.sync_level ?? 'repository',
  repo_owner: props.modelValue?.repo_owner ?? null,
  repo_name: props.modelValue?.repo_name ?? null,
  github_environment: props.modelValue?.github_environment ?? null,
  github_org_visibility: props.modelValue?.github_org_visibility ?? 'all'
})

const selectedRepo = ref<string | null>(
  props.modelValue?.repo_owner && props.modelValue?.repo_name
    ? `${props.modelValue.repo_owner}/${props.modelValue.repo_name}`
    : null
)

// =====================================================
// Computed
// =====================================================

const syncLevelDescription = computed(() => {
  switch (localConfig.value.sync_level) {
    case 'repository':
      return 'Sync to repository-level GitHub Actions configuration. Available to all workflows.'
    case 'environment':
      return 'Sync to environment-specific GitHub Actions configuration. Requires workflow to use the environment.'
    case 'organization':
      return 'Sync to organization-level GitHub Actions configuration. Available to all repos in the org.'
    default:
      return ''
  }
})

const hasTarget = computed(() => {
  const config = localConfig.value
  if (config.sync_level === 'organization') {
    return !!config.repo_owner
  }
  if (config.sync_level === 'environment') {
    return !!config.repo_owner && !!config.repo_name && !!config.github_environment
  }
  return !!config.repo_owner && !!config.repo_name
})

const targetSummary = computed(() => {
  const config = localConfig.value
  if (config.sync_level === 'organization') {
    return `org:${config.repo_owner}`
  }
  if (config.sync_level === 'environment') {
    return `${config.repo_owner}/${config.repo_name} → ${config.github_environment}`
  }
  return `${config.repo_owner}/${config.repo_name}`
})

const targetDescription = computed(() => {
  const config = localConfig.value
  if (config.sync_level === 'organization') {
    return `Values will sync to organization-level GitHub Actions configuration for ${config.github_org_visibility === 'private' ? 'private repositories' : 'all repositories'}`
  }
  if (config.sync_level === 'environment') {
    return `Values will sync to the "${config.github_environment}" environment configuration`
  }
  return 'Values will sync to repository-level GitHub Actions configuration'
})

// =====================================================
// Methods
// =====================================================

function handleSyncLevelChange() {
  // Reset fields when changing sync level
  if (localConfig.value.sync_level === 'organization') {
    localConfig.value.repo_name = null
    localConfig.value.github_environment = null
    localConfig.value.github_org_visibility = localConfig.value.github_org_visibility ?? 'all'
    selectedRepo.value = null
  } else if (localConfig.value.sync_level === 'repository') {
    localConfig.value.github_environment = null
  }
  emitChange()
}

function handleRepoChange() {
  if (selectedRepo.value) {
    const [owner, ...nameParts] = selectedRepo.value.split('/')
    localConfig.value.repo_owner = owner ?? null
    localConfig.value.repo_name = nameParts.join('/') || null
  } else {
    localConfig.value.repo_owner = null
    localConfig.value.repo_name = null
  }
  emitChange()
}

function emitChange() {
  if (hasTarget.value) {
    emit('update:modelValue', { ...localConfig.value })
  } else {
    emit('update:modelValue', null)
  }
}

const repoOwnerInput = computed({
  get: () => localConfig.value.repo_owner ?? '',
  set: (value: string) => {
    localConfig.value.repo_owner = value || null
    emitChange()
  }
})

const githubEnvironmentInput = computed({
  get: () => localConfig.value.github_environment ?? '',
  set: (value: string) => {
    localConfig.value.github_environment = value || null
    emitChange()
  }
})

const githubOrgVisibility = computed({
  get: () => localConfig.value.github_org_visibility ?? 'all',
  set: (value: 'all' | 'private') => {
    localConfig.value.github_org_visibility = value
    emitChange()
  }
})

// =====================================================
// Watchers
// =====================================================

// Sync with modelValue prop
watch(() => props.modelValue, (val) => {
  if (val) {
    localConfig.value = { ...val }
    if (val.repo_owner && val.repo_name) {
      selectedRepo.value = `${val.repo_owner}/${val.repo_name}`
    }
  }
}, { immediate: true, deep: true })
</script>
