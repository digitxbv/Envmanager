<template>
  <section
    data-testid="marketing-hero"
    class="relative overflow-hidden rounded-3xl border border-border/50 bg-card/60 px-6 py-16 backdrop-blur-sm md:px-10"
  >
    <div class="hero-grid absolute inset-0 opacity-60"></div>
    <div class="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl"></div>

    <div class="relative z-10 mx-auto flex max-w-3xl flex-col items-center text-center">
      <span class="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary">
        <Icon :name="badgeIcon" class="mr-2 h-3.5 w-3.5" />
        {{ badge }}
      </span>

      <h1 class="mt-6 text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
        {{ title }}
      </h1>

      <p class="mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
        {{ description }}
      </p>

      <div class="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
        <slot name="actions">
          <NuxtLink
            :to="primaryCtaTo"
            data-testid="primary-cta"
            class="inline-flex w-full items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:w-auto"
          >
            <Icon :name="primaryIcon" class="mr-2 h-4 w-4" />
            {{ primaryCtaLabel }}
          </NuxtLink>

          <NuxtLink
            v-if="secondaryCtaTo && secondaryCtaLabel"
            :to="secondaryCtaTo"
            class="inline-flex w-full items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-medium shadow-sm transition-colors hover:bg-muted sm:w-auto"
          >
            {{ secondaryCtaLabel }}
          </NuxtLink>
        </slot>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
interface Props {
  badge?: string
  badgeIcon?: string
  title?: string
  description?: string
  primaryCtaLabel?: string
  primaryCtaTo?: string
  primaryIcon?: string
  secondaryCtaLabel?: string
  secondaryCtaTo?: string
}

withDefaults(defineProps<Props>(), {
  badge: 'Secure configuration management',
  badgeIcon: 'lucide:shield-check',
  title: 'Ship faster without exposing secrets',
  description: 'Centralize environment variables, lock down team access, and sync every environment with confidence.',
  primaryCtaLabel: 'Start Free Trial',
  primaryCtaTo: '/auth/register',
  primaryIcon: 'lucide:rocket',
  secondaryCtaLabel: 'View Pricing',
  secondaryCtaTo: '/pricing'
})
</script>
