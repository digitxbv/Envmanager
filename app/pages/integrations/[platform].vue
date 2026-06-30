<template>
  <div v-if="platform" class="relative isolate overflow-hidden bg-background text-foreground">
    <div class="pointer-events-none absolute inset-0">
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_14%_12%,hsl(var(--primary)/0.1),transparent_42%),radial-gradient(circle_at_88%_18%,hsl(var(--primary)/0.06),transparent_38%)]"></div>
      <div class="hero-grid absolute inset-0 opacity-20"></div>
      <div class="absolute -top-24 right-0 h-80 w-80 rounded-full bg-primary/6 blur-[130px]"></div>
    </div>

    <section class="relative px-4 pb-14 pt-16 md:px-6 md:pb-20 md:pt-24">
      <div class="container relative z-10">
        <div class="mx-auto max-w-6xl space-y-10">
          <nav class="flex items-center gap-2 text-sm text-muted-foreground">
            <NuxtLink to="/integrations" class="transition-colors hover:text-foreground">Integrations</NuxtLink>
            <Icon name="lucide:chevron-right" class="h-4 w-4" />
            <span class="text-foreground/85">{{ platform.name }}</span>
          </nav>

          <div class="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div class="space-y-7">
              <div class="flex items-center gap-4">
                <div class="flex h-20 w-20 items-center justify-center rounded-2xl border border-primary/20 bg-primary/8 shadow-[0_18px_34px_-28px_hsl(var(--primary)/0.45)]">
                  <Icon :name="platform.icon" :class="['h-10 w-10', platform.iconColor]" />
                </div>
                <div>
                  <h1 class="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">{{ platform.name }}</h1>
                  <p class="mt-1 text-lg text-muted-foreground">{{ platform.tagline }}</p>
                </div>
              </div>

              <p class="text-base leading-relaxed text-muted-foreground md:text-lg">
                {{ platform.heroDescription }}
              </p>

              <div class="flex flex-wrap gap-2">
                <span class="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-xs font-medium text-primary/80">
                  <Icon name="lucide:check-circle" class="h-3.5 w-3.5" />
                  Available now
                </span>
                <span class="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/60 px-3 py-1 text-xs font-medium text-foreground/85">
                  <Icon name="lucide:zap" class="h-3.5 w-3.5 text-amber-300" />
                  One-click sync
                </span>
                <span class="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/60 px-3 py-1 text-xs font-medium text-foreground/85">
                  <Icon name="lucide:shield" class="h-3.5 w-3.5 text-primary/80" />
                  Encrypted transport
                </span>
              </div>

              <div class="flex flex-col gap-3 sm:flex-row">
                <Button
                  size="lg"
                   class="h-auto bg-primary px-8 py-6 text-lg font-semibold text-primary-foreground transition-all duration-300 hover:bg-primary/90 hover:shadow-[0_20px_44px_-24px_hsl(var(--primary)/1)]"
                  @click="navigateTo('/auth/register')"
                >
                  <Icon name="lucide:rocket" class="mr-2 h-5 w-5" />
                  Start Free Trial
                </Button>
                <Button
                  v-if="platform.blogUrl"
                  variant="outline"
                  size="lg"
                  class="h-auto border-border/80 bg-card/70 px-8 py-6 text-lg text-foreground hover:border-primary/35 hover:bg-primary/6"
                  @click="navigateTo(platform.blogUrl)"
                >
                  <Icon name="lucide:book-open" class="mr-2 h-5 w-5" />
                  Read Setup Guide
                </Button>
              </div>
            </div>

            <div class="relative rounded-3xl border border-border/60 bg-card/70 p-6 backdrop-blur-xl md:p-8">
              <div class="space-y-5">
                <div class="flex items-center justify-between">
                  <h3 class="text-lg font-semibold text-foreground">Sync to {{ platform.name }}</h3>
                  <span class="rounded-full border border-primary/20 bg-primary/8 px-2.5 py-1 text-xs font-medium text-primary/80">
                    Connected
                  </span>
                </div>

                <div class="space-y-3">
                  <div class="flex items-center justify-between rounded-xl border border-border/60 bg-card/60 p-3">
                    <div class="flex items-center gap-3">
                      <Icon name="lucide:key" class="h-4 w-4 text-muted-foreground" />
                      <span class="font-mono text-sm text-foreground/85">DATABASE_URL</span>
                    </div>
                    <Icon name="lucide:check" class="h-4 w-4 text-primary/80" />
                  </div>
                  <div class="flex items-center justify-between rounded-xl border border-border/60 bg-card/60 p-3">
                    <div class="flex items-center gap-3">
                      <Icon name="lucide:key" class="h-4 w-4 text-muted-foreground" />
                      <span class="font-mono text-sm text-foreground/85">API_SECRET</span>
                    </div>
                    <Icon name="lucide:check" class="h-4 w-4 text-primary/80" />
                  </div>
                  <div class="flex items-center justify-between rounded-xl border border-border/60 bg-card/60 p-3">
                    <div class="flex items-center gap-3">
                      <Icon name="lucide:key" class="h-4 w-4 text-muted-foreground" />
                      <span class="font-mono text-sm text-foreground/85">STRIPE_KEY</span>
                    </div>
                    <Icon name="lucide:check" class="h-4 w-4 text-primary/80" />
                  </div>
                </div>

                <div class="border-t border-border/60 pt-4 text-sm">
                  <div class="flex items-center justify-between">
                    <span class="text-muted-foreground">Last synced</span>
                    <span class="font-medium text-foreground/85">Just now</span>
                  </div>
                </div>
              </div>
               <div class="absolute -right-3 -top-3 rounded-lg border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary/80 shadow-[0_14px_24px_-22px_hsl(var(--primary)/0.45)]">
                3 variables synced
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="relative px-4 py-14 md:px-6 md:py-20">
      <div class="container relative z-10">
        <div class="mx-auto max-w-6xl space-y-10">
          <div class="space-y-4 text-center">
            <h2 class="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              How to connect {{ platform.name }}
            </h2>
            <p class="mx-auto max-w-3xl text-base text-muted-foreground md:text-lg">
              Follow this flow and your variables are synced in minutes.
            </p>
          </div>

          <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <div v-for="(step, index) in platform.steps" :key="step.title" class="relative">
              <MarketingCard
                :icon="stepIcons[index] || 'lucide:circle-dot'"
                :title="step.title"
                :description="step.description"
                class="!h-full !rounded-3xl !border-border/70 !bg-card/60 text-foreground backdrop-blur-2xl"
              >
                <div class="mt-4 border-t border-border/60 pt-4">
                  <span class="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-primary/20 bg-primary/10 px-2 text-xs font-semibold text-primary/80">
                    {{ index + 1 }}
                  </span>
                </div>
              </MarketingCard>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="relative px-4 py-14 md:px-6 md:py-20">
      <div class="container relative z-10">
        <div class="mx-auto max-w-6xl space-y-10">
          <div class="space-y-4 text-center">
            <h2 class="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              {{ platform.name }} integration features
            </h2>
            <p class="mx-auto max-w-3xl text-base text-muted-foreground md:text-lg">
              Everything needed to operate {{ platform.name }} secrets from EnvManager.
            </p>
          </div>

          <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <MarketingCard
              v-for="feature in platform.features"
              :key="feature.title"
              :icon="feature.icon"
              :title="feature.title"
              :description="feature.description"
                class="!h-full !rounded-3xl !border-border/70 !bg-card/60 text-foreground backdrop-blur-2xl"
            >
              <div class="mt-4 border-t border-border/60 pt-4 text-xs text-muted-foreground">
                Built for secure automation
              </div>
            </MarketingCard>
          </div>
        </div>
      </div>
    </section>

    <section v-if="platform.codeExample" class="relative px-4 py-14 md:px-6 md:py-20">
      <div class="container relative z-10">
        <div class="mx-auto max-w-4xl space-y-6 rounded-3xl border border-border/60 bg-card/70 p-6 backdrop-blur-xl md:p-8">
          <div class="space-y-3 text-center">
            <h2 class="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">See it in action</h2>
            <p class="text-muted-foreground">{{ platform.codeExample.description }}</p>
          </div>

          <div class="overflow-x-auto rounded-2xl border border-border/60 bg-card/75 p-5">
            <pre class="font-mono text-sm text-muted-foreground"><code>{{ platform.codeExample.code }}</code></pre>
          </div>
        </div>
      </div>
    </section>

    <section v-if="platform.blogUrl" class="relative px-4 py-14 md:px-6 md:py-20">
      <div class="container relative z-10">
        <div class="mx-auto max-w-5xl rounded-3xl border border-border/60 bg-card/70 p-6 backdrop-blur-xl md:p-8">
          <div class="flex flex-col items-center gap-6 text-center md:flex-row md:text-left">
            <div class="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/8">
              <Icon :name="platform.icon" :class="['h-8 w-8', platform.iconColor]" />
            </div>
            <div class="flex-1">
              <h3 class="text-2xl font-semibold tracking-tight text-foreground">{{ platform.blogTitle }}</h3>
              <p class="mt-2 text-muted-foreground">{{ platform.blogDescription }}</p>
            </div>
            <Button
              class="h-auto bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90"
              @click="navigateTo(platform.blogUrl)"
            >
              <Icon name="lucide:book-open" class="mr-2 h-4 w-4" />
              Read Guide
            </Button>
          </div>
        </div>
      </div>
    </section>

    <section class="relative px-4 pb-20 pt-10 md:px-6 md:pb-24 md:pt-16">
      <div class="container relative z-10">
         <div class="mx-auto max-w-5xl rounded-3xl border border-border/60 bg-card/80 p-7 text-center shadow-[0_30px_90px_-68px_hsl(var(--primary)/0.4)] backdrop-blur-xl md:p-12">
          <h2 class="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            Ready to connect {{ platform.name }}?
          </h2>
          <p class="mx-auto mt-4 max-w-3xl text-base text-foreground/85 md:text-lg">
            14-day free trial. Connect {{ platform.name }} and sync your first variables in under 5 minutes.
          </p>

          <div class="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
               class="h-auto bg-primary px-8 py-6 text-lg font-semibold text-primary-foreground transition-all duration-300 hover:bg-primary/90 hover:shadow-[0_20px_44px_-24px_hsl(var(--primary)/1)]"
               @click="navigateTo('/auth/register')"
            >
              <Icon name="lucide:rocket" class="mr-2 h-5 w-5" />
              Start Free Trial
            </Button>
            <Button
              variant="outline"
              size="lg"
              class="h-auto border-border/80 bg-card/70 px-8 py-6 text-lg text-foreground hover:border-primary/35 hover:bg-primary/6"
              @click="navigateTo('/integrations')"
            >
              <Icon name="lucide:arrow-left" class="mr-2 h-5 w-5" />
              View All Integrations
            </Button>
          </div>
        </div>
      </div>
    </section>
  </div>

  <div v-else class="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 text-foreground">
    <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.1),transparent_62%)]"></div>
    <div class="relative z-10 w-full max-w-lg rounded-3xl border border-border/60 bg-card/70 p-8 text-center backdrop-blur-xl">
      <h1 class="text-4xl font-semibold tracking-tight">Integration Not Found</h1>
      <p class="mt-3 text-muted-foreground">The integration you are looking for does not exist.</p>
      <Button
        class="mt-6 h-auto bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90"
        @click="navigateTo('/integrations')"
      >
        View All Integrations
      </Button>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  layout: 'default'
})

import Button from '@/components/ui/Button.vue'

const route = useRoute()
const platformId = computed(() => {
  const rawPlatform = route.params.platform
  return Array.isArray(rawPlatform) ? rawPlatform[0] : rawPlatform
})

const stepIcons = [
  'lucide:plug',
  'lucide:folder-search-2',
  'lucide:settings-2',
  'lucide:send'
]

const platforms = {
  github: {
    id: 'github',
    name: 'GitHub',
    tagline: 'Secrets Sync for GitHub Actions',
    icon: 'logos:github-icon',
    bgColor: 'bg-slate-500/10',
    iconColor: '',
    heroDescription: 'Sync your environment variables directly to GitHub Actions secrets. Support for repository, environment, and organization-level secrets. Keep your CI/CD pipelines secure and up-to-date without manual copying.',
    blogUrl: '/blog/github-secrets-management',
    blogTitle: 'Complete Guide to GitHub Secrets Management',
    blogDescription: 'Learn how to set up and manage GitHub Actions secrets with EnvManager.',
    steps: [
      { title: 'Connect GitHub', description: 'Authorize EnvManager to access your GitHub repositories.' },
      { title: 'Select Repository', description: 'Choose which repository to sync secrets to.' },
      { title: 'Map Variables', description: 'Select which environment variables to sync as secrets.' },
      { title: 'Sync & Deploy', description: 'One-click sync keeps your GitHub secrets up-to-date.' }
    ],
    features: [
       { title: 'Repository Secrets', description: 'Sync secrets to any repository you have admin access to.', icon: 'lucide:folder', bgColor: 'bg-slate-500/10', iconColor: 'text-slate-400' },
       { title: 'Environment Secrets', description: 'Target specific GitHub environments like production or staging.', icon: 'lucide:layers', bgColor: 'bg-blue-500/10', iconColor: 'text-blue-400' },
       { title: 'Organization Secrets', description: 'Share secrets across multiple repositories in your organization.', icon: 'lucide:building', bgColor: 'bg-purple-500/10', iconColor: 'text-purple-400' },
       { title: 'Automatic Encryption', description: 'GitHub encrypts secrets automatically using Libsodium.', icon: 'lucide:shield', bgColor: 'bg-emerald-500/10', iconColor: 'text-emerald-400' },
       { title: 'Selective Sync', description: 'Choose exactly which variables to sync as GitHub secrets.', icon: 'lucide:check-square', bgColor: 'bg-orange-500/10', iconColor: 'text-orange-400' },
       { title: 'Audit Trail', description: 'Track every sync operation for compliance and debugging.', icon: 'lucide:scroll-text', bgColor: 'bg-indigo-500/10', iconColor: 'text-indigo-400' }
     ],
    codeExample: {
      description: 'After syncing, use your secrets in GitHub Actions workflows.',
      code: `# .github/workflows/deploy.yml
name: Deploy
on: [push]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy with secrets
        env:
          DATABASE_URL: \${{ secrets.DATABASE_URL }}
          API_SECRET: \${{ secrets.API_SECRET }}
        run: npm run deploy`
    }
  },
  vercel: {
    id: 'vercel',
    name: 'Vercel',
    tagline: 'Environment Variables for Vercel Projects',
    icon: 'logos:vercel-icon',
    bgColor: 'bg-slate-500/10',
    iconColor: '',
    heroDescription: 'One-click sync to Vercel projects. Keep your frontend deployments in sync with your secrets. Support for production, preview, and development environments.',
    blogUrl: '/blog/vercel-environment-variables',
    blogTitle: 'Managing Vercel Environment Variables with EnvManager',
    blogDescription: 'A complete guide to syncing environment variables to Vercel projects.',
    steps: [
      { title: 'Connect Vercel', description: 'Link your Vercel account using a secure API token.' },
      { title: 'Select Project', description: 'Choose which Vercel project to sync variables to.' },
      { title: 'Configure Targets', description: 'Select which environments (production, preview, development) to target.' },
      { title: 'Sync Variables', description: 'Push your variables to Vercel with one click.' }
    ],
    features: [
       { title: 'Project Integration', description: 'Sync to any Vercel project you have access to.', icon: 'lucide:folder', bgColor: 'bg-slate-500/10', iconColor: 'text-slate-400' },
       { title: 'Environment Targeting', description: 'Target production, preview, or development environments.', icon: 'lucide:target', bgColor: 'bg-blue-500/10', iconColor: 'text-blue-400' },
       { title: 'Preview/Production Sync', description: 'Keep preview and production environments in sync or separate.', icon: 'lucide:git-branch', bgColor: 'bg-purple-500/10', iconColor: 'text-purple-400' },
       { title: 'Team Projects', description: 'Works with personal and team Vercel projects.', icon: 'lucide:users', bgColor: 'bg-emerald-500/10', iconColor: 'text-emerald-400' },
       { title: 'Sensitive Variables', description: 'Mark variables as sensitive to hide them in the Vercel dashboard.', icon: 'lucide:eye-off', bgColor: 'bg-red-500/10', iconColor: 'text-red-400' },
       { title: 'Instant Updates', description: 'Variables are available immediately after sync.', icon: 'lucide:zap', bgColor: 'bg-amber-500/10', iconColor: 'text-amber-400' }
     ],
    codeExample: {
      description: 'After syncing, your variables are available in your Vercel deployments.',
      code: `// Access in your Next.js/Nuxt app
const apiUrl = process.env.API_URL;
const dbConnection = process.env.DATABASE_URL;

// Server-side only (prefixed)
const secretKey = process.env.SECRET_KEY;`
    }
  },
  railway: {
    id: 'railway',
    name: 'Railway',
    tagline: 'Deploy to Railway with Confidence',
    icon: 'simple-icons:railway',
    bgColor: 'bg-purple-500/10',
    iconColor: 'text-primary/80',
    heroDescription: 'Deploy your Railway services with the right configuration. Sync variables to any service or environment. Perfect for full-stack applications with multiple services.',
    blogUrl: null,
    blogTitle: null,
    blogDescription: null,
    steps: [
      { title: 'Generate API Token', description: 'Create a Railway API token from your account settings.' },
      { title: 'Connect Railway', description: 'Add your token to EnvManager to connect your account.' },
      { title: 'Select Service', description: 'Choose which Railway project and service to sync to.' },
      { title: 'Sync & Redeploy', description: 'Push variables and optionally trigger a redeploy.' }
    ],
     features: [
       { title: 'Service Integration', description: 'Sync to specific services within your Railway projects.', icon: 'lucide:server', bgColor: 'bg-purple-500/10', iconColor: 'text-purple-400' },
       { title: 'Environment Targeting', description: 'Target different Railway environments (staging, production).', icon: 'lucide:layers', bgColor: 'bg-blue-500/10', iconColor: 'text-blue-400' },
       { title: 'Project Variables', description: 'Set variables at the project level to share across services.', icon: 'lucide:folder', bgColor: 'bg-emerald-500/10', iconColor: 'text-emerald-400' },
       { title: 'Automatic Redeploy', description: 'Optionally trigger a redeploy after syncing variables.', icon: 'lucide:refresh-cw', bgColor: 'bg-orange-500/10', iconColor: 'text-orange-400' },
       { title: 'Multi-Service Support', description: 'Sync to multiple services from a single EnvManager environment.', icon: 'lucide:grid-3x3', bgColor: 'bg-indigo-500/10', iconColor: 'text-indigo-400' },
       { title: 'Secure Storage', description: 'Railway encrypts all environment variables at rest.', icon: 'lucide:shield', bgColor: 'bg-red-500/10', iconColor: 'text-red-400' }
     ],
    codeExample: null
  },
  render: {
    id: 'render',
    name: 'Render',
    tagline: 'Environment Variables for Render Services',
    icon: 'simple-icons:render',
    bgColor: 'bg-emerald-500/10',
    iconColor: 'text-primary/80',
    heroDescription: 'Manage Render environment groups and service variables from one place. Sync to web services, background workers, and cron jobs with a single click.',
    blogUrl: null,
    blogTitle: null,
    blogDescription: null,
    steps: [
      { title: 'Create API Key', description: 'Generate a Render API key from your account settings.' },
      { title: 'Connect Render', description: 'Add your API key to EnvManager to connect.' },
      { title: 'Select Service', description: 'Choose which Render service or environment group to sync to.' },
      { title: 'Push Variables', description: 'Sync your variables with one click.' }
    ],
     features: [
       { title: 'Environment Groups', description: 'Sync to Render environment groups for shared configuration.', icon: 'lucide:folder', bgColor: 'bg-emerald-500/10', iconColor: 'text-emerald-400' },
       { title: 'Service Variables', description: 'Set variables for individual web services, workers, or cron jobs.', icon: 'lucide:server', bgColor: 'bg-blue-500/10', iconColor: 'text-blue-400' },
       { title: 'Blueprint Support', description: 'Works with Render Blueprints for infrastructure-as-code.', icon: 'lucide:file-code', bgColor: 'bg-purple-500/10', iconColor: 'text-purple-400' },
       { title: 'Multi-Service Sync', description: 'Sync to multiple services from one EnvManager environment.', icon: 'lucide:grid-3x3', bgColor: 'bg-orange-500/10', iconColor: 'text-orange-400' },
       { title: 'Secret Files', description: 'Support for Render secret files in addition to env vars.', icon: 'lucide:file-lock', bgColor: 'bg-red-500/10', iconColor: 'text-red-400' },
       { title: 'Auto-Redeploy', description: 'Render automatically redeploys when variables change.', icon: 'lucide:refresh-cw', bgColor: 'bg-amber-500/10', iconColor: 'text-amber-400' }
     ],
    codeExample: null
  },
  dokploy: {
    id: 'dokploy',
    name: 'Dokploy',
    tagline: 'Self-Hosted Deployment Platform Integration',
    icon: 'lucide:server',
    bgColor: 'bg-blue-500/10',
    iconColor: 'text-primary/80',
    heroDescription: 'Perfect for teams running their own infrastructure. Connect to your self-hosted Dokploy instance and manage application variables from EnvManager.',
    blogUrl: '/blog/dokploy-environment-variables',
    blogTitle: 'Dokploy Integration Guide',
    blogDescription: 'Learn how to connect your self-hosted Dokploy instance to EnvManager.',
    steps: [
      { title: 'Get API Token', description: 'Generate an API token from your Dokploy instance.' },
      { title: 'Configure Endpoint', description: 'Enter your Dokploy URL and optionally add a CA certificate.' },
      { title: 'Select Application', description: 'Choose which Dokploy application to sync to.' },
      { title: 'Sync Variables', description: 'Push your environment variables to Dokploy.' }
    ],
     features: [
       { title: 'Application Variables', description: 'Sync variables directly to your Dokploy applications.', icon: 'lucide:app-window', bgColor: 'bg-blue-500/10', iconColor: 'text-blue-400' },
       { title: 'Custom Endpoints', description: 'Connect to any self-hosted Dokploy instance.', icon: 'lucide:link', bgColor: 'bg-purple-500/10', iconColor: 'text-purple-400' },
       { title: 'CA Certificate Support', description: 'Support for self-signed certificates in private networks.', icon: 'lucide:shield-check', bgColor: 'bg-emerald-500/10', iconColor: 'text-emerald-400' },
       { title: 'Docker Integration', description: 'Works with Dokploy\'s Docker-based deployment system.', icon: 'lucide:container', bgColor: 'bg-cyan-500/10', iconColor: 'text-cyan-400' },
       { title: 'Private Network Support', description: 'Perfect for on-premise or VPN-only deployments.', icon: 'lucide:network', bgColor: 'bg-orange-500/10', iconColor: 'text-orange-400' },
       { title: 'Secure Connection', description: 'All communication is encrypted with HTTPS.', icon: 'lucide:lock', bgColor: 'bg-red-500/10', iconColor: 'text-red-400' }
     ],
    codeExample: null
  },
  coolify: {
    id: 'coolify',
    name: 'Coolify',
    tagline: 'Open-Source PaaS Integration',
    icon: 'lucide:cloud',
    bgColor: 'bg-orange-500/10',
    iconColor: 'text-primary/80',
    heroDescription: 'Connect to your self-hosted Coolify instance. The open-source, self-hostable Heroku alternative. Sync variables to your applications with ease.',
    blogUrl: '/blog/coolify-environment-variables',
    blogTitle: 'Coolify Integration Guide',
    blogDescription: 'A complete guide to managing Coolify environment variables with EnvManager.',
    steps: [
      { title: 'Generate API Token', description: 'Create an API token from your Coolify settings.' },
      { title: 'Configure Connection', description: 'Enter your Coolify URL and API token. Add CA cert if needed.' },
      { title: 'Select Application', description: 'Choose which Coolify application to sync to.' },
      { title: 'Push Variables', description: 'Sync your variables with one click.' }
    ],
     features: [
       { title: 'Application Variables', description: 'Sync environment variables to any Coolify application.', icon: 'lucide:app-window', bgColor: 'bg-orange-500/10', iconColor: 'text-orange-400' },
       { title: 'Self-Hosted Support', description: 'Connect to any self-hosted Coolify instance.', icon: 'lucide:server', bgColor: 'bg-blue-500/10', iconColor: 'text-blue-400' },
       { title: 'CA Certificate Support', description: 'Support for custom CA certificates in private networks.', icon: 'lucide:shield-check', bgColor: 'bg-emerald-500/10', iconColor: 'text-emerald-400' },
       { title: 'Preview Deployments', description: 'Sync different variables to preview vs production.', icon: 'lucide:eye', bgColor: 'bg-purple-500/10', iconColor: 'text-purple-400' },
       { title: 'Docker & Git Deploy', description: 'Works with Coolify\'s Docker and git-based deployments.', icon: 'lucide:git-branch', bgColor: 'bg-slate-500/10', iconColor: 'text-slate-400' },
       { title: 'Open Source Friendly', description: 'Perfect for teams committed to open-source infrastructure.', icon: 'lucide:heart', bgColor: 'bg-red-500/10', iconColor: 'text-red-400' }
     ],
    codeExample: null
  }
}

const platform = computed(() => platforms[platformId.value] || null)

useSeoMeta({
  title: () => platform.value
    ? `${platform.value.name} Environment Variables - EnvManager`
    : 'Integration Not Found - EnvManager',
  description: () => platform.value
    ? `Manage and sync environment variables to ${platform.value.name}. Secure, team-friendly, with audit logging.`
    : 'Browse all EnvManager integrations for GitHub, Vercel, Railway, Render, Dokploy, and Coolify.',
  ogTitle: () => platform.value
    ? `${platform.value.name} Environment Variables - EnvManager`
    : 'Integration Not Found - EnvManager',
  ogDescription: () => platform.value
    ? `Manage and sync environment variables to ${platform.value.name}. Secure, team-friendly, with audit logging.`
    : 'Browse all EnvManager integrations for GitHub, Vercel, Railway, Render, Dokploy, and Coolify.'
})
</script>
