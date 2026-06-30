<template>
  <div class="marketing flex min-h-screen flex-col">
    <header class="glass-header sticky top-0 z-40">
      <div class="container flex h-16 items-center justify-between">
        <div class="flex items-center gap-6">
          <NuxtLink to="/" class="group flex items-center gap-2.5 text-lg font-bold text-foreground">
              <div class="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 shadow-[0_0_15px_-3px_hsl(var(--primary)/0.3)] transition-all duration-300 group-hover:border-primary/50 group-hover:bg-primary/20 group-hover:shadow-[0_0_20px_-3px_hsl(var(--primary)/0.5)]">
              <Icon name="lucide:terminal" class="h-4 w-4 text-primary" />
            </div>
            <span class="hidden sm:inline-block tracking-tight">EnvManager</span>
          </NuxtLink>
          <nav class="hidden items-center gap-1 md:flex">
            <NuxtLink
              v-for="link in navLinks"
              :key="link.to"
              :to="link.to"
              active-class="text-primary bg-primary/10"
              class="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-all duration-200 hover:text-foreground hover:bg-muted/50"
            >
              {{ link.label }}
            </NuxtLink>
          </nav>
        </div>
        <div class="flex items-center gap-3">
          <!-- Mobile menu button -->
           <button
             @click="mobileMenuOpen = !mobileMenuOpen"
             class="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground md:hidden"
           >
            <Icon v-if="mobileMenuOpen" name="lucide:x" class="h-5 w-5" />
            <Icon v-else name="lucide:menu" class="h-5 w-5" />
            <span class="sr-only">Toggle menu</span>
          </button>

          <!-- Desktop auth buttons -->
          <div class="hidden md:flex items-center gap-3">
            <template v-if="user">
               <NuxtLink
                 to="/dashboard"
                 class="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[0_0_20px_-5px_hsl(var(--primary)/0.4)] transition-all duration-300 hover:bg-primary/90 hover:shadow-[0_0_25px_-5px_hsl(var(--primary)/0.6)] hover:-translate-y-0.5"
               >
                 Dashboard
               </NuxtLink>
               <button
                 @click="signOut"
                 class="inline-flex items-center justify-center rounded-md border border-input bg-transparent px-4 py-2 text-sm font-medium text-muted-foreground transition-all duration-200 hover:border-foreground/20 hover:text-foreground hover:bg-muted/30"
               >
                 Sign out
               </button>
            </template>
            <template v-else>
               <NuxtLink
                 to="/auth/login"
                 class="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground"
               >
                 Login
               </NuxtLink>
               <NuxtLink
                 to="/auth/register"
                 class="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[0_0_20px_-5px_hsl(var(--primary)/0.4)] transition-all duration-300 hover:bg-primary/90 hover:shadow-[0_0_25px_-5px_hsl(var(--primary)/0.6)] hover:-translate-y-0.5"
               >
                 Sign up
               </NuxtLink>
            </template>
          </div>
        </div>
      </div>

      <!-- Mobile menu -->
      <Transition
        enter-active-class="transition-all duration-300 ease-out"
        leave-active-class="transition-all duration-200 ease-in"
        enter-from-class="opacity-0 -translate-y-4"
        leave-to-class="opacity-0 -translate-y-4"
      >
        <div v-if="mobileMenuOpen" class="border-b border-border/40 bg-background/95 backdrop-blur-xl md:hidden">
          <div class="container space-y-1 py-4 pb-6">
             <NuxtLink
               v-for="link in navLinks"
               :key="link.to"
               :to="link.to"
               active-class="text-primary bg-primary/10"
               class="block rounded-lg px-4 py-3 text-base font-medium text-muted-foreground transition-colors duration-200 hover:bg-muted/50 hover:text-foreground"
               @click="mobileMenuOpen = false"
             >
              {{ link.label }}
            </NuxtLink>
            <div class="mt-4 space-y-3 border-t border-border/40 pt-4 px-1">
              <template v-if="user">
                 <NuxtLink
                   to="/dashboard"
                   class="flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground shadow-lg"
                   @click="mobileMenuOpen = false"
                 >
                   Dashboard
                 </NuxtLink>
                 <button
                   @click="signOut; mobileMenuOpen = false"
                   class="w-full rounded-lg border border-input bg-background px-4 py-3 text-center text-sm font-medium text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
                 >
                   Sign out
                 </button>
              </template>
              <template v-else>
                 <NuxtLink
                   to="/auth/login"
                   class="block w-full rounded-lg border border-input bg-background px-4 py-3 text-center text-sm font-medium text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
                   @click="mobileMenuOpen = false"
                 >
                   Login
                 </NuxtLink>
                 <NuxtLink
                   to="/auth/register"
                   class="block w-full rounded-lg bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground shadow-lg"
                   @click="mobileMenuOpen = false"
                 >
                   Sign up
                 </NuxtLink>
              </template>
            </div>
          </div>
        </div>
      </Transition>
    </header>
    <div class="marketing container flex-1 items-start md:grid md:grid-cols-[220px_minmax(0,1fr)] md:gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10 py-8">
      <aside class="fixed top-16 z-30 -ml-2 hidden h-[calc(100vh-4rem)] w-full shrink-0 md:sticky md:block overflow-y-auto">
        <DocsSidebar />
      </aside>
      <main class="relative w-full">
        <slot />
      </main>
    </div>
    <MarketingFooter />
  </div>
</template>

<script setup>
const user = useSupabaseUser()
const client = useSupabaseClient()
const { $toast } = useNuxtApp()

const mobileMenuOpen = ref(false)

const navLinks = [
  { to: '/features', label: 'Features' },
  { to: '/integrations', label: 'Integrations' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/docs', label: 'Docs' },
  { to: '/blog', label: 'Blog' },
]

const signOut = async () => {
  try {
    await client.auth.signOut()
    $toast.success('Signed out successfully')
    navigateTo('/')
  } catch (error) {
    $toast.error('Failed to sign out')
    console.error(error)
  }
}

// Close mobile menu on route change
const route = useRoute()
watch(() => route.path, () => {
  mobileMenuOpen.value = false
})
</script>
