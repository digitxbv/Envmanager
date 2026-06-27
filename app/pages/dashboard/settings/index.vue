<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: ['auth']
})

// Redirect /dashboard/settings/ to /dashboard/settings/account
navigateTo('/dashboard/settings/account', { replace: true })
</script>

<template>
  <div>Loading...</div>
</template>
