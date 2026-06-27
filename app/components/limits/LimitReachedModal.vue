<template>
  <Dialog
    :open="isOpen"
    :title="title"
    :description="message"
    max-width="sm"
    @close="close"
  >
    <div class="space-y-4">
      <div class="flex items-start space-x-4">
        <div class="bg-warning-bg rounded-full p-3">
          <Icon name="lucide:alert-triangle" class="h-5 w-5 text-warning" />
        </div>
        <div class="flex-1">
          <div v-if="limitResult" class="rounded-md bg-muted p-3">
            <div class="flex justify-between text-sm">
              <span>Current usage:</span>
              <span class="font-medium">
                {{ limitResult.current }} / {{ limitResult.limit }}
              </span>
            </div>
          </div>

          <div class="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <div class="mb-2 flex items-center justify-between">
              <p class="text-sm font-semibold text-primary">Upgrade to Pro</p>
              <span class="text-lg font-bold text-primary">$9<span class="text-sm font-normal text-muted-foreground">/month</span></span>
            </div>
            <ul class="space-y-1 text-xs">
              <li class="flex items-center gap-2">
                <Icon name="lucide:infinity" class="h-4 w-4 text-primary" />
                Unlimited projects
              </li>
              <li class="flex items-center gap-2">
                <Icon name="lucide:infinity" class="h-4 w-4 text-primary" />
                Unlimited environments per project
              </li>
              <li class="flex items-center gap-2">
                <Icon name="lucide:infinity" class="h-4 w-4 text-primary" />
                Unlimited team members
              </li>
              <li class="flex items-center gap-2">
                <Icon name="lucide:check" class="h-4 w-4 text-primary" />
                90-day audit log retention
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div class="flex justify-end space-x-2">
        <Button variant="outline" @click="close">
          Cancel
        </Button>
        <Button @click="handleUpgrade">
          <Icon name="lucide:zap" class="mr-2 h-4 w-4" />
          Upgrade to Pro
        </Button>
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import type { LimitCheckResult } from '~/types/billing.types'
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/ui/Dialog.vue'

const { track } = usePostHog()
const isOpen = ref(false)
const limitResult = ref<LimitCheckResult | null>(null)

const title = computed(() => {
  if (!limitResult.value) return 'Limit Reached'

  const limitType = limitResult.value.limitType
  switch (limitType) {
    case 'projects':
      return 'Project Limit Reached'
    case 'team_members':
      return 'Team Member Limit Reached'
    case 'variables_per_environment':
      return 'Variable Limit Reached'
    case 'environments_per_project':
      return 'Environment Limit Reached'
    default:
      return 'Limit Reached'
  }
})

const resourceName = computed(() => {
  if (!limitResult.value) return 'resources'

  const limitType = limitResult.value.limitType
  switch (limitType) {
    case 'projects':
      return 'projects'
    case 'team_members':
      return 'team members'
    case 'variables_per_environment':
      return 'variables'
    case 'environments_per_project':
      return 'environments'
    default:
      return 'resources'
  }
})

const message = computed(() => {
  if (!limitResult.value) return ''

  const limit = limitResult.value.limit
  const type = resourceName.value

  return `You've reached the limit of ${limit} ${type} on your current plan. Upgrade to Pro for unlimited ${type} and more.`
})

// Listen for limit-reached events from anywhere in the app
onMounted(() => {
  window.addEventListener('billing:limit-reached', handleLimitReached as EventListener)
})

onBeforeUnmount(() => {
  window.removeEventListener('billing:limit-reached', handleLimitReached as EventListener)
})

const handleLimitReached = (event: CustomEvent<LimitCheckResult>) => {
  limitResult.value = event.detail
  isOpen.value = true
  track('limit_reached', {
    limit_type: event.detail.limitType,
    current_count: event.detail.current,
    max_count: event.detail.limit
  })
}

const close = () => {
  isOpen.value = false
  limitResult.value = null
}

const handleUpgrade = () => {
  track('limit_upgrade_clicked', {
    limit_type: limitResult.value?.limitType || 'unknown'
  })
  navigateTo('/dashboard/settings/billing')
  close()
}
</script>
