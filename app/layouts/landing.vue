<template>
  <div class="marketing flex min-h-screen flex-col bg-background text-foreground">
    <header class="glass-header sticky top-0 z-40">
      <div class="container flex h-16 items-center justify-between">
        <NuxtLink to="/" class="group flex items-center gap-2.5 text-lg font-bold text-foreground">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 shadow-[0_0_15px_-3px_hsl(var(--primary)/0.3)] transition-all duration-300 group-hover:border-primary/50 group-hover:bg-primary/20 group-hover:shadow-[0_0_20px_-3px_hsl(var(--primary)/0.5)]">
            <Icon name="lucide:terminal" class="h-4 w-4 text-primary" />
          </div>
          <span class="hidden sm:inline-block tracking-tight">EnvManager</span>
        </NuxtLink>
        <NuxtLink
          to="/auth/register"
          class="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[0_0_20px_-5px_hsl(var(--primary)/0.4)] transition-all duration-300 hover:bg-primary/90 hover:shadow-[0_0_25px_-5px_hsl(var(--primary)/0.6)] hover:-translate-y-0.5"
        >
          Start Free Trial
        </NuxtLink>
      </div>
    </header>
    <main class="marketing flex-1">
      <slot />
    </main>
    <footer class="border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
      <div class="container flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
        <span>&copy; {{ new Date().getFullYear() }} EnvManager. All rights reserved.</span>
        <div class="flex gap-4">
          <NuxtLink to="/privacy" :external="true" class="hover:text-foreground">Privacy</NuxtLink>
          <NuxtLink to="/terms" :external="true" class="hover:text-foreground">Terms</NuxtLink>
        </div>
      </div>
    </footer>
  </div>
</template>
