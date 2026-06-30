<template>
  <section class="relative overflow-hidden rounded-3xl border border-border/50 bg-card/70 px-6 py-14 text-center backdrop-blur-sm md:px-10">
    <div class="hero-grid absolute inset-0 opacity-40"></div>
    <div class="absolute inset-x-0 top-0 mx-auto h-44 w-44 rounded-full bg-primary/10 blur-3xl"></div>

    <div class="relative z-10 mx-auto max-w-2xl">
      <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">
        {{ title }}
      </h2>
      <p class="mt-4 text-base text-muted-foreground md:text-lg">
        {{ description }}
      </p>

      <div class="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <NuxtLink
          :to="primaryCtaTo"
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
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
interface Props {
  title?: string
  description?: string
  primaryCtaLabel?: string
  primaryCtaTo?: string
  primaryIcon?: string
  secondaryCtaLabel?: string
  secondaryCtaTo?: string
}

withDefaults(defineProps<Props>(), {
  title: 'Ready to secure your environments?',
  description: 'Create your workspace in minutes, invite your team, and deploy secrets safely across every platform.',
  primaryCtaLabel: 'Start Free',
  primaryCtaTo: '/auth/register',
  primaryIcon: 'lucide:rocket',
  secondaryCtaLabel: 'Talk to Sales',
  secondaryCtaTo: '/contact'
})
</script>
