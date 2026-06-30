<template>
  <div class="relative overflow-hidden bg-background text-foreground">
    <!-- Background Effects -->
    <div class="pointer-events-none absolute inset-0">
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.08),transparent_55%)]"></div>
      <div class="absolute -top-40 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-primary/6 blur-[120px]"></div>
    </div>

    <!-- Hero -->
    <section class="relative py-20 md:py-28">
      <div class="container px-4 md:px-6">
        <div class="mx-auto flex max-w-4xl flex-col items-center space-y-8 text-center">
          <div class="rounded-full border border-primary/20 bg-primary/8 px-5 py-2 backdrop-blur-md">
            <span class="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">Proxy Functions</span>
          </div>

          <h1 class="text-balance text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
            Your Stripe key is in the
            <span class="bg-gradient-to-r from-red-500 via-red-400 to-red-500 bg-clip-text text-transparent">
              browser DevTools
            </span>
            right now
          </h1>

          <p class="max-w-3xl text-lg leading-relaxed text-muted-foreground md:text-xl">
            Static sites can't hide API keys. Every fetch to Stripe, SendGrid, or OpenAI exposes your secret in the network tab. Proxy functions fix this in 2 clicks -- no serverless functions to write.
          </p>

          <div class="flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
            <NuxtLink
              to="/auth/register"
              class="inline-flex w-full items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:w-auto"
              @click="track('signup_cta_clicked', { page_source: 'proxy-functions', cta_text: 'Start Free' })"
            >
              <Icon name="lucide:arrow-right" class="mr-2 h-4 w-4" />
              Start 14-Day Free Trial
            </NuxtLink>
            <NuxtLink
              to="/docs/proxy-functions/overview"
              class="inline-flex w-full items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-medium shadow-sm transition-colors hover:bg-muted sm:w-auto"
            >
              Read the Docs
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <!-- Before / After Contrast -->
    <section class="relative border-t border-border/40 bg-muted/10 py-20 md:py-28">
      <div class="mx-auto max-w-6xl px-4 md:px-6">
        <div class="mx-auto mb-14 max-w-3xl text-center">
          <h2 class="text-3xl font-bold tracking-tight text-foreground md:text-5xl">
            Stop writing boilerplate serverless functions
          </h2>
          <p class="mt-6 text-lg leading-relaxed text-muted-foreground">
            You already store secrets in EnvManager. Now they do the work for you.
          </p>
        </div>

        <div class="grid gap-6 md:grid-cols-2">
          <!-- Before -->
          <div class="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 space-y-4">
            <div class="flex items-center gap-2 text-lg font-semibold text-red-400">
              <Icon name="lucide:x-circle" class="h-5 w-5" />
              Without proxy functions
            </div>
            <p class="text-sm text-muted-foreground">Write, deploy, and maintain a serverless function for every API call:</p>
            <div class="rounded-lg border border-border/40 bg-background/90 p-4 font-mono text-xs leading-relaxed text-muted-foreground overflow-x-auto">
              <div class="space-y-1">
                <p><span class="text-red-400">// api/send-email.ts -- you write this</span></p>
                <p>export default async function handler(req) {'{'}</p>
                <p class="pl-4">const res = await fetch('https://api.brevo.com/v3/smtp/email', {'{'}</p>
                <p class="pl-8">method: 'POST',</p>
                <p class="pl-8">headers: {'{'}</p>
                <p class="pl-12">'api-key': <span class="text-red-400">process.env.BREVO_API_KEY</span>,</p>
                <p class="pl-12">'Content-Type': 'application/json',</p>
                <p class="pl-8">{'}'},</p>
                <p class="pl-8">body: req.body,</p>
                <p class="pl-4">{'}'})</p>
                <p class="pl-4">return new Response(await res.text(), {'{'}</p>
                <p class="pl-8">status: res.status,</p>
                <p class="pl-8">headers: {'{'} 'Access-Control-Allow-Origin': '*' {'}'},</p>
                <p class="pl-4">{'}'})</p>
                <p>{'}'}</p>
              </div>
            </div>
            <p class="text-xs text-muted-foreground">+ CORS handling, error handling, deploy config, env var setup on the platform...</p>
          </div>

          <!-- After -->
          <div class="rounded-2xl border border-primary/20 bg-primary/5 p-6 space-y-4">
            <div class="flex items-center gap-2 text-lg font-semibold text-primary">
              <Icon name="lucide:check-circle" class="h-5 w-5" />
              With proxy functions
            </div>
            <p class="text-sm text-muted-foreground">Pick a template, select your secret, done:</p>
            <div class="rounded-lg border border-border/40 bg-background/90 p-4 font-mono text-xs leading-relaxed text-muted-foreground overflow-x-auto">
              <div class="space-y-1">
                <p><span class="text-primary">// your-frontend.js -- just fetch</span></p>
                <p>const res = await fetch(</p>
                <p class="pl-4">'<span class="text-primary">https://your-app.supabase.co/functions/v1/proxy-handler/abc123</span>',</p>
                <p class="pl-4">{'{'}</p>
                <p class="pl-8">method: 'POST',</p>
                <p class="pl-8">headers: {'{'}</p>
                <p class="pl-12">'x-proxy-token': '<span class="text-primary">your-proxy-token</span>',</p>
                <p class="pl-12">'Content-Type': 'application/json',</p>
                <p class="pl-8">{'}'},</p>
                <p class="pl-8">body: JSON.stringify({'{'} to: 'user@example.com' {'}'}),</p>
                <p class="pl-4">{'}'},</p>
                <p>)</p>
              </div>
            </div>
            <p class="text-xs text-primary/80">No serverless function. No platform env vars. No CORS config. Just a URL and a token.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- How It Works -->
    <section class="relative border-t border-border/40 py-20 md:py-28">
      <div class="mx-auto max-w-5xl px-4 md:px-6">
        <div class="mx-auto mb-16 max-w-3xl text-center">
          <h2 class="text-3xl font-bold tracking-tight text-foreground md:text-5xl">
            Three steps. Two minutes. Zero exposed secrets.
          </h2>
        </div>

        <div class="grid gap-8 md:grid-cols-3">
          <div class="relative text-center">
            <div class="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border-2 border-primary bg-primary/10 text-xl font-bold text-primary">1</div>
            <h3 class="mb-2 text-lg font-bold">Pick a template</h3>
            <p class="text-sm text-muted-foreground">
              Choose from pre-built templates for Stripe, Brevo, OpenAI, and more. Or start from scratch with a custom proxy.
            </p>
          </div>
          <div class="relative text-center">
            <div class="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border-2 border-primary bg-primary/10 text-xl font-bold text-primary">2</div>
            <h3 class="mb-2 text-lg font-bold">Map your secrets</h3>
            <p class="text-sm text-muted-foreground">
              Select which secrets to inject and where -- as headers, query params, or body fields. Supports templates like <code class="rounded bg-muted px-1 py-0.5 font-mono text-xs">Bearer ${'${value}'}</code>.
            </p>
          </div>
          <div class="relative text-center">
            <div class="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border-2 border-primary bg-primary/10 text-xl font-bold text-primary">3</div>
            <h3 class="mb-2 text-lg font-bold">Call the URL</h3>
            <p class="text-sm text-muted-foreground">
              Get a hosted proxy URL and token. Replace your API call with a fetch to the proxy. Secrets are injected server-side, never visible in the browser.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Templates Showcase -->
    <section class="relative border-t border-border/40 bg-muted/10 py-20 md:py-28">
      <div class="mx-auto max-w-5xl px-4 md:px-6">
        <div class="mx-auto mb-14 max-w-3xl text-center">
          <h2 class="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Pre-built for the APIs you already use
          </h2>
          <p class="mt-4 text-lg text-muted-foreground">
            One-click templates with the right headers, auth patterns, and body structure already configured.
          </p>
        </div>

        <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          <div
            v-for="tmpl in templates"
            :key="tmpl.name"
            class="flex flex-col items-center gap-3 rounded-xl border border-border/50 bg-card/50 p-6 transition-colors hover:border-primary/30 hover:bg-card"
          >
            <Icon :name="tmpl.icon" class="h-8 w-8 text-foreground" />
            <span class="text-sm font-medium">{{ tmpl.name }}</span>
            <span class="text-xs text-muted-foreground">{{ tmpl.category }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Two Modes -->
    <section class="relative border-t border-border/40 py-20 md:py-28">
      <div class="mx-auto max-w-6xl px-4 md:px-6">
        <div class="mx-auto mb-14 max-w-3xl text-center">
          <h2 class="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Hosted or self-hosted. Your call.
          </h2>
        </div>

        <div class="grid gap-8 md:grid-cols-2">
          <!-- Hosted -->
          <div class="group relative overflow-hidden rounded-2xl border border-primary/30 bg-card p-8 md:p-10">
            <div class="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-primary/5 to-transparent"></div>
            <div class="relative z-10 space-y-4">
              <div class="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">Recommended</div>
              <div class="flex items-center gap-3">
                <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon name="lucide:cloud" class="h-6 w-6" />
                </div>
                <h3 class="text-2xl font-bold">Hosted Proxy</h3>
              </div>
              <p class="text-muted-foreground">
                EnvManager runs the proxy for you. Get a URL, add it to your frontend, and you're done. No infrastructure to manage.
              </p>
              <div class="space-y-2.5 pt-2">
                <div class="flex items-start gap-3">
                  <Icon name="lucide:check" class="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span class="text-sm text-muted-foreground">Zero deployment -- works immediately</span>
                </div>
                <div class="flex items-start gap-3">
                  <Icon name="lucide:check" class="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span class="text-sm text-muted-foreground">Secrets fetched from vault at runtime</span>
                </div>
                <div class="flex items-start gap-3">
                  <Icon name="lucide:check" class="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span class="text-sm text-muted-foreground">Built-in rate limiting and analytics</span>
                </div>
                <div class="flex items-start gap-3">
                  <Icon name="lucide:check" class="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span class="text-sm text-muted-foreground">CORS protection per proxy</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Self-hosted -->
          <div class="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-8 md:p-10">
            <div class="relative z-10 space-y-4">
              <div class="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">Advanced</div>
              <div class="flex items-center gap-3">
                <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Icon name="lucide:download" class="h-6 w-6" />
                </div>
                <h3 class="text-2xl font-bold">Download Code</h3>
              </div>
              <p class="text-muted-foreground">
                Download generated proxy code for your own platform. Deploy to Vercel, Netlify, Cloudflare, or AWS Lambda.
              </p>
              <div class="space-y-2.5 pt-2">
                <div class="flex items-start gap-3">
                  <Icon name="lucide:check" class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span class="text-sm text-muted-foreground">Full control over infrastructure</span>
                </div>
                <div class="flex items-start gap-3">
                  <Icon name="lucide:check" class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span class="text-sm text-muted-foreground">Platform-specific code generation</span>
                </div>
                <div class="flex items-start gap-3">
                  <Icon name="lucide:check" class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span class="text-sm text-muted-foreground">Secrets via platform env vars</span>
                </div>
                <div class="flex items-start gap-3">
                  <Icon name="lucide:check" class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span class="text-sm text-muted-foreground">CORS, auth, and error handling included</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Security -->
    <section class="relative border-t border-border/40 bg-muted/10 py-20 md:py-28">
      <div class="mx-auto max-w-5xl px-4 md:px-6">
        <div class="mx-auto mb-14 max-w-3xl text-center">
          <h2 class="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Defense in depth, not just CORS
          </h2>
          <p class="mt-4 text-lg text-muted-foreground">
            Every proxy call is authenticated, rate-limited, and logged.
          </p>
        </div>

        <div class="grid gap-6 md:grid-cols-3">
          <div class="flex gap-4 rounded-lg border border-border/40 bg-card/40 p-5 transition-colors hover:bg-card/60">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon name="lucide:key" class="h-5 w-5" />
            </div>
            <div>
              <h3 class="font-medium text-foreground">Per-proxy tokens</h3>
              <p class="text-sm text-muted-foreground">Each proxy gets a unique secret token. Rotate instantly if compromised.</p>
            </div>
          </div>
          <div class="flex gap-4 rounded-lg border border-border/40 bg-card/40 p-5 transition-colors hover:bg-card/60">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon name="lucide:globe" class="h-5 w-5" />
            </div>
            <div>
              <h3 class="font-medium text-foreground">Origin allowlists</h3>
              <p class="text-sm text-muted-foreground">Lock each proxy to specific domains. Block requests from unauthorized origins.</p>
            </div>
          </div>
          <div class="flex gap-4 rounded-lg border border-border/40 bg-card/40 p-5 transition-colors hover:bg-card/60">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon name="lucide:gauge" class="h-5 w-5" />
            </div>
            <div>
              <h3 class="font-medium text-foreground">Rate limiting</h3>
              <p class="text-sm text-muted-foreground">Set per-minute limits to prevent abuse. Sliding window with standard rate headers.</p>
            </div>
          </div>
          <div class="flex gap-4 rounded-lg border border-border/40 bg-card/40 p-5 transition-colors hover:bg-card/60">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon name="lucide:lock" class="h-5 w-5" />
            </div>
            <div>
              <h3 class="font-medium text-foreground">Vault-backed secrets</h3>
              <p class="text-sm text-muted-foreground">Secrets are decrypted at request time and never stored in plaintext. Same encryption as your variables.</p>
            </div>
          </div>
          <div class="flex gap-4 rounded-lg border border-border/40 bg-card/40 p-5 transition-colors hover:bg-card/60">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon name="lucide:bar-chart-2" class="h-5 w-5" />
            </div>
            <div>
              <h3 class="font-medium text-foreground">Usage analytics</h3>
              <p class="text-sm text-muted-foreground">See invocation trends, error rates, and response times per proxy. Spot issues before users report them.</p>
            </div>
          </div>
          <div class="flex gap-4 rounded-lg border border-border/40 bg-card/40 p-5 transition-colors hover:bg-card/60">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon name="lucide:scroll-text" class="h-5 w-5" />
            </div>
            <div>
              <h3 class="font-medium text-foreground">Audit logging</h3>
              <p class="text-sm text-muted-foreground">Every proxy creation, edit, and token rotation is logged. Full compliance trail.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Pricing -->
    <section class="relative border-t border-border/40 py-20 md:py-28">
      <div class="mx-auto max-w-4xl px-4 md:px-6">
        <div class="mx-auto mb-14 max-w-3xl text-center">
          <h2 class="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Included on every plan
          </h2>
          <p class="mt-4 text-lg text-muted-foreground">
            No add-on fee. No per-call pricing surprises. Proxy functions are part of your EnvManager subscription.
          </p>
        </div>

        <div class="mx-auto max-w-sm">
          <div class="rounded-2xl border border-primary/30 bg-primary/5 p-8 text-center">
            <p class="text-sm font-medium text-primary mb-2">Professional Plan</p>
            <p class="text-4xl font-bold text-foreground">25 <span class="text-lg font-normal text-muted-foreground">proxies</span></p>
            <p class="mt-2 text-muted-foreground">5,000 calls/month included</p>
            <p class="mt-3 text-xs text-muted-foreground">14-day free trial · No credit card required</p>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="relative px-4 pb-20 pt-10 md:px-6 md:pb-28">
      <div class="container relative z-10">
        <div class="mx-auto max-w-4xl rounded-3xl border border-primary/20 bg-gradient-to-b from-primary/5 to-transparent p-8 text-center backdrop-blur-sm md:p-16">
          <h2 class="text-3xl font-bold tracking-tight text-foreground md:text-5xl">
            Your static site needs to call an API. Keep the keys off the frontend.
          </h2>
          <p class="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Included with every plan. Set up your first proxy in under 2 minutes.
          </p>
          <div class="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <NuxtLink
              to="/auth/register"
              class="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-primary/40"
              @click="track('signup_cta_clicked', { page_source: 'proxy-functions', cta_text: 'Start Free Trial' })"
            >
              <Icon name="lucide:arrow-right" class="mr-2 h-4 w-4" />
              Start 14-Day Free Trial
            </NuxtLink>
            <NuxtLink
              to="/pricing"
              class="inline-flex items-center justify-center rounded-md border border-input bg-background px-8 py-3 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
            >
              Compare Plans
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default'
})

useSeoMeta({
  title: 'Proxy Functions - Call APIs from Static Sites Without Exposing Secrets | EnvManager',
  description: 'Route Stripe, SendGrid, and OpenAI calls through a secure proxy. Your API keys stay server-side. No serverless functions to write. Included on all plans.',
  ogTitle: 'Proxy Functions - Call APIs from Static Sites Without Exposing Secrets | EnvManager',
  ogDescription: 'Route Stripe, SendGrid, and OpenAI calls through a secure proxy. Your API keys stay server-side. No serverless functions to write. Included on all plans.'
})

const { track } = usePostHog()

const templates = [
  { name: 'Stripe', icon: 'simple-icons:stripe', category: 'Payments' },
  { name: 'Brevo', icon: 'lucide:mail', category: 'Email' },
  { name: 'OpenAI', icon: 'simple-icons:openai', category: 'AI' },
  { name: 'SendGrid', icon: 'lucide:send', category: 'Email' },
  { name: 'Resend', icon: 'lucide:mail-check', category: 'Email' },
  { name: 'Mailgun', icon: 'lucide:mails', category: 'Email' },
  { name: 'Twilio', icon: 'lucide:phone', category: 'SMS' },
  { name: 'Custom API', icon: 'lucide:globe', category: 'Any API' },
]
</script>
