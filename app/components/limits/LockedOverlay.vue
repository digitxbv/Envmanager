<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[200] flex items-center justify-center bg-background/90 backdrop-blur-sm p-4">
      <div class="w-full max-w-md rounded-xl border border-border bg-card shadow-xl">
        <!-- Header -->
        <div class="flex flex-col items-center gap-3 px-6 pt-8 pb-4 text-center">
          <div class="rounded-full bg-destructive/10 p-4">
            <Icon name="lucide:lock" class="h-7 w-7 text-destructive" />
          </div>
          <h2 class="text-xl font-bold text-foreground">{{ heading }}</h2>
          <p v-if="trialEndLabel" class="text-sm text-muted-foreground">{{ trialEndLabel }}</p>
        </div>

        <!-- Body -->
        <div class="px-6 pb-4 space-y-3 text-center">
          <p class="text-sm text-muted-foreground leading-relaxed">
            Your workspace is <strong>read-only</strong>. All your data is safe and nothing has been deleted.
            Upgrade to restore full access.
          </p>
        </div>

        <!-- CTAs -->
        <div class="px-6 pb-8 space-y-3">
          <!-- Primary: monthly -->
          <Button
            class="w-full"
            size="lg"
            :loading="checkoutLoading === 'pro_monthly'"
            :disabled="!!checkoutLoading"
            @click="handleCheckout('pro_monthly')"
          >
            <Icon name="lucide:zap" class="mr-2 h-4 w-4" />
            Upgrade to Pro — $9/month
          </Button>

          <!-- Secondary: annual -->
          <Button
            class="w-full"
            variant="outline"
            size="lg"
            :loading="checkoutLoading === 'pro_annual'"
            :disabled="!!checkoutLoading"
            @click="handleCheckout('pro_annual')"
          >
            <Icon name="lucide:calendar" class="mr-2 h-4 w-4" />
            Pro Annual — $90/year
            <span class="ml-2 text-xs font-medium text-primary">(save $18)</span>
          </Button>

          <!-- Tertiary: billing page -->
          <div class="text-center pt-1">
            <button
              class="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors"
              @click="navigateTo('/dashboard/settings/billing')"
            >
              View billing &amp; invoices
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { PlanId, SubscriptionWithPlan } from '~/types/billing.types'
import Button from '@/components/ui/Button.vue'

const { subscription, startCheckout } = useBilling()
const { $toast } = useNuxtApp()

const checkoutLoading = ref<PlanId | null>(null)

const isCanceled = computed(() => {
  const sub = subscription.value as SubscriptionWithPlan | null
  return !!(sub?.canceled_at || (sub?.stripe_subscription_id && sub?.status === 'paused'))
})

const heading = computed(() => {
  return isCanceled.value ? 'Your subscription has ended' : 'Your free trial has ended'
})

const trialEndLabel = computed(() => {
  const sub = subscription.value as SubscriptionWithPlan | null
  if (isCanceled.value) return null
  if (!sub?.trial_end_date) return null
  const date = new Date(sub.trial_end_date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  return `Trial ended on ${date}`
})

const handleCheckout = async (planId: PlanId) => {
  checkoutLoading.value = planId
  try {
    await startCheckout(planId)
  } catch {
    $toast.error('Failed to start checkout. Please try again.')
  } finally {
    checkoutLoading.value = null
  }
}
</script>
