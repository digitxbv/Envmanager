<template>
  <div class="space-y-4">
    <div class="text-center">
      <h3 class="text-lg font-semibold">Choose a template</h3>
      <p class="text-sm text-muted-foreground mt-1">
        Start with a pre-configured template or create a custom proxy
      </p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-10">
      <Icon name="lucide:loader-2" class="h-5 w-5 animate-spin text-primary" />
    </div>

    <template v-else>
      <!-- Search + Category filter -->
      <div class="space-y-3">
        <Input
          v-model="searchTerm"
          placeholder="Search templates..."
        />
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="cat in categories"
            :key="cat"
            type="button"
            class="rounded-full px-3 py-1 text-xs font-medium transition-colors"
            :class="activeCategory === cat
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:text-foreground'"
            @click="activeCategory = activeCategory === cat ? null : cat"
          >
            {{ cat === 'all' ? 'All' : cat }}
          </button>
        </div>
      </div>

      <!-- Template grid -->
      <div v-if="filteredTemplates.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <button
          v-for="template in filteredTemplates"
          :key="template.id"
          type="button"
          class="flex flex-col items-start rounded-lg border p-4 text-left transition-all hover:border-primary hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          @click="$emit('select', template)"
        >
          <div class="flex items-center gap-3 mb-2">
            <div class="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
              <Icon :name="template.icon || 'lucide:zap'" class="h-5 w-5 text-foreground" />
            </div>
            <div>
              <p class="font-medium text-sm">{{ template.name }}</p>
              <span class="inline-block rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {{ template.category }}
              </span>
            </div>
          </div>
          <p v-if="template.description" class="text-xs text-muted-foreground line-clamp-2">
            {{ template.description }}
          </p>
        </button>
      </div>

      <!-- No results -->
      <div v-else class="text-center py-8">
        <p class="text-sm text-muted-foreground">No templates match your search</p>
      </div>
    </template>

    <!-- Skip / Custom -->
    <div class="flex justify-center pt-2">
      <button
        type="button"
        class="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
        @click="$emit('skip')"
      >
        Skip / Custom
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import Input from '@/components/ui/Input.vue'
import type { ProxyTemplate } from '~/types/proxy.types'

const emit = defineEmits<{
  select: [template: ProxyTemplate]
  skip: []
}>()

const { templates, loading, fetchTemplates } = useProxyTemplates()

const searchTerm = ref('')
const activeCategory = ref<string | null>(null)

const categories = computed(() => {
  const cats = new Set(templates.value.map(t => t.category))
  return Array.from(cats).sort()
})

const filteredTemplates = computed(() => {
  let result = [...templates.value]
  if (activeCategory.value) {
    result = result.filter(t => t.category === activeCategory.value)
  }

  const search = searchTerm.value.trim().toLowerCase()
  if (search) {
    result = result.filter(t =>
      t.name.toLowerCase().includes(search) ||
      t.description?.toLowerCase().includes(search) ||
      t.category.toLowerCase().includes(search)
    )
  }

  return result
})

onMounted(() => {
  fetchTemplates()
})
</script>
