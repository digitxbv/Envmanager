<template>
  <div class="relative isolate overflow-hidden bg-background text-foreground">
    <div class="pointer-events-none absolute inset-0">
      <div class="hero-grid absolute inset-0 opacity-45"></div>
      <div class="absolute -left-44 top-14 h-[27rem] w-[27rem] rounded-full bg-success/15 blur-[140px]"></div>
      <div class="absolute -right-48 top-[34%] h-[25rem] w-[25rem] rounded-full bg-primary/18 blur-[130px]"></div>
      <div class="absolute inset-x-0 bottom-0 h-80 bg-gradient-to-t from-background via-background/80 to-transparent"></div>
    </div>

    <main class="relative">
      <section class="py-16 md:py-24">
        <div class="container space-y-8 px-4 md:space-y-12 md:px-6">
          <MarketingHero
            badge="Audit & Compliance"
            badge-icon="lucide:scroll-text"
            title="Your auditor asks 'who accessed production secrets last Tuesday.' Can you answer in 10 seconds?"
            description="EnvManager logs every access, change, and sync with full context. When compliance comes knocking, you are ready -- not scrambling through Slack history."
            primary-cta-label="Start Tracking"
            primary-icon="lucide:shield"
            secondary-cta-label="See All Features"
            secondary-cta-to="/features"
          >
            <template #actions>
              <Button
                size="lg"
                class="w-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 sm:w-auto"
                @click="handleStartTracking"
              >
                <Icon name="lucide:shield" class="mr-2 h-5 w-5" />
                Start Tracking
              </Button>
              <Button
                variant="outline"
                size="lg"
                class="w-full border-border/70 bg-background/80 hover:bg-muted sm:w-auto"
                @click="navigateTo('/features')"
              >
                See All Features
              </Button>
            </template>
          </MarketingHero>

          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div
              v-for="item in proofPoints"
              :key="item"
              class="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <div class="flex h-6 w-6 items-center justify-center rounded-full bg-success/10">
                <Icon name="lucide:check" class="h-3 w-3 text-success" />
              </div>
              {{ item }}
            </div>
          </div>
        </div>
      </section>

      <section class="border-y border-border/60 bg-muted/20 py-16 md:py-24">
        <div class="container px-4 md:px-6">
          <div class="mx-auto max-w-5xl">
            <div class="mx-auto mb-10 max-w-3xl text-center md:mb-14">
              <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">Why audit logs matter</h2>
              <p class="mt-4 text-base text-muted-foreground md:text-lg">For security, compliance, and peace of mind.</p>
            </div>

            <div class="grid gap-6 md:grid-cols-2">
              <MarketingCard
                v-for="(reason, index) in auditReasons"
                :key="reason.title"
                :icon="reason.icon"
                :title="reason.title"
                :description="reason.description"
                :class="index === 2 ? 'md:col-span-2' : ''"
              />
            </div>
          </div>
        </div>
      </section>

      <section class="py-16 md:py-24">
        <div class="container px-4 md:px-6">
          <div class="mx-auto max-w-6xl">
            <div class="mx-auto mb-10 max-w-3xl text-center md:mb-14">
              <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">What we track</h2>
              <p class="mt-4 text-base text-muted-foreground md:text-lg">Every significant action is logged with full context.</p>
            </div>

            <div class="grid gap-8 lg:grid-cols-[1.05fr_1fr] lg:items-start">
              <div class="grid gap-6 sm:grid-cols-2">
                <MarketingCard
                  v-for="item in trackedActions"
                  :key="item.title"
                  :icon="item.icon"
                  :title="item.title"
                  :description="item.description"
                />
              </div>

              <div class="rounded-3xl border border-border/60 bg-card/70 p-6 shadow-lg backdrop-blur-sm md:p-8">
                <div class="mb-5 flex items-center justify-between">
                  <h3 class="text-lg font-semibold">Recent Activity</h3>
                  <span class="text-xs text-muted-foreground">Production</span>
                </div>

                <div class="space-y-3">
                  <div
                    v-for="activity in activityPreview"
                    :key="activity.text"
                    class="flex items-start gap-3 rounded-xl border border-border/60 bg-background/50 p-3"
                  >
                    <div :class="activity.iconClass" class="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full">
                      <Icon :name="activity.icon" class="h-4 w-4" />
                    </div>
                    <div class="min-w-0 flex-1">
                      <p class="text-sm"><span class="font-medium">{{ activity.name }}</span> {{ activity.action }} <span v-if="activity.target" class="rounded bg-muted px-1 font-mono text-xs">{{ activity.target }}</span><span v-if="activity.targetBold" class="font-medium">{{ activity.targetBold }}</span></p>
                      <p class="text-xs text-muted-foreground">{{ activity.time }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="border-y border-border/60 bg-muted/20 py-16 md:py-24">
        <div class="container px-4 md:px-6">
          <div class="mx-auto max-w-6xl">
            <div class="mx-auto mb-10 max-w-3xl text-center md:mb-14">
              <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">Compliance framework support</h2>
              <p class="mt-4 text-base text-muted-foreground md:text-lg">
                EnvManager helps you meet requirements across common compliance frameworks.
              </p>
            </div>

            <div class="grid gap-6 md:grid-cols-2">
              <article
                v-for="framework in frameworks"
                :key="framework.name"
                class="rounded-2xl border border-border/60 bg-card/70 p-6 backdrop-blur-sm"
              >
                <div class="mb-4 flex items-center gap-3">
                  <div :class="framework.iconClass" class="inline-flex h-10 w-10 items-center justify-center rounded-lg">
                    <Icon :name="framework.icon" class="h-5 w-5" />
                  </div>
                  <h3 class="text-lg font-semibold">{{ framework.name }}</h3>
                </div>
                <p class="text-sm text-muted-foreground">{{ framework.description }}</p>

                <div class="mt-4 space-y-2">
                  <div v-for="item in framework.checks" :key="item" class="flex items-center gap-2 text-sm">
                    <Icon name="lucide:check" class="h-4 w-4 text-success" />
                    <span>{{ item }}</span>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section class="py-16 md:py-24">
        <div class="container px-4 md:px-6">
          <div class="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.05fr_1fr] lg:items-start">
            <div>
              <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">Export for auditors</h2>
              <p class="mt-4 text-base text-muted-foreground md:text-lg">
                When auditors come knocking, you will be ready. Export your audit logs in formats they understand.
              </p>

              <div class="mt-8 space-y-4">
                <MarketingCard
                  v-for="feature in exportFeatures"
                  :key="feature.title"
                  :icon="feature.icon"
                  :title="feature.title"
                  :description="feature.description"
                />
              </div>
            </div>

            <div class="rounded-3xl border border-border/60 bg-card/70 p-6 backdrop-blur-sm md:p-8">
              <h3 class="text-lg font-semibold">Export Preview</h3>
              <div class="mt-4 overflow-x-auto rounded-xl border border-border/60 bg-background/60 p-4 font-mono text-xs text-muted-foreground">
                <p class="mb-2">audit_log_2026-02.csv</p>
                <p>timestamp,user,action,resource,environment</p>
                <p>2026-02-21T14:32:00Z,john@co.com,update,DATABASE_URL,production</p>
                <p>2026-02-21T13:15:00Z,sarah@co.com,reveal,API_SECRET,production</p>
                <p>2026-02-21T13:00:00Z,john@co.com,sync,vercel,production</p>
                <p>2026-02-20T16:45:00Z,mike@co.com,create,STRIPE_KEY,production</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="border-t border-border/60 py-16 md:py-24">
        <div class="container px-4 md:px-6">
          <div class="mx-auto max-w-4xl rounded-3xl border border-success/30 bg-gradient-to-br from-success/15 via-card/85 to-background p-8 text-center md:p-12">
            <h2 class="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">Your next audit starts now -- be ready.</h2>
            <p class="mx-auto mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
              Every day without audit logging is another day of evidence you cannot produce. Start tracking in minutes, free.
            </p>

            <div class="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                class="w-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 sm:w-auto"
                @click="handleStartTracking"
              >
                <Icon name="lucide:scroll-text" class="mr-2 h-5 w-5" />
                Start Tracking
              </Button>
              <Button
                variant="outline"
                size="lg"
                class="w-full border-border/70 bg-background/80 hover:bg-muted sm:w-auto"
                @click="navigateTo('/pricing')"
              >
                View Pricing
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
definePageMeta({
  layout: 'default'
})

useSeoMeta({
  title: 'Audit & Compliance - EnvManager',
  description: 'Comprehensive audit logging for environment variables. Built to support SOC 2, HIPAA, GDPR, and ISO 27001 compliance workflows.',
  ogTitle: 'Audit & Compliance - EnvManager',
  ogDescription: 'Comprehensive audit logging for environment variables. Built to support SOC 2, HIPAA, GDPR, and ISO 27001 compliance workflows.'
})

import MarketingCard from '@/components/marketing/MarketingCard.vue'
import MarketingHero from '@/components/marketing/MarketingHero.vue'
import Button from '@/components/ui/Button.vue'

const { track } = usePostHog()

const proofPoints = [
  'Every access logged with user, timestamp, and IP',
  'One-click CSV export for auditors',
  'Supports SOC 2, HIPAA, GDPR, ISO 27001',
  'Investigate incidents in minutes, not days'
]

const auditReasons = [
  {
    icon: 'lucide:shield-check',
    title: 'Security Investigations',
    description: 'Production went down at 3 AM. Was it a config change? Who made it? With audit logs, you know in seconds -- not after a two-day post-mortem.'
  },
  {
    icon: 'lucide:clipboard-check',
    title: 'Compliance Audits',
    description: 'SOC 2, HIPAA, and GDPR all require evidence of access controls and change tracking. EnvManager generates that evidence automatically.'
  },
  {
    icon: 'lucide:search',
    title: 'Debugging Production Issues',
    description: '"What changed?" is always the first question when something breaks. Audit logs give you the answer before the Slack thread starts.'
  }
]

const trackedActions = [
  {
    icon: 'lucide:plus',
    title: 'Variable Created',
    description: 'Who added the variable, when, and to which environment.'
  },
  {
    icon: 'lucide:edit',
    title: 'Variable Updated',
    description: 'Who changed the value, when, and what the previous value was (encrypted).'
  },
  {
    icon: 'lucide:trash',
    title: 'Variable Deleted',
    description: 'Who removed the variable and from which environment.'
  },
  {
    icon: 'lucide:eye',
    title: 'Secret Revealed',
    description: 'Who viewed a secret value and when.'
  },
  {
    icon: 'lucide:upload-cloud',
    title: 'Sync Performed',
    description: 'Who synced to which platform and what variables were pushed.'
  }
]

const activityPreview = [
  {
    icon: 'lucide:edit',
    iconClass: 'bg-primary/20 text-primary',
    name: 'John Doe',
    action: 'updated',
    target: 'DATABASE_URL',
    time: 'Today at 14:32'
  },
  {
    icon: 'lucide:eye',
    iconClass: 'bg-secondary/20 text-secondary',
    name: 'Sarah Smith',
    action: 'revealed',
    target: 'API_SECRET',
    time: 'Today at 13:15'
  },
  {
    icon: 'lucide:upload-cloud',
    iconClass: 'bg-destructive/20 text-destructive',
    name: 'John Doe',
    action: 'synced to',
    targetBold: 'Vercel',
    time: 'Today at 13:00 - 12 variables'
  },
  {
    icon: 'lucide:plus',
    iconClass: 'bg-success/20 text-success',
    name: 'Mike Johnson',
    action: 'added',
    target: 'STRIPE_KEY',
    time: 'Yesterday at 16:45'
  }
]

const frameworks = [
  {
    name: 'SOC 2 Type II',
    icon: 'lucide:shield',
    iconClass: 'bg-success/20 text-success',
    description: 'Demonstrate access controls, change management, and encryption to your SOC 2 auditor with exportable evidence.',
    checks: ['Immutable access logging', 'Change management trail', 'AES-256 encryption at rest']
  },
  {
    name: 'HIPAA',
    icon: 'lucide:heart-pulse',
    iconClass: 'bg-primary/20 text-primary',
    description: 'Healthcare teams need to prove who accessed protected data and when. EnvManager generates that evidence automatically.',
    checks: ['Role-based access controls', 'Detailed audit trails', 'End-to-end data encryption']
  },
  {
    name: 'GDPR',
    icon: 'lucide:globe',
    iconClass: 'bg-secondary/20 text-secondary',
    description: 'EU data protection requirements demand clear access records and the ability to remove data. EnvManager delivers both.',
    checks: ['Data protection logging', 'Access audit records', 'Right to erasure support']
  },
  {
    name: 'ISO 27001',
    icon: 'lucide:file-check',
    iconClass: 'bg-destructive/20 text-destructive',
    description: 'Meet information security management standard requirements with built-in classification, access controls, and monitoring.',
    checks: ['Secret classification by environment', 'Granular access management', 'Continuous logging & monitoring']
  }
]

const exportFeatures = [
  {
    icon: 'lucide:file-spreadsheet',
    title: 'CSV Export',
    description: 'Download logs as CSV for spreadsheet analysis.'
  },
  {
    icon: 'lucide:filter',
    title: 'Date Range Filtering',
    description: 'Filter by date range to export exactly what auditors need.'
  },
  {
    icon: 'lucide:folder',
    title: 'Per-Project Export',
    description: 'Export logs for specific projects or environments.'
  }
]

const handleStartTracking = () => {
  track('signup_cta_clicked', { page_source: 'solutions', cta_text: 'Start Tracking' })
  navigateTo('/auth/register')
}

onMounted(() => {
  track('solution_page_viewed', { solution: 'audit-compliance' })
})
</script>
