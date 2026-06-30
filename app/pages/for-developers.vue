<template>
  <div class="relative isolate overflow-hidden bg-background text-foreground">
    <div class="pointer-events-none absolute inset-0">
      <div class="hero-grid absolute inset-0 opacity-50"></div>
      <div class="absolute -left-40 top-24 h-96 w-96 rounded-full bg-primary/25 blur-[120px]"></div>
       <div class="absolute -right-48 top-[30%] h-[26rem] w-[26rem] rounded-full bg-primary/20 blur-[140px]"></div>
      <div class="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-background via-background/70 to-transparent"></div>
    </div>

    <main class="relative">
      <section class="py-16 md:py-24">
        <div class="container px-4 md:px-6 space-y-8 md:space-y-12">
          <MarketingHero
            badge="Built for Developers"
            badge-icon="lucide:terminal"
            title="Your .env file is not a secret management strategy"
            description="Import your existing .env in 30 seconds. Pull secrets with the CLI. Push to Vercel, Railway, or Render in one command. Schema validation catches misconfigurations before they hit production. 14-day free trial."
            primary-cta-label="Start Free Trial"
            primary-cta-to="/auth/register"
            primary-icon="lucide:terminal"
            secondary-cta-label="Read the Docs"
            secondary-cta-to="/docs"
          />

          <div class="grid gap-4 md:grid-cols-3">
            <div
              v-for="proof in developerProofPoints"
              :key="proof"
              class="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary-foreground/90"
            >
              <Icon name="lucide:check-circle" class="mr-2 inline h-4 w-4 text-primary" />
              {{ proof }}
            </div>
          </div>

          <div class="mt-12 overflow-hidden rounded-xl border border-border/60 bg-card/50 p-2 shadow-2xl backdrop-blur-sm md:mt-16 md:p-4">
            <img
              src="/images/product/variables-management.png"
              alt="EnvManager Variables Dashboard"
              class="h-auto w-full rounded-lg border border-border/40 shadow-sm"
              width="1200"
              height="675"
            />
          </div>
        </div>
      </section>

      <section class="border-y border-border/60 bg-muted/20 py-16 md:py-24">
        <div class="container px-4 md:px-6">
          <div class="mx-auto mb-10 max-w-3xl text-center md:mb-14">
            <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">Three steps. Zero workflow disruption.</h2>
            <p class="mt-4 text-base text-muted-foreground md:text-lg">
              EnvManager fits into the tools you already use. No new process to learn.
            </p>
          </div>

          <div class="space-y-12 md:space-y-24">
            <div v-for="(step, i) in workflowSteps" :key="step.title" class="flex flex-col gap-8 md:flex-row md:items-center" :class="{ 'md:flex-row-reverse': i % 2 === 1 }">
               <div class="flex-1 space-y-4">
                 <div class="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon :name="step.icon" class="h-6 w-6" />
                 </div>
                 <h3 class="text-2xl font-bold">{{ step.title }}</h3>
                 <p class="text-muted-foreground text-lg">{{ step.description }}</p>
                 <div class="text-sm font-medium text-primary bg-primary/5 inline-block px-3 py-1 rounded-full border border-primary/10">{{ step.index }}</div>
               </div>
               <div class="flex-1 rounded-xl border border-border/60 bg-card/50 p-8 shadow-sm backdrop-blur-sm min-h-[200px] flex items-center justify-center text-muted-foreground/40 bg-[url('/images/grid-pattern.svg')]">
                  <!-- Placeholder or specific illustration for each step could go here -->
                  <Icon :name="step.icon" class="h-24 w-24 opacity-20" />
               </div>
            </div>
          </div>
        </div>
      </section>

      <section class="py-16 md:py-24">
        <div class="container px-4 md:px-6">
          <div class="mx-auto mb-10 max-w-3xl text-center md:mb-14">
            <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">Developer tools, not enterprise bloat</h2>
          </div>

          <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <MarketingCard
              v-for="feature in developerFeatures"
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
              <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">14-day free trial — no credit card</h2>
              <p class="mt-4 text-base text-muted-foreground md:text-lg">
                Everything you need for personal projects, side projects, and freelance work. No credit card required.
              </p>
            </div>

            <div class="mb-10 grid gap-8 md:grid-cols-2">
              <div>
                 <h3 class="mb-4 text-sm font-semibold uppercase tracking-wide text-primary">Included in Trial</h3>
                <div class="space-y-2.5">
                  <div v-for="item in freeTierItems" :key="item" class="flex items-center gap-2 text-sm text-muted-foreground">
                     <Icon name="lucide:check" class="h-4 w-4 text-primary" />
                    <span>{{ item }}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 class="mb-4 text-sm font-semibold uppercase tracking-wide text-primary">Upgrade for more</h3>
                <div class="space-y-2.5">
                  <div v-for="item in upgradeItems" :key="item" class="flex items-center gap-2 text-sm text-muted-foreground">
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
                Compare Plans
              </NuxtLink>
            </div>
          </div>
        </div>
      </section>

      <section class="py-16 md:py-24">
        <div class="container px-4 md:px-6">
          <div class="mx-auto max-w-4xl rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card/80 to-background/80 p-8 text-center backdrop-blur-sm md:p-12">
            <h2 class="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">Your secrets deserve better than a .env file</h2>
            <p class="mx-auto mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
              Import your .env in 30 seconds. 14-day free trial. No workflow changes required.
            </p>

            <div class="mt-8 flex justify-center">
              <NuxtLink
                to="/auth/register"
                class="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              >
                <Icon name="lucide:rocket" class="mr-2 h-4 w-4" />
                Start Free Trial
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
  title: 'EnvManager for Developers - CLI-First Secret Management',
  description: 'Import your .env in 30 seconds. Pull and push secrets from the terminal. Schema validation, variable references, and 6+ platform integrations. 14-day free trial.',
  ogTitle: 'EnvManager for Developers - CLI-First Secret Management',
  ogDescription: 'Import your .env in 30 seconds. Pull and push secrets from the terminal. Schema validation and 6+ platform integrations. 14-day free trial.'
})

const developerProofPoints = [
  'npm install -g @envmanager-cli/cli',
  'envmanager pull — secrets in your .env, encrypted at rest',
  'envmanager push — sync to Vercel, Railway, Render in one command'
]

const workflowSteps = [
  {
    index: '1. Import',
    icon: 'lucide:upload',
    title: 'Import your .env in 30 seconds',
    description: 'Drag and drop your .env file or paste raw variables. EnvManager parses, encrypts, and stores them. No manual entry.'
  },
  {
    index: '2. Organize',
    icon: 'lucide:settings',
    title: 'Separate dev, staging, and production',
    description: 'Each environment has its own variables. Mark sensitive values as secrets — they get AES-256 encryption automatically. Use ${VAR} references to avoid duplication.'
  },
  {
    index: '3. Deploy',
    icon: 'lucide:terminal',
    title: 'Sync with one CLI command',
    description: 'Run envmanager push to sync secrets to your deploy platform. Or use the dashboard for one-click sync to Vercel, Railway, Render, Dokploy, Coolify, and GitHub Actions.'
  }
]

const developerFeatures = [
  {
    icon: 'lucide:terminal',
    title: 'CLI-First Workflow',
    description: 'Pull, push, diff, validate, and sync from your terminal. File watcher for real-time dev sync. Fits into your existing workflow.'
  },
  {
    icon: 'lucide:file-down',
    title: 'One-Click .env Import',
    description: 'Drag and drop your existing .env file. EnvManager parses it, encrypts secrets, and organizes by environment. Export back to .env anytime.'
  },
  {
    icon: 'lucide:link',
    title: 'Variable References',
    description: 'Reference other variables with ${VAR} syntax. Circular dependency detection built in. See resolved values in the preview.'
  },
  {
    icon: 'lucide:plug',
    title: '6+ Platform Integrations',
    description: 'GitHub, Vercel, Railway, Render, Dokploy, Coolify. Push secrets to your deploy platform without leaving the terminal.'
  },
  {
    icon: 'lucide:file-check',
    title: 'Schema Validation',
    description: 'Define type, format, and required rules for variables. Validate in the CLI before deploy. Catch misconfigurations in CI, not production.'
  },
  {
    icon: 'lucide:shield',
    title: 'AES-256 Encrypted Secrets',
    description: 'Secrets are encrypted at rest and never displayed in plain text. Decrypt on demand with role-based access control.'
  },
  {
    icon: 'lucide:text-cursor-input',
    title: 'Naming Convention Enforcement',
    description: 'Set org-wide rules like UPPER_SNAKE_CASE. Audit existing variables in bulk. Validate on every create and import.'
  },
  {
    icon: 'lucide:history',
    title: 'Version History & Rollback',
    description: 'Every change is versioned. Roll back to any previous state. Take snapshots before risky deployments.'
  }
]

const freeTierItems = [
  '1 project with 3 environments',
  'Unlimited variables and secrets',
  'Full CLI access (pull, push, diff, validate)',
  '1 platform integration',
  '7-day version history'
]

const upgradeItems = [
  'Unlimited projects and environments',
  'All 6+ platform integrations',
  'Full version history with snapshots',
  'Schema validation and naming conventions',
  'Priority support'
]
</script>
