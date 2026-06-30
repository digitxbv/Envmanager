<template>
  <div class="relative overflow-x-hidden bg-background text-foreground selection:bg-primary/20">
    <!-- Sophisticated Background -->
    <div class="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
    <div class="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/20 opacity-30 blur-[120px] rounded-full mix-blend-screen"></div>

    <!-- Hero Section -->
    <section class="relative px-4 pb-16 pt-16 md:px-6 md:pb-24 md:pt-20">
      <div class="mx-auto max-w-7xl">
        <div @click.capture="handleHeroCtaClick">
          <MarketingHero
            badge="Trusted by developer teams worldwide"
            badge-icon="lucide:shield-check"
            title="Stop sharing secrets over Slack"
            description="EnvManager replaces .env files passed through chat, email, and sticky notes with encrypted, versioned, role-based secret management. Set up in 2 minutes."
            primary-cta-label="Start 14-Day Free Trial — No Credit Card"
            primary-cta-to="/auth/register"
            primary-icon="lucide:arrow-right"
            secondary-cta-label=""
            secondary-cta-to=""
            class="marketing-hero-shell mx-auto"
          />
        </div>

        <div class="mx-auto mt-8 flex w-full max-w-3xl flex-col items-center justify-center gap-4 sm:flex-row">
          <NuxtLink
            to="/auth/register"
            data-testid="hero-command-register-cta"
            class="inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-8 text-sm font-semibold text-primary-foreground shadow-[0_0_20px_-5px_hsl(var(--primary)/0.5)] transition-all hover:bg-primary/90 hover:scale-[1.02] sm:w-auto"
            @click="track('signup_cta_clicked', { page_source: 'homepage', cta_text: 'Start Free' })"
          >
            Start 14-Day Free Trial — No Credit Card
          </NuxtLink>

          <div
            data-testid="hero-command-input"
            class="flex h-11 w-full items-center justify-between rounded-lg border border-border/60 bg-card/50 px-4 text-xs backdrop-blur-sm transition-colors hover:border-border/80 hover:bg-card/80 sm:w-auto sm:min-w-[340px]"
          >
            <span class="mr-3 font-mono text-primary">$</span>
            <span class="flex-1 truncate font-mono text-foreground/90">{{ cliCommand }}</span>
            <button
              type="button"
              data-testid="copy-command-button"
              class="ml-2 rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              @click="copyCliCommand"
            >
              <Icon name="lucide:copy" class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <!-- Hero Visual: Product Screenshot with Perspective -->
        <div class="relative mx-auto mt-16 max-w-5xl perspective-1000">
          <div class="absolute -inset-4 bg-gradient-to-t from-primary/20 via-primary/5 to-transparent blur-3xl opacity-40"></div>

          <div class="transform-style-3d rotate-x-6 hover:rotate-x-0 transition-transform duration-700 ease-out">
            <div class="relative overflow-hidden rounded-xl border border-border/40 bg-card/95 shadow-2xl ring-1 ring-white/10">
              <div class="flex h-10 items-center gap-2 border-b border-border/40 bg-muted/30 px-4">
                <div class="flex gap-1.5">
                  <div class="h-2.5 w-2.5 rounded-full bg-red-500/20"></div>
                  <div class="h-2.5 w-2.5 rounded-full bg-yellow-500/20"></div>
                  <div class="h-2.5 w-2.5 rounded-full bg-primary/20"></div>
                </div>
                <div class="ml-4 h-5 w-64 rounded bg-muted/50"></div>
              </div>
              <img
                src="/images/product/dashboard-overview.png"
                alt="EnvManager Dashboard — manage environment variables across projects and environments"
                class="w-full h-auto object-cover opacity-90"
              />

              <!-- Floating Code Overlay -->
              <div class="absolute -right-4 bottom-8 hidden w-80 rounded-lg border border-border/60 bg-card/95 p-4 shadow-xl backdrop-blur md:block">
                <div class="mb-2 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span class="font-mono">.env.production</span>
                  <Icon name="lucide:lock" class="h-3 w-3" />
                </div>
                <div class="space-y-1.5 font-mono text-[11px]">
                  <div class="flex items-center gap-2">
                    <span class="text-primary">STRIPE_KEY</span>
                    <span class="text-muted-foreground">=</span>
                    <span class="truncate text-foreground/70">sk_live_51Mz...</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-primary">DATABASE_URL</span>
                    <span class="text-muted-foreground">=</span>
                    <span class="truncate text-foreground/70">postgres://...</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Social Proof: Trust Bar -->
    <section class="relative border-t border-border/40 py-12 md:py-16">
      <div class="mx-auto max-w-5xl px-4 md:px-6">
        <p class="mb-8 text-center text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Trusted by teams shipping to production
        </p>
        <div class="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div class="flex flex-col items-center gap-2 text-center">
            <span class="text-3xl font-bold text-foreground">AES-256</span>
            <span class="text-sm text-muted-foreground">Encryption at rest</span>
          </div>
          <div class="flex flex-col items-center gap-2 text-center">
            <span class="text-3xl font-bold text-foreground">8+</span>
            <span class="text-sm text-muted-foreground">Platform integrations</span>
          </div>
          <div class="flex flex-col items-center gap-2 text-center">
            <span class="text-3xl font-bold text-foreground">2 min</span>
            <span class="text-sm text-muted-foreground">Setup time</span>
          </div>
          <div class="flex flex-col items-center gap-2 text-center">
            <span class="text-3xl font-bold text-foreground">100%</span>
            <span class="text-sm text-muted-foreground">Audit trail coverage</span>
          </div>
        </div>
      </div>
    </section>

    <!-- How It Works -->
    <section class="relative border-t border-border/40 bg-muted/10 py-24 md:py-32">
      <div class="mx-auto max-w-5xl px-4 md:px-6">
        <div class="mx-auto mb-16 max-w-3xl text-center">
          <h2 class="text-3xl font-bold tracking-tight text-foreground md:text-5xl">
            From scattered .env files to secure vault in 3 steps
          </h2>
        </div>

        <div class="grid gap-8 md:grid-cols-3">
          <div class="relative text-center">
            <div class="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border-2 border-primary bg-primary/10 text-xl font-bold text-primary">
              1
            </div>
            <h3 class="mb-2 text-lg font-bold">Import your .env files</h3>
            <p class="text-sm text-muted-foreground">
              Paste or drag-and-drop your existing .env files. EnvManager encrypts every value with AES-256 on import.
            </p>
          </div>
          <div class="relative text-center">
            <div class="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border-2 border-primary bg-primary/10 text-xl font-bold text-primary">
              2
            </div>
            <h3 class="mb-2 text-lg font-bold">Set roles and environments</h3>
            <p class="text-sm text-muted-foreground">
              Define who can access production vs staging. Invite your team with granular, per-environment permissions.
            </p>
          </div>
          <div class="relative text-center">
            <div class="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border-2 border-primary bg-primary/10 text-xl font-bold text-primary">
              3
            </div>
            <h3 class="mb-2 text-lg font-bold">Sync with one command</h3>
            <p class="text-sm text-muted-foreground">
              Run <code class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">envmanager pull</code> to sync secrets to your local machine or CI/CD pipeline. Done.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Features Section: Broken Grid Layout -->
    <section data-testid="features-section" class="relative overflow-hidden border-t border-border/40 bg-muted/20 py-24 md:py-32">
      <div class="mx-auto max-w-7xl px-4 md:px-6">
        <div class="mx-auto mb-16 max-w-3xl text-center md:mb-24">
          <h2 class="text-3xl font-bold tracking-tight text-foreground md:text-5xl">
            Security that doesn't slow you down
          </h2>
          <p class="mt-6 text-lg leading-relaxed text-muted-foreground">
            Every .env shared over Slack is a secret exposed. Every developer who leaves still has your production keys. EnvManager fixes both.
          </p>
        </div>

        <div class="grid gap-8 md:grid-cols-12 md:gap-12">
          <!-- Feature 1: Large Left -->
          <div class="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-8 md:col-span-7 md:p-12">
            <div class="relative z-10">
              <div class="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon name="lucide:history" class="h-6 w-6" />
              </div>
              <h3 class="mb-3 text-2xl font-bold">Know exactly who changed what, and when</h3>
              <p class="mb-8 max-w-md text-muted-foreground">
                Every secret change is versioned with an immutable audit trail. Roll back a bad rotation instantly. Pass compliance audits without scrambling.
              </p>

              <div class="rounded-lg border border-border/60 bg-background/50 p-4 font-mono text-xs">
                <div class="space-y-3">
                  <div class="flex items-center gap-3 text-muted-foreground">
                    <span class="w-12 opacity-50">10:42</span>
                    <div class="h-6 w-6 rounded-full bg-primary/20 text-[10px] flex items-center justify-center text-primary">SJ</div>
                    <span>rotated <span class="text-foreground font-medium">STRIPE_KEY</span></span>
                  </div>
                  <div class="flex items-center gap-3 text-muted-foreground">
                    <span class="w-12 opacity-50">10:45</span>
                    <div class="h-6 w-6 rounded-full bg-secondary/20 text-[10px] flex items-center justify-center text-secondary-foreground">AM</div>
                    <span>accessed <span class="text-foreground font-medium">production</span></span>
                  </div>
                </div>
              </div>
            </div>
            <div class="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-primary/5 to-transparent"></div>
          </div>

          <!-- Feature 2: Small Right -->
          <div class="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-8 md:col-span-5 md:p-12">
            <div class="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon name="lucide:lock" class="h-6 w-6" />
            </div>
            <h3 class="mb-3 text-2xl font-bold">Your secrets never leave the vault unencrypted</h3>
            <p class="text-muted-foreground">
              AES-256 encryption at rest via Supabase Vault. Secrets are decrypted only at the moment of access, by authorized users only.
            </p>
            <div class="mt-8 flex justify-center">
              <Icon name="lucide:shield-check" class="h-24 w-24 text-primary/10 transition-transform duration-500 group-hover:scale-110 group-hover:text-primary/20" />
            </div>
          </div>

          <!-- Feature 3: Small Left -->
          <div class="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-8 md:col-span-5 md:p-12">
            <div class="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon name="lucide:badge-check" class="h-6 w-6" />
            </div>
            <h3 class="mb-3 text-2xl font-bold">Interns can't access production</h3>
            <p class="text-muted-foreground">
              Grant access per project and environment. Developers see staging, leads see production. Revoke instantly when someone leaves the team.
            </p>
            <div class="mt-8 space-y-3">
              <div class="flex items-center gap-3 rounded border border-border/40 bg-background/50 p-2.5">
                <span class="text-xs font-medium text-muted-foreground">Dev</span>
                <div class="h-1.5 flex-1 rounded-full bg-muted">
                  <div class="h-full w-2/3 rounded-full bg-primary/60"></div>
                </div>
              </div>
              <div class="flex items-center gap-3 rounded border border-border/40 bg-background/50 p-2.5">
                <span class="text-xs font-medium text-foreground">Admin</span>
                <div class="h-1.5 flex-1 rounded-full bg-muted">
                  <div class="h-full w-full rounded-full bg-primary"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Feature 4: Large Right -->
          <div class="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-8 md:col-span-7 md:p-12">
             <div class="relative z-10">
              <div class="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon name="lucide:terminal" class="h-6 w-6" />
              </div>
              <h3 class="mb-3 text-2xl font-bold">One command. All your secrets. Locally.</h3>
              <p class="mb-8 max-w-md text-muted-foreground">
                No more asking teammates for the latest .env. Pull secrets straight from the vault to your machine or CI/CD pipeline with one CLI command.
              </p>

              <div class="rounded-lg border border-border/60 bg-background/90 p-5 font-mono text-sm shadow-sm">
                <div class="flex gap-1.5 mb-3">
                  <div class="w-2.5 h-2.5 rounded-full bg-muted-foreground/30"></div>
                  <div class="w-2.5 h-2.5 rounded-full bg-muted-foreground/30"></div>
                  <div class="w-2.5 h-2.5 rounded-full bg-muted-foreground/30"></div>
                </div>
                <div class="space-y-2">
                  <p class="text-muted-foreground">$ envmanager pull</p>
                  <p class="text-primary font-semibold">Synced 24 secrets to .env</p>
                  <p class="text-muted-foreground">$ npm run dev</p>
                </div>
              </div>
            </div>
            <div class="absolute left-0 bottom-0 h-full w-1/3 bg-gradient-to-tr from-primary/5 to-transparent"></div>
          </div>
        </div>
      </div>
    </section>

    <!-- Proxy Functions Teaser -->
    <section class="relative border-t border-border/40 py-24 md:py-32">
      <div class="mx-auto max-w-6xl px-4 md:px-6">
        <div class="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <!-- Content -->
          <div class="space-y-6">
            <div class="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Icon name="lucide:shield" class="mr-1.5 h-3.5 w-3.5" />
              New: Proxy Functions
            </div>
            <h2 class="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Call Stripe from your static site without leaking keys
            </h2>
            <p class="text-lg text-muted-foreground">
              Static sites expose every API key in the browser. Proxy functions route those calls through EnvManager, injecting secrets server-side. No serverless function to write, no infrastructure to manage.
            </p>
            <div class="space-y-3">
              <div class="flex items-start gap-3">
                <Icon name="lucide:check" class="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span class="text-sm text-muted-foreground">Pre-built templates for Stripe, Brevo, OpenAI, and more</span>
              </div>
              <div class="flex items-start gap-3">
                <Icon name="lucide:check" class="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span class="text-sm text-muted-foreground">Token auth, CORS protection, and rate limiting built in</span>
              </div>
              <div class="flex items-start gap-3">
                <Icon name="lucide:check" class="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span class="text-sm text-muted-foreground">Included with every plan — 25 proxy functions and 5,000 calls/month</span>
              </div>
            </div>
            <NuxtLink
              to="/features/proxy-functions"
              class="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Learn more about proxy functions
              <Icon name="lucide:arrow-right" class="h-4 w-4" />
            </NuxtLink>
          </div>

          <!-- Code preview -->
          <div class="relative">
            <div class="absolute -inset-4 rounded-full bg-primary/10 blur-3xl"></div>
            <div class="relative overflow-hidden rounded-xl border border-border/60 bg-background shadow-2xl">
              <div class="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-4 py-3">
                <div class="flex gap-1.5">
                  <div class="h-3 w-3 rounded-full bg-red-500/20"></div>
                  <div class="h-3 w-3 rounded-full bg-amber-500/20"></div>
                  <div class="h-3 w-3 rounded-full bg-primary/20"></div>
                </div>
                <span class="ml-3 font-mono text-xs text-muted-foreground">your-frontend.js</span>
              </div>
              <div class="p-5 font-mono text-sm leading-relaxed">
                <p class="text-muted-foreground"><span class="text-primary/60">// No API key in your frontend code</span></p>
                <p class="mt-2 text-muted-foreground"><span class="text-foreground">const</span> res = <span class="text-foreground">await</span> fetch(proxyUrl, {'{'}</p>
                <p class="pl-4 text-muted-foreground">method: <span class="text-primary">'POST'</span>,</p>
                <p class="pl-4 text-muted-foreground">headers: {'{'} <span class="text-primary">'x-proxy-token'</span>: token {'}'},</p>
                <p class="pl-4 text-muted-foreground">body: JSON.stringify({'{'} to: email {'}'}),</p>
                <p class="text-muted-foreground">{'}'})</p>
                <p class="mt-3 text-muted-foreground"><span class="text-primary/60">// EnvManager injects BREVO_API_KEY server-side</span></p>
                <p class="text-muted-foreground"><span class="text-primary/60">// Your secret never reaches the browser</span></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Integrations Showcase -->
    <section class="relative border-t border-border/40 py-24 md:py-32">
      <div class="mx-auto max-w-5xl px-4 md:px-6">
        <div class="mx-auto mb-16 max-w-3xl text-center">
          <h2 class="text-3xl font-bold tracking-tight text-foreground md:text-5xl">
            Connects to your existing stack
          </h2>
          <p class="mt-6 text-lg leading-relaxed text-muted-foreground">
            Sync secrets directly to Vercel, Railway, Render, GitHub, Google Cloud, Azure, and more. No copy-pasting between dashboards.
          </p>
        </div>

        <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4">
          <div class="flex flex-col items-center gap-3 rounded-xl border border-border/50 bg-card/50 p-6 transition-colors hover:border-primary/30 hover:bg-card">
            <Icon name="simple-icons:vercel" class="h-8 w-8 text-foreground" />
            <span class="text-sm font-medium">Vercel</span>
          </div>
          <div class="flex flex-col items-center gap-3 rounded-xl border border-border/50 bg-card/50 p-6 transition-colors hover:border-primary/30 hover:bg-card">
            <Icon name="simple-icons:railway" class="h-8 w-8 text-foreground" />
            <span class="text-sm font-medium">Railway</span>
          </div>
          <div class="flex flex-col items-center gap-3 rounded-xl border border-border/50 bg-card/50 p-6 transition-colors hover:border-primary/30 hover:bg-card">
            <Icon name="simple-icons:render" class="h-8 w-8 text-foreground" />
            <span class="text-sm font-medium">Render</span>
          </div>
          <div class="flex flex-col items-center gap-3 rounded-xl border border-border/50 bg-card/50 p-6 transition-colors hover:border-primary/30 hover:bg-card">
            <Icon name="simple-icons:github" class="h-8 w-8 text-foreground" />
            <span class="text-sm font-medium">GitHub</span>
          </div>
          <div class="flex flex-col items-center gap-3 rounded-xl border border-border/50 bg-card/50 p-6 transition-colors hover:border-primary/30 hover:bg-card">
            <Icon name="simple-icons:googlecloud" class="h-8 w-8 text-foreground" />
            <span class="text-sm font-medium">Google Cloud</span>
          </div>
          <div class="flex flex-col items-center gap-3 rounded-xl border border-border/50 bg-card/50 p-6 transition-colors hover:border-primary/30 hover:bg-card">
            <Icon name="simple-icons:microsoftazure" class="h-8 w-8 text-foreground" />
            <span class="text-sm font-medium">Azure</span>
          </div>
          <div class="flex flex-col items-center gap-3 rounded-xl border border-border/50 bg-card/50 p-6 transition-colors hover:border-primary/30 hover:bg-card">
            <Icon name="simple-icons:docker" class="h-8 w-8 text-foreground" />
            <span class="text-sm font-medium">Dokploy</span>
          </div>
          <div class="flex flex-col items-center gap-3 rounded-xl border border-border/50 bg-card/50 p-6 transition-colors hover:border-primary/30 hover:bg-card">
            <Icon name="lucide:cloud" class="h-8 w-8 text-foreground" />
            <span class="text-sm font-medium">Coolify</span>
          </div>
        </div>

        <div class="mt-8 text-center">
          <NuxtLink to="/docs/integrations/overview" class="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors">
            View all integrations
            <Icon name="lucide:arrow-right" class="h-4 w-4" />
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Risk / Pain Point Section -->
    <section class="relative border-t border-border/40 bg-muted/10 py-24 md:py-32">
      <div class="mx-auto max-w-4xl px-4 md:px-6">
        <div class="mx-auto mb-12 max-w-3xl text-center">
          <h2 class="text-3xl font-bold tracking-tight text-foreground md:text-5xl">
            The cost of doing nothing
          </h2>
          <p class="mt-6 text-lg leading-relaxed text-muted-foreground">
            Most secret leaks aren't from sophisticated attacks. They're from your team's daily workflow.
          </p>
        </div>

        <div class="grid gap-6 md:grid-cols-3">
          <div class="rounded-xl border border-red-500/20 bg-red-500/5 p-6">
            <div class="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
              <Icon name="lucide:message-square" class="h-5 w-5" />
            </div>
            <h3 class="mb-2 text-lg font-bold text-foreground">.env files in Slack</h3>
            <p class="text-sm text-muted-foreground">
              Searchable by anyone in the workspace forever. One leaked API key costs an average of $1.2M to remediate.
            </p>
          </div>
          <div class="rounded-xl border border-red-500/20 bg-red-500/5 p-6">
            <div class="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
              <Icon name="lucide:user-minus" class="h-5 w-5" />
            </div>
            <h3 class="mb-2 text-lg font-bold text-foreground">No offboarding</h3>
            <p class="text-sm text-muted-foreground">
              When a developer leaves, do you rotate every secret they had access to? With .env files, you can't even know which ones they saw.
            </p>
          </div>
          <div class="rounded-xl border border-red-500/20 bg-red-500/5 p-6">
            <div class="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
              <Icon name="lucide:git-branch" class="h-5 w-5" />
            </div>
            <h3 class="mb-2 text-lg font-bold text-foreground">Secrets in git history</h3>
            <p class="text-sm text-muted-foreground">
              Accidentally committed a key? Even after removing it, it lives in git history forever. Bots scan public repos in seconds.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Bottom CTA -->
    <section class="relative px-4 py-24 md:px-6 md:py-32">
      <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.05),transparent_70%)]"></div>
      <div class="relative mx-auto max-w-4xl" @click.capture="handleBottomCtaClick">
        <MarketingCTA
          title="Your .env files are a liability. Fix it in 2 minutes."
          description="Free for 14 days. No credit card required. Import your existing .env files and start syncing secrets securely."
          primary-cta-label="Start Your Free Trial"
          primary-cta-to="/auth/register"
          primary-icon="lucide:arrow-right"
          secondary-cta-label="Read the Docs"
          secondary-cta-to="/docs"
          class="marketing-cta-shell border-border/60 bg-card/50 backdrop-blur-xl"
        />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware() {
    // Self-hosted instances have no marketing homepage — send visitors straight
    // to the app. SaaS mode falls through and renders the marketing page below.
    const { public: { selfHosted } } = useRuntimeConfig()
    if (!selfHosted) return
    const user = useSupabaseUser()
    return navigateTo(user.value ? '/dashboard' : '/auth/login')
  },
})

const { track } = usePostHog()

const cliCommand = 'npm i -g @envmanager-cli/cli'

const copyCliCommand = async () => {
  try {
    await navigator.clipboard.writeText(cliCommand)
  } catch (error) {
    console.warn('[index] Failed to copy CLI command', error)
  }
}

const handleHeroCtaClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement | null
  if (!target) return

  if (target.closest('[data-testid="primary-cta"]')) {
    track('signup_cta_clicked', { page_source: 'homepage', cta_text: 'Start Free' })
  }
}

const handleBottomCtaClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement | null
  if (!target) return

  if (target.closest('a[href="/auth/register"]')) {
    track('signup_cta_clicked', { page_source: 'homepage', cta_text: 'Start Free' })
  }
}
</script>

<style scoped>
:deep([data-testid='marketing-hero']) {
  border-color: hsl(var(--border) / 0.6);
  background: hsl(var(--card) / 0.75);
  box-shadow: 0 0 0 1px hsl(var(--foreground) / 0.05), 0 4px 12px hsl(var(--background) / 0.45);
}

:deep([data-testid='marketing-hero'] h1) {
  background: linear-gradient(to bottom, hsl(var(--foreground)), hsl(var(--foreground) / 0.62));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  text-shadow: 0 0 30px hsl(var(--foreground) / 0.2);
}

:deep([data-testid='marketing-hero'] p) {
  color: hsl(var(--muted-foreground));
}

:deep([data-testid='primary-cta']) {
  background-color: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  box-shadow: 0 0 20px -5px hsl(var(--primary) / 0.4);
}

:deep([data-testid='primary-cta']:hover) {
  background-color: hsl(var(--primary) / 0.9);
  box-shadow: 0 0 30px -5px hsl(var(--primary) / 0.5);
}

.marketing-cta-shell {
  border-color: hsl(var(--border) / 0.6);
  background: hsl(var(--card) / 0.8);
}

.marketing-cta-shell :deep(h2) {
  color: hsl(var(--foreground));
}

.marketing-cta-shell :deep(p) {
  color: hsl(var(--muted-foreground));
}
</style>
