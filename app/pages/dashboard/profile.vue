<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
})

// Redirect /dashboard/profile → /dashboard/settings/account
navigateTo('/dashboard/settings/account', { redirectCode: 301, replace: true })
</script>