<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: ['auth']
})

// Redirect to unified settings page with billing tab
navigateTo('/dashboard/settings/billing', { redirectCode: 301, replace: true })
</script>
