<template>
  <div class="relative min-h-screen overflow-hidden bg-background px-4 py-12 text-foreground sm:px-6 lg:px-8">
    <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.12),transparent_55%)]"></div>
    <div class="hero-grid pointer-events-none absolute inset-0 opacity-20"></div>

    <div class="relative mx-auto max-w-4xl rounded-3xl border border-border/60 bg-card/80 p-6 shadow-glow-xl backdrop-blur-xl sm:p-8 lg:p-10">
      <button
        @click="goBack"
        class="mb-8 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <article
        v-if="page"
        class="legal-content prose prose-invert prose-zinc max-w-none prose-sm sm:prose-base lg:prose-lg prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-foreground prose-p:leading-relaxed prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground prose-hr:border-border/60 prose-code:text-foreground prose-pre:border prose-pre:border-border/60 prose-pre:bg-card/90 prose-a:text-primary prose-a:underline prose-a:decoration-primary/45 prose-a:underline-offset-4"
      >
        <ContentRenderer :value="page" />
      </article>

      <div v-else class="py-12 text-center">
        <p class="mb-4 text-destructive">Cookie Policy not found</p>
        <button
          @click="goBack"
          class="font-medium text-primary transition-colors hover:text-primary/80"
        >
          Go Back
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { data: page } = await useAsyncData('cookie-policy', () => {
  return queryCollection('legal').path('/legal/cookie-policy').first()
})

const goBack = () => {
  window.history.back()
}

useHead({
  title: 'Cookie Policy - EnvManager',
  meta: [
    {
      name: 'description',
      content: 'Cookie Policy for EnvManager - How we use cookies and tracking technologies'
    }
  ]
})
</script>

<style scoped>
.legal-content :deep(a) {
  transition: color 0.2s ease;
}

.legal-content :deep(a:hover) {
  color: hsl(var(--primary));
}
</style>
