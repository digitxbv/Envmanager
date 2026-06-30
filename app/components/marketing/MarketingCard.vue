<template>
  <article
    data-testid="marketing-card"
    class="card-hover group h-full rounded-2xl border border-border/50 bg-card p-6"
  >
    <div class="flex h-full flex-col gap-4">
      <div class="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
        <Icon :name="icon" class="h-5 w-5" />
      </div>

      <div class="space-y-2">
        <h3 class="text-lg font-semibold tracking-tight">{{ title }}</h3>
        <p class="text-sm leading-relaxed text-muted-foreground">{{ description }}</p>
      </div>

      <slot />
    </div>
  </article>
</template>

<script setup lang="ts">
interface Props {
  icon?: string
  title: string
  description: string
}

withDefaults(defineProps<Props>(), {
  icon: 'lucide:star'
})
</script>
