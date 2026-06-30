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
            <span class="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">Transparent pricing</span>
          </div>

          <h1 class="text-balance text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
            One price per team.
            <span class="bg-gradient-to-r from-foreground via-primary/80 to-foreground/90 bg-clip-text text-transparent">
              No per-seat fees, ever.
            </span>
          </h1>

          <p class="max-w-3xl text-lg leading-relaxed text-muted-foreground md:text-xl">
            Stop sharing secrets over Slack. Get encrypted, versioned environment variables
            with role-based access — try everything free for 14 days. One flat price after.
          </p>

          <div class="grid w-full max-w-3xl grid-cols-3 gap-3 rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur-xl">
            <div class="rounded-xl border border-border/60 bg-card/70 px-4 py-3">
              <p class="text-2xl font-semibold text-foreground">2 min</p>
              <p class="text-xs uppercase tracking-wide text-muted-foreground">setup time</p>
            </div>
            <div class="rounded-xl border border-border/60 bg-card/70 px-4 py-3">
              <p class="text-2xl font-semibold text-foreground">AES-256</p>
              <p class="text-xs uppercase tracking-wide text-muted-foreground">encryption</p>
            </div>
            <div class="rounded-xl border border-border/60 bg-card/70 px-4 py-3">
              <p class="text-2xl font-semibold text-foreground">Flat rate</p>
              <p class="text-xs uppercase tracking-wide text-muted-foreground">per team</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="relative pb-24">
      <div class="container px-4 md:px-6">
        <div class="mb-14 flex items-center justify-center">
          <div class="rounded-full border border-border/70 bg-card/70 p-1.5 backdrop-blur-xl">
            <div class="flex items-center gap-1">
              <button
                :class="[
                  'rounded-full px-6 py-2 text-sm font-medium transition-all duration-200',
                   billingPeriod === 'monthly'
                     ? 'bg-primary/18 text-foreground shadow-glow-sm'
                     : 'text-muted-foreground hover:text-foreground'
                ]"
                @click="handleBillingPeriodChange('monthly')"
              >
                Monthly
              </button>
              <button
                :class="[
                  'rounded-full px-6 py-2 text-sm font-medium transition-all duration-200',
                   billingPeriod === 'annual'
                     ? 'bg-primary/18 text-foreground shadow-glow-sm'
                     : 'text-muted-foreground hover:text-foreground'
                ]"
                @click="handleBillingPeriodChange('annual')"
              >
                Annual
                <span class="ml-2 rounded-full bg-primary/20 px-2 py-0.5 text-xs font-semibold text-primary/85">{{ annualSavings }}</span>
              </button>
            </div>
          </div>
        </div>

        <div class="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
          <div class="relative md:-mt-3">
             <MarketingCard
               icon="lucide:zap"
               title="Professional"
               description="For teams that need shared access, audit trails, and integrations"
               class="!bg-gradient-to-b !from-primary/12 !to-primary/[0.03] !border-primary/40 text-foreground backdrop-blur-2xl shadow-glow-xl ring-1 ring-primary/20"
             >
              <div class="mt-3 space-y-6">
                <div>
                  <div class="mb-4 flex items-center justify-between">
                     <span class="rounded-full bg-primary/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">Most Popular</span>
                  </div>
                  <div class="flex items-baseline gap-1">
                    <span class="text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
                      {{ billingPeriod === 'monthly' ? monthlyPrice : annualPrice }}
                    </span>
                    <span class="text-base font-medium text-muted-foreground">/month</span>
                  </div>
                  <div class="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    <span class="font-medium text-foreground/90">14-day free trial</span>
                    <span class="h-1 w-1 rounded-full bg-muted-foreground/70"></span>
                    <span class="text-muted-foreground">No credit card required</span>
                    <template v-if="billingPeriod === 'annual'">
                      <span class="h-1 w-1 rounded-full bg-muted-foreground/70"></span>
                      <span class="text-muted-foreground">billed $90/yr</span>
                      <span class="h-1 w-1 rounded-full bg-muted-foreground/70"></span>
                      <span class="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">Save $18/yr</span>
                    </template>
                  </div>
                </div>

                <div class="space-y-3">
                  <h4 class="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">What's included</h4>
                  <div class="space-y-2.5">
                    <div v-for="feature in proFeatures" :key="feature.label" class="flex items-center gap-3 text-sm text-foreground">
                      <span class="inline-flex h-5 w-5 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
                        <Icon :name="feature.icon" class="h-3 w-3 text-primary/80" />
                      </span>
                      <span :class="feature.bold ? 'font-medium' : ''">{{ feature.label }}</span>
                    </div>
                  </div>
                </div>

                <Button
                  class="w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
                  @click="track('signup_cta_clicked', { page_source: 'pricing', cta_text: 'Start 14-Day Free Trial', tier: 'professional' }); navigateTo('/auth/register')"
                >
                  <Icon name="lucide:sparkles" class="mr-2 h-4 w-4" />
                  Start 14-Day Free Trial
                </Button>

                <p class="text-center text-xs text-muted-foreground">No credit card required. After the trial your workspace becomes read-only until you upgrade — your data is never deleted.</p>
              </div>
            </MarketingCard>
          </div>

          <MarketingCard
             icon="lucide:building"
             title="Enterprise"
             description="SSO, compliance controls, and dedicated support for regulated teams"
             class="!bg-card/70 !border-border/70 text-foreground backdrop-blur-2xl shadow-[0_20px_45px_-25px_hsl(var(--background)/0.8)]"
           >
            <div class="mt-3 space-y-6">
              <div>
                <div class="flex items-baseline gap-1">
                   <span class="text-5xl font-bold tracking-tight text-foreground sm:text-6xl">Custom</span>
                 </div>
                <p class="mt-2 text-sm font-medium text-muted-foreground">Volume pricing for larger teams</p>
              </div>

              <div class="space-y-3">
                <h4 class="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Everything in Professional, plus</h4>
                <div class="space-y-2.5">
                  <div v-for="feature in enterpriseFeatures" :key="feature" class="flex items-center gap-3 text-sm text-foreground/85">
                    <span class="inline-flex h-5 w-5 items-center justify-center rounded-full border border-muted-foreground/45 bg-muted/40">
                      <Icon name="lucide:check" class="h-3 w-3 text-muted-foreground" />
                    </span>
                    <span>{{ feature }}</span>
                  </div>
                </div>
              </div>

              <Button
                variant="outline"
                class="w-full border-border/80 bg-card/60 text-foreground hover:border-primary/35 hover:bg-primary/6"
                @click="track('signup_cta_clicked', { page_source: 'pricing', cta_text: 'Talk to Sales', tier: 'enterprise' }); navigateTo('/auth/register')"
              >
                <Icon name="lucide:mail" class="mr-2 h-4 w-4" />
                Talk to Sales
              </Button>

              <div class="rounded-xl border border-muted-foreground/35 bg-muted/40 p-3">
                <div class="flex items-center gap-2 text-sm text-foreground/85">
                  <Icon name="lucide:medal" class="h-4 w-4 text-muted-foreground" />
                  <span class="font-medium">White-glove onboarding and migration help</span>
                </div>
              </div>
            </div>
          </MarketingCard>
        </div>

        <!-- Social proof / trust signals -->
        <div class="mt-16 grid gap-4 sm:grid-cols-3">
          <div class="rounded-2xl border border-border/60 bg-card/60 p-6 text-center backdrop-blur-xl">
            <div class="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Icon name="lucide:shield-check" class="h-5 w-5 text-primary/80" />
            </div>
            <p class="text-sm font-semibold text-foreground">AES-256-GCM encryption</p>
            <p class="mt-1 text-xs text-muted-foreground">Every secret encrypted at rest and in transit</p>
          </div>
          <div class="rounded-2xl border border-border/60 bg-card/60 p-6 text-center backdrop-blur-xl">
            <div class="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Icon name="lucide:lock" class="h-5 w-5 text-primary/80" />
            </div>
            <p class="text-sm font-semibold text-foreground">Tenant isolation by default</p>
            <p class="mt-1 text-xs text-muted-foreground">Row-level security policies on every query</p>
          </div>
          <div class="rounded-2xl border border-border/60 bg-card/60 p-6 text-center backdrop-blur-xl">
            <div class="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Icon name="lucide:file-text" class="h-5 w-5 text-primary/80" />
            </div>
            <p class="text-sm font-semibold text-foreground">Full audit trail</p>
            <p class="mt-1 text-xs text-muted-foreground">Every access and change logged for compliance</p>
          </div>
        </div>

        <!-- Risk reversal -->
        <div class="mt-8 rounded-2xl border border-primary/20 bg-primary/8 p-8 backdrop-blur-xl">
          <div class="mx-auto max-w-3xl text-center">
            <div class="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary/20 text-primary/85">
              <Icon name="lucide:shield-check" class="h-5 w-5" />
            </div>
            <h3 class="text-2xl font-semibold text-foreground">Zero-risk to try</h3>
            <p class="mt-2 text-foreground/85">14-day free trial, no credit card needed, no lock-in — export your data and cancel anytime.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Why not just use .env files? -->
    <section class="relative py-20">
      <div class="container px-4 md:px-6">
        <div class="mx-auto mb-12 max-w-3xl text-center">
          <div class="mb-4 inline-flex rounded-full border border-border/60 bg-card/60 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Why EnvManager
          </div>
          <h2 class="text-3xl font-semibold tracking-tight sm:text-4xl">Still using .env files?</h2>
          <p class="mt-4 text-lg text-muted-foreground">Here's what you're risking — and what changes when you switch.</p>
        </div>

        <div class="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
          <div v-for="item in comparisonItems" :key="item.before" class="rounded-2xl border border-border/60 bg-card/60 p-6 backdrop-blur-xl">
            <div class="space-y-3">
              <div class="flex items-start gap-3">
                <span class="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10">
                  <Icon name="lucide:x" class="h-3.5 w-3.5 text-destructive" />
                </span>
                <p class="text-sm text-muted-foreground">{{ item.before }}</p>
              </div>
              <div class="flex items-start gap-3">
                <span class="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                  <Icon name="lucide:check" class="h-3.5 w-3.5 text-primary" />
                </span>
                <p class="text-sm font-medium text-foreground">{{ item.after }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="relative py-20">
      <div class="container px-4 md:px-6">
        <div class="mx-auto mb-12 max-w-3xl text-center">
          <div class="mb-4 inline-flex rounded-full border border-border/60 bg-card/60 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            FAQ
          </div>
          <h2 class="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">Common questions</h2>
        </div>

        <div class="mx-auto grid max-w-6xl gap-5 md:grid-cols-2">
          <div
            v-for="item in faqItems"
            :key="item.title"
            class="rounded-2xl border border-border/60 bg-card/60 p-6 backdrop-blur-xl"
          >
            <div class="flex items-start gap-4">
              <span class="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary/80">
                <Icon :name="item.icon" class="h-4 w-4" />
              </span>
              <div class="space-y-2">
                <h3 class="text-lg font-semibold text-foreground">{{ item.title }}</h3>
                <p class="text-sm leading-relaxed text-muted-foreground">{{ item.description }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="relative py-20">
      <div class="container px-4 md:px-6">
        <div class="mx-auto max-w-4xl rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/4 to-transparent p-8 text-center backdrop-blur-xl md:p-12">
          <h2 class="text-balance text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
            Stop sharing secrets over Slack
          </h2>
          <p class="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Replace .env files with one encrypted source of truth. Set up in under two minutes — 14-day free trial, no credit card required.
          </p>

          <div class="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
              class="h-auto bg-primary px-8 py-5 text-base font-semibold text-primary-foreground hover:bg-primary/90"
              @click="track('signup_cta_clicked', { page_source: 'pricing', cta_text: 'Start Free Trial', position: 'bottom' }); navigateTo('/auth/register')"
            >
              <Icon name="lucide:rocket" class="mr-2 h-5 w-5" />
              Start Free Trial
            </Button>
            <Button
              variant="outline"
              size="lg"
              class="h-auto border-border/80 bg-card/60 px-8 py-5 text-base text-foreground hover:border-primary/35 hover:bg-primary/6"
              @click="navigateTo('/docs')"
            >
              <Icon name="lucide:book-open" class="mr-2 h-5 w-5" />
              Read Documentation
            </Button>
          </div>

          <p class="mt-4 text-sm text-muted-foreground">14-day free trial. No credit card needed.</p>
          <p class="mt-3 text-sm text-muted-foreground">
            See how we compare on cost:
            <NuxtLink to="/blog/hashicorp-vault-pricing" class="text-primary hover:underline">HashiCorp Vault</NuxtLink>,
            <NuxtLink to="/blog/aws-secrets-manager-pricing" class="text-primary hover:underline">AWS Secrets Manager</NuxtLink>,
            <NuxtLink to="/blog/doppler-pricing-alternatives" class="text-primary hover:underline">Doppler</NuxtLink>.
          </p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

definePageMeta({
  layout: 'default'
})

import MarketingCard from '@/components/marketing/MarketingCard.vue'
import Button from '@/components/ui/Button.vue'

const { track } = usePostHog()

const billingPeriod = ref<'monthly' | 'annual'>('monthly')

const monthlyPrice = '$9'
const annualPrice = '$7.50'
const annualSavings = 'Save $18/yr'

const proFeatures = [
  { icon: 'lucide:infinity', label: 'Unlimited projects & environments', bold: true },
  { icon: 'lucide:users', label: 'Unlimited team members — flat rate', bold: true },
  { icon: 'lucide:plug', label: 'Unlimited integrations (AWS, GCP, Vercel, ...)', bold: false },
  { icon: 'lucide:shield', label: 'Role-based access & audit logs', bold: false },
  { icon: 'lucide:clock', label: 'Unlimited version history', bold: false },
  { icon: 'lucide:headphones', label: 'Priority email support', bold: false }
]

const enterpriseFeatures = [
  'SSO & SAML authentication',
  'On-premise / self-hosted deployment',
  'Dedicated success manager',
  'Custom compliance & access policies',
  '99.99% uptime SLA',
  'Volume discounts'
]

const comparisonItems = [
  {
    before: '.env files scattered across repos, Slack, and Notion',
    after: 'One encrypted dashboard — every secret, every environment, one place'
  },
  {
    before: 'No idea who accessed or changed a secret',
    after: 'Full audit trail — who changed what, when, and why'
  },
  {
    before: 'New developer? Spend an hour collecting credentials',
    after: 'CLI sync pulls all variables in seconds: envmanager pull'
  },
  {
    before: 'Secrets in plaintext on developer laptops',
    after: 'AES-256-GCM encryption at rest and in transit'
  }
]

const faqItems = computed(() => [
  {
    icon: 'lucide:users',
    title: 'Do you charge per seat?',
    description: 'No. Professional is a flat $9/mo (or $7.50/mo annual) for your entire team — unlimited members. No per-seat pricing, ever.'
  },
  {
    icon: 'lucide:help-circle',
    title: 'What happens after the 14-day trial?',
    description: 'Your workspace becomes read-only — no charge, and your data is never deleted. Upgrade anytime to restore full access.'
  },
  {
    icon: 'lucide:arrow-right-left',
    title: 'How is this different from Doppler or Infisical?',
    description: 'EnvManager is simpler to set up (under 2 minutes), uses flat-rate pricing instead of per-seat, and gives you encryption + audit logs on every plan.'
  },
  {
    icon: 'lucide:shield-check',
    title: 'How secure is my data?',
    description: 'Every secret is encrypted with AES-256-GCM via Supabase Vault. Row-level security ensures tenant isolation. Full audit logging tracks every access.'
  },
  {
    icon: 'lucide:calendar',
    title: 'Is there a long-term contract?',
    description: 'No. Month-to-month by default. Annual plans get a discount but you can cancel anytime — your data is always exportable.'
  },
  {
    icon: 'lucide:terminal',
    title: 'How does the CLI work?',
    description: 'Install with npm, authenticate once, then run "envmanager pull" to sync variables to your local .env file. Works in CI/CD pipelines too.'
  },
  {
    icon: 'lucide:plug',
    title: 'Which platforms do you integrate with?',
    description: 'AWS Secrets Manager, GCP Secret Manager, Vercel, GitHub Actions, and more. Professional plan includes unlimited integrations.'
  },
  {
    icon: 'lucide:building',
    title: 'Do you support self-hosting?',
    description: 'Yes, on the Enterprise plan. We help you deploy EnvManager in your own infrastructure with full support and migration assistance.'
  }
])

const handleBillingPeriodChange = (period: 'monthly' | 'annual') => {
  billingPeriod.value = period
  track('billing_period_toggled', { selected_period: period })
}
</script>
