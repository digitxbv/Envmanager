<template>
  <div class="relative isolate overflow-hidden bg-background text-foreground">
    <div class="pointer-events-none absolute inset-0">
      <div class="hero-grid absolute inset-0 opacity-45"></div>
      <div class="absolute -left-44 top-20 h-[27rem] w-[27rem] rounded-full bg-primary/20 blur-[140px]"></div>
      <div class="absolute -right-40 top-[34%] h-[24rem] w-[24rem] rounded-full bg-primary/20 blur-[130px]"></div>
      <div class="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-background via-background/70 to-transparent"></div>
    </div>

    <main class="relative">
      <section class="py-16 md:py-24">
        <div class="container space-y-8 px-4 md:space-y-12 md:px-6">
          <MarketingHero
            badge="Built for Agencies"
            badge-icon="lucide:briefcase"
            title="12 clients. 47 .env files. One wrong deploy away from a breach."
            description="Stop juggling spreadsheets and Slack threads for client credentials. One dashboard for every client project, with isolated access controls and audit logs your enterprise clients actually ask for."
            primary-cta-label="Start 14-Day Free Trial"
            primary-cta-to="/auth/register"
            primary-icon="lucide:rocket"
            secondary-cta-label="See Agency Pricing"
            secondary-cta-to="/pricing"
          />

          <div class="grid gap-4 md:grid-cols-3">
            <div
              v-for="proof in agencyProofPoints"
              :key="proof"
              class="rounded-xl border border-primary/35 bg-primary/10 px-4 py-3 text-sm text-foreground/90"
            >
              <Icon name="lucide:check-circle" class="mr-2 inline h-4 w-4 text-primary" />
              {{ proof }}
            </div>
          </div>
        </div>
      </section>

      <section class="border-y border-border/60 bg-muted/20 py-16 md:py-24">
        <div class="container px-4 md:px-6">
          <div class="mx-auto mb-10 max-w-3xl text-center md:mb-14">
            <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">The real cost of managing secrets in spreadsheets</h2>
            <p class="mt-4 text-base text-muted-foreground md:text-lg">
              More clients means more credentials to track. Here is where agencies lose time, trust, and contracts.
            </p>
          </div>

          <div class="grid gap-12 lg:grid-cols-2 items-center">
            <div class="relative overflow-hidden rounded-xl border border-border/60 bg-card/50 p-2 shadow-2xl backdrop-blur-sm md:p-4">
              <img
                src="/images/product/team-settings.png"
                alt="EnvManager Team Settings"
                class="h-auto w-full rounded-lg border border-border/40 shadow-sm"
                width="1200"
                height="675"
              />
            </div>
            <div class="space-y-8">
              <div v-for="painPoint in agencyPainPoints" :key="painPoint.title" class="flex gap-4">
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
          </div>
        </div>
      </section>

      <section class="py-16 md:py-24">
        <div class="container px-4 md:px-6">
          <div class="mx-auto mb-10 max-w-3xl text-center md:mb-14">
            <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">Everything you need to manage client secrets professionally</h2>
            <p class="mt-4 text-base text-muted-foreground md:text-lg">
              Stop treating secret management as an afterthought. Your clients will notice the difference.
            </p>
          </div>

          <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <MarketingCard
              v-for="feature in agencyFeatures"
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
          <div class="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1.3fr_1fr] lg:items-stretch">
            <div class="rounded-3xl border border-border/60 bg-card/70 p-8 backdrop-blur-sm md:p-10">
              <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">One price. Unlimited clients. No per-seat surprises.</h2>
              <p class="mt-4 text-base text-muted-foreground md:text-lg">
                The Professional plan covers unlimited projects, variables, and team members. Add clients without worrying about your bill.
              </p>

              <div class="mt-8 space-y-3">
                <div v-for="item in professionalPlanItems" :key="item" class="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon name="lucide:check" class="h-4 w-4 text-primary" />
                  <span>{{ item }}</span>
                </div>
              </div>
            </div>

            <div class="rounded-3xl border border-primary/25 bg-primary/10 p-8">
              <p class="text-xs font-semibold uppercase tracking-wide text-primary">Recommended Plan</p>
              <h3 class="mt-3 text-2xl font-bold">Professional</h3>
              <p class="mt-2 text-sm text-muted-foreground">Perfect for agencies</p>
              <p class="mt-5 text-4xl font-bold">$9<span class="text-lg text-muted-foreground">/month</span></p>
              <p class="mt-1 text-sm text-muted-foreground">14-day free trial</p>

              <div class="mt-6 flex flex-col gap-3">
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
                  View Pricing
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="py-16 md:py-24">
        <div class="container px-4 md:px-6">
          <div class="mx-auto max-w-4xl rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/20 via-card/80 to-background/80 p-8 text-center backdrop-blur-sm md:p-12">
            <h2 class="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">Stop losing time to secret management. Start winning client trust.</h2>
            <p class="mx-auto mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
              14-day free trial. No credit card required. Set up your first client project in under 5 minutes.
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
  title: 'EnvManager for Agencies - Manage Client Secrets Securely at Scale',
  description: 'Stop juggling .env files across client projects. Isolated projects, scoped team access, instant revocation, and audit logs your enterprise clients actually request.',
  ogTitle: 'EnvManager for Agencies - Client Secret Management at Scale',
  ogDescription: 'Isolated projects per client, scoped team access, and audit logs. One dashboard for every client credential.'
})

const agencyProofPoints = [
  'Isolated projects per client — no cross-contamination',
  'Instant access revocation when contractors leave',
  'Audit logs your enterprise clients actually request'
]

const agencyPainPoints = [
  {
    icon: 'lucide:folder-open',
    title: '"I deployed Client A\'s secrets to Client B\'s server"',
    description: 'Dozens of .env files in shared drives and Slack channels. One copy-paste mistake and you have a data breach across clients.',
    solution: 'Isolated projects with separate environments per client'
  },
  {
    icon: 'lucide:user-minus',
    title: 'Freelancer left the project. Still has all the keys.',
    description: 'Contractors and freelancers rotate through projects. Revoking access means hunting through every service they touched.',
    solution: 'Revoke all access with one click when they leave'
  },
  {
    icon: 'lucide:file-question',
    title: '"We need a security audit before signing the contract"',
    description: 'Your biggest client prospect wants proof you handle credentials securely. You have nothing to show them.',
    solution: 'Export audit logs per project for client reviews'
  }
]

const agencyFeatures = [
  {
    icon: 'lucide:folder',
    title: 'One Project Per Client',
    description: 'Complete isolation between clients. No shared credentials, no accidental cross-contamination, no risk.'
  },
  {
    icon: 'lucide:users',
    title: 'Scoped Team Access',
    description: 'Assign developers to specific client projects. Contractors only see what they need. Revoke access instantly.'
  },
  {
    icon: 'lucide:scroll-text',
    title: 'Client-Ready Audit Trails',
    description: 'Every secret access is logged. Export per-project audit reports when clients ask for security documentation.'
  },
  {
    icon: 'lucide:layers',
    title: 'Dev, Staging, Production Per Client',
    description: 'Separate environments for every client project. Deploy the right secrets to the right place every time.'
  },
  {
    icon: 'lucide:plug',
    title: 'Deploy to Any Stack',
    description: 'Sync secrets to Vercel, Railway, Render, Dokploy, Coolify, and GitHub Actions. One dashboard for every client stack.'
  },
  {
    icon: 'lucide:handshake',
    title: 'Clean Client Handoff',
    description: 'Project complete? Export all secrets for handoff or invite the client directly to take ownership of their project.'
  }
]

const professionalPlanItems = [
  'Unlimited client projects',
  'Unlimited variables and secrets',
  'Unlimited team members and contractors',
  'All 6+ platform integrations',
  'Full audit logs with export',
  'Priority support'
]
</script>
