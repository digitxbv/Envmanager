<template>
  <div class="not-prose my-8 rounded-xl border border-primary/30 bg-primary/5 p-6">
    <h3 class="text-lg font-semibold text-foreground">{{ heading }}</h3>
    <p class="mt-1 text-sm text-muted-foreground"><slot>Stop sharing .env files over Slack. EnvManager stores, versions, and syncs your secrets — encrypted, with role-based access.</slot></p>
    <NuxtLink to="/auth/register" class="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90" @click="onClick">
      {{ cta }}
      <Icon name="lucide:arrow-right" class="h-4 w-4" />
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{ heading?: string; cta?: string; placement?: string }>(), {
  heading: 'Manage your environment variables the secure way',
  cta: 'Start free — no credit card',
  placement: 'inline',
})
const { track } = usePostHog()
const onClick = () => track('signup_cta_clicked', { page_source: 'blog', cta_text: props.cta, placement: props.placement })
</script>
