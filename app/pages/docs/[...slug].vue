<template>
  <div>
    <div v-if="page">
      <div v-if="page.video" class="mb-8">
        <VideoEmbed :src="page.video" />
      </div>
      <article class="prose prose-gray dark:prose-invert max-w-none">
        <ContentRenderer :value="page" />
      </article>
      <DocsNavigation :prev="prev" :next="next" class="mt-12" />

      <!-- Newsletter Signup -->
      <div class="mt-8">
        <NewsletterSignup
          title="Get DevOps tips in your inbox"
          description="Security best practices and product updates. No spam."
          source="docs"
          :compact="true"
        />
      </div>
    </div>
    <div v-else class="text-center py-12">
      <h1 class="text-3xl font-bold">Page not found</h1>
      <p class="text-muted-foreground mt-2">The requested documentation page could not be found.</p>
      <NuxtLink to="/docs" class="text-primary hover:underline mt-4 inline-block">
        Back to documentation
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'docs'
})

const route = useRoute()
const path = computed(() => `/docs/${(route.params.slug as string[]).join('/')}`)

const { data: page } = await useAsyncData(`docs-${path.value}`, () =>
  queryCollection('docs').path(path.value).first()
)

const { data: navigation } = await useAsyncData('docs-navigation', () =>
  // Prev/next nav only needs path+title — avoid serializing every doc's full body AST.
  queryCollection('docs').select('path', 'title').order('stem', 'ASC').all()
)

const currentIndex = computed(() => {
  if (!navigation.value || !page.value) return -1
  return navigation.value.findIndex(p => p.path === page.value?.path)
})

const prev = computed(() => {
  if (!navigation.value || currentIndex.value <= 0) return null
  return navigation.value[currentIndex.value - 1] ?? null
})

const next = computed(() => {
  if (!navigation.value || currentIndex.value < 0 || currentIndex.value >= navigation.value.length - 1) return null
  return navigation.value[currentIndex.value + 1] ?? null
})

useSeoMeta({
  title: page.value?.title || 'Documentation',
  description: page.value?.description || 'EnvManager documentation'
})
</script>
