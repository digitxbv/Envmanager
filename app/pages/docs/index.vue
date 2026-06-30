<template>
  <div>
    <div v-if="page">
      <div v-if="page.video" class="mb-8">
        <VideoEmbed :src="page.video" />
      </div>
      <article class="prose prose-gray dark:prose-invert max-w-none">
        <ContentRenderer :value="page" />
      </article>
    </div>
    <div v-else class="text-center py-12">
      <h1 class="text-3xl font-bold">Documentation</h1>
      <p class="text-muted-foreground mt-2">Welcome to EnvManager documentation.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'docs'
})

const { data: page } = await useAsyncData('docs-index', () =>
  queryCollection('docs').path('/docs').first()
)

useSeoMeta({
  title: page.value?.title || 'Documentation',
  description: page.value?.description || 'EnvManager documentation'
})
</script>
