<template>
  <nav class="py-4">
    <div v-for="section in sections" :key="section.title" class="mb-6">
      <h4 class="mb-2 text-sm font-semibold text-foreground">{{ section.title }}</h4>
      <ul class="space-y-1">
        <li v-for="item in section.items" :key="item.path">
          <NuxtLink
            :to="item.path"
            class="block rounded-md px-3 py-2 text-sm transition-colors"
            :class="[
              isActive(item.path)
                ? 'bg-muted font-medium text-foreground'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            ]"
          >
            {{ item.title }}
          </NuxtLink>
        </li>
      </ul>
    </div>
  </nav>
</template>

<script setup lang="ts">
const route = useRoute()

const { data: docs } = await useAsyncData('docs-sidebar', () =>
  // Select only nav fields — otherwise every doc's full body AST is serialized into the page payload.
  queryCollection('docs').select('path', 'title').order('stem', 'ASC').all()
)

interface NavItem {
  title: string
  path: string
}

interface NavSection {
  title: string
  items: NavItem[]
}

// Define section order explicitly
const sectionOrder = [
  'getting-started',
  'variables',
  'environments',
  'team',
  'account'
]

const sections = computed<NavSection[]>(() => {
  if (!docs.value) return []

  const sectionMap = new Map<string, { slug: string; items: NavItem[] }>()

  for (const doc of docs.value) {
    const parts = doc.path.split('/').filter(Boolean)

    // Skip index pages in navigation items
    if (parts.length <= 1) continue

    // Get section name from path (e.g., 'getting-started' from '/docs/getting-started/intro')
    const sectionSlug = parts[1]
    if (!sectionSlug) continue
    const sectionTitle = formatSectionTitle(sectionSlug)

    if (!sectionMap.has(sectionTitle)) {
      sectionMap.set(sectionTitle, { slug: sectionSlug, items: [] })
    }

    sectionMap.get(sectionTitle)!.items.push({
      title: doc.title || formatTitle(parts[parts.length - 1] || ''),
      path: doc.path
    })
  }

  // Sort sections by defined order
  return Array.from(sectionMap.entries())
    .sort(([, a], [, b]) => {
      const aIndex = sectionOrder.indexOf(a.slug)
      const bIndex = sectionOrder.indexOf(b.slug)
      // Unknown sections go to the end
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex)
    })
    .map(([title, { items }]) => ({
      title,
      items
    }))
})

function formatSectionTitle(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
}

function formatTitle(slug: string): string {
  // Remove number prefix (e.g., '1.introduction' -> 'introduction')
  return slug
    .replace(/^\d+\./, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
}

function isActive(path: string): boolean {
  return route.path === path
}
</script>
