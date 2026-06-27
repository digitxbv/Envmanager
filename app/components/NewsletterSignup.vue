<template>
  <div :class="['rounded-lg border bg-card p-6', compact ? 'p-4' : 'p-6']">
    <div v-if="!subscribed">
      <h3 :class="['font-semibold', compact ? 'text-base mb-2' : 'text-lg mb-2']">
        {{ title }}
      </h3>
      <p :class="['text-muted-foreground', compact ? 'text-sm mb-3' : 'mb-4']">
        {{ description }}
      </p>

      <form @submit.prevent="subscribe" class="flex gap-2">
        <UiInput
          v-model="email"
          type="email"
          placeholder="you@company.com"
          :disabled="loading"
          required
          class="flex-1"
          aria-label="Email address"
        />
        <UiButton
          type="submit"
          :loading="loading"
          :disabled="!email || loading"
          :size="compact ? 'default' : 'lg'"
        >
          {{ buttonText }}
        </UiButton>
      </form>

      <p v-if="error" class="text-sm text-destructive mt-2">
        {{ error }}
      </p>

      <p class="text-xs text-muted-foreground mt-3">
        No spam. Unsubscribe anytime.
      </p>
    </div>

    <div v-else class="text-center py-2">
      <Icon name="lucide:check-circle" class="h-8 w-8 text-success mx-auto mb-2" />
      <p class="font-medium">You're subscribed!</p>
      <p class="text-sm text-muted-foreground">
        Check your inbox for a welcome email.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  title?: string
  description?: string
  buttonText?: string
  source?: string
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Stay updated',
  description: 'Get security tips, product updates, and DevOps best practices delivered to your inbox.',
  buttonText: 'Subscribe',
  source: 'website',
  compact: false
})

const supabase = useSupabaseClient()

const email = ref('')
const loading = ref(false)
const error = ref('')
const subscribed = ref(false)

interface NewsletterSubscriptionResult {
  success: boolean
  error?: string
}

function isNewsletterSubscriptionResult(value: unknown): value is NewsletterSubscriptionResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  return 'success' in value
}

async function subscribe() {
  if (!email.value || loading.value) return

  loading.value = true
  error.value = ''

  try {
    const { data, error: rpcError } = await supabase.rpc('subscribe_to_newsletter', {
      p_email: email.value.toLowerCase().trim(),
      p_source: props.source
    })

    if (rpcError) {
      console.error('Newsletter subscription error:', rpcError)
      error.value = 'Something went wrong. Please try again.'
      return
    }

    if (isNewsletterSubscriptionResult(data) && !data.success) {
      error.value = data.error || 'Something went wrong. Please try again.'
      return
    }

    subscribed.value = true
    email.value = ''
  } catch (err) {
    console.error('Newsletter subscription error:', err)
    error.value = 'Something went wrong. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>
