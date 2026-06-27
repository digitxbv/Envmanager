<template>
  <Card>
    <EmptyState
      icon="lucide:bell"
      title="Notifications — Coming Soon"
      description="Manage your email and in-app notification preferences. This feature is currently under development."
    />
  </Card>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: ['auth']
})
</script>
