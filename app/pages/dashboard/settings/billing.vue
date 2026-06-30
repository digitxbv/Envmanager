<template>
  <div class="space-y-6">
    <!-- Access Restricted for non-owners -->
    <Card v-if="!isBillingOwner && !billingIsLoading" class-name="text-center">
      <EmptyState
        icon="lucide:lock"
        title="Access Restricted"
        description="Only organization owners can manage billing and subscriptions."
      />
    </Card>

    <!-- Loading State -->
    <LoadingSpinner v-else-if="billingIsLoading" class="py-20" />

    <template v-else-if="isBillingOwner">
      <!-- Trial Banner (control variant only — test variant shows trial info in upgrade hero) -->
      <Card
        v-if="isTrialing && trialDaysRemaining > 0"
        class-name="border-primary/20 bg-primary/5"
      >
        <template #header>
          <h2 class="text-base font-semibold">Pro Trial Active</h2>
        </template>
        <div class="flex items-start gap-4">
          <div class="rounded-full bg-primary/10 p-2">
            <Icon name="lucide:clock" class="h-5 w-5 text-primary" />
          </div>
          <div class="flex-1">
            <p class="text-sm text-muted-foreground mt-1">
              You have <strong>{{ trialDaysRemaining }} days</strong> remaining in your Pro trial.
              Upgrade now to continue enjoying unlimited resources.
            </p>
            <Button variant="secondary" @click="handleUpgrade" class="mt-4">
              <Icon name="lucide:zap" class="mr-2 h-4 w-4" />
              Upgrade to Pro
            </Button>
          </div>
        </div>
      </Card>

      <!-- Workspace Locked Banner (trial expired or subscription paused) -->
      <Card
        v-if="isLocked"
        class-name="border-destructive/20 bg-destructive/5"
      >
        <template #header>
          <h2 class="text-base font-semibold text-destructive">Workspace Locked</h2>
        </template>
        <div class="flex items-start gap-4">
          <div class="rounded-full bg-destructive/10 p-2">
            <Icon name="lucide:lock" class="h-5 w-5 text-destructive" />
          </div>
          <div class="flex-1">
            <p class="text-sm text-muted-foreground mt-1">
              Your trial has ended — your workspace is read-only. Upgrade to restore full access.
            </p>
            <Button variant="secondary" @click="handleUpgrade" class="mt-4">
              <Icon name="lucide:zap" class="mr-2 h-4 w-4" />
              Upgrade to Pro
            </Button>
          </div>
        </div>
      </Card>

      <!-- Upgrade Hero (non-Pro users) -->
      <Card
        v-if="!isProPlan"
        class-name="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10"
      >
        <div class="space-y-4 p-1">
          <h2 class="text-xl font-bold">Upgrade to Professional</h2>
          <p class="text-sm text-muted-foreground">
            <template v-if="isTrialing && trialDaysRemaining > 0">
              Your trial ends in <strong>{{ trialDaysRemaining }} days</strong> — lock in your rate today
            </template>
            <template v-else>
              Unlock unlimited projects, environments, and team members
            </template>
          </p>
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div class="flex items-center gap-2">
              <Icon name="lucide:check-circle" class="h-4 w-4 text-primary shrink-0" />
              Unlimited Projects
            </div>
            <div class="flex items-center gap-2">
              <Icon name="lucide:check-circle" class="h-4 w-4 text-primary shrink-0" />
              Unlimited Environments
            </div>
            <div class="flex items-center gap-2">
              <Icon name="lucide:check-circle" class="h-4 w-4 text-primary shrink-0" />
              Unlimited Team Members
            </div>
            <div class="flex items-center gap-2">
              <Icon name="lucide:check-circle" class="h-4 w-4 text-primary shrink-0" />
              Priority Support
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-3 pt-2">
            <Button size="lg" @click="handleUpgrade" :loading="billingLoading">
              <Icon name="lucide:zap" class="mr-2 h-4 w-4" />
              Monthly — $9/month
            </Button>
            <Button size="lg" variant="outline" @click="handleUpgradeAnnual" :loading="billingLoading">
              <Icon name="lucide:calendar" class="mr-2 h-4 w-4" />
              Annual — $90/year
              <span class="ml-1.5 text-xs font-medium text-primary">2 months free</span>
            </Button>
          </div>
        </div>
      </Card>

      <!-- Current Plan Card -->
      <Card v-if="isProPlan || isLocked">
        <template #header>
          <h2 class="text-base font-semibold">Current Plan</h2>
        </template>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-3xl font-bold mt-2">
              {{ subscription?.plan.display_name || 'Free' }}
            </p>
            <p v-if="subscription?.current_period_end" class="text-sm text-muted-foreground mt-1">
              Renews on {{ formatBillingDate(subscription.current_period_end) }}
            </p>
            <p v-if="subscription?.cancel_at_period_end" class="text-sm text-destructive mt-1">
              <Icon name="lucide:alert-triangle" class="inline h-4 w-4 mr-1" />
              Subscription will cancel on {{ formatBillingDate(subscription.current_period_end!) }}
            </p>
          </div>
          <div class="flex gap-2">
            <Button
              v-if="!isProPlan"
              @click="handleUpgrade"
              :loading="billingLoading"
            >
              <Icon name="lucide:zap" class="mr-2 h-4 w-4" />
              Upgrade to Pro
            </Button>
            <Button
              v-else
              variant="outline"
              @click="handleManageSubscription"
              :loading="billingLoading"
            >
              <Icon name="lucide:settings" class="mr-2 h-4 w-4" />
              Manage Subscription
            </Button>
          </div>
        </div>
      </Card>

      <!-- Tabbed Content -->
      <Tabs v-model="activeTab">
        <TabsList>
          <TabsTrigger value="usage">
            <Icon name="lucide:bar-chart-3" class="h-4 w-4" />
            Usage
          </TabsTrigger>
          <TabsTrigger value="billing">
            <Icon name="lucide:credit-card" class="h-4 w-4" />
            Billing
          </TabsTrigger>
          <TabsTrigger value="invoices">
            <Icon name="lucide:receipt" class="h-4 w-4" />
            Invoices
          </TabsTrigger>
        </TabsList>

        <!-- Usage Tab -->
        <TabsContent value="usage">
          <div class="space-y-6">
            <Card>
              <template #header>
                <div class="flex items-center justify-between">
                  <h2 class="text-base font-semibold">Usage & Limits</h2>
                  <span class="text-xs text-muted-foreground">
                    {{ isProPlan ? 'Pro Plan' : isTrialing ? 'Pro Trial' : 'Pro' }}
                  </span>
                </div>
              </template>
              <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
                <UsageCard
                  title="Projects"
                  :current="currentUsage?.projects || 0"
                  :limit="currentLimits?.projects || 1"
                  icon="lucide:folder"
                />
                <UsageCard
                  title="Environments"
                  :current="currentUsage?.environments || 0"
                  :limit="currentLimits?.environments_per_project || 3"
                  icon="lucide:server"
                />
                <UsageCard
                  title="Variables"
                  :current="currentUsage?.variables || 0"
                  :limit="currentLimits?.variables_per_environment || -1"
                  icon="lucide:key"
                />
                <UsageCard
                  title="Team Members"
                  :current="currentUsage?.team_members || 0"
                  :limit="currentLimits?.team_members || 1"
                  icon="lucide:users"
                />
                <UsageCard
                  title="Integrations"
                  :current="currentUsage?.integrations || 0"
                  :limit="currentLimits?.integrations || 1"
                  icon="lucide:plug"
                />
              </div>
            </Card>

            <!-- Proxy Usage Card -->
            <Card v-if="proxyInvocationUsage">
              <template #header>
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <Icon name="lucide:globe" class="h-4 w-4 text-muted-foreground" />
                    <h2 class="text-base font-semibold">Proxy Usage</h2>
                  </div>
                  <span class="text-xs text-muted-foreground">
                    {{ proxyInvocationUsage.period }}
                  </span>
                </div>
              </template>

              <div class="space-y-4">
                <!-- Summary line -->
                <div class="flex items-center justify-between">
                  <span class="text-sm text-muted-foreground">
                    <span class="font-medium text-foreground">{{ proxyInvocationUsage.used.toLocaleString() }}</span>
                    / {{ proxyInvocationUsage.included.toLocaleString() }} calls used
                  </span>
                  <span
                    v-if="proxyInvocationUsage.overage > 0"
                    class="text-sm font-medium text-destructive"
                  >
                    +{{ proxyInvocationUsage.overage.toLocaleString() }} overage
                  </span>
                </div>

                <!-- Progress bar -->
                <div class="w-full bg-muted rounded-full h-2">
                  <div
                    class="h-2 rounded-full transition-all"
                    :class="{
                      'bg-destructive': proxyInvocationUsage.percentUsed >= 100,
                      'bg-warning': proxyInvocationUsage.percentUsed >= 80 && proxyInvocationUsage.percentUsed < 100,
                      'bg-primary': proxyInvocationUsage.percentUsed < 80
                    }"
                    :style="{ width: `${Math.min(proxyInvocationUsage.percentUsed, 100)}%` }"
                  />
                </div>

                <!-- Per-proxy breakdown (top 5) -->
                <div v-if="proxyInvocationUsage.perProxy.length > 0" class="space-y-2 pt-1">
                  <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Top proxies this month</p>
                  <div
                    v-for="proxy in proxyInvocationUsage.perProxy"
                    :key="proxy.proxy_function_id"
                    class="flex items-center justify-between text-sm"
                  >
                    <span class="truncate text-muted-foreground max-w-[200px]">{{ proxy.name }}</span>
                    <span class="font-medium tabular-nums">{{ proxy.call_count.toLocaleString() }}</span>
                  </div>
                </div>

                <!-- Upgrade CTA for free plan near limit -->
                <div
                  v-if="!isProPlan && proxyInvocationUsage.percentUsed >= 80"
                  class="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex items-center justify-between gap-4"
                >
                  <p class="text-sm text-muted-foreground">
                    <Icon name="lucide:zap" class="inline h-4 w-4 mr-1 text-primary" />
                    Upgrade to Pro for <strong>5,000</strong> monthly proxy calls
                  </p>
                  <Button size="sm" @click="handleUpgrade" :loading="billingLoading">
                    Upgrade
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        <!-- Billing Tab -->
        <TabsContent value="billing">
          <div class="space-y-6">
            <!-- Pro Plan Card -->
            <Card>
              <template #header>
                <h2 class="text-base font-semibold">Plans</h2>
              </template>
              <div
                :class="[
                  'rounded-lg border p-5 space-y-4',
                  isProPlan ? 'border-primary ring-1 ring-primary' : 'border-primary/50 ring-1 ring-primary/50'
                ]"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <h3 class="font-semibold text-lg">Pro</h3>
                    <span
                      v-if="!isProPlan"
                      class="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full"
                    >
                      Recommended
                    </span>
                  </div>
                  <span
                    v-if="isProPlan"
                    class="text-xs font-medium bg-primary text-primary-foreground px-2 py-0.5 rounded-full"
                  >
                    Current
                  </span>
                </div>
                <ul class="space-y-2 text-sm">
                  <li class="flex items-center gap-2">
                    <Icon name="lucide:infinity" class="h-4 w-4 text-primary" />
                    <strong>Unlimited</strong> Projects
                  </li>
                  <li class="flex items-center gap-2">
                    <Icon name="lucide:infinity" class="h-4 w-4 text-primary" />
                    <strong>Unlimited</strong> Environments
                  </li>
                  <li class="flex items-center gap-2">
                    <Icon name="lucide:infinity" class="h-4 w-4 text-primary" />
                    <strong>Unlimited</strong> Variables
                  </li>
                  <li class="flex items-center gap-2">
                    <Icon name="lucide:infinity" class="h-4 w-4 text-primary" />
                    <strong>Unlimited</strong> Integrations
                  </li>
                  <li class="flex items-center gap-2">
                    <Icon name="lucide:infinity" class="h-4 w-4 text-primary" />
                    <strong>Unlimited</strong> Team members
                  </li>
                  <li class="flex items-center gap-2">
                    <Icon name="lucide:check" class="h-4 w-4 text-primary" />
                    Priority support
                  </li>
                </ul>
                <div v-if="!isProPlan" class="flex flex-wrap gap-3 pt-1">
                  <Button
                    @click="handleUpgrade"
                    :loading="billingLoading"
                  >
                    <Icon name="lucide:zap" class="mr-2 h-4 w-4" />
                    Monthly — $9/month
                  </Button>
                  <Button
                    variant="outline"
                    @click="handleUpgradeAnnual"
                    :loading="billingLoading"
                  >
                    <Icon name="lucide:calendar" class="mr-2 h-4 w-4" />
                    Annual — $90/year
                    <span class="ml-1.5 text-xs font-medium text-primary">2 months free</span>
                  </Button>
                </div>
              </div>
            </Card>

            <!-- Billing Details -->
            <Card>
              <template #header>
                <h2 class="text-base font-semibold">Billing Details</h2>
              </template>
              <div class="space-y-4">
                <div>
                  <label class="text-sm font-medium text-muted-foreground">Billing Email</label>
                  <p class="mt-1 text-sm">{{ billingEmail }}</p>
                  <p class="text-xs text-muted-foreground mt-1">
                    Manage your billing email through the Stripe customer portal.
                  </p>
                </div>
                <div class="pt-2">
                  <Button
                    variant="outline"
                    @click="handleManageSubscription"
                    :loading="billingLoading"
                  >
                    <Icon name="lucide:external-link" class="mr-2 h-4 w-4" />
                    Manage Subscription
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        <!-- Invoices Tab -->
        <TabsContent value="invoices">
          <Card>
            <EmptyState
              icon="lucide:receipt"
              title="Invoices"
              description="Invoices and payment history are managed through Stripe. View and download your invoices from the Stripe customer portal."
            >
              <Button
                variant="outline"
                @click="handleManageSubscription"
                :loading="billingLoading"
              >
                <Icon name="lucide:external-link" class="mr-2 h-4 w-4" />
                View Invoices
              </Button>
            </EmptyState>
          </Card>
        </TabsContent>
      </Tabs>
    </template>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/Button.vue'
import UsageCard from '@/components/billing/UsageCard.vue'
import type { PlanLimits, CurrentUsage, ProxyInvocationUsage } from '~/types/billing.types'

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth']
})

// =====================================================
// Core Composables
// =====================================================

const organizationStore = useOrganizationStore()
const user = useSupabaseUser()
const { $toast } = useNuxtApp()
const { getCurrentUserRole } = useTeamManagement()
const { track } = usePostHog()
const {
  subscription,
  loading: billingLoading,
  isProPlan,
  isTrialing,
  isTrialExpired,
  isLocked,
  trialDaysRemaining,
  fetchSubscription,
  startCheckout,
  openCustomerPortal
} = useBilling()
const { getCurrentUsage, getProxyInvocationUsage } = useLimits()

// =====================================================
// Reactive State
// =====================================================

const selectedOrganizationId = computed(() => organizationStore.selectedOrganizationId)
const currentUsage = ref<CurrentUsage | null>(null)
const proxyInvocationUsage = ref<ProxyInvocationUsage | null>(null)
const billingIsLoading = ref(true)
const billingUserRole = ref<string | null>(null)
const isBillingOwner = computed(() => billingUserRole.value === 'owner')
const currentLimits = computed<PlanLimits | null>(() => {
  return subscription.value?.plan.limits as unknown as PlanLimits | null
})
const activeTab = ref('usage')
const billingEmail = computed(() => user.value?.email || 'No email available')

// =====================================================
// Methods
// =====================================================

const formatBillingDate = (dateString: string) => {
  if (!dateString) return 'Unknown'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

async function loadBillingData() {
  if (!selectedOrganizationId.value) return

  billingIsLoading.value = true

  try {
    // Check user role first
    const role = await getCurrentUserRole(selectedOrganizationId.value)
    billingUserRole.value = role

    // Only load billing data if user is owner
    if (role === 'owner') {
      await fetchSubscription()

      if (selectedOrganizationId.value) {
        [currentUsage.value, proxyInvocationUsage.value] = await Promise.all([
          getCurrentUsage(selectedOrganizationId.value),
          getProxyInvocationUsage(selectedOrganizationId.value).catch(() => null)
        ])
      }
    }
  } catch (error) {
    console.error('Failed to load billing data:', error)
    $toast.error('Failed to load billing information')
  } finally {
    billingIsLoading.value = false
  }
}

const handleUpgrade = async () => {
  try {
    track('upgrade_button_clicked', {
      source: 'settings_billing',
      current_plan: subscription.value?.plan_id || 'pro_monthly',
      billing_interval: 'monthly'
    })
    track('checkout_started', {
      plan_name: 'pro_monthly',
      billing_interval: 'monthly',
      source: 'settings_billing'
    })
    await startCheckout('pro_monthly')
  } catch (error) {
    // Error already handled in composable
  }
}

const handleUpgradeAnnual = async () => {
  try {
    track('upgrade_button_clicked', {
      source: 'settings_billing',
      current_plan: subscription.value?.plan_id || 'pro_monthly',
      billing_interval: 'annual'
    })
    track('checkout_started', {
      plan_name: 'pro_annual',
      billing_interval: 'annual',
      source: 'settings_billing'
    })
    await startCheckout('pro_annual')
  } catch (error) {
    // Error already handled in composable
  }
}

const handleManageSubscription = async () => {
  try {
    track('customer_portal_opened', {
      current_plan: subscription.value?.plan_id || 'free'
    })
    await openCustomerPortal()
  } catch (error) {
    // Error already handled in composable
  }
}

// =====================================================
// Lifecycle
// =====================================================

// Handle billing success redirect + A/B test flag
onMounted(() => {
  const route = useRoute()
  if (route.query.success === 'true') {
    $toast.success('Subscription activated successfully!')
    navigateTo('/dashboard/settings/billing', { replace: true })
  }
})

watch(
  [selectedOrganizationId, user],
  async ([orgId, currentUser]) => {
    const userId = currentUser?.id ?? currentUser?.sub
    if (!orgId || !userId) return
    await loadBillingData()
  },
  { immediate: true }
)
</script>
