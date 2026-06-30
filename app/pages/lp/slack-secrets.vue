<template>
  <div class="relative overflow-x-hidden bg-background text-foreground selection:bg-primary/20">
    <!-- Background -->
    <div class="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
    <div class="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/20 opacity-30 blur-[120px] rounded-full mix-blend-screen"></div>

    <!-- Hero -->
    <section class="relative px-4 pb-12 pt-16 md:px-6 md:pb-16 md:pt-24">
      <div class="mx-auto max-w-3xl text-center">
        <span class="inline-flex items-center rounded-full border border-red-500/20 bg-red-500/5 px-4 py-1.5 text-xs font-medium text-red-400">
          <Icon name="lucide:alert-triangle" class="mr-2 h-3.5 w-3.5" />
          Security Risk
        </span>

        <h1 class="mt-6 text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lp-hero-heading">
          Your team's secrets management strategy is called <span class="text-primary">#general</span>
        </h1>

        <p class="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
          Every <code class="rounded bg-muted/50 px-1.5 py-0.5 text-sm font-mono text-foreground/80">.env</code> shared over Slack is a secret exposed. One leaked key. That's all it takes.
        </p>

        <div class="mt-10">
          <NuxtLink
            to="/auth/register"
            class="inline-flex items-center justify-center rounded-lg bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-[0_0_30px_-5px_hsl(var(--primary)/0.5)] transition-all hover:bg-primary/90 hover:scale-[1.02] hover:shadow-[0_0_40px_-5px_hsl(var(--primary)/0.6)]"
            @click="trackCta('hero')"
          >
            <Icon name="lucide:arrow-right" class="mr-2 h-5 w-5" />
            Get Started Free
          </NuxtLink>
          <p class="mt-3 text-xs text-muted-foreground">No credit card required. Set up in under 2 minutes.</p>
        </div>
      </div>
    </section>

    <!-- Problem / Solution -->
    <section class="relative border-t border-border/40 bg-muted/20 px-4 py-16 md:px-6 md:py-24">
      <div class="mx-auto max-w-5xl">
        <div class="grid gap-8 md:grid-cols-2">
          <!-- The Problem -->
          <div class="rounded-2xl border border-red-500/20 bg-red-500/5 p-8">
            <div class="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
              <Icon name="lucide:message-square-warning" class="h-6 w-6" />
            </div>
            <h2 class="mb-4 text-2xl font-bold">How most teams do it</h2>
            <div class="space-y-4">
              <div v-for="problem in problems" :key="problem" class="flex items-start gap-3">
                <Icon name="lucide:x" class="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <span class="text-sm text-muted-foreground">{{ problem }}</span>
              </div>
            </div>
            <!-- Fake Slack message -->
            <div class="mt-6 rounded-lg border border-border/40 bg-background/50 p-4">
              <div class="flex items-center gap-2 mb-2">
                <div class="h-6 w-6 rounded bg-green-500/20 text-[9px] flex items-center justify-center text-green-400 font-bold">JD</div>
                <span class="text-xs font-semibold text-foreground/80">john.dev</span>
                <span class="text-[10px] text-muted-foreground">2:34 PM</span>
              </div>
              <p class="font-mono text-xs text-foreground/70">
                hey can someone send me the prod DB credentials? need to debug something real quick
              </p>
              <div class="mt-2 flex items-center gap-2 mb-2">
                <div class="h-6 w-6 rounded bg-blue-500/20 text-[9px] flex items-center justify-center text-blue-400 font-bold">SM</div>
                <span class="text-xs font-semibold text-foreground/80">sarah.m</span>
                <span class="text-[10px] text-muted-foreground">2:35 PM</span>
              </div>
              <p class="font-mono text-xs text-foreground/70">
                sure here you go: <span class="bg-red-500/10 text-red-400 px-1 rounded">postgres://admin:s3cr3t_pr0d@db.example.com:5432</span>
              </p>
            </div>
          </div>

          <!-- The Solution -->
          <div class="rounded-2xl border border-primary/20 bg-primary/5 p-8">
            <div class="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon name="lucide:shield-check" class="h-6 w-6" />
            </div>
            <h2 class="mb-4 text-2xl font-bold">With EnvManager</h2>
            <div class="space-y-4">
              <div v-for="solution in solutions" :key="solution" class="flex items-start gap-3">
                <Icon name="lucide:check" class="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span class="text-sm text-muted-foreground">{{ solution }}</span>
              </div>
            </div>
            <!-- CLI demo -->
            <div class="mt-6 rounded-lg border border-border/40 bg-background/50 p-4 font-mono text-xs">
              <div class="flex gap-1.5 mb-3">
                <div class="w-2 h-2 rounded-full bg-muted-foreground/30"></div>
                <div class="w-2 h-2 rounded-full bg-muted-foreground/30"></div>
                <div class="w-2 h-2 rounded-full bg-muted-foreground/30"></div>
              </div>
              <div class="space-y-1.5">
                <p class="text-muted-foreground">$ envmanager pull --env production</p>
                <p class="text-primary">Synced 24 secrets to .env</p>
                <p class="text-muted-foreground/50">Encrypted in transit. Audit logged. Role-verified.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- How it works -->
    <section class="relative px-4 py-16 md:px-6 md:py-24">
      <div class="mx-auto max-w-4xl">
        <h2 class="mb-12 text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Set up in 3 steps
        </h2>

        <div class="grid gap-8 md:grid-cols-3">
          <div v-for="(step, i) in steps" :key="step.title" class="text-center">
            <div class="mx-auto mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-sm font-bold text-primary">
              {{ i + 1 }}
            </div>
            <h3 class="mb-2 text-lg font-semibold">{{ step.title }}</h3>
            <p class="text-sm text-muted-foreground">{{ step.description }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Trust signals -->
    <section class="relative border-t border-border/40 bg-muted/20 px-4 py-12 md:px-6 md:py-16">
      <div class="mx-auto max-w-4xl">
        <div class="grid grid-cols-2 gap-6 md:grid-cols-4">
          <div v-for="signal in trustSignals" :key="signal.label" class="text-center">
            <Icon :name="signal.icon" class="mx-auto mb-2 h-6 w-6 text-primary" />
            <p class="text-sm font-medium">{{ signal.label }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Final CTA -->
    <section class="relative px-4 py-16 md:px-6 md:py-24">
      <div class="mx-auto max-w-2xl text-center">
        <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">
          Stop sharing secrets in Slack. Start today.
        </h2>
        <p class="mx-auto mt-4 max-w-lg text-muted-foreground">
          Encrypted storage, role-based access, one-command sync. Free to start, set up in under 2 minutes.
        </p>
        <div class="mt-8">
          <NuxtLink
            to="/auth/register"
            class="inline-flex items-center justify-center rounded-lg bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-[0_0_30px_-5px_hsl(var(--primary)/0.5)] transition-all hover:bg-primary/90 hover:scale-[1.02] hover:shadow-[0_0_40px_-5px_hsl(var(--primary)/0.6)]"
            @click="trackCta('bottom')"
          >
            <Icon name="lucide:rocket" class="mr-2 h-5 w-5" />
            Get Started Free
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'landing'
})

useSeoMeta({
  title: 'Stop Sharing Secrets in Slack - EnvManager',
  description: 'Replace .env files shared over Slack with encrypted, role-based secret management. Set up in 2 minutes.',
  ogTitle: 'Your team\'s secrets strategy is called #general',
  ogDescription: 'Every .env shared over Slack is a secret exposed. There\'s a better way.',
})

const { track } = usePostHog()

const trackCta = (location: string) => {
  track('signup_cta_clicked', {
    page_source: 'lp_slack_secrets',
    cta_location: location,
  })
}

const problems = [
  'Credentials shared in DMs and channels',
  'No audit trail of who accessed what',
  'No way to know who saved credentials locally',
  'Copy-pasting .env files between machines',
  'One leaked key = full production access',
]

const solutions = [
  'Encrypted vault with role-based access',
  'Full audit log of every access event',
  'Instant revocation when someone leaves',
  'CLI sync — one command, any machine',
  'Per-environment permissions (dev/staging/prod)',
]

const steps = [
  {
    title: 'Add your secrets',
    description: 'Import your .env file or add variables manually. Everything is encrypted at rest.',
  },
  {
    title: 'Invite your team',
    description: 'Set roles and environment permissions. Juniors get dev, seniors get production.',
  },
  {
    title: 'Sync via CLI',
    description: 'Run envmanager pull and your .env is up to date. No Slack. No copy-paste.',
  },
]

const trustSignals = [
  { icon: 'lucide:lock', label: 'AES-256 Encryption' },
  { icon: 'lucide:shield-check', label: 'SOC 2 Aligned' },
  { icon: 'lucide:scroll-text', label: 'Full Audit Trail' },
  { icon: 'lucide:users', label: 'Role-Based Access' },
]

onMounted(() => {
  track('landing_page_viewed', { page: 'slack_secrets', source: 'reddit' })
})
</script>

<style scoped>
.lp-hero-heading {
  background: linear-gradient(to bottom, hsl(var(--foreground)), hsl(var(--foreground) / 0.62));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  text-shadow: 0 0 30px hsl(var(--foreground) / 0.2);
}
</style>
