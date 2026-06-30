<template>
  <div class="relative overflow-hidden bg-background text-foreground">
    <div class="pointer-events-none absolute inset-0">
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.08),transparent_55%)]"></div>
      <div class="absolute -top-40 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-primary/6 blur-[120px]"></div>
    </div>

    <section class="relative py-20 md:py-28">
      <div class="container px-4 md:px-6">
        <div class="mx-auto max-w-2xl">
          <div class="mb-12 text-center">
            <div class="mb-6 inline-block rounded-full border border-primary/20 bg-primary/8 px-5 py-2 backdrop-blur-md">
              <span class="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">Get in touch</span>
            </div>
            <h1 class="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              Contact us
            </h1>
            <p class="mt-4 text-lg text-muted-foreground">
              Have a question or need help? We'd love to hear from you.
            </p>
          </div>

          <form
            v-if="!submitted"
            class="space-y-6 rounded-2xl border border-border/60 bg-card/60 p-8 backdrop-blur-xl"
            @submit.prevent="handleSubmit"
          >
            <div class="grid gap-6 sm:grid-cols-2">
              <div>
                <label for="name" class="mb-2 block text-sm font-medium text-foreground">Name</label>
                <input
                  id="name"
                  v-model="form.name"
                  type="text"
                  required
                  placeholder="Your name"
                  class="w-full rounded-lg border border-border/60 bg-background/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>
              <div>
                <label for="email" class="mb-2 block text-sm font-medium text-foreground">Email</label>
                <input
                  id="email"
                  v-model="form.email"
                  type="email"
                  required
                  placeholder="you@company.com"
                  class="w-full rounded-lg border border-border/60 bg-background/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>
            </div>

            <div>
              <label for="subject" class="mb-2 block text-sm font-medium text-foreground">Subject</label>
              <input
                id="subject"
                v-model="form.subject"
                type="text"
                required
                placeholder="How can we help?"
                class="w-full rounded-lg border border-border/60 bg-background/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>

            <div>
              <label for="message" class="mb-2 block text-sm font-medium text-foreground">Message</label>
              <textarea
                id="message"
                v-model="form.message"
                rows="5"
                required
                placeholder="Tell us more..."
                class="w-full resize-none rounded-lg border border-border/60 bg-background/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>

            <div v-if="error" class="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {{ error }}
            </div>

            <button
              type="submit"
              :disabled="sending"
              class="w-full rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition-all duration-200 hover:bg-primary/90 disabled:opacity-50"
            >
              <span v-if="sending" class="flex items-center justify-center gap-2">
                <Icon name="lucide:loader-2" class="h-4 w-4 animate-spin" />
                Sending...
              </span>
              <span v-else>Send Message</span>
            </button>
          </form>

          <div v-else class="rounded-2xl border border-border/60 bg-card/60 p-12 text-center backdrop-blur-xl">
            <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
              <Icon name="lucide:check" class="h-8 w-8 text-primary" />
            </div>
            <h2 class="text-2xl font-semibold">Message sent</h2>
            <p class="mt-2 text-muted-foreground">
              Thanks for reaching out. We'll get back to you soon.
            </p>
            <button
              class="mt-6 rounded-lg border border-border/60 px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
              @click="resetForm"
            >
              Send another message
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default'
})

const client = useSupabaseClient()

const form = reactive({
  name: '',
  email: '',
  subject: '',
  message: '',
})

const sending = ref(false)
const submitted = ref(false)
const error = ref<string | null>(null)

async function handleSubmit() {
  sending.value = true
  error.value = null

  try {
    const { data, error: fnError } = await client.functions.invoke('contact-form', {
      body: {
        name: form.name,
        email: form.email,
        subject: form.subject,
        message: form.message,
      },
    })

    if (fnError) {
      throw new Error(fnError.message || 'Failed to send message')
    }

    if (!data?.success) {
      throw new Error(data?.data?.message || data?.error || 'Failed to send message')
    }

    submitted.value = true
  } catch (e: any) {
    error.value = e.message || 'Something went wrong. Please try again.'
  } finally {
    sending.value = false
  }
}

function resetForm() {
  form.name = ''
  form.email = ''
  form.subject = ''
  form.message = ''
  submitted.value = false
  error.value = null
}

useSeoMeta({
  title: 'Contact - EnvManager',
  description: 'Get in touch with the EnvManager team. We\'d love to hear from you.',
})
</script>
