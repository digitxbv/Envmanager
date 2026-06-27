<template>
  <Card>
    <EmptyState
      icon="lucide:key"
      title="API Keys — Coming Soon"
      description="Generate and manage API keys for programmatic access. This feature is currently under development."
    />
  </Card>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: ['auth']
})
</script>
