<script setup>
// Toggles between explicit light/dark. With preference 'system' the first
// click pins whatever the OS resolved to its opposite. color-mode persists
// the choice in a cookie, so it follows the user across every page.
const colorMode = useColorMode()
const toggle = () => {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}
</script>

<template>
  <button
    type="button"
    @click="toggle"
    class="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
    :aria-label="`Switch to ${colorMode.value === 'dark' ? 'light' : 'dark'} mode`"
  >
    <!-- ClientOnly: colorMode.value is unknown during SSR, so reading it would cause a hydration mismatch -->
    <ClientOnly>
      <Icon :name="colorMode.value === 'dark' ? 'lucide:sun' : 'lucide:moon'" class="h-5 w-5" />
      <template #fallback>
        <Icon name="lucide:sun" class="h-5 w-5" />
      </template>
    </ClientOnly>
  </button>
</template>
