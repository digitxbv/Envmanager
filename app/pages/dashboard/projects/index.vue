<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: ['auth']
})

// Redirect to unified dashboard
navigateTo('/dashboard', { redirectCode: 301, replace: true })
</script>
