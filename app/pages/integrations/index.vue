<template>
  <div class="relative overflow-hidden bg-background text-foreground">
    <div class="pointer-events-none absolute inset-0">
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.08),transparent_55%)]"></div>
      <div class="absolute -top-40 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-primary/6 blur-[120px]"></div>
      <div class="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-primary/5 blur-3xl"></div>
      <div class="absolute right-0 top-1/3 h-96 w-96 rounded-full bg-primary/4 blur-[130px]"></div>
    </div>

    <section class="relative py-20 md:py-28">
      <div class="container px-4 md:px-6">
        <div class="mx-auto flex max-w-4xl flex-col items-center space-y-8 text-center">
          <div class="rounded-full border border-primary/20 bg-primary/8 px-5 py-2 backdrop-blur-md">
            <span class="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">Platform Integrations</span>
          </div>

          <h1 class="text-balance text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
            Stop copy-pasting secrets
            <span class="bg-gradient-to-r from-foreground via-primary/80 to-foreground/90 bg-clip-text text-transparent">
              into every platform.
            </span>
          </h1>

          <p class="max-w-3xl text-lg leading-relaxed text-muted-foreground md:text-xl">
            Sync environment variables to GitHub, Vercel, Railway, Render, Dokploy, and Coolify with one click. Define once, deploy everywhere.
          </p>

          <div class="flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
            <NuxtLink
              to="/auth/register"
              class="inline-flex w-full items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:w-auto"
            >
              <Icon name="lucide:rocket" class="mr-2 h-4 w-4" />
              Start Free Trial
            </NuxtLink>
            <NuxtLink
              to="/docs"
              class="inline-flex w-full items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-medium shadow-sm transition-colors hover:bg-muted sm:w-auto"
            >
              View Documentation
            </NuxtLink>
          </div>

          <div class="grid w-full max-w-3xl grid-cols-3 gap-3 rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur-xl">
            <div class="rounded-xl border border-border/60 bg-card/70 px-4 py-3">
              <p class="text-2xl font-semibold text-foreground">{{ platforms.length }}</p>
              <p class="text-xs uppercase tracking-wide text-muted-foreground">Platforms</p>
            </div>
            <div class="rounded-xl border border-border/60 bg-card/70 px-4 py-3">
              <p class="text-2xl font-semibold text-foreground">1-click</p>
              <p class="text-xs uppercase tracking-wide text-muted-foreground">Sync workflow</p>
            </div>
            <div class="rounded-xl border border-border/60 bg-card/70 px-4 py-3">
              <p class="text-2xl font-semibold text-foreground">Encrypted</p>
              <p class="text-xs uppercase tracking-wide text-muted-foreground">Transport + storage</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="relative px-4 py-14 md:px-6 md:py-20">
      <div class="container relative z-10">
        <div class="mx-auto max-w-6xl space-y-10">
          <div class="space-y-4 text-center">
            <span class="inline-flex items-center rounded-full border border-primary/20 bg-primary/8 px-4 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary/80">
              Supported Platforms
            </span>
            <h2 class="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              Connect once, sync everywhere
            </h2>
            <p class="mx-auto max-w-3xl text-base text-muted-foreground md:text-lg">
              Choose your stack. Manage every secret from one dashboard.
            </p>
          </div>

          <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <NuxtLink
              v-for="platform in platforms"
              :key="platform.id"
              :to="`/integrations/${platform.id}`"
              class="group block"
            >
              <MarketingCard
                :icon="platform.icon"
                :title="platform.name"
                :description="platform.description"
                class="!h-full !rounded-3xl !border-border/70 !bg-card/60 text-foreground backdrop-blur-2xl transition-all duration-300 group-hover:-translate-y-1 group-hover:!border-primary/30 group-hover:shadow-glow-lg"
              >
                <div class="space-y-4 pt-1">
                  <div class="flex items-center justify-between border-b border-border/60 pb-3">
                    <span class="rounded-full border border-primary/20 bg-primary/8 px-2.5 py-1 text-xs font-medium text-primary/80">
                      {{ platform.badge.text }}
                    </span>
                    <span class="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                      Open integration
                      <Icon name="lucide:arrow-right" class="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>

                  <div class="space-y-2.5">
                    <div
                      v-for="feature in platform.features"
                      :key="feature"
                      class="flex items-center gap-3"
                    >
                      <div class="flex h-5 w-5 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
                        <Icon name="lucide:check" class="h-3 w-3 text-primary/80" />
                      </div>
                      <span class="text-sm text-foreground/85">{{ feature }}</span>
                    </div>
                  </div>
                </div>
              </MarketingCard>
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <section class="relative px-4 py-14 md:px-6 md:py-20">
      <div class="container relative z-10">
        <div class="mx-auto max-w-6xl rounded-3xl border border-border/60 bg-card/70 p-6 backdrop-blur-xl md:p-8">
          <div class="mb-8 space-y-3 text-center">
            <h2 class="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Compare platform support
            </h2>
            <p class="mx-auto max-w-3xl text-muted-foreground">
              See which features are available for each platform at a glance.
            </p>
          </div>

          <div class="overflow-x-auto rounded-2xl border border-border/60 bg-card/75">
            <table class="w-full min-w-[760px]">
              <thead>
                <tr class="border-b border-border/60">
                  <th class="p-4 text-left text-sm font-semibold text-foreground/90">Feature</th>
                  <th v-for="platform in platforms" :key="platform.id" class="p-4 text-center">
                    <div class="flex flex-col items-center gap-1">
                      <Icon :name="platform.icon" :class="['h-5 w-5', platform.iconColor]" />
                      <span class="text-xs font-medium text-muted-foreground">{{ platform.name }}</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="feature in comparisonFeatures"
                  :key="feature.name"
                  class="border-b border-border/40 last:border-b-0"
                >
                  <td class="p-4 text-sm text-foreground/85">{{ feature.name }}</td>
                  <td v-for="platform in platforms" :key="platform.id" class="p-4 text-center">
                    <Icon
                      v-if="feature.platforms[platform.id]"
                      name="lucide:check"
                      class="mx-auto h-4 w-4 text-primary/80"
                    />
                    <Icon
                      v-else
                      name="lucide:minus"
                        class="mx-auto h-4 w-4 text-muted-foreground"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>

    <section class="relative px-4 py-14 md:px-6 md:py-20">
      <div class="container relative z-10">
        <div class="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2 lg:items-start">
          <div class="space-y-6 rounded-3xl border border-border/60 bg-card/70 p-6 backdrop-blur-xl md:p-8">
            <h2 class="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Why teams centralize secrets
            </h2>
            <p class="text-base text-muted-foreground md:text-lg">
              Stop environment drift, eliminate deployment friction, and keep a full audit trail -- all without copy-pasting a single value.
            </p>

            <div class="space-y-3">
              <div class="rounded-2xl border border-border/60 bg-card/60 p-4">
                <h3 class="font-semibold text-foreground">Single source of truth</h3>
                <p class="mt-1 text-sm text-muted-foreground">Define once and sync consistent values to every connected platform.</p>
              </div>
              <div class="rounded-2xl border border-border/60 bg-card/60 p-4">
                <h3 class="font-semibold text-foreground">Faster release cycles</h3>
                <p class="mt-1 text-sm text-muted-foreground">Move from setup to deploy in minutes with one-click propagation.</p>
              </div>
              <div class="rounded-2xl border border-border/60 bg-card/60 p-4">
                <h3 class="font-semibold text-foreground">Audit-first operations</h3>
                <p class="mt-1 text-sm text-muted-foreground">Track every sync event for compliance and incident response.</p>
              </div>
            </div>
          </div>

          <div class="space-y-6 rounded-3xl border border-border/60 bg-card/70 p-6 backdrop-blur-xl md:p-8">
            <h2 class="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Frequently asked questions</h2>
            <div class="space-y-3">
              <div
                v-for="faq in faqs"
                :key="faq.question"
                class="rounded-2xl border border-border/60 bg-card/60 p-5"
              >
                <h3 class="font-semibold text-foreground">{{ faq.question }}</h3>
                <p class="mt-2 text-sm leading-relaxed text-muted-foreground">{{ faq.answer }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="relative px-4 pb-20 pt-10 md:px-6 md:pb-24 md:pt-16">
      <div class="container relative z-10">
         <div class="mx-auto max-w-5xl rounded-3xl border border-border/60 bg-card/80 p-7 text-center shadow-glow-xl backdrop-blur-xl md:p-12">
          <h2 class="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            Connect your first platform in under 5 minutes.
          </h2>
          <p class="mx-auto mt-4 max-w-3xl text-base text-foreground/85 md:text-lg">
            Free to start. No credit card required. Sync secrets across every platform your team ships to.
          </p>

          <div class="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
              class="h-auto bg-primary px-8 py-6 text-lg font-semibold text-primary-foreground transition-all duration-300 hover:bg-primary/90 hover:shadow-glow"
              @click="navigateTo('/auth/register')"
            >
              <Icon name="lucide:rocket" class="mr-2 h-5 w-5" />
              Start Free Trial
            </Button>
            <Button
              variant="outline"
              size="lg"
              class="h-auto border-border/80 bg-card/70 px-8 py-6 text-lg text-foreground hover:border-primary/35 hover:bg-primary/6"
              @click="navigateTo('/docs')"
            >
              <Icon name="lucide:book-open" class="mr-2 h-5 w-5" />
              View Documentation
            </Button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
definePageMeta({
  layout: 'default'
})

useSeoMeta({
  title: 'Platform Integrations - EnvManager',
  description: 'Sync environment variables to GitHub, Vercel, Railway, Render & more. One dashboard for all your deployments.',
  ogTitle: 'Platform Integrations - EnvManager',
  ogDescription: 'Sync environment variables to GitHub, Vercel, Railway, Render & more. One dashboard for all your deployments.'
})

import Button from '@/components/ui/Button.vue'

const platforms = [
  {
    id: 'github',
    name: 'GitHub',
    icon: 'logos:github-icon',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    iconColor: '',
    description: 'Sync secrets directly to GitHub Actions. Support for repository, environment, and organization-level secrets.',
    badge: { text: 'Popular', color: 'bg-primary/8 text-primary/80' },
    features: [
      'Repository secrets',
      'Environment secrets',
      'Organization secrets',
      'Automatic encryption'
    ]
  },
  {
    id: 'vercel',
    name: 'Vercel',
    icon: 'logos:vercel-icon',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    iconColor: '',
    description: 'One-click sync to Vercel projects. Keep your frontend deployments in sync with your secrets.',
    badge: { text: 'Popular', color: 'bg-primary/8 text-primary/80' },
    features: [
      'Project integration',
      'Environment targeting',
      'Preview/Production sync',
      'Team projects support'
    ]
  },
  {
    id: 'railway',
    name: 'Railway',
    icon: 'simple-icons:railway',
    bgColor: 'bg-primary/8',
    iconColor: 'text-primary/80',
    description: 'Deploy your Railway services with the right configuration. Sync variables to any service or environment.',
    badge: { text: 'Available', color: 'bg-primary/12 text-primary/85' },
    features: [
      'Service integration',
      'Environment targeting',
      'Project variables',
      'Automatic redeploy'
    ]
  },
  {
    id: 'render',
    name: 'Render',
    icon: 'simple-icons:render',
    bgColor: 'bg-primary/8',
    iconColor: 'text-primary/80',
    description: 'Manage Render environment groups and service variables from one place.',
    badge: { text: 'Available', color: 'bg-primary/12 text-primary/85' },
    features: [
      'Environment groups',
      'Service variables',
      'Blueprint support',
      'Multi-service sync'
    ]
  },
  {
    id: 'dokploy',
    name: 'Dokploy',
    icon: 'lucide:server',
    bgColor: 'bg-primary/8',
    iconColor: 'text-primary/80',
    description: 'Self-hosted deployment platform integration. Perfect for teams running their own infrastructure.',
    badge: { text: 'Self-hosted', color: 'bg-muted text-muted-foreground' },
    features: [
      'Application variables',
      'Custom endpoints',
      'CA certificate support',
      'Docker integration'
    ]
  },
  {
    id: 'coolify',
    name: 'Coolify',
    icon: 'lucide:cloud',
    bgColor: 'bg-primary/8',
    iconColor: 'text-primary/80',
    description: 'Open-source, self-hostable Heroku alternative. Sync variables to your Coolify applications.',
    badge: { text: 'Self-hosted', color: 'bg-muted text-muted-foreground' },
    features: [
      'Application variables',
      'Self-hosted support',
      'CA certificate support',
      'Preview deployments'
    ]
  }
]

const comparisonFeatures = [
  {
    name: 'One-click sync',
    platforms: { github: true, vercel: true, railway: true, render: true, dokploy: true, coolify: true }
  },
  {
    name: 'Environment targeting',
    platforms: { github: true, vercel: true, railway: true, render: true, dokploy: true, coolify: true }
  },
  {
    name: 'Automatic encryption',
    platforms: { github: true, vercel: true, railway: true, render: true, dokploy: true, coolify: true }
  },
  {
    name: 'Organization/team support',
    platforms: { github: true, vercel: true, railway: true, render: true, dokploy: false, coolify: false }
  },
  {
    name: 'Self-hosted option',
    platforms: { github: false, vercel: false, railway: false, render: false, dokploy: true, coolify: true }
  },
  {
    name: 'CA certificate support',
    platforms: { github: false, vercel: false, railway: false, render: false, dokploy: true, coolify: true }
  },
  {
    name: 'Preview environment sync',
    platforms: { github: true, vercel: true, railway: true, render: false, dokploy: true, coolify: true }
  }
]

const faqs = [
  {
    question: 'Which platforms do you support?',
    answer: 'We currently support GitHub (Actions secrets), Vercel, Railway, Render, Dokploy, and Coolify. We\'re constantly adding more integrations based on user feedback.'
  },
  {
    question: 'How does the sync work?',
    answer: 'When you connect a platform, EnvManager securely stores your API credentials (encrypted). When you sync, we push your selected variables to the platform using their official API. Variables are encrypted in transit and at rest.'
  },
  {
    question: 'Can I sync to multiple environments?',
    answer: 'Yes! Most platforms support environment-specific variables. You can sync your "production" environment in EnvManager to your production environment on Vercel, Railway, etc.'
  },
  {
    question: 'Is my data secure?',
    answer: 'Absolutely. Your platform credentials and variables are encrypted using industry-standard AES-256 encryption. We never store your secrets in plain text, and all API communication uses HTTPS.'
  },
  {
    question: 'Can I use this with self-hosted platforms?',
    answer: 'Yes! Dokploy and Coolify integrations support custom endpoints and CA certificates, making them perfect for self-hosted or on-premise deployments.'
  }
]
</script>
