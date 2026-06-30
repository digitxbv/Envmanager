<template>
  <div class="relative isolate overflow-hidden bg-background text-foreground">
    <div class="pointer-events-none absolute inset-0">
      <div class="hero-grid absolute inset-0 opacity-45"></div>
      <div class="absolute -left-52 top-12 h-[30rem] w-[30rem] rounded-full bg-primary/20 blur-[150px]"></div>
       <div class="absolute -right-44 top-[34%] h-[24rem] w-[24rem] rounded-full bg-primary/20 blur-[130px]"></div>
      <div class="absolute inset-x-0 bottom-0 h-80 bg-gradient-to-t from-background via-background/70 to-transparent"></div>
    </div>

    <main class="relative">
      <section class="py-16 md:py-24">
        <div class="container px-4 md:px-6 space-y-8 md:space-y-12">
          <MarketingHero
            badge="Enterprise Grade"
            badge-icon="lucide:shield"
            title="Your auditor just asked who accessed production secrets last Tuesday. Do you have the answer?"
            description="AES-256 encryption, row-level access control, and complete audit trails for every secret access. Deploy in minutes instead of weeks. No infrastructure to maintain."
            primary-cta-label="Start 14-Day Free Trial"
            primary-cta-to="/auth/register"
            primary-icon="lucide:shield"
            secondary-cta-label="View Enterprise Features"
            secondary-cta-to="/pricing"
          />

          <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div
              v-for="proof in enterpriseProofPoints"
              :key="proof"
              class="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary-foreground/90"
            >
              <Icon name="lucide:shield-check" class="mr-2 inline h-4 w-4 text-primary" />
              {{ proof }}
            </div>
          </div>
        </div>
      </section>

      <section class="border-y border-border/60 bg-muted/20 py-16 md:py-24 relative overflow-hidden">
        <div class="absolute inset-0 bg-[url('/images/grid-pattern.svg')] opacity-5"></div>
        <div class="container px-4 md:px-6 relative">
          <div class="mx-auto mb-10 max-w-3xl text-center md:mb-14">
            <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">Security controls that pass the audit</h2>
            <p class="mt-4 text-base text-muted-foreground md:text-lg">
              Every feature your security team needs. No infrastructure to deploy or maintain.
            </p>
          </div>

          <div class="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
             <div v-for="feature in enterpriseFeatures" :key="feature.title" class="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-6 hover:border-primary/50 transition-colors">
               <div class="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                 <Icon :name="feature.icon" class="h-5 w-5" />
               </div>
               <h3 class="mb-2 text-lg font-semibold">{{ feature.title }}</h3>
               <p class="text-muted-foreground text-sm leading-relaxed">{{ feature.description }}</p>
             </div>
          </div>
        </div>
      </section>

      <section class="py-16 md:py-24">
        <div class="container px-4 md:px-6">
          <div class="mb-12 overflow-hidden rounded-xl border border-border/60 bg-card/50 p-2 shadow-2xl backdrop-blur-sm md:p-4">
             <img
              src="/images/product/activity-audit.png"
              alt="EnvManager Audit Logs"
              class="h-auto w-full rounded-lg border border-border/40 shadow-sm"
              width="1200"
              height="675"
            />
          </div>

          <div class="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-start">
            <div class="rounded-3xl border border-border/60 bg-card/70 p-8 backdrop-blur-sm md:p-10">
              <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">Compliance-ready from day one</h2>
              <p class="mt-4 text-base text-muted-foreground md:text-lg">
                Comprehensive logging, granular access controls, and encryption standards that satisfy auditors. No months-long implementation project.
              </p>

              <div class="mt-8 space-y-5">
                <div v-for="item in complianceChecks" :key="item.title" class="flex items-start gap-3">
                   <div class="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                     <Icon name="lucide:check" class="h-4 w-4" />
                   </div>
                  <div>
                    <h3 class="text-sm font-semibold md:text-base">{{ item.title }}</h3>
                    <p class="mt-1 text-sm text-muted-foreground">{{ item.description }}</p>
                  </div>
                </div>
              </div>
            </div>

            <div class="rounded-3xl border border-primary/20 bg-primary/10 p-8">
              <h3 class="text-lg font-semibold">Framework alignment</h3>
              <div class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div v-for="framework in complianceFrameworks" :key="framework.name" class="rounded-xl border border-border/60 bg-card/70 p-4">
                  <p class="text-sm font-semibold text-primary">{{ framework.name }}</p>
                  <p class="mt-1 text-xs text-muted-foreground">{{ framework.description }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="border-t border-border/60 py-16 md:py-24">
        <div class="container px-4 md:px-6">
          <div class="mx-auto max-w-4xl rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card/80 to-background/80 p-8 text-center backdrop-blur-sm md:p-12">
            <h2 class="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">Enterprise security without the enterprise implementation timeline</h2>
            <p class="mx-auto mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
              Deploy in minutes, not months. 14-day free trial with no credit card required.
            </p>

            <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <NuxtLink
                to="/auth/register"
                class="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              >
                <Icon name="lucide:shield" class="mr-2 h-4 w-4" />
                Start 14-Day Free Trial
              </NuxtLink>
              <NuxtLink
                to="/pricing"
                class="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
              >
                <Icon name="lucide:credit-card" class="mr-2 h-4 w-4" />
                Compare Plans
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
  title: 'EnvManager for Enterprise - Audit-Ready Secret Management',
  description: 'AES-256 encryption, complete audit trails, approval workflows, and granular RBAC. Enterprise secret management that deploys in minutes, not months.',
  ogTitle: 'EnvManager for Enterprise - Audit-Ready Secret Management',
  ogDescription: 'AES-256 encryption, complete audit trails, approval workflows, and granular RBAC. Deploys in minutes, not months.'
})

const enterpriseProofPoints = [
  'AES-256-GCM encryption at rest and in transit',
  'Complete audit trail — who accessed what, when, from where',
  'Granular RBAC with per-environment permissions',
  'Approval workflows with two-person sign-off for production'
]

const enterpriseFeatures = [
  {
    icon: 'lucide:shield',
    title: 'AES-256-GCM Encryption',
    description: 'Every secret is encrypted at rest using AES-256-GCM via Supabase Vault. Zero-knowledge architecture — your secrets are never stored or transmitted in plain text.'
  },
  {
    icon: 'lucide:scroll-text',
    title: 'Audit Logs That Satisfy Auditors',
    description: 'Every access, modification, and export is logged with timestamp, user ID, and action type. Export full audit reports per project for compliance reviews.'
  },
  {
    icon: 'lucide:users',
    title: 'Granular Role-Based Access',
    description: 'Admin, Editor, and Viewer roles with per-environment permissions. Control exactly who can read, write, and approve changes to production secrets.'
  },
  {
    icon: 'lucide:check-check',
    title: 'Production Approval Workflows',
    description: 'Require single or two-person approval before production changes go live. Automatic expiration for pending approvals. Full audit trail on every decision.'
  },
  {
    icon: 'lucide:key-round',
    title: 'Time-Limited Secret Access',
    description: 'Team members request access to view secret values. Admins grant temporary, time-limited access. Every request and grant is logged.'
  },
  {
    icon: 'lucide:text-cursor-input',
    title: 'Org-Wide Naming Enforcement',
    description: 'Define and enforce naming conventions for every variable. Audit existing variables in bulk. Validate automatically on every create, import, and update.'
  },
  {
    icon: 'lucide:history',
    title: 'Full Version History & Disaster Recovery',
    description: 'Every change is versioned with full rollback capability. Take environment snapshots before deployments. Restore to any point in time.'
  },
  {
    icon: 'lucide:file-check',
    title: 'Schema Validation',
    description: 'Define schemas with type, format, and required rules. Validate in the UI, CLI, and CI pipeline. Prevent misconfigurations before they reach production.'
  },
  {
    icon: 'lucide:plug',
    title: 'Self-Hosted & Cloud Integrations',
    description: 'Deploy to Vercel, Railway, Render, GitHub Actions, Dokploy, and Coolify. Custom CA certificate support for on-premise infrastructure.'
  }
]

const complianceChecks = [
  {
    title: 'Audit-Ready Access Logs',
    description: 'Every secret access and modification is logged with timestamps, user identifiers, and action types. Exportable per-project for auditor review.'
  },
  {
    title: 'Documented Access Control Model',
    description: 'Clear role definitions (Admin, Editor, Viewer) with per-environment permission matrices. Ready for security assessments and vendor questionnaires.'
  },
  {
    title: 'Industry-Standard Encryption',
    description: 'AES-256-GCM encryption at rest via Supabase Vault (pgsodium). Secrets are never stored or transmitted in plain text.'
  },
  {
    title: 'Change Approval Controls',
    description: 'Production changes require explicit approval. Two-person sign-off mode available. Automatic expiration prevents stale approvals.'
  }
]

const complianceFrameworks = [
  {
    name: 'SOC 2',
    description: 'Encryption at rest, audit logging, and access controls aligned with SOC 2 Trust Services Criteria.'
  },
  {
    name: 'GDPR',
    description: 'Data protection controls, access logging, and role-based permissions for EU data handling requirements.'
  },
  {
    name: 'HIPAA',
    description: 'Encrypted storage, access audit trails, and role-based controls suitable for protected health information.'
  },
  {
    name: 'ISO 27001',
    description: 'Information security management controls including encryption, access control, and change management processes.'
  }
]
</script>
