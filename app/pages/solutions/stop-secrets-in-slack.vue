<template>
  <div class="relative isolate overflow-hidden bg-background text-foreground">
    <div class="pointer-events-none absolute inset-0">
      <div class="hero-grid absolute inset-0 opacity-45"></div>
      <div class="absolute -left-44 top-16 h-[26rem] w-[26rem] rounded-full bg-destructive/15 blur-[130px]"></div>
      <div class="absolute -right-44 top-[32%] h-[28rem] w-[28rem] rounded-full bg-primary/20 blur-[140px]"></div>
      <div class="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-background via-background/80 to-transparent"></div>
    </div>

    <main class="relative">
      <section class="py-16 md:py-24">
        <div class="container space-y-8 px-4 md:space-y-12 md:px-6">
          <MarketingHero
            badge="Security Problem"
            badge-icon="lucide:alert-triangle"
            title="Stop sharing secrets in Slack"
            description="Can someone DM me the API key? Sharing secrets through Slack, Discord, or email is one of the biggest security risks in modern development. It is time to stop."
            primary-cta-label="Secure Your Secrets"
            primary-icon="lucide:shield"
            secondary-cta-label="See How It Works"
            secondary-cta-to="/features"
          >
            <template #actions>
              <Button
                size="lg"
                class="w-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 sm:w-auto"
                @click="handleHeroSignup"
              >
                <Icon name="lucide:shield" class="mr-2 h-5 w-5" />
                Secure Your Secrets
              </Button>
              <Button
                variant="outline"
                size="lg"
                class="w-full border-border/70 bg-background/80 hover:bg-muted sm:w-auto"
                @click="navigateTo('/features')"
              >
                See How It Works
              </Button>
            </template>
          </MarketingHero>

          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div
              v-for="item in proofPoints"
              :key="item"
              class="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/30 px-3 py-2 text-sm text-foreground/80"
            >
              <Icon name="lucide:check" class="h-4 w-4 text-success" />
              {{ item }}
            </div>
          </div>
        </div>
      </section>

      <section class="border-y border-border/60 bg-muted/20 py-16 md:py-24">
        <div class="container px-4 md:px-6">
          <div class="mx-auto max-w-5xl">
            <div class="mx-auto mb-10 max-w-3xl text-center md:mb-14">
              <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">The problem with secrets in chat</h2>
            </div>

            <div class="grid gap-6 md:grid-cols-2">
              <MarketingCard
                v-for="problem in problemCards"
                :key="problem.title"
                :icon="problem.icon"
                :title="problem.title"
                :description="problem.description"
              />
            </div>

            <div class="mt-10 rounded-2xl border border-destructive/40 bg-destructive/10 p-7 text-center md:p-8">
              <p class="text-4xl font-bold text-destructive">81%</p>
              <p class="mt-2 text-sm text-destructive/80 md:text-base">
                of breaches involve compromised credentials, often obtained through chat history or social engineering.
              </p>
              <p class="mt-2 text-xs text-destructive/60">Source: Verizon Data Breach Investigations Report</p>
            </div>
          </div>
        </div>
      </section>

      <section class="py-16 md:py-24">
        <div class="container px-4 md:px-6">
          <div class="mx-auto max-w-5xl space-y-10 md:space-y-14">
            <div class="mx-auto max-w-3xl text-center">
              <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">The EnvManager solution</h2>
              <p class="mt-4 text-base text-muted-foreground md:text-lg">
                One secure place for all your secrets. Share access, not credentials.
              </p>
            </div>

            <div class="grid gap-6 lg:grid-cols-2">
              <div class="rounded-2xl border border-destructive/35 bg-destructive/10 p-6 md:p-8">
                <h3 class="text-2xl font-bold">Before: Secrets everywhere</h3>
                <div class="mt-5 space-y-3">
                  <div v-for="risk in chatRisks" :key="risk" class="flex items-center gap-3 text-sm text-destructive/80 md:text-base">
                    <Icon name="lucide:x-circle" class="h-4 w-4 text-destructive" />
                    <span>{{ risk }}</span>
                  </div>
                </div>
              </div>

              <div class="rounded-2xl border border-success/35 bg-success/10 p-6 md:p-8">
                <h3 class="text-2xl font-bold">After: One secure dashboard</h3>
                <div class="mt-5 space-y-3">
                  <div
                    v-for="outcome in secureOutcomes"
                    :key="outcome"
                    class="flex items-center gap-3 text-sm text-success/80 md:text-base"
                  >
                    <Icon name="lucide:check-circle" class="h-4 w-4 text-success" />
                    <span>{{ outcome }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="rounded-3xl border border-border/60 bg-card/70 p-7 backdrop-blur-sm md:p-10">
              <h3 class="text-center text-xl font-bold">How to share secrets securely</h3>
              <div class="mt-8 space-y-6">
                <div 
                  v-for="step in secureFlow"
                  :key="step.title"
                  class="flex flex-col gap-4 md:flex-row md:items-start"
                >
                  <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon :name="step.icon" class="h-6 w-6" />
                  </div>
                  <div>
                    <h4 class="font-semibold">{{ step.index }}: {{ step.title }}</h4>
                    <p class="mt-1 text-muted-foreground">{{ step.description }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="border-y border-border/60 bg-muted/20 py-16 md:py-24">
        <div class="container px-4 md:px-6">
          <div class="mx-auto max-w-5xl">
            <div class="mx-auto mb-10 max-w-3xl text-center md:mb-14">
              <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">Security built in</h2>
            </div>

            <div class="grid gap-6 md:grid-cols-2">
              <MarketingCard
                v-for="feature in securityFeatures"
                :key="feature.title"
                :icon="feature.icon"
                :title="feature.title"
                :description="feature.description"
              />
            </div>
          </div>
        </div>
      </section>

      <section class="py-16 md:py-24">
        <div class="container px-4 md:px-6">
          <div class="mx-auto max-w-4xl rounded-3xl border border-success/30 bg-gradient-to-br from-success/15 via-card/85 to-background p-8 text-center md:p-12">
            <h2 class="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">Stop the insecure sharing today</h2>
            <p class="mx-auto mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
              Set up EnvManager in minutes and never share secrets in Slack again.
            </p>

            <div class="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                class="w-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 sm:w-auto"
                @click="navigateTo('/auth/register')"
              >
                <Icon name="lucide:shield" class="mr-2 h-5 w-5" />
                Secure Your Secrets
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
  title: 'Stop Sharing Secrets in Slack - EnvManager',
  description: 'Stop the insecure practice of sharing API keys and passwords in Slack. EnvManager provides a secure alternative.',
  ogTitle: 'Stop Sharing Secrets in Slack - EnvManager',
  ogDescription: 'Stop the insecure practice of sharing API keys and passwords in Slack. EnvManager provides a secure alternative.'
})

import MarketingCard from '@/components/marketing/MarketingCard.vue'
import MarketingHero from '@/components/marketing/MarketingHero.vue'
import Button from '@/components/ui/Button.vue'

const { track } = usePostHog()

const proofPoints = [
  'No secrets in Slack or Discord',
  'Role-based access from day one',
  'Encrypted storage in one vault',
  'Instant revoke when someone leaves'
]

const problemCards = [
  {
    icon: 'lucide:search',
    title: 'Searchable Forever',
    description: 'Chat history is searchable. That API key you shared 2 years ago is still there, waiting for a compromised account to find it.'
  },
  {
    icon: 'lucide:users',
    title: 'Who Has Access?',
    description: 'Anyone in the channel can see it. Ex-employees who left months ago are still in that old Slack export.'
  },
  {
    icon: 'lucide:clock',
    title: 'No Expiration',
    description: 'Messages do not expire. That database password you shared to unblock someone is still accessible years later.'
  },
  {
    icon: 'lucide:file-x',
    title: 'No Audit Trail',
    description: 'You have no idea who has seen the secret or if it has been copied to other places.'
  }
]

const chatRisks = [
  'API keys in Slack DMs',
  'Database passwords in email',
  '.env files in shared drives',
  'Hardcoded in git history'
]

const secureOutcomes = [
  'All secrets in one encrypted vault',
  'Share access, not credentials',
  'Revoke access instantly',
  'Complete audit trail'
]

const secureFlow = [
  {
    index: 'Step 1',
    icon: 'lucide:database',
    title: 'Store in EnvManager',
    description: 'Add your secrets to a project. They are encrypted immediately.'
  },
  {
    index: 'Step 2',
    icon: 'lucide:user-plus',
    title: 'Invite team members',
    description: 'Add people to the project so they can access what they need without copy-pasting credentials.'
  },
  {
    index: 'Step 3',
    icon: 'lucide:upload-cloud',
    title: 'Sync to platforms',
    description: 'One-click sync to Vercel, Railway, GitHub Actions, and more.'
  }
]

const securityFeatures = [
  {
    icon: 'lucide:lock',
    title: 'End-to-End Encryption',
    description: 'AES-256-GCM encryption. Secrets are encrypted before leaving your browser.'
  },
  {
    icon: 'lucide:eye-off',
    title: 'Hidden by Default',
    description: 'Secret values are never shown in plain text unless explicitly revealed.'
  },
  {
    icon: 'lucide:user-x',
    title: 'Instant Revocation',
    description: 'Remove access immediately. No more shared credentials to rotate.'
  },
  {
    icon: 'lucide:scroll-text',
    title: 'Complete Audit Trail',
    description: 'Track who accessed what and when. Essential for security and compliance.'
  }
]

const handleHeroSignup = () => {
  track('signup_cta_clicked', { page_source: 'solutions', cta_text: 'Secure Your Secrets' })
  navigateTo('/auth/register')
}

onMounted(() => {
  track('solution_page_viewed', { solution: 'stop-secrets-in-slack' })
})
</script>
