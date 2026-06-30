<template>
  <div class="relative isolate overflow-hidden bg-background text-foreground">
    <div class="pointer-events-none absolute inset-0">
      <div class="hero-grid absolute inset-0 opacity-50"></div>
      <div class="absolute -left-48 top-16 h-[28rem] w-[28rem] rounded-full bg-secondary/15 blur-[145px]"></div>
      <div class="absolute -right-44 top-[36%] h-[24rem] w-[24rem] rounded-full bg-primary/20 blur-[130px]"></div>
      <div class="absolute inset-x-0 bottom-0 h-80 bg-gradient-to-t from-background via-background/80 to-transparent"></div>
    </div>

    <main class="relative">
      <section class="py-16 md:py-24">
        <div class="container space-y-8 px-4 md:space-y-12 md:px-6">
          <MarketingHero
            badge="Team Security"
            badge-icon="lucide:users"
            title="The intern has production database credentials. You just do not know it yet."
            description="Three roles. Environment-level permissions. Full audit trail. Set up in 5 minutes, know exactly who can access what from day one."
            primary-cta-label="Start Free Trial"
            primary-icon="lucide:shield"
            secondary-cta-label="See All Features"
            secondary-cta-to="/features"
          >
            <template #actions>
              <Button
                size="lg"
                class="w-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 sm:w-auto"
                @click="handleHeroSignup"
              >
                <Icon name="lucide:shield" class="mr-2 h-5 w-5" />
                Start Free Trial
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

          <div class="flex flex-wrap gap-x-8 gap-y-4 text-sm text-muted-foreground">
            <div
              v-for="item in proofPoints"
              :key="item"
              class="flex items-center gap-2"
            >
              <Icon name="lucide:check-circle" class="h-4 w-4 text-success" />
              {{ item }}
            </div>
          </div>
        </div>
      </section>

      <section class="border-y border-border/60 bg-muted/20 py-16 md:py-24">
        <div class="container px-4 md:px-6">
          <div class="mx-auto max-w-5xl">
            <div class="mx-auto mb-10 max-w-3xl text-center md:mb-14">
              <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">The team access problem</h2>
              <p class="mt-4 text-base text-muted-foreground md:text-lg">
                As teams grow, secret management becomes a security nightmare.
              </p>
            </div>

            <div class="grid gap-6 md:grid-cols-2">
              <MarketingCard
                v-for="(problem, index) in accessProblems"
                :key="problem.title"
                :icon="problem.icon"
                :title="problem.title"
                :description="problem.description"
                :class="index === 0 ? 'md:col-span-2' : ''"
              />
            </div>
          </div>
        </div>
      </section>

      <section class="py-16 md:py-24">
        <div class="container px-4 md:px-6">
          <div class="mx-auto max-w-6xl">
            <div class="mx-auto mb-10 max-w-3xl text-center md:mb-14">
              <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">Role-based access control</h2>
              <p class="mt-4 text-base text-muted-foreground md:text-lg">
                Three simple roles that give you complete control.
              </p>
            </div>

            <div class="grid gap-6 md:grid-cols-3">
              <article
                v-for="role in roleCards"
                :key="role.title"
                :class="role.highlight ? 'border-primary/40 bg-primary/10 shadow-lg scale-[1.02]' : 'border-border/60 bg-card/70 hover:bg-card/90 transition-colors'"
                class="rounded-2xl border p-6 backdrop-blur-sm"
              >
                <div class="mb-6 text-center">
                  <div :class="role.iconClass" class="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl">
                    <Icon :name="role.icon" class="h-7 w-7" />
                  </div>
                  <h3 class="text-xl font-bold">{{ role.title }}</h3>
                  <p class="text-sm text-muted-foreground">{{ role.subtitle }}</p>
                </div>

                <div class="space-y-3">
                  <div
                    v-for="permission in role.permissions"
                    :key="permission.label"
                    class="flex items-center gap-2 text-sm"
                  >
                    <Icon
                      :name="permission.allowed ? 'lucide:check' : 'lucide:x'"
                      :class="permission.allowed ? 'text-success' : 'text-muted-foreground'"
                      class="h-4 w-4"
                    />
                    <span :class="permission.allowed ? '' : 'text-muted-foreground'">{{ permission.label }}</span>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section class="border-y border-border/60 bg-muted/20 py-16 md:py-24">
        <div class="container px-4 md:px-6">
          <div class="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-start">
            <div>
              <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">Environment-level permissions</h2>
              <p class="mt-4 text-base text-muted-foreground md:text-lg">
                Not everyone needs production access. EnvManager lets you control access at the environment level.
              </p>

              <div class="mt-8 space-y-4">
                <MarketingCard
                  v-for="environment in environments"
                  :key="environment.title"
                  :icon="environment.icon"
                  :title="environment.title"
                  :description="environment.description"
                />
              </div>
            </div>

            <div class="rounded-3xl border border-border/60 bg-card/70 p-6 backdrop-blur-sm md:p-8">
              <h3 class="text-lg font-semibold">Example: Web App Team</h3>
              <div class="mt-5 space-y-3">
                <div
                  v-for="member in teamExample"
                  :key="member.name"
                  class="flex items-center justify-between rounded-xl border border-border/60 bg-background/50 p-3"
                >
                  <div class="flex items-center gap-3">
                    <div :class="member.avatarClass" class="inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold">
                      {{ member.initials }}
                    </div>
                    <div>
                      <p class="text-sm font-medium">{{ member.name }}</p>
                      <p class="text-xs text-muted-foreground">{{ member.role }}</p>
                    </div>
                  </div>
                  <p class="text-xs text-muted-foreground">{{ member.access }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="py-16 md:py-24">
        <div class="container px-4 md:px-6">
          <div class="mx-auto max-w-5xl">
            <div class="mx-auto mb-10 max-w-3xl text-center md:mb-14">
              <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">More security features</h2>
            </div>

            <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
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

      <section class="border-t border-border/60 py-16 md:py-24">
        <div class="container px-4 md:px-6">
          <div class="mx-auto max-w-4xl rounded-3xl border border-success/30 bg-gradient-to-br from-success/15 via-card/85 to-background p-8 text-center md:p-12">
            <h2 class="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">Your next hire starts Monday. Are your secrets protected?</h2>
            <p class="mx-auto mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
              Set up role-based access control in under 5 minutes. Free for small teams.
            </p>

            <div class="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                class="w-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 sm:w-auto"
                @click="navigateTo('/auth/register')"
              >
                <Icon name="lucide:users" class="mr-2 h-5 w-5" />
                Start Free Trial
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
  title: 'Team Variable Security - EnvManager',
  description: 'Role-based access control for environment variables. Control who can view, edit, and deploy your secrets.',
  ogTitle: 'Team Variable Security - EnvManager',
  ogDescription: 'Role-based access control for environment variables. Control who can view, edit, and deploy your secrets.'
})

import MarketingCard from '@/components/marketing/MarketingCard.vue'
import MarketingHero from '@/components/marketing/MarketingHero.vue'
import Button from '@/components/ui/Button.vue'

const { track } = usePostHog()

const proofPoints = [
  'Three permission roles out of the box',
  'Environment-level access controls',
  'Instant revocation for offboarding',
  'Complete audit logging on every action'
]

const accessProblems = [
  {
    icon: 'lucide:user-plus',
    title: 'New Hire Onboarding',
    description: '"Here is a shared doc with all our credentials." Sound familiar? Every person who sees that doc is a potential leak. One screenshot, one email forward, and your secrets are out.'
  },
  {
    icon: 'lucide:user-minus',
    title: 'Employee Offboarding',
    description: 'Someone left last month. They still have the production database password saved in their notes app. Are you rotating every credential they ever touched? Most teams are not.'
  },
  {
    icon: 'lucide:alert-triangle',
    title: 'Production Access',
    description: 'Everyone has the same .env file, so everyone has production access. One wrong deployment and the junior dev is staring at a deleted database.'
  }
]

const roleCards = [
  {
    title: 'Admin',
    subtitle: 'Full control',
    icon: 'lucide:crown',
    iconClass: 'bg-primary/15 text-primary',
    highlight: true,
    permissions: [
      { label: 'View all secrets', allowed: true },
      { label: 'Edit all secrets', allowed: true },
      { label: 'Delete secrets', allowed: true },
      { label: 'Manage team members', allowed: true },
      { label: 'Configure integrations', allowed: true },
      { label: 'View audit logs', allowed: true }
    ]
  },
  {
    title: 'Editor',
    subtitle: 'Day-to-day work',
    icon: 'lucide:edit',
    iconClass: 'bg-secondary/15 text-secondary',
    highlight: false,
    permissions: [
      { label: 'View all secrets', allowed: true },
      { label: 'Edit all secrets', allowed: true },
      { label: 'Add new secrets', allowed: true },
      { label: 'Manage team members', allowed: false },
      { label: 'Configure integrations', allowed: false },
      { label: 'View audit logs', allowed: false }
    ]
  },
  {
    title: 'Viewer',
    subtitle: 'Read-only access',
    icon: 'lucide:eye',
    iconClass: 'bg-muted text-muted-foreground',
    highlight: false,
    permissions: [
      { label: 'View non-secret values', allowed: true },
      { label: 'View secret values', allowed: false },
      { label: 'Edit any secrets', allowed: false },
      { label: 'Delete secrets', allowed: false },
      { label: 'Manage team', allowed: false },
      { label: 'Configure integrations', allowed: false }
    ]
  }
]

const environments = [
  {
    icon: 'lucide:code',
    title: 'Development',
    description: 'Full team access. Safe to experiment.'
  },
  {
    icon: 'lucide:flask-conical',
    title: 'Staging',
    description: 'Senior devs and QA. Pre-production testing.'
  },
  {
    icon: 'lucide:rocket',
    title: 'Production',
    description: 'Admins only. Maximum protection.'
  }
]

const teamExample = [
  {
    initials: 'JD',
    avatarClass: 'bg-primary/20 text-primary',
    name: 'John (Lead)',
    role: 'Admin',
    access: 'All envs'
  },
  {
    initials: 'SM',
    avatarClass: 'bg-secondary/20 text-secondary',
    name: 'Sarah (Senior)',
    role: 'Editor',
    access: 'Dev, Staging'
  },
  {
    initials: 'MK',
    avatarClass: 'bg-success/20 text-success',
    name: 'Mike (Junior)',
    role: 'Editor',
    access: 'Dev only'
  },
  {
    initials: 'AL',
    avatarClass: 'bg-muted text-muted-foreground',
    name: 'Alex (Intern)',
    role: 'Viewer',
    access: 'Dev only'
  }
]

const securityFeatures = [
  {
    icon: 'lucide:smartphone',
    title: 'Two-Factor Authentication',
    description: 'Require 2FA for every team member. Authenticator apps and recovery codes included.'
  },
  {
    icon: 'lucide:check-check',
    title: 'Approval Workflows',
    description: 'No production changes without review. Require one or two approvals before secrets go live.'
  },
  {
    icon: 'lucide:key-round',
    title: 'Secure Value Access Requests',
    description: 'Developers request access to view secrets. Admins approve with a time limit and full audit trail.'
  },
  {
    icon: 'lucide:mail',
    title: 'Email Invitations',
    description: 'Invite team members by email with pre-assigned roles. They create their own account -- you control the access.'
  },
  {
    icon: 'lucide:user-x',
    title: 'Instant Revocation',
    description: 'Remove a team member and their access is gone immediately. No credentials to rotate, no cleanup scripts.'
  },
  {
    icon: 'lucide:scroll-text',
    title: 'Activity Logging',
    description: 'Every access, every change, every reveal -- logged with the user, timestamp, and context.'
  }
]

const handleHeroSignup = () => {
  track('signup_cta_clicked', { page_source: 'solutions', cta_text: 'Start Free Trial' })
  navigateTo('/auth/register')
}

onMounted(() => {
  track('solution_page_viewed', { solution: 'team-security' })
})
</script>
