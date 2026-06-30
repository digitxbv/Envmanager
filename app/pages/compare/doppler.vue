<template>
  <div class="relative isolate overflow-hidden bg-background text-foreground">
    <!-- Background Pattern -->
    <div class="pointer-events-none absolute inset-0">
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,hsl(var(--primary)/0.15),transparent_48%),radial-gradient(circle_at_90%_14%,hsl(var(--primary)/0.08),transparent_40%)]"></div>
      <div class="hero-grid absolute inset-0 opacity-[0.15]"></div>
    </div>

    <section class="relative px-4 pb-14 pt-16 md:px-6 md:pb-20 md:pt-24">
      <div class="container relative z-10">
        <div class="mx-auto max-w-6xl space-y-8" @click="handleHeroClick">
           <MarketingHero
             badge="EnvManager vs Doppler"
             badge-icon="lucide:scale"
             title="The Doppler alternative that grows with your team, not your invoice"
             description="Doppler charges $21/user/month. A 10-person team pays $210/month before add-ons. EnvManager gives you the same core workflow — encryption, RBAC, audit logs, and CLI sync — for a flat $9/month."
             primary-cta-label="Start 14-Day Free Trial"
             primary-cta-to="/auth/register"
             primary-icon="lucide:rocket"
             secondary-cta-label="See Pricing"
             secondary-cta-to="/pricing"
             class="border-primary/20 bg-card/60 shadow-lg backdrop-blur-sm"
           />

          <div class="grid gap-4 md:grid-cols-3">
            <div
              v-for="stat in heroStats"
              :key="stat.label"
               class="rounded-xl border border-border/40 bg-card/60 p-5 backdrop-blur-md transition-colors hover:border-border/60"
            >
              <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{{ stat.label }}</p>
              <p class="mt-2 text-2xl font-bold text-foreground">{{ stat.value }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="relative px-4 py-14 md:px-6 md:py-20">
      <div class="container relative z-10">
        <div class="mx-auto max-w-6xl space-y-6">
          <div class="space-y-3 text-center">
            <h2 class="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Per-seat pricing punishes growing teams</h2>
            <p class="mx-auto max-w-2xl text-base text-muted-foreground md:text-lg">
              Doppler charges per seat and per add-on. EnvManager is a flat $9/month for your whole team. The more people you add, the more you save.
            </p>
          </div>

          <MarketingCard
            icon="lucide:calculator"
            title="Monthly cost comparison"
            description="Doppler Team plan is $21/user/month (plus $9/seat add-ons for roles, groups, or syncs). EnvManager Pro is $9/month for unlimited team members."
            class="rounded-2xl border-border/40 bg-card/40 backdrop-blur-md"
          >
            <div class="mt-6 overflow-hidden rounded-xl border border-border/40">
              <table class="min-w-full text-sm">
                <thead class="bg-muted/30 text-foreground">
                  <tr>
                    <th class="px-6 py-4 text-left font-semibold">Team Size</th>
                    <th class="px-6 py-4 text-center font-semibold text-muted-foreground">Doppler Team</th>
                    <th class="bg-primary/5 px-6 py-4 text-center font-bold text-primary border-x border-primary/10">EnvManager Pro</th>
                    <th class="px-6 py-4 text-center font-semibold text-muted-foreground">You Save</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border/40 bg-card/20">
                  <tr
                    v-for="row in pricingRows"
                    :key="row.users"
                    class="transition-colors hover:bg-muted/10"
                  >
                    <td class="px-6 py-4 font-medium text-foreground">{{ row.users }} {{ row.users === 1 ? 'user' : 'users' }}</td>
                    <td class="px-6 py-4 text-center text-muted-foreground">{{ row.doppler }}/mo</td>
                    <td class="bg-primary/5 px-6 py-4 text-center font-bold text-foreground border-x border-primary/10">{{ row.envmanager }}/mo</td>
                    <td class="px-6 py-4 text-center font-medium text-primary">{{ row.savings }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="mt-4 text-xs text-muted-foreground">
              Doppler Developer is free for up to 3 users, then $8/user/month. Team plan ($21/user/mo) shown above. Add-ons for custom roles, user groups, and integration syncs cost $9/seat/month each.
            </p>
          </MarketingCard>
        </div>
      </div>
    </section>

    <section class="relative px-4 py-14 md:px-6 md:py-20">
      <div class="container relative z-10">
        <div class="mx-auto max-w-6xl space-y-6">
          <div class="space-y-3 text-center">
            <h2 class="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Feature-by-feature breakdown</h2>
            <p class="mx-auto max-w-2xl text-base text-muted-foreground md:text-lg">
              An honest comparison. Doppler has deeper enterprise features. EnvManager covers the core workflow most teams actually need, at a fraction of the cost.
            </p>
          </div>

          <MarketingCard
            icon="lucide:layout-list"
            title="Capabilities overview"
            description="Both platforms cover core secrets management. The trade-off is enterprise breadth versus focused simplicity."
            class="rounded-2xl border-border/40 bg-card/40 backdrop-blur-md"
          >
            <div class="mt-6 overflow-hidden rounded-xl border border-border/40">
              <table class="min-w-full text-sm">
                <thead class="bg-muted/30 text-foreground">
                  <tr>
                    <th class="px-6 py-4 text-left font-semibold">Feature</th>
                    <th class="px-6 py-4 text-center font-semibold text-muted-foreground">Doppler</th>
                    <th class="bg-primary/5 px-6 py-4 text-center font-bold text-primary border-x border-primary/10">EnvManager</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border/40 bg-card/20">
                  <tr
                    v-for="feature in comparisonFeatures"
                    :key="feature.name"
                    class="transition-colors hover:bg-muted/10"
                  >
                    <td class="px-6 py-4 align-top">
                      <p class="font-medium text-foreground">{{ feature.name }}</p>
                      <p v-if="feature.note" class="mt-1 text-xs text-muted-foreground">{{ feature.note }}</p>
                    </td>
                    <td class="px-6 py-4 text-center align-middle">
                      <Icon v-if="feature.doppler === true" name="lucide:check" class="mx-auto h-5 w-5 text-foreground" />
                      <Icon v-else-if="feature.doppler === false" name="lucide:minus" class="mx-auto h-5 w-5 text-muted-foreground/30" />
                      <span v-else class="text-sm text-muted-foreground">{{ feature.doppler }}</span>
                    </td>
                    <td class="bg-primary/5 px-6 py-4 text-center align-middle border-x border-primary/10">
                      <Icon v-if="feature.envmanager === true" name="lucide:check" class="mx-auto h-5 w-5 text-primary" />
                      <Icon v-else-if="feature.envmanager === false" name="lucide:minus" class="mx-auto h-5 w-5 text-muted-foreground/30" />
                      <span v-else class="font-medium text-foreground">{{ feature.envmanager }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </MarketingCard>
        </div>
      </div>
    </section>

    <section class="relative px-4 py-14 md:px-6 md:py-20">
      <div class="container relative z-10">
        <div class="mx-auto grid max-w-6xl gap-6 md:grid-cols-2">
          <MarketingCard
            icon="lucide:building-2"
            title="When Doppler makes sense"
            description="Doppler is the right fit when enterprise compliance and breadth of integrations outweigh cost."
            class="rounded-2xl border-border/40 bg-card/40"
          >
            <div class="mt-6 space-y-4">
              <div v-for="reason in chooseDoppler" :key="reason" class="flex items-start gap-3 text-sm text-muted-foreground">
                <span class="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted/20">
                  <Icon name="lucide:check" class="h-3 w-3 text-muted-foreground" />
                </span>
                <span>{{ reason }}</span>
              </div>
            </div>
          </MarketingCard>

           <MarketingCard
             icon="lucide:shield-check"
             title="When EnvManager is the better fit"
             description="EnvManager is built for teams that need the core secrets workflow without per-seat cost surprises."
             class="rounded-2xl border-primary/20 bg-primary/5 shadow-sm"
           >
            <div class="mt-6 space-y-4">
              <div v-for="reason in chooseEnvManager" :key="reason" class="flex items-start gap-3 text-sm text-foreground">
                <span class="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
                  <Icon name="lucide:check" class="h-3 w-3 text-primary" />
                </span>
                <span>{{ reason }}</span>
              </div>
            </div>
          </MarketingCard>
        </div>
      </div>
    </section>

    <section class="relative px-4 pb-20 pt-10 md:px-6 md:pb-24 md:pt-16">
      <div class="container relative z-10">
        <MarketingCard
          icon="lucide:rocket"
          title="Same encryption. Same RBAC. 96% less at 10 users."
          description="Start a 14-day free trial, then upgrade to Pro when your team needs unlimited projects and collaboration controls. No credit card required."
          class="mx-auto max-w-4xl rounded-2xl border-primary/20 bg-primary/5 text-center shadow-sm"
        >
          <div class="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <NuxtLink to="/auth/register" @click="track('signup_cta_clicked', { page_source: 'comparison_doppler', cta_text: 'Switch to EnvManager' })">
              <Button
                size="lg"
                class="h-11 bg-primary px-8 text-base font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <Icon name="lucide:rocket" class="mr-2 h-5 w-5" />
                Start 14-Day Free Trial
              </Button>
            </NuxtLink>
            <NuxtLink to="/pricing">
              <Button
                variant="outline"
                size="lg"
                class="h-11 border-border/60 bg-transparent px-8 text-base text-foreground hover:bg-muted/50"
              >
                <Icon name="lucide:calculator" class="mr-2 h-5 w-5" />
                Compare Pricing
              </Button>
            </NuxtLink>
          </div>
        </MarketingCard>

        <p class="mx-auto mt-8 max-w-4xl text-center text-sm text-muted-foreground">
          Comparing more tools? See our
          <NuxtLink to="/blog/doppler-pricing-alternatives" class="text-primary hover:underline">Doppler pricing &amp; alternatives</NuxtLink>
          guide and the full
          <NuxtLink to="/blog/best-secrets-management-tools" class="text-primary hover:underline">secrets management tools comparison</NuxtLink>.
        </p>
      </div>
    </section>
  </div>
</template>

<script setup>
import Button from '@/components/ui/Button.vue'

definePageMeta({
  layout: 'default'
})

useSeoMeta({
  title: 'EnvManager vs Doppler - Best Doppler Alternative for Teams in 2026 | EnvManager',
  description: 'Looking for a Doppler alternative? Compare EnvManager and Doppler for secrets management. Same AES-256 encryption, RBAC, and audit logs — flat $9/mo vs $21/user/mo. No per-seat pricing.',
  ogTitle: 'EnvManager vs Doppler - The Doppler Alternative That Doesn\'t Charge Per Seat',
  ogDescription: 'Compare EnvManager and Doppler side-by-side. Same encryption and RBAC — but EnvManager is $9/mo flat instead of $21/user/mo. Switch in minutes.'
})

const { track } = usePostHog()

onMounted(() => {
  track('comparison_page_viewed', { competitor: 'doppler' })
})

const handleHeroClick = (event) => {
  const target = event.target
  if (!(target instanceof Element)) {
    return
  }

  if (target.closest('[data-testid="primary-cta"]')) {
    track('signup_cta_clicked', { page_source: 'comparison', cta_text: 'Start Free Trial' })
  }
}

const heroStats = [
  { label: 'Doppler Team', value: '$21/user/mo' },
  { label: 'EnvManager Pro', value: '$9/mo flat' },
  { label: 'Savings at 10 users', value: '96%' }
]

const pricingRows = [
  { users: 1, doppler: '$21', envmanager: '$9', savings: '57%' },
  { users: 5, doppler: '$105', envmanager: '$9', savings: '91%' },
  { users: 10, doppler: '$210', envmanager: '$9', savings: '96%' },
  { users: 25, doppler: '$525', envmanager: '$9', savings: '98%' }
]

const comparisonFeatures = [
  { name: 'AES-256 Encryption', doppler: true, envmanager: true, note: 'EnvManager uses Supabase Vault (pgsodium)' },
  { name: 'Environment Separation', doppler: true, envmanager: true },
  { name: 'CLI Tool', doppler: true, envmanager: true },
  { name: 'Audit Logging', doppler: true, envmanager: true },
  { name: 'Role-Based Access Control', doppler: true, envmanager: true, note: 'Doppler charges $9/seat extra for custom roles' },
  { name: 'Version History', doppler: true, envmanager: true },
  { name: 'SOC 2 Type II', doppler: true, envmanager: false, note: 'Doppler is SOC 2 certified' },
  { name: 'Native Integrations', doppler: '20+', envmanager: '6', note: 'Doppler has broader coverage; EnvManager covers Vercel, Railway, Render, GitHub, Dokploy, Coolify' },
  { name: 'Secret Rotation', doppler: true, envmanager: false },
  { name: 'Dynamic Secrets', doppler: 'Enterprise', envmanager: false },
  { name: 'SAML SSO / SCIM', doppler: true, envmanager: false },
  { name: 'Schema Validation', doppler: false, envmanager: true, note: 'Validate variable names and values before deploy' },
  { name: 'Approval Workflows', doppler: false, envmanager: true, note: 'Require review before production changes' },
  { name: 'Self-Hosted Platform Support', doppler: false, envmanager: true, note: 'Dokploy and Coolify integrations' },
  { name: 'Flat Pricing (no per-seat)', doppler: false, envmanager: true, note: '$9/mo for unlimited team members' }
]

const chooseDoppler = [
  'You need SOC 2 Type II certification for compliance or regulatory requirements',
  'You rely on 20+ native platform integrations that Doppler supports out of the box',
  'You need automatic secret rotation or dynamic secrets for database credentials',
  'Your organization requires SAML SSO, SCIM provisioning, or dedicated infrastructure',
  'Enterprise budget is approved and you need those features now'
]

const chooseEnvManager = [
  'You want encryption, RBAC, and audit logs without per-seat pricing eating your budget',
  'Your team is growing and you need predictable costs — $9/month, whether you have 5 or 50 people',
  'You deploy to Vercel, Railway, Render, GitHub Actions, Dokploy, or Coolify',
  'You want schema validation and approval workflows included — not gated behind enterprise tiers',
  'You prefer a focused, opinionated tool that does env management well over a large platform you only use 20% of'
]
</script>
