<template>
  <div class="relative isolate overflow-hidden bg-background text-foreground">
    <div class="pointer-events-none absolute inset-0">
      <div class="hero-grid absolute inset-0 opacity-45"></div>
      <div class="absolute -left-44 top-20 h-[28rem] w-[28rem] rounded-full bg-primary/20 blur-[140px]"></div>
      <div class="absolute -right-40 top-[33%] h-[23rem] w-[23rem] rounded-full bg-primary/20 blur-[130px]"></div>
      <div class="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-background via-background/70 to-transparent"></div>
    </div>

    <main class="relative">
      <section class="py-16 md:py-24">
        <div class="container space-y-8 px-4 md:space-y-12 md:px-6">
          <MarketingHero
            badge="Built for Startups"
            badge-icon="lucide:rocket"
            title="Stop DM'ing API keys. Start shipping."
            description="Your team is growing, but your secret management is still a Slack message and a prayer. Set up role-based access in 5 minutes. Sync to Vercel, Railway, and Render in one click. 14-day free trial."
            primary-cta-label="Start Free Trial"
            primary-cta-to="/auth/register"
            primary-icon="lucide:rocket"
            secondary-cta-label="See What's Included"
            secondary-cta-to="/pricing"
          />

          <div class="grid gap-4 md:grid-cols-3">
            <div
              v-for="proof in startupProofPoints"
              :key="proof"
              class="rounded-xl border border-primary/35 bg-primary/10 px-4 py-3 text-sm text-foreground/90"
            >
              <Icon name="lucide:check-circle" class="mr-2 inline h-4 w-4 text-primary" />
              {{ proof }}
            </div>
          </div>

          <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div
              v-for="stat in startupStats"
              :key="stat.label"
              class="rounded-xl border border-border/60 bg-card/70 p-5 text-center"
            >
              <p class="text-2xl font-bold text-primary md:text-3xl">{{ stat.value }}</p>
              <p class="mt-1 text-sm text-muted-foreground">{{ stat.label }}</p>
            </div>
          </div>
        </div>
      </section>

      <section class="border-y border-border/60 bg-muted/20 py-16 md:py-24">
        <div class="container px-4 md:px-6">
          <div class="mx-auto mb-10 max-w-3xl text-center md:mb-14">
            <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">This is how secrets leak at startups</h2>
            <p class="mt-4 text-base text-muted-foreground md:text-lg">
              You are moving fast. That is the point. But scattered credentials slow you down and create risk.
            </p>
          </div>

          <div class="grid gap-8 lg:grid-cols-2 lg:gap-12 items-center">
            <div class="space-y-8">
              <div v-for="painPoint in startupPainPoints" :key="painPoint.title" class="flex gap-4">
                <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon :name="painPoint.icon" class="h-6 w-6" />
                </div>
                <div>
                  <h3 class="text-lg font-semibold">{{ painPoint.title }}</h3>
                  <p class="mt-1 text-muted-foreground">{{ painPoint.description }}</p>
                  <div class="mt-2 inline-flex items-center rounded-md bg-accent/20 px-2 py-1 text-xs font-medium text-accent-foreground">
                    <Icon name="lucide:check" class="mr-1 h-3 w-3" />
                    {{ painPoint.solution }}
                  </div>
                </div>
              </div>
            </div>
            <div class="relative overflow-hidden rounded-xl border border-border/60 bg-card/50 p-2 shadow-2xl backdrop-blur-sm md:p-4 lg:order-last">
              <img
                src="/images/product/dashboard-overview.png"
                alt="EnvManager Dashboard Overview"
                class="h-auto w-full rounded-lg border border-border/40 shadow-sm"
                width="1200"
                height="675"
              />
            </div>
          </div>
        </div>
      </section>

      <section class="py-16 md:py-24">
        <div class="container px-4 md:px-6">
          <div class="mx-auto mb-10 max-w-3xl text-center md:mb-14">
            <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">Move fast. Stay secure. No tradeoff.</h2>
            <p class="mt-4 text-base text-muted-foreground md:text-lg">
              Built for teams that ship daily and cannot afford to slow down for security.
            </p>
          </div>

          <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <MarketingCard
              v-for="feature in startupFeatures"
              :key="feature.title"
              :icon="feature.icon"
              :title="feature.title"
              :description="feature.description"
            />
          </div>
        </div>
      </section>

      <section class="border-y border-border/60 bg-muted/20 py-16 md:py-24">
        <div class="container px-4 md:px-6">
          <div class="mx-auto max-w-4xl rounded-3xl border border-border/60 bg-card/70 p-8 backdrop-blur-sm md:p-10">
            <div class="mx-auto mb-10 max-w-3xl text-center">
              <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">14-day free trial. No credit card. No catch.</h2>
              <p class="mt-4 text-base text-muted-foreground md:text-lg">
                Get started with unlimited variables today. Upgrade to Professional after your trial to keep full access.
              </p>
            </div>

            <div class="mb-10 grid gap-8 md:grid-cols-2">
              <div>
                <h3 class="mb-4 text-sm font-semibold uppercase tracking-wide text-primary">Free trial includes</h3>
                <div class="space-y-2.5">
                  <div v-for="item in startupFreeItems" :key="item" class="flex items-center gap-2 text-sm text-muted-foreground">
                    <Icon name="lucide:check" class="h-4 w-4 text-primary" />
                    <span>{{ item }}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 class="mb-4 text-sm font-semibold uppercase tracking-wide text-primary">When you scale</h3>
                <div class="space-y-2.5">
                  <div v-for="item in startupScaleItems" :key="item" class="flex items-center gap-2 text-sm text-muted-foreground">
                    <Icon name="lucide:plus" class="h-4 w-4 text-primary" />
                    <span>{{ item }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <NuxtLink
                to="/auth/register"
                class="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              >
                <Icon name="lucide:rocket" class="mr-2 h-4 w-4" />
                Start Free Trial
              </NuxtLink>
              <NuxtLink
                to="/pricing"
                class="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
              >
                <Icon name="lucide:credit-card" class="mr-2 h-4 w-4" />
                View Pricing
              </NuxtLink>
            </div>
          </div>
        </div>
      </section>

      <section class="py-16 md:py-24">
        <div class="container px-4 md:px-6">
          <div class="mx-auto max-w-4xl rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/20 via-card/80 to-background/80 p-8 text-center backdrop-blur-sm md:p-12">
            <h2 class="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">Your next hire deserves secure access from day one</h2>
            <p class="mx-auto mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
              Set up in 5 minutes. Free for 14 days. No security expertise needed.
            </p>

            <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <NuxtLink
                to="/auth/register"
                class="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              >
                <Icon name="lucide:rocket" class="mr-2 h-4 w-4" />
                Start Free Trial
              </NuxtLink>
              <NuxtLink
                to="/pricing"
                class="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
              >
                <Icon name="lucide:credit-card" class="mr-2 h-4 w-4" />
                View All Plans
              </NuxtLink>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default'
})

useSeoMeta({
  title: 'EnvManager for Startups - Secure Secrets From Day One',
  description: 'Stop DM\'ing API keys in Slack. Set up encrypted environment variable management in 5 minutes. 14-day free trial, no credit card required. Sync to Vercel, Railway, Render.',
  ogTitle: 'EnvManager for Startups - Secure Secrets From Day One',
  ogDescription: 'Stop DM\'ing API keys in Slack. Set up encrypted secret management in 5 minutes. 14-day free trial, no credit card required.'
})

const startupProofPoints = [
  'Import your .env and go live in under 5 minutes',
  '14-day free trial with unlimited variables',
  'No credit card required to start'
]

const startupStats = [
  {
    value: '< 5 min',
    label: 'From signup to first sync'
  },
  {
    value: '14 days',
    label: 'Free trial, no card required'
  },
  {
    value: '6+',
    label: 'Deploy platform integrations'
  },
  {
    value: 'AES-256',
    label: 'Encryption standard'
  }
]

const startupPainPoints = [
  {
    icon: 'lucide:message-square',
    title: '"Can someone DM me the Stripe key?"',
    description: 'Production secrets are floating around Slack, Discord, and email. One screenshot away from a breach.',
    solution: 'One encrypted dashboard replaces every DM'
  },
  {
    icon: 'lucide:users',
    title: 'New hire on day one, no access for a week',
    description: 'Onboarding takes hours when credentials are pinned in 4 different Slack channels and a shared Google Doc.',
    solution: 'Invite with one click, scoped to their role'
  },
  {
    icon: 'lucide:git-branch',
    title: '"I deployed staging secrets to production"',
    description: 'Local .env files get out of sync. Someone pushes the wrong one. The deploy breaks at 2am.',
    solution: 'One source of truth for every environment'
  }
]

const startupFeatures = [
  {
    icon: 'lucide:zap',
    title: '5-Minute Setup',
    description: 'Drag-and-drop your .env file, invite your team, and sync to your deploy platform. Done before your coffee gets cold.'
  },
  {
    icon: 'lucide:plug',
    title: 'One-Click Deploy Sync',
    description: 'Push secrets to Vercel, Railway, Render, GitHub Actions, Dokploy, and Coolify from a single dashboard.'
  },
  {
    icon: 'lucide:shield',
    title: 'Enterprise Security at Startup Speed',
    description: 'AES-256 encryption and role-based access from day one. No security team required.'
  },
  {
    icon: 'lucide:trending-up',
    title: 'Grows With Your Team',
    description: 'Try free for 14 days. Upgrade to Professional when you need unlimited projects. No per-seat pricing, no surprise invoices.'
  }
]

const startupFreeItems = [
  '1 project with 3 environments',
  'Unlimited variables and secrets',
  '1 platform integration',
  'Role-based access control',
  '7-day version history'
]

const startupScaleItems = [
  'Unlimited projects and environments',
  'Unlimited platform integrations',
  'Approval workflows for production',
  'Full version history with snapshots',
  'Priority support'
]
</script>
