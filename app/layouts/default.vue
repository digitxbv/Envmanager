<script setup lang="ts">
// Public/self-hosted build: the marketing chrome (header, nav, footer) is not
// part of the OSS subset. This minimal fallback layout just renders the page.
</script>

<template>
  <div class="flex min-h-screen flex-col bg-background">
    <main class="flex-1">
      <slot />
    </main>
  </div>
</template>
