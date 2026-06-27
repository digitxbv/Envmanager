<template>
  <div class="min-h-screen bg-background antialiased transition-colors duration-300">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <ClientOnly>
      <Toaster position="top-right" />
    </ClientOnly>
  </div>
</template>

<script setup>
const { init: initConsent, cleanup: cleanupConsent } = useConsentManager()

// --- SEO: self-referencing canonical (query-params stripped) + brand schema ---
const route = useRoute()
const runtimeConfig = useRuntimeConfig()
const siteUrl = (runtimeConfig.public.siteUrl || 'https://envmanager.com').replace(/\/+$/, '')

// Canonical is always the clean path with no query string / trailing slash.
// Fixes Google indexing ?ref=... tracking-param duplicates.
const canonicalUrl = computed(() => {
  const path = route.path.replace(/\/+$/, '') // strip trailing slash(es)
  return path === '' ? `${siteUrl}/` : `${siteUrl}${path}`
})

const brandSchema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: 'EnvManager',
      url: `${siteUrl}/`,
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/apple-touch-icon.png`,
        width: 180,
        height: 180,
      },
      description: 'Secure environment variable and secrets management for development teams.',
    },
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      name: 'EnvManager',
      url: `${siteUrl}/`,
      publisher: { '@id': `${siteUrl}/#organization` },
    },
  ],
}

useHead({
  link: [{ rel: 'canonical', href: canonicalUrl }],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify(brandSchema),
    },
  ],
})

onMounted(() => {
  initConsent()
})

onUnmounted(() => {
  cleanupConsent()
})
</script>