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
             badge="EnvManager vs Infisical"
             badge-icon="lucide:layers"
             title="The Infisical alternative for teams that just need env vars done right"
             description="Infisical is a powerful infrastructure security platform — dynamic secrets, PKI, SSH, and 50+ integrations. If what you actually need is secure env variable management with RBAC and audit logs, EnvManager does that for $9/month flat instead of $18/identity/month."
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
            <h2 class="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Identity-based pricing adds up fast</h2>
            <p class="mx-auto max-w-2xl text-base text-muted-foreground md:text-lg">
              Infisical Pro charges $18 per identity per month. Users, service tokens, and machine identities all count as separate identities. EnvManager is $9/month flat for your whole team.
            </p>
          </div>

          <MarketingCard
            icon="lucide:calculator"
            title="Monthly cost comparison"
            description="Infisical Pro charges $18/identity/month. Every user and every service token counts. EnvManager Pro is $9/month total."
            class="rounded-2xl border-border/40 bg-card/40 backdrop-blur-md"
          >
            <div class="mt-6 overflow-hidden rounded-xl border border-border/40">
              <table class="min-w-full text-sm">
                <thead class="bg-muted/30 text-foreground">
                  <tr>
                    <th class="px-6 py-4 text-left font-semibold">Team Size</th>
                    <th class="px-6 py-4 text-center font-semibold text-muted-foreground">Infisical Pro</th>
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
                    <td class="px-6 py-4 text-center text-muted-foreground">{{ row.infisical }}/mo</td>
                    <td class="bg-primary/5 px-6 py-4 text-center font-bold text-foreground border-x border-primary/10">{{ row.envmanager }}/mo</td>
                    <td class="px-6 py-4 text-center font-medium text-primary">{{ row.savings }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="mt-4 text-xs text-muted-foreground">
              Infisical's free tier is limited to 5 identities, 3 projects, and 3 environments. Costs above reflect Pro tier pricing for user identities only — service tokens and machine identities add further cost.
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
              Infisical is a broad infrastructure security platform. EnvManager is a focused env variable management tool. Different scope, different price.
            </p>
          </div>

          <MarketingCard
            icon="lucide:layout-list"
            title="Capabilities overview"
            description="Choose infrastructure depth or a focused platform with predictable pricing and faster onboarding."
            class="rounded-2xl border-border/40 bg-card/40 backdrop-blur-md"
          >
            <div class="mt-6 overflow-hidden rounded-xl border border-border/40">
              <table class="min-w-full text-sm">
                <thead class="bg-muted/30 text-foreground">
                  <tr>
                    <th class="px-6 py-4 text-left font-semibold">Feature</th>
                    <th class="px-6 py-4 text-center font-semibold text-muted-foreground">Infisical</th>
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
                      <Icon v-if="feature.infisical === true" name="lucide:check" class="mx-auto h-5 w-5 text-foreground" />
                      <Icon v-else-if="feature.infisical === false" name="lucide:minus" class="mx-auto h-5 w-5 text-muted-foreground/30" />
                      <span v-else class="text-sm text-muted-foreground">{{ feature.infisical }}</span>
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
            icon="lucide:server"
            title="When Infisical makes sense"
            description="Infisical is the right call when your security needs go well beyond env variables."
            class="rounded-2xl border-border/40 bg-card/40"
          >
            <div class="mt-6 space-y-4">
              <div v-for="reason in chooseInfisical" :key="reason" class="flex items-start gap-3 text-sm text-muted-foreground">
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
             description="EnvManager is built for teams that need reliable env variable management without paying for PKI, SSH, and infrastructure features they won't use."
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
          title="Focused on env vars. 95% less at 10 users."
          description="Infisical is a great infrastructure security platform. If your actual need is env variable management with encryption, RBAC, and audit logs — EnvManager does that at $9/month flat."
          class="mx-auto max-w-4xl rounded-2xl border-primary/20 bg-primary/5 text-center shadow-sm"
        >
          <div class="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <NuxtLink to="/auth/register" @click="track('signup_cta_clicked', { page_source: 'comparison_infisical', cta_text: 'Switch to EnvManager' })">
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
          Still weighing options? Read our
          <NuxtLink to="/blog/infisical-alternatives" class="text-primary hover:underline">7 best Infisical alternatives</NuxtLink>
          and the wider
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
  title: 'EnvManager vs Infisical - Best Infisical Alternative for Teams in 2026 | EnvManager',
  description: 'Looking for an Infisical alternative? Compare EnvManager and Infisical for env management. Same encryption and RBAC — flat $9/mo vs $18/identity/mo. No per-identity pricing surprises.',
  ogTitle: 'EnvManager vs Infisical - The Infisical Alternative Without Per-Identity Pricing',
  ogDescription: 'Compare EnvManager and Infisical side-by-side. Same encryption and RBAC — $9/mo flat instead of $18/identity/mo. Focused on env vars, not infrastructure.'
})

const { track } = usePostHog()

onMounted(() => {
  track('comparison_page_viewed', { competitor: 'infisical' })
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
  { label: 'Infisical Pro', value: '$18/identity/mo' },
  { label: 'EnvManager Pro', value: '$9/mo flat' },
  { label: 'Savings at 10 identities', value: '95%' }
]

const pricingRows = [
  { users: 1, infisical: '$18', envmanager: '$9', savings: '50%' },
  { users: 5, infisical: '$90', envmanager: '$9', savings: '90%' },
  { users: 10, infisical: '$180', envmanager: '$9', savings: '95%' },
  { users: 25, infisical: '$450', envmanager: '$9', savings: '98%' }
]

const comparisonFeatures = [
  { name: 'AES-256 Encryption', infisical: true, envmanager: true, note: 'EnvManager uses Supabase Vault (pgsodium)' },
  { name: 'Environment Separation', infisical: true, envmanager: true },
  { name: 'CLI Tool', infisical: true, envmanager: true },
  { name: 'Role-Based Access Control', infisical: true, envmanager: true },
  { name: 'Audit Logging', infisical: true, envmanager: true, note: 'Infisical Pro: 90-day retention. EnvManager: full history.' },
  { name: 'Version History', infisical: true, envmanager: true },
  { name: 'Open Source / Self-Hosted', infisical: true, envmanager: false, note: 'Infisical offers a self-hosted community edition' },
  { name: 'SOC 2 / HIPAA / FIPS 140-3', infisical: true, envmanager: false, note: 'Infisical has extensive compliance certifications' },
  { name: 'Native Integrations', infisical: '50+', envmanager: '6', note: 'EnvManager covers Vercel, Railway, Render, GitHub, Dokploy, Coolify' },
  { name: 'Dynamic Secrets', infisical: 'Enterprise', envmanager: false, note: 'Requires Infisical Enterprise plan' },
  { name: 'PKI / Certificate Management', infisical: true, envmanager: false },
  { name: 'SSH Key Management', infisical: true, envmanager: false },
  { name: 'SDKs', infisical: '6 languages', envmanager: 'CLI + REST API' },
  { name: 'Schema Validation', infisical: false, envmanager: true, note: 'Validate variable names and values before deploy' },
  { name: 'Variable References', infisical: false, envmanager: true, note: 'Reference variables across environments' },
  { name: 'Self-Hosted Platform Support', infisical: false, envmanager: true, note: 'Dokploy and Coolify integrations' },
  { name: 'Flat Pricing (no per-identity)', infisical: false, envmanager: true, note: '$9/mo for unlimited team members' }
]

const chooseInfisical = [
  'You need dynamic secrets that rotate automatically for databases and cloud providers',
  'Your compliance requirements mandate SOC 2, HIPAA, or FIPS 140-3 certification',
  'You want to self-host your secrets manager on your own infrastructure',
  'You need PKI, certificate management, or SSH key management in one platform',
  'You need SDKs in multiple languages for direct application-level secret fetching',
  'Your infrastructure spans 50+ services that need native integrations'
]

const chooseEnvManager = [
  'Your primary need is managing env variables across environments, not infrastructure secrets',
  'You want flat pricing at $9/month — not $18/identity that grows with every service token',
  'You need schema validation and variable naming enforcement before deploys',
  'You deploy to Vercel, Railway, Render, GitHub Actions, Dokploy, or Coolify',
  'You want a focused tool your team can learn in minutes, not a platform with weeks of onboarding',
  'You need 80% of the functionality at 5% of the cost'
]
</script>
