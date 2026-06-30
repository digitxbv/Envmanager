<template>
  <div class="min-h-[60vh] flex items-center justify-center px-4">
    <div class="max-w-md w-full text-center space-y-4">
      <div v-if="state === 'loading'" class="text-muted-foreground">Processing…</div>
      <template v-else-if="state === 'success'">
        <h1 class="text-2xl font-semibold text-foreground">You've been unsubscribed</h1>
        <p class="text-muted-foreground">You won't receive product tip emails from EnvManager anymore. You'll still get important account and security messages.</p>
        <NuxtLink to="/" class="inline-block text-primary hover:underline">Back to EnvManager</NuxtLink>
      </template>
      <template v-else>
        <h1 class="text-2xl font-semibold text-foreground">Link invalid or expired</h1>
        <p class="text-muted-foreground">We couldn't process this unsubscribe link. Please use the link from your most recent email.</p>
        <NuxtLink to="/" class="inline-block text-primary hover:underline">Back to EnvManager</NuxtLink>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'landing' })
const state = ref<'loading' | 'success' | 'error'>('loading')
const route = useRoute()
const supabase = useSupabaseClient()

onMounted(async () => {
  const token = route.query.token as string | undefined
  if (!token) { state.value = 'error'; return }
  try {
    const { data, error } = await supabase.functions.invoke('unsubscribe', { body: { token } })
    state.value = !error && (data as { success?: boolean })?.success ? 'success' : 'error'
  } catch {
    state.value = 'error'
  }
})
</script>
