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
             badge="EnvManager vs dotenvx"
             badge-icon="lucide:terminal"
             title="The dotenvx alternative when your team outgrows encrypted .env files"
             description="dotenvx is great for encrypted .env files in solo projects. When your team needs a dashboard, role-based access, audit logs, and deployment sync — EnvManager delivers all of that for $9/month. dotenvx Pro costs $349/month."
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
            <h2 class="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Different tools, different trade-offs</h2>
            <p class="mx-auto max-w-2xl text-base text-muted-foreground md:text-lg">
              dotenvx Core is free and open source — ideal for solo devs. dotenvx Pro jumps to $349/month. EnvManager Pro gives teams a dashboard, RBAC, and audit logs for $9/month.
            </p>
          </div>

          <MarketingCard
            icon="lucide:calculator"
            title="Pricing and capability comparison"
            description="dotenvx Pro is $349/month ($299/month annual). EnvManager Pro is $9/month ($7.50/month annual)."
            class="rounded-2xl border-border/40 bg-card/40 backdrop-blur-md"
          >
            <div class="mt-6 overflow-hidden rounded-xl border border-border/40">
              <table class="min-w-full text-sm">
                <thead class="bg-muted/30 text-foreground">
                  <tr>
                    <th class="px-6 py-4 text-left font-semibold">Plan</th>
                    <th class="px-6 py-4 text-center font-semibold text-muted-foreground">dotenvx Core</th>
                    <th class="px-6 py-4 text-center font-semibold text-muted-foreground">dotenvx Pro</th>
                    <th class="bg-primary/5 px-6 py-4 text-center font-bold text-primary border-x border-primary/10">EnvManager Pro</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border/40 bg-card/20">
                  <tr
                    v-for="row in pricingRows"
                    :key="row.label"
                    class="transition-colors hover:bg-muted/10"
                  >
                    <td class="px-6 py-4 font-medium text-foreground">{{ row.label }}</td>
                    <td class="px-6 py-4 text-center text-muted-foreground">{{ row.dotenvxCore }}</td>
                    <td class="px-6 py-4 text-center text-muted-foreground">{{ row.dotenvxPro }}</td>
                    <td class="bg-primary/5 px-6 py-4 text-center font-bold text-foreground border-x border-primary/10">{{ row.envmanager }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="mt-4 text-xs text-muted-foreground">
              dotenv-vault is deprecated in favor of dotenvx. dotenvx Pro pricing from dotenvx.com/pricing. dotenvx Pro includes managed private keys and team permissions.
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
              dotenvx excels at encrypted file-level workflows. EnvManager is built for teams that need visibility, access control, and deployment sync.
            </p>
          </div>

          <MarketingCard
            icon="lucide:layout-list"
            title="Capabilities overview"
            description="Pick file-level control or managed team workflows with policies, visibility, and deployment sync."
            class="rounded-2xl border-border/40 bg-card/40 backdrop-blur-md"
          >
            <div class="mt-6 overflow-hidden rounded-xl border border-border/40">
              <table class="min-w-full text-sm">
                <thead class="bg-muted/30 text-foreground">
                  <tr>
                    <th class="px-6 py-4 text-left font-semibold">Feature</th>
                    <th class="px-6 py-4 text-center font-semibold text-muted-foreground">dotenvx</th>
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
                      <Icon v-if="feature.dotenvx === true" name="lucide:check" class="mx-auto h-5 w-5 text-foreground" />
                      <Icon v-else-if="feature.dotenvx === false" name="lucide:minus" class="mx-auto h-5 w-5 text-muted-foreground/30" />
                      <span v-else class="text-sm text-muted-foreground">{{ feature.dotenvx }}</span>
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
            icon="lucide:file-lock-2"
            title="When dotenvx makes sense"
            description="dotenvx is ideal for solo developers or small teams who want encrypted files with zero external dependencies."
            class="rounded-2xl border-border/40 bg-card/40"
          >
            <div class="mt-6 space-y-4">
              <div v-for="reason in chooseDotenvx" :key="reason" class="flex items-start gap-3 text-sm text-muted-foreground">
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
             description="EnvManager is the right move when your team needs controlled access, visibility, and deployment sync — not just encrypted files."
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

    <section class="relative px-4 py-14 md:px-6 md:py-20">
      <div class="container relative z-10">
        <MarketingCard
          icon="lucide:arrow-right-left"
          title="Migrating from dotenv-vault or dotenvx?"
          description="Import your existing .env files into EnvManager in under 2 minutes. Use the CLI or drag and drop in the dashboard."
          class="mx-auto max-w-5xl rounded-2xl border-border/40 bg-card/40"
        >
          <div class="mt-6 rounded-xl border border-border/40 bg-card/60 p-5">
            <code class="text-sm text-muted-foreground font-mono">
              <span class="text-muted-foreground/50"># Import your existing .env files</span><br>
              <span class="text-primary">$</span> envmanager import .env.production<br>
              <span class="text-primary">$</span> envmanager import .env.staging<br>
              <span class="text-primary">$</span> envmanager import .env.development
            </code>
          </div>
        </MarketingCard>
      </div>
    </section>

    <section class="relative px-4 pb-20 pt-10 md:px-6 md:pb-24 md:pt-16">
      <div class="container relative z-10">
        <MarketingCard
          icon="lucide:rocket"
          title="Dashboard, RBAC, and audit logs. $9/month."
          description="Import your .env files, add your team, and get deployment sync across 6 platforms. No credit card required to start."
          class="mx-auto max-w-4xl rounded-2xl border-primary/20 bg-primary/5 text-center shadow-sm"
        >
          <div class="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <NuxtLink to="/auth/register" @click="track('signup_cta_clicked', { page_source: 'comparison_dotenvx', cta_text: 'Switch to EnvManager' })">
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
  title: 'EnvManager vs dotenvx - Best dotenv Alternative for Teams in 2026 | EnvManager',
  description: 'Looking for a dotenvx or dotenv-vault alternative? EnvManager adds a dashboard, RBAC, audit logging, and platform integrations for $9/month. 39x cheaper than dotenvx Pro.',
  ogTitle: 'EnvManager vs dotenvx - The dotenv Alternative With Team Features Built In',
  ogDescription: 'Compare EnvManager and dotenvx for env management. Dashboard, RBAC, audit logging, and 6 platform integrations for $9/month vs $349/month.'
})

const { track } = usePostHog()

onMounted(() => {
  track('comparison_page_viewed', { competitor: 'dotenvx' })
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
  { label: 'dotenvx Pro', value: '$349/mo' },
  { label: 'EnvManager Pro', value: '$9/mo' },
  { label: 'Price gap', value: '39x cheaper' }
]

const pricingRows = [
  { label: 'Price', dotenvxCore: 'Free', dotenvxPro: '$349/mo', envmanager: '$9/mo' },
  { label: 'Web Dashboard', dotenvxCore: 'No', dotenvxPro: 'No', envmanager: 'Yes' },
  { label: 'RBAC', dotenvxCore: 'No', dotenvxPro: 'No', envmanager: 'Yes' },
  { label: 'Audit Logging', dotenvxCore: 'No', dotenvxPro: 'No', envmanager: 'Yes' },
  { label: 'Platform Integrations', dotenvxCore: 'No', dotenvxPro: 'No', envmanager: '6 platforms' },
  { label: 'Team Management', dotenvxCore: 'No', dotenvxPro: 'Yes', envmanager: 'Yes' },
  { label: 'Version History', dotenvxCore: 'No', dotenvxPro: 'No', envmanager: 'Yes' },
  { label: 'Schema Validation', dotenvxCore: 'No', dotenvxPro: 'No', envmanager: 'Yes' }
]

const comparisonFeatures = [
  { name: 'Encrypted Environment Variables', dotenvx: true, envmanager: true, note: 'EnvManager uses Supabase Vault (pgsodium) for AES-256 encryption' },
  { name: 'CLI Tool', dotenvx: true, envmanager: true },
  { name: 'Open Source', dotenvx: true, envmanager: false, note: 'dotenvx core is fully open source (BSD-3)' },
  { name: 'No Vendor Lock-in', dotenvx: true, envmanager: false, note: 'dotenvx works at the file level with no external dependency' },
  { name: 'Language-Agnostic', dotenvx: true, envmanager: true },
  { name: 'Web Dashboard', dotenvx: false, envmanager: true, note: 'Manage secrets without CLI knowledge' },
  { name: 'Role-Based Access Control', dotenvx: false, envmanager: true, note: 'Control who can read/write per environment' },
  { name: 'Audit Logging', dotenvx: false, envmanager: true, note: 'Track every change — who, what, when' },
  { name: 'Platform Integrations', dotenvx: false, envmanager: '6 platforms', note: 'Vercel, Railway, Render, GitHub Actions, Dokploy, Coolify' },
  { name: 'Team Management & Invitations', dotenvx: false, envmanager: true },
  { name: 'Environment Separation', dotenvx: 'File-based', envmanager: true, note: 'dotenvx uses separate .env files; EnvManager has first-class environment support' },
  { name: 'Schema Validation', dotenvx: false, envmanager: true, note: 'Validate variable names and values before deploy' },
  { name: 'Variable References', dotenvx: false, envmanager: true, note: 'Reference variables across environments' },
  { name: 'Approval Workflows', dotenvx: false, envmanager: true, note: 'Require review before production changes' },
  { name: 'Version History', dotenvx: false, envmanager: true, note: 'Full history of every variable change' }
]

const chooseDotenvx = [
  'You\'re a solo developer who wants encrypted .env files with zero external dependencies',
  'You need a fully open-source solution with no vendor lock-in whatsoever',
  'Your workflow is file-based and you don\'t need a web dashboard or team features',
  'You want secrets stored in your repo (encrypted) and want to avoid any hosted service',
  'You\'re comfortable managing access through file system permissions and Git branch protections'
]

const chooseEnvManager = [
  'Your team needs a dashboard where non-technical members can manage env vars without CLI knowledge',
  'You need role-based access so junior devs or contractors can\'t touch production secrets',
  'You want a full audit trail — who changed what variable, in which environment, and when',
  'You deploy to Vercel, Railway, Render, GitHub Actions, Dokploy, or Coolify and want one-click sync',
  'You want approval workflows that require review before production changes go live',
  'You\'re outgrowing dotenv-vault or dotenvx Core and need team features at $9/month instead of $349/month'
]
</script>
