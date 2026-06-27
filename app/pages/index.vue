<script setup lang="ts">
// Public/self-hosted build: the marketing homepage is not part of the OSS
// subset. Send visitors straight to the app.
const user = useSupabaseUser()
watchEffect(() => {
  navigateTo(user.value ? '/dashboard' : '/auth/login')
})
</script>

<template>
  <div class="flex min-h-screen items-center justify-center">
    <p class="text-sm text-muted-foreground">Redirecting…</p>
  </div>
</template>
