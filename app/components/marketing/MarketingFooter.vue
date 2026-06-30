<template>
  <footer class="border-t border-border/40 bg-background">
    <div class="container py-16 md:py-20">
      <!-- Footer Links Grid -->
      <div class="grid grid-cols-2 md:grid-cols-6 gap-8 mb-12">
        <!-- Product -->
        <div>
          <h3 class="mb-4 text-xs font-medium uppercase tracking-wider text-foreground/45">Product</h3>
          <ul class="space-y-3">
            <li><NuxtLink to="/features" class="text-sm text-foreground/70 transition-colors duration-150 hover:text-primary">Features</NuxtLink></li>
            <li><NuxtLink to="/integrations" class="text-sm text-foreground/70 transition-colors duration-150 hover:text-primary">Integrations</NuxtLink></li>
            <li><NuxtLink to="/pricing" class="text-sm text-foreground/70 transition-colors duration-150 hover:text-primary">Pricing</NuxtLink></li>
          </ul>
        </div>

        <!-- Integrations -->
        <div>
          <h3 class="mb-4 text-xs font-medium uppercase tracking-wider text-foreground/45">Integrations</h3>
          <ul class="space-y-3">
            <li><NuxtLink to="/integrations/github" class="text-sm text-foreground/70 transition-colors duration-150 hover:text-primary">GitHub</NuxtLink></li>
            <li><NuxtLink to="/integrations/vercel" class="text-sm text-foreground/70 transition-colors duration-150 hover:text-primary">Vercel</NuxtLink></li>
            <li><NuxtLink to="/integrations/railway" class="text-sm text-foreground/70 transition-colors duration-150 hover:text-primary">Railway</NuxtLink></li>
            <li><NuxtLink to="/integrations/render" class="text-sm text-foreground/70 transition-colors duration-150 hover:text-primary">Render</NuxtLink></li>
            <li><NuxtLink to="/integrations/dokploy" class="text-sm text-foreground/70 transition-colors duration-150 hover:text-primary">Dokploy</NuxtLink></li>
            <li><NuxtLink to="/integrations/coolify" class="text-sm text-foreground/70 transition-colors duration-150 hover:text-primary">Coolify</NuxtLink></li>
          </ul>
        </div>

        <!-- Solutions -->
        <div>
          <h3 class="mb-4 text-xs font-medium uppercase tracking-wider text-foreground/45">Solutions</h3>
          <ul class="space-y-3">
            <li><NuxtLink to="/solutions/stop-secrets-in-slack" class="text-sm text-foreground/70 transition-colors duration-150 hover:text-primary">Stop Secrets in Slack</NuxtLink></li>
            <li><NuxtLink to="/solutions/team-security" class="text-sm text-foreground/70 transition-colors duration-150 hover:text-primary">Team Security</NuxtLink></li>
            <li><NuxtLink to="/solutions/audit-compliance" class="text-sm text-foreground/70 transition-colors duration-150 hover:text-primary">Audit & Compliance</NuxtLink></li>
          </ul>
        </div>

        <!-- Use Cases -->
        <div>
          <h3 class="mb-4 text-xs font-medium uppercase tracking-wider text-foreground/45">Use Cases</h3>
          <ul class="space-y-3">
            <li><NuxtLink to="/for-startups" class="text-sm text-foreground/70 transition-colors duration-150 hover:text-primary">For Startups</NuxtLink></li>
            <li><NuxtLink to="/for-enterprises" class="text-sm text-foreground/70 transition-colors duration-150 hover:text-primary">For Enterprises</NuxtLink></li>
            <li><NuxtLink to="/for-developers" class="text-sm text-foreground/70 transition-colors duration-150 hover:text-primary">For Developers</NuxtLink></li>
            <li><NuxtLink to="/for-agencies" class="text-sm text-foreground/70 transition-colors duration-150 hover:text-primary">For Agencies</NuxtLink></li>
          </ul>
        </div>

        <!-- Resources -->
        <div>
          <h3 class="mb-4 text-xs font-medium uppercase tracking-wider text-foreground/45">Resources</h3>
          <ul class="space-y-3">
            <li><NuxtLink to="/docs" class="text-sm text-foreground/70 transition-colors duration-150 hover:text-primary">Documentation</NuxtLink></li>
            <li><NuxtLink to="/blog" class="text-sm text-foreground/70 transition-colors duration-150 hover:text-primary">Blog</NuxtLink></li>
            <li><NuxtLink to="/share" class="text-sm text-foreground/70 transition-colors duration-150 hover:text-primary">Share a Secret</NuxtLink></li>
          </ul>
        </div>

        <!-- Guides (internal links to cornerstone posts — feeds crawl signal from indexed pages) -->
        <div>
          <h3 class="mb-4 text-xs font-medium uppercase tracking-wider text-foreground/45">Guides</h3>
          <ul class="space-y-3">
            <li><NuxtLink to="/blog/best-secrets-management-tools" class="text-sm text-foreground/70 transition-colors duration-150 hover:text-primary">Secrets Management Tools</NuxtLink></li>
            <li><NuxtLink to="/blog/external-secrets-operator" class="text-sm text-foreground/70 transition-colors duration-150 hover:text-primary">External Secrets Operator</NuxtLink></li>
            <li><NuxtLink to="/blog/hashicorp-vault-pricing" class="text-sm text-foreground/70 transition-colors duration-150 hover:text-primary">HashiCorp Vault Pricing</NuxtLink></li>
            <li><NuxtLink to="/blog/doppler-pricing-alternatives" class="text-sm text-foreground/70 transition-colors duration-150 hover:text-primary">Doppler Alternatives</NuxtLink></li>
            <li><NuxtLink to="/blog/infisical-alternatives" class="text-sm text-foreground/70 transition-colors duration-150 hover:text-primary">Infisical Alternatives</NuxtLink></li>
            <li><NuxtLink to="/blog/cyberark-conjur-pricing-alternatives" class="text-sm text-foreground/70 transition-colors duration-150 hover:text-primary">CyberArk Conjur Alternatives</NuxtLink></li>
          </ul>
        </div>
      </div>

      <!-- Bottom Bar -->
      <div class="flex flex-col items-center justify-between gap-4 border-t border-border/40 pt-8 md:flex-row">
        <div class="flex items-center gap-2.5">
          <div class="flex h-7 w-7 items-center justify-center rounded-lg border border-primary/35 bg-primary/15">
            <Icon name="lucide:terminal" class="h-3.5 w-3.5 text-primary" />
          </div>
          <span class="text-sm font-semibold text-foreground">EnvManager</span>
        </div>
        <p class="text-sm text-foreground/55">
          &copy; {{ currentYear }} EnvManager. All rights reserved.
        </p>
        <div class="flex items-center gap-6">
          <NuxtLink to="/privacy" :external="true" class="text-sm text-foreground/60 transition-colors duration-150 hover:text-primary">
            Privacy
          </NuxtLink>
          <NuxtLink to="/terms" :external="true" class="text-sm text-foreground/60 transition-colors duration-150 hover:text-primary">
            Terms
          </NuxtLink>
          <NuxtLink to="/cookie-policy" :external="true" class="text-sm text-foreground/60 transition-colors duration-150 hover:text-primary">
            Cookies
          </NuxtLink>
          <NuxtLink to="/disclaimer" :external="true" class="text-sm text-foreground/60 transition-colors duration-150 hover:text-primary">
            Disclaimer
          </NuxtLink>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup>
const currentYear = new Date().getFullYear()
</script>
