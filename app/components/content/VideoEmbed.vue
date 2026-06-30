<template>
  <div class="relative aspect-video rounded-lg overflow-hidden bg-muted">
    <iframe
      v-if="embedUrl"
      :src="embedUrl"
      class="absolute inset-0 w-full h-full"
      frameborder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen
    />
    <video
      v-else-if="isDirectVideo"
      :src="src"
      class="absolute inset-0 w-full h-full object-cover"
      controls
    />
    <div v-else class="absolute inset-0 flex items-center justify-center text-muted-foreground">
      Invalid video URL
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  src: string
}>()

const embedUrl = computed(() => {
  const url = props.src

  // YouTube
  const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/)
  if (youtubeMatch) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}`
  }

  // Vimeo
  const vimeoMatch = url.match(/(?:vimeo\.com\/)(\d+)/)
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`
  }

  return null
})

const isDirectVideo = computed(() => {
  const url = props.src.toLowerCase()
  return url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.ogg')
})
</script>
