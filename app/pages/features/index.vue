<template>
  <div class="relative overflow-hidden bg-background text-foreground">
    <!-- Background Effects -->
    <div class="pointer-events-none absolute inset-0">
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.08),transparent_55%)]"></div>
      <div class="absolute -top-40 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-primary/6 blur-[120px]"></div>
      <div class="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-primary/5 blur-3xl"></div>
      <div class="absolute right-0 top-1/3 h-96 w-96 rounded-full bg-primary/4 blur-[130px]"></div>
    </div>

    <!-- Hero Section -->
    <section class="relative py-20 md:py-28">
      <div class="container px-4 md:px-6">
        <div class="mx-auto flex max-w-4xl flex-col items-center space-y-8 text-center">
          <div class="rounded-full border border-primary/20 bg-primary/8 px-5 py-2 backdrop-blur-md">
            <span class="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">Features & Capabilities</span>
          </div>

          <h1 class="text-balance text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
            Stop sharing secrets
            <span class="bg-gradient-to-r from-foreground via-primary/80 to-foreground/90 bg-clip-text text-transparent">
              over Slack.
            </span>
          </h1>

          <p class="max-w-3xl text-lg leading-relaxed text-muted-foreground md:text-xl">
            Encrypted storage, role-based access, audit logs, CLI sync, and 6 platform integrations. Everything you need to manage secrets securely — included on every plan.
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
              to="/pricing"
              class="inline-flex w-full items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-medium shadow-sm transition-colors hover:bg-muted sm:w-auto"
            >
              View Pricing
            </NuxtLink>
          </div>

          <!-- Stats Grid -->
          <div class="mx-auto grid max-w-4xl grid-cols-2 gap-4 md:grid-cols-4">
            <div
              v-for="category in featureCategories"
              :key="category.name"
              class="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-6 transition-all hover:border-primary/20 hover:bg-card/60"
            >
              <div class="mb-3 flex justify-center">
                <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                  <Icon :name="category.icon" class="h-5 w-5" />
                </div>
              </div>
              <div class="font-semibold text-foreground">{{ category.name }}</div>
              <div class="text-xs text-muted-foreground">{{ category.count }} features</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Feature Section 1: Developer Experience (Screenshot Left) -->
    <section class="relative border-y border-border/40 bg-muted/20 px-4 py-20 md:px-6 md:py-32">
      <div class="container relative z-10">
        <div class="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <!-- Screenshot -->
          <div class="relative order-2 lg:order-1">
            <div class="absolute -inset-4 rounded-full bg-primary/20 blur-3xl"></div>
            <div class="relative overflow-hidden rounded-xl border border-border/60 bg-background shadow-2xl transition-transform hover:scale-[1.01]">
              <div class="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-4 py-3">
                <div class="flex gap-1.5">
                  <div class="h-3 w-3 rounded-full bg-red-500/20"></div>
                  <div class="h-3 w-3 rounded-full bg-amber-500/20"></div>
                  <div class="h-3 w-3 rounded-full bg-primary/20"></div>
                </div>
                <div class="mx-auto h-5 w-1/2 rounded-md bg-muted/50"></div>
              </div>
              <img
                src="/images/product/variables-management.png"
                alt="Variables Management Dashboard"
                class="w-full object-cover"
                loading="lazy"
              />
            </div>
          </div>

          <!-- Content -->
          <div class="order-1 space-y-8 lg:order-2">
            <div class="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Icon name="lucide:terminal" class="mr-1.5 h-3.5 w-3.5" />
              Developer Experience
            </div>
            <h2 class="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              From one API key to a thousand -- managed in seconds
            </h2>
            <p class="text-lg text-muted-foreground">
              Centralize your configuration with environment-specific variables, bulk operations, and a CLI that syncs in real-time. Stop copy-pasting .env files between developers.
            </p>

            <div class="grid gap-6 sm:grid-cols-2">
              <div class="space-y-2">
                <div class="flex items-center gap-2 font-medium text-foreground">
                  <Icon name="lucide:layers" class="h-4 w-4 text-primary" />
                  Multiple Environments
                </div>
                <p class="text-sm text-muted-foreground">Dev, Staging, Prod separation with inheritance and overrides.</p>
              </div>
              <div class="space-y-2">
                <div class="flex items-center gap-2 font-medium text-foreground">
                  <Icon name="lucide:git-fork" class="h-4 w-4 text-primary" />
                  Smart References
                </div>
                <p class="text-sm text-muted-foreground">Reference other variables with ${VAR} syntax and auto-resolution.</p>
              </div>
              <div class="space-y-2">
                <div class="flex items-center gap-2 font-medium text-foreground">
                  <Icon name="lucide:database" class="h-4 w-4 text-primary" />
                  Bulk Operations
                </div>
                <p class="text-sm text-muted-foreground">Import/export JSON or .env files with conflict detection.</p>
              </div>
              <div class="space-y-2">
                <div class="flex items-center gap-2 font-medium text-foreground">
                  <Icon name="lucide:terminal" class="h-4 w-4 text-primary" />
                  Local Development
                </div>
                <p class="text-sm text-muted-foreground">CLI tool that injects secrets directly into your process.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Feature Section 2: Security (Screenshot Right) -->
    <section class="relative px-4 py-20 md:px-6 md:py-32">
      <div class="container relative z-10">
        <div class="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <!-- Content -->
          <div class="space-y-8">
            <div class="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Icon name="lucide:shield-check" class="mr-1.5 h-3.5 w-3.5" />
              Enterprise Security
            </div>
            <h2 class="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Know exactly who accessed what, and when
            </h2>
            <p class="text-lg text-muted-foreground">
              Every read, write, and access attempt is logged immutably. Manage team access with role-based permissions and protect production with approval workflows.
            </p>

            <div class="space-y-4">
               <div class="flex gap-4 rounded-lg border border-border/40 bg-card/40 p-4 transition-colors hover:bg-card/60">
                <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon name="lucide:lock" class="h-5 w-5" />
                </div>
                <div>
                  <h3 class="font-medium text-foreground">Zero-Knowledge Encryption</h3>
                  <p class="text-sm text-muted-foreground">AES-256-GCM encryption before data leaves your browser. We never see your raw secrets.</p>
                </div>
              </div>
              <div class="flex gap-4 rounded-lg border border-border/40 bg-card/40 p-4 transition-colors hover:bg-card/60">
                <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon name="lucide:user-check" class="h-5 w-5" />
                </div>
                <div>
                  <h3 class="font-medium text-foreground">Granular RBAC</h3>
                  <p class="text-sm text-muted-foreground">Assign Admin, Editor, or Viewer roles per project or environment.</p>
                </div>
              </div>
              <div class="flex gap-4 rounded-lg border border-border/40 bg-card/40 p-4 transition-colors hover:bg-card/60">
                <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon name="lucide:history" class="h-5 w-5" />
                </div>
                <div>
                  <h3 class="font-medium text-foreground">Immutable History</h3>
                  <p class="text-sm text-muted-foreground">Rollback to any previous version instantly if something breaks.</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Screenshot -->
          <div class="relative">
             <div class="absolute -right-4 -top-4 -z-10 h-64 w-64 rounded-full bg-primary/20 blur-3xl"></div>
             <div class="relative overflow-hidden rounded-xl border border-border/60 bg-background shadow-2xl transition-transform hover:scale-[1.01]">
              <div class="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-4 py-3">
                <div class="flex gap-1.5">
                  <div class="h-3 w-3 rounded-full bg-red-500/20"></div>
                  <div class="h-3 w-3 rounded-full bg-amber-500/20"></div>
                  <div class="h-3 w-3 rounded-full bg-primary/20"></div>
                </div>
                <div class="mx-auto h-5 w-1/2 rounded-md bg-muted/50"></div>
              </div>
              <img
                src="/images/product/activity-audit.png"
                alt="Audit Logs Dashboard"
                class="w-full object-cover"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Main Features Grid -->
    <section class="relative border-t border-border/40 bg-muted/20 px-4 py-20 md:px-6 md:py-32">
       <div class="container relative z-10">
        <div class="mx-auto mb-16 max-w-3xl text-center">
          <h2 class="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Everything your team needs, nothing it does not
          </h2>
          <p class="mt-4 text-lg text-muted-foreground">
            Search, sync, validate, and deploy -- all from one dashboard. No YAML configs. No custom scripting.
          </p>

          <!-- Category Filter -->
           <div class="mt-8 flex flex-wrap justify-center gap-2">
            <button
              v-for="category in featureCategories"
              :key="category.id"
              @click="activeCategory = category.id"
              :class="[
                'rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200',
                activeCategory === category.id
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                  : 'bg-background/50 text-muted-foreground hover:bg-background hover:text-foreground'
              ]"
            >
              {{ category.name }}
            </button>
          </div>
        </div>

        <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <MarketingCard
            v-for="feature in filteredFeatures"
            :key="feature.id"
            :icon="feature.icon"
            :title="feature.title"
            :description="feature.description"
            class="group !h-full !rounded-2xl !border-border/60 !bg-card/50 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:!border-primary/20 hover:!bg-card/80 hover:shadow-xl hover:shadow-primary/5"
          >
             <!-- Dynamic Icon with Theme -->
             <template #icon>
                <div
                  class="flex h-12 w-12 items-center justify-center rounded-lg shadow-inner"
                  :class="gradientThemes[feature.theme || 'primary'].bg"
                >
                  <Icon :name="feature.icon" class="h-6 w-6" :class="gradientThemes[feature.theme || 'primary'].icon" />
                </div>
             </template>

            <div class="mt-4 space-y-4">
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="badge in feature.badges"
                  :key="badge.text"
                  :class="['rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider', badge.color]"
                >
                  {{ badge.text }}
                </span>
              </div>

              <div class="space-y-2.5">
                <div
                  v-for="detail in feature.details"
                  :key="detail"
                  class="flex items-start gap-3"
                >
                  <Icon name="lucide:check" class="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                  <span class="text-sm text-muted-foreground group-hover:text-foreground/80 transition-colors">{{ detail }}</span>
                </div>
              </div>

              <div v-if="feature.codeExample" class="rounded-lg border border-border/40 bg-muted/30 p-3 font-mono text-xs text-muted-foreground whitespace-pre">
                <div v-for="(line, i) in feature.codeExample.split('<br/>')" :key="i">{{ line }}</div>
              </div>
            </div>
          </MarketingCard>
        </div>
      </div>
    </section>

    <!-- Roadmap Section -->
    <section class="relative overflow-hidden px-4 py-20 md:px-6 md:py-32">
      <div class="container relative z-10">
        <div class="mx-auto max-w-4xl space-y-12">
          <div class="text-center">
            <span class="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              What's Next
            </span>
            <h2 class="mt-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Public Roadmap
            </h2>
          </div>

          <div class="grid gap-6 md:grid-cols-2">
            <div
              v-for="item in roadmapItems"
              :key="item.id"
              class="relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-6 transition-all hover:border-border hover:bg-card/60"
            >
              <div class="flex items-start gap-4">
                <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Icon :name="item.icon" class="h-5 w-5" />
                </div>
                <div class="space-y-2">
                  <h3 class="font-semibold text-foreground">{{ item.title }}</h3>
                  <p class="text-sm text-muted-foreground">{{ item.description }}</p>
                  <div class="flex items-center gap-3 pt-2">
                    <span :class="['rounded-full px-2 py-0.5 text-xs font-medium', item.statusColor]">
                      {{ item.status }}
                    </span>
                    <span v-if="item.eta" class="text-xs text-muted-foreground/60">Target: {{ item.eta }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Comparison Callout -->
    <section class="relative px-4 py-16 md:px-6 md:py-24">
      <div class="container relative z-10">
        <div class="mx-auto max-w-4xl">
          <div class="mx-auto mb-10 max-w-3xl text-center">
            <h2 class="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              What you get vs. the old way
            </h2>
          </div>

          <div class="grid gap-6 md:grid-cols-2">
            <div class="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 space-y-4">
              <div class="flex items-center gap-2 text-lg font-semibold text-destructive">
                <Icon name="lucide:x-circle" class="h-5 w-5" />
                Without EnvManager
              </div>
              <div class="space-y-3 text-sm text-muted-foreground">
                <div class="flex items-start gap-2">
                  <Icon name="lucide:x" class="mt-0.5 h-4 w-4 shrink-0 text-destructive/60" />
                  <span>Secrets shared in Slack, email, or shared docs</span>
                </div>
                <div class="flex items-start gap-2">
                  <Icon name="lucide:x" class="mt-0.5 h-4 w-4 shrink-0 text-destructive/60" />
                  <span>No visibility into who accessed what</span>
                </div>
                <div class="flex items-start gap-2">
                  <Icon name="lucide:x" class="mt-0.5 h-4 w-4 shrink-0 text-destructive/60" />
                  <span>Manual copy-paste to every platform</span>
                </div>
                <div class="flex items-start gap-2">
                  <Icon name="lucide:x" class="mt-0.5 h-4 w-4 shrink-0 text-destructive/60" />
                  <span>Offboarded employees still have credentials</span>
                </div>
                <div class="flex items-start gap-2">
                  <Icon name="lucide:x" class="mt-0.5 h-4 w-4 shrink-0 text-destructive/60" />
                  <span>Production accidents from junior devs</span>
                </div>
              </div>
            </div>

            <div class="rounded-2xl border border-primary/20 bg-primary/5 p-6 space-y-4">
              <div class="flex items-center gap-2 text-lg font-semibold text-primary">
                <Icon name="lucide:check-circle" class="h-5 w-5" />
                With EnvManager
              </div>
              <div class="space-y-3 text-sm text-muted-foreground">
                <div class="flex items-start gap-2">
                  <Icon name="lucide:check" class="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                  <span>Encrypted vault with role-based access</span>
                </div>
                <div class="flex items-start gap-2">
                  <Icon name="lucide:check" class="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                  <span>Full audit trail on every access and change</span>
                </div>
                <div class="flex items-start gap-2">
                  <Icon name="lucide:check" class="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                  <span>One-click sync to GitHub, Vercel, Railway, and more</span>
                </div>
                <div class="flex items-start gap-2">
                  <Icon name="lucide:check" class="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                  <span>Instant access revocation on offboarding</span>
                </div>
                <div class="flex items-start gap-2">
                  <Icon name="lucide:check" class="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                  <span>Environment-level permissions protect production</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="relative px-4 pb-20 pt-10 md:px-6 md:pb-24">
      <div class="container relative z-10">
        <div class="mx-auto max-w-4xl rounded-3xl border border-primary/20 bg-gradient-to-b from-primary/5 to-transparent p-8 text-center backdrop-blur-sm md:p-16">
          <h2 class="text-3xl font-bold tracking-tight text-foreground md:text-5xl">
            Set up in 2 minutes. Free for 14 days — no credit card.
          </h2>
          <p class="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            No credit card required. Start managing secrets securely today and upgrade when you need more.
          </p>

          <div class="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
              class="h-12 px-8 text-base font-semibold shadow-lg shadow-primary/20 transition-all hover:shadow-primary/40"
              @click="track('signup_cta_clicked', { page_source: 'features', cta_text: 'Start Free Trial' }); navigateTo('/auth/register')"
            >
              <Icon name="lucide:rocket" class="mr-2 h-5 w-5" />
              Start Free Trial
            </Button>
            <Button
              variant="outline"
              size="lg"
              class="h-12 px-8 text-base"
              @click="navigateTo('/pricing')"
            >
              Compare Plans
            </Button>
          </div>

          <p class="mt-6 text-xs text-muted-foreground">
            Trusted by development teams managing secrets across multiple environments and platforms.
          </p>
          <p class="mt-6 text-sm text-muted-foreground">
            Comparing options? See the
            <NuxtLink to="/blog/best-secrets-management-tools" class="text-primary hover:underline">best secrets management tools</NuxtLink>
            or our guide to the
            <NuxtLink to="/blog/external-secrets-operator" class="text-primary hover:underline">External Secrets Operator</NuxtLink>.
          </p>
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
  title: 'Features - Secure Environment Variable Management | EnvManager',
  description: 'Encrypted secrets, role-based access, audit logs, CLI sync, and 6 platform integrations. Everything you need to stop sharing secrets over Slack.',
  ogTitle: 'Features - Secure Environment Variable Management | EnvManager',
  ogDescription: 'Encrypted secrets, role-based access, audit logs, CLI sync, and 6 platform integrations. Everything you need to stop sharing secrets over Slack.'
})

import Button from '@/components/ui/Button.vue'
import { ref, computed } from 'vue'

const { track } = usePostHog()

// Reactive state for filtering
const activeCategory = ref('all')

// Feature categories
const featureCategories = [
  {
    id: 'all',
    name: 'All Features',
    icon: 'lucide:grid-3x3',
    bgColor: 'bg-primary/8',
    iconColor: 'text-primary/80',
    count: 0 // Will be calculated
  },
  {
    id: 'security',
    name: 'Security',
    icon: 'lucide:shield-check',
    bgColor: 'bg-primary/8',
    iconColor: 'text-primary/80',
    count: 0
  },
  {
    id: 'collaboration',
    name: 'Team',
    icon: 'lucide:users',
    bgColor: 'bg-primary/8',
    iconColor: 'text-primary/80',
    count: 0
  },
  {
    id: 'developer',
    name: 'Developer',
    icon: 'lucide:code',
    bgColor: 'bg-primary/8',
    iconColor: 'text-primary/80',
    count: 0
  },
  {
    id: 'integrations',
    name: 'Integrations',
    icon: 'lucide:plug',
    bgColor: 'bg-primary/8',
    iconColor: 'text-primary/80',
    count: 0
  }
]


// Gradient Themes Configuration
const gradientThemes = {
  primary: {
    bg: 'bg-gradient-to-br from-primary/80 to-primary text-primary-foreground',
    icon: 'text-primary-foreground'
  },
  secondary: {
    bg: 'bg-gradient-to-br from-muted-foreground/10 to-muted-foreground/20 text-foreground',
    icon: 'text-foreground'
  },
  accent: {
    bg: 'bg-gradient-to-br from-primary/40 to-primary/60 text-foreground',
    icon: 'text-foreground'
  },
  success: {
    bg: 'bg-gradient-to-br from-primary/70 to-primary/90 text-primary-foreground',
    icon: 'text-primary-foreground'
  },
  warning: {
    bg: 'bg-gradient-to-br from-primary/60 to-primary/80 text-primary-foreground',
    icon: 'text-primary-foreground'
  },
  info: {
    bg: 'bg-gradient-to-br from-primary/50 to-primary/70 text-primary-foreground',
    icon: 'text-primary-foreground'
  }
}

// Comprehensive features configuration
const features = [
  // Security Features
  {
    id: 'encryption',
    title: 'End-to-End Encryption',
    description: 'Your secrets are encrypted before they leave the browser. Even we cannot read them.',
    category: 'security',
    icon: 'lucide:lock',
    theme: 'primary',
    status: 'available',
    version: '1.0',
    badges: [
      { text: 'Core', color: 'bg-primary/10 text-primary' }
    ],
    details: [
      'Client-side encryption before transmission',
      'Zero-knowledge architecture',
      'Secure key derivation (PBKDF2)',
      'Industry-standard AES-256-GCM'
    ]
  },
  {
    id: 'rbac',
    title: 'Role-Based Access Control',
    description: 'Give every team member exactly the access they need -- no more, no less.',
    category: 'security',
    icon: 'lucide:user-check',
    theme: 'accent',
    status: 'available',
    version: '1.0',
    badges: [
      { text: 'Core', color: 'bg-primary/10 text-primary' }
    ],
    details: [
      'Admin, Editor, Viewer roles',
      'Project-level permissions',
      'Environment-specific access',
      'Invite management system'
    ]
  },
  {
    id: 'audit-logs',
    title: 'Comprehensive Audit Logs',
    description: 'Answer "who changed this?" instantly. Every access and modification is logged.',
    category: 'security',
    icon: 'lucide:scroll-text',
    theme: 'secondary',
    status: 'available',
    version: '1.0',
    badges: [
      { text: 'Pro', color: 'bg-primary/10 text-primary' }
    ],
    details: [
      'Complete activity timeline',
      'User action tracking',
      'Variable change history',
      'Export capabilities for compliance'
    ]
  },
  {
    id: 'two-factor-auth',
    title: 'Two-Factor Authentication',
    description: 'Add a second layer of protection to every account on your team.',
    category: 'security',
    icon: 'lucide:smartphone',
    theme: 'secondary',
    status: 'available',
    version: '1.2',
    badges: [
      { text: 'Core', color: 'bg-primary/10 text-primary' }
    ],
    details: [
      'TOTP authenticator app support',
      '10 single-use recovery codes',
      'Recovery code regeneration',
      'Security audit logging'
    ]
  },
  {
    id: 'approval-workflows',
    title: 'Approval Workflows',
    description: 'Prevent unauthorized production changes. Require review before secrets go live.',
    category: 'security',
    icon: 'lucide:check-check',
    theme: 'accent',
    status: 'available',
    version: '1.2',
    badges: [
      { text: 'Pro', color: 'bg-primary/10 text-primary' }
    ],
    details: [
      'Protect production environments',
      'Single or two-person approval modes',
      'Designated approvers per environment',
      'Automatic expiration of pending changes'
    ]
  },

  // Team Collaboration Features
  {
    id: 'team-workspaces',
    title: 'Team Workspaces',
    description: 'One place for every project. Invite your team and collaborate securely.',
    category: 'collaboration',
    icon: 'lucide:users',
    theme: 'primary',
    status: 'available',
    version: '1.0',
    badges: [
      { text: 'Core', color: 'bg-primary/10 text-primary' }
    ],
    details: [
      'Multiple projects per workspace',
      'Team member management',
      'Shared environment configurations',
      'Collaborative editing'
    ]
  },
  {
    id: 'version-control',
    title: 'Version Control & History',
    description: 'Broke something? Roll back to any previous version with one click.',
    category: 'collaboration',
    icon: 'lucide:git-branch',
    theme: 'accent',
    status: 'available',
    version: '1.0',
    badges: [
      { text: 'Core', color: 'bg-primary/10 text-primary' }
    ],
    details: [
      'Full change history',
      'One-click rollback',
      'Compare versions',
      'Change attribution'
    ],
  },
  {
    id: 'comments',
    title: 'Variable Comments & Documentation',
    description: 'Never wonder what a variable is for. Add context that stays with the secret.',
    category: 'collaboration',
    icon: 'lucide:message-square',
    theme: 'secondary',
    status: 'beta',
    badges: [
      { text: 'Beta', color: 'bg-primary/10 text-primary' }
    ],
    details: [
      'Add descriptions to variables',
      'Team comments and discussions',
      'Usage examples',
      'Deprecation notices'
    ]
  },

  // Developer Experience Features
  {
    id: 'multiple-environments',
    title: 'Multiple Environments',
    description: 'Keep dev, staging, and production configs separate. No accidental cross-contamination.',
    category: 'developer',
    icon: 'lucide:layers',
    theme: 'primary',
    status: 'available',
    version: '1.0',
    badges: [
      { text: 'Core', color: 'bg-primary/10 text-primary' }
    ],
    details: [
      'Unlimited environments per project',
      'Environment-specific variables',
      'Copy between environments',
      'Environment templates'
    ]
  },
  {
    id: 'bulk-operations',
    title: 'Bulk Operations',
    description: 'Import hundreds of variables in one go. Export to .env or JSON anytime.',
    category: 'developer',
    icon: 'lucide:database',
    theme: 'secondary',
    status: 'available',
    version: '1.0',
    badges: [
      { text: 'Core', color: 'bg-primary/10 text-primary' }
    ],
    details: [
      'CSV/JSON import/export',
      'Bulk edit variables',
      'Template creation',
      'Batch operations'
    ],
    codeExample: '# Export to .env format<br/>DATABASE_URL=postgres://...<br/>API_KEY=sk_live_...'
  },
  {
    id: 'search-filter',
    title: 'Smart Search & Filtering',
    description: 'Find any variable across all projects in seconds. Filter by environment, type, or regex.',
    category: 'developer',
    icon: 'lucide:search',
    theme: 'secondary',
    status: 'available',
    version: '1.0',
    badges: [
      { text: 'Core', color: 'bg-primary/10 text-primary' }
    ],
    details: [
      'Global search across projects',
      'Filter by environment',
      'Search by key or value',
      'Regular expression support'
    ]
  },
  {
    id: 'cli-tool',
    title: 'Command Line Interface',
    description: 'Pull secrets into your local dev environment with one command. Push changes back just as easily.',
    category: 'developer',
    icon: 'lucide:terminal',
    theme: 'accent',
    status: 'available',
    version: '1.0',
    badges: [
      { text: 'New', color: 'bg-primary/10 text-primary' }
    ],
    details: [
      'Pull and push variables to any environment',
      'Real-time dev sync with file watching',
      'Schema validation and templates',
      'Variable reference resolution'
    ],
    codeExample: '$ npm i -g @envmanager-cli/cli<br/>$ envmanager pull production<br/>$ envmanager dev --watch'
  },
  {
    id: 'agent-run',
    title: 'Secrets for AI Agents',
    description: 'Let AI agents and scripts run commands with the secrets they need -- without the values ever landing in their chat, logs, or output.',
    category: 'developer',
    icon: 'lucide:bot',
    theme: 'primary',
    status: 'available',
    version: '1.3',
    badges: [
      { text: 'New', color: 'bg-primary/10 text-primary' }
    ],
    details: [
      'Inject scoped variables into any command',
      'Reference secrets with {{VAR}} placeholders',
      'Secret values masked from command output',
      'Scope each run to only the keys it needs'
    ],
    codeExample: '$ envmanager run --only API_KEY -- \\<br/>&nbsp;&nbsp;curl -H "Authorization: Bearer {{API_KEY}}"'
  },

  {
    id: 'variable-references',
    title: 'Variable References',
    description: 'Build URLs and configs dynamically. Change one value and all references update automatically.',
    category: 'developer',
    icon: 'lucide:link',
    theme: 'secondary',
    status: 'available',
    version: '1.2',
    badges: [
      { text: 'New', color: 'bg-primary/10 text-primary' }
    ],
    details: [
      'Reference variables with ${VAR} syntax',
      'Circular dependency detection',
      'Resolved value preview',
      'Fallback values support'
    ],
    codeExample: 'APP_URL=https://app.com<br/>API_URL=${APP_URL}/api<br/>WEBHOOK=${API_URL}/webhooks'
  },
  {
    id: 'variable-dependencies',
    title: 'Dependency Tracking & Impact Analysis',
    description: 'See which variables depend on each other. Get warned before a change breaks something downstream.',
    category: 'developer',
    icon: 'lucide:git-fork',
    theme: 'secondary',
    status: 'available',
    version: '1.2',
    badges: [
      { text: 'New', color: 'bg-primary/10 text-primary' }
    ],
    details: [
      'Visual dependency graph',
      'Impact analysis before changes',
      'Access tracking per variable',
      'Warns before breaking references'
    ]
  },
  {
    id: 'naming-conventions',
    title: 'Naming Convention Enforcement',
    description: 'Enforce consistent naming rules across your organization. No more DB_URL vs DATABASE_URL debates.',
    category: 'developer',
    icon: 'lucide:text-cursor-input',
    theme: 'secondary',
    status: 'available',
    version: '1.2',
    badges: [
      { text: 'New', color: 'bg-primary/10 text-primary' }
    ],
    details: [
      'Org and project-level naming rules',
      'Validation on create, edit, and import',
      'Bulk audit of existing variables',
      'Custom pattern enforcement'
    ]
  },
  {
    id: 'schema-validation',
    title: 'Schema Validation',
    description: 'Define required variables and types. Catch missing or malformed config before deployment.',
    category: 'developer',
    icon: 'lucide:file-check',
    theme: 'primary',
    status: 'available',
    version: '1.1',
    badges: [
      { text: 'Core', color: 'bg-primary/10 text-primary' }
    ],
    details: [
      'Visual schema editor',
      'Type and format validation',
      'Required variable enforcement',
      'CLI schema validation support'
    ]
  },
  {
    id: 'conflict-detection',
    title: 'Conflict Detection',
    description: 'Two people edited the same variable? Catch it before it ships, not after.',
    category: 'developer',
    icon: 'lucide:alert-triangle',
    theme: 'warning',
    status: 'available',
    version: '1.2',
    badges: [
      { text: 'Core', color: 'bg-primary/10 text-primary' }
    ],
    details: [
      'Detect key conflicts during import',
      'Sync conflict resolution',
      'Merge strategy options',
      'Prevent accidental overwrites'
    ]
  },
  {
    id: 'secure-value-viewing',
    title: 'Secure Value Access Requests',
    description: 'Need to see a production secret? Request access. Admins approve with an audit trail.',
    category: 'security',
    icon: 'lucide:key-round',
    theme: 'info',
    status: 'available',
    version: '1.2',
    badges: [
      { text: 'Pro', color: 'bg-primary/10 text-primary' }
    ],
    details: [
      'Request access to view secrets',
      'Grant/deny with audit trail',
      'Temporary access with expiration',
      'Access request dashboard'
    ]
  },
  {
    id: 'environment-snapshots',
    title: 'Environment Snapshots',
    description: 'Take a snapshot before risky changes. Restore the entire environment in one click if needed.',
    category: 'collaboration',
    icon: 'lucide:camera',
    theme: 'secondary',
    status: 'available',
    version: '1.2',
    badges: [
      { text: 'New', color: 'bg-primary/10 text-primary' }
    ],
    details: [
      'Snapshot entire environment state',
      'Restore from any snapshot',
      'Compare snapshots side-by-side',
      'Snapshot before risky changes'
    ]
  },

  // Proxy Functions
  {
    id: 'proxy-functions',
    title: 'Proxy Functions',
    description: 'Call third-party APIs from static sites without exposing secrets. EnvManager injects your keys server-side.',
    category: 'developer',
    icon: 'lucide:shield',
    theme: 'primary',
    status: 'available',
    version: '1.3',
    badges: [
      { text: 'New', color: 'bg-primary/10 text-primary' }
    ],
    details: [
      'Pre-built templates for Stripe, Brevo, OpenAI',
      'Hosted proxy or downloadable code',
      'Per-proxy rate limiting and CORS',
      'Usage analytics and audit logging'
    ],
    codeExample: '$ fetch(proxyUrl, {<br/>  headers: { \'x-proxy-token\': token },<br/>  body: JSON.stringify({ to: \'user@email.com\' })<br/>})'
  },

  // Integration Features
  {
    id: 'platform-sync',
    title: 'Platform Integrations',
    description: 'Sync secrets to GitHub, Vercel, Railway, Render, and more with one click. No manual copy-paste.',
    category: 'integrations',
    icon: 'lucide:upload-cloud',
    theme: 'primary',
    status: 'available',
    version: '1.0',
    badges: [
      { text: 'New', color: 'bg-primary/10 text-primary' }
    ],
    details: [
      'GitHub Actions secrets sync',
      'Vercel project integration',
      'Railway & Render support',
      'Dokploy & Coolify (self-hosted)'
    ]
  },
  {
    id: 'sso',
    title: 'Single Sign-On (SSO)',
    description: 'Connect your identity provider. One login for your entire team.',
    category: 'integrations',
    icon: 'lucide:key',
    theme: 'accent',
    status: 'coming-soon',
    badges: [
      { text: 'Enterprise', color: 'bg-muted text-muted-foreground' }
    ],
    details: [
      'SAML 2.0 support',
      'OAuth providers (Google, GitHub)',
      'Active Directory integration',
      'Custom identity providers'
    ]
  }
]

// Roadmap items
const roadmapItems = [
  {
    id: 'webhooks',
    title: 'Webhooks & Notifications',
    description: 'Real-time change notifications via custom endpoints, Slack, and Discord.',
    icon: 'lucide:webhook',
    bgColor: 'bg-primary/8',
    iconColor: 'text-primary/80',
    status: 'In Development',
    statusColor: 'bg-primary/12 text-primary/85',
    eta: 'Q2 2026'
  },
  {
    id: 'integrations',
    title: 'More Integrations',
    description: 'Expanding to AWS Parameter Store, Netlify, Kubernetes, and Docker exports.',
    icon: 'lucide:plug',
    bgColor: 'bg-muted',
    iconColor: 'text-muted-foreground',
    status: 'Planned',
    statusColor: 'bg-muted text-muted-foreground',
    eta: 'Q3 2026'
  },
  {
    id: 'mobile',
    title: 'Mobile App',
    description: 'Native mobile apps for iOS and Android to manage variables on the go.',
    icon: 'lucide:smartphone',
    bgColor: 'bg-muted',
    iconColor: 'text-muted-foreground',
    status: 'Research',
    statusColor: 'bg-muted text-muted-foreground',
    eta: '2026'
  },
  {
    id: 'advanced-security',
    title: 'Advanced Security',
    description: 'Hardware security modules (HSM) and advanced compliance features.',
    icon: 'lucide:shield',
    bgColor: 'bg-muted',
    iconColor: 'text-muted-foreground',
    status: 'Research',
    statusColor: 'bg-muted text-muted-foreground',
    eta: '2026'
  },
  {
    id: 'ai-suggestions',
    title: 'AI-Powered Suggestions',
    description: 'Smart suggestions for variable naming, security improvements, and optimization.',
    icon: 'lucide:brain',
    bgColor: 'bg-muted',
    iconColor: 'text-muted-foreground',
    status: 'Idea',
    statusColor: 'bg-muted text-muted-foreground',
    eta: '2026'
  },
  {
    id: 'enterprise-features',
    title: 'Enterprise Suite',
    description: 'Advanced enterprise features including SSO, custom compliance, and dedicated support.',
    icon: 'lucide:building',
    bgColor: 'bg-muted',
    iconColor: 'text-muted-foreground',
    status: 'Planned',
    statusColor: 'bg-muted text-muted-foreground',
    eta: 'Q3 2026'
  }
]

// Computed properties for feature filtering and stats
const filteredFeatures = computed(() => {
  if (activeCategory.value === 'all') {
    return features
  }
  return features.filter(feature => feature.category === activeCategory.value)
})

const availableFeatures = computed(() => features.filter(f => f.status === 'available'))
const betaFeatures = computed(() => features.filter(f => f.status === 'beta'))
const comingSoonFeatures = computed(() => features.filter(f => f.status === 'coming-soon'))
const totalFeatures = computed(() => features.length)

// Update feature counts in categories
featureCategories[0].count = features.length // All features
featureCategories[1].count = features.filter(f => f.category === 'security').length
featureCategories[2].count = features.filter(f => f.category === 'collaboration').length
featureCategories[3].count = features.filter(f => f.category === 'developer').length
featureCategories[4].count = features.filter(f => f.category === 'integrations').length
</script>
