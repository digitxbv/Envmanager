<template>
  <div class="flex items-center justify-between border-t pt-4">
    <div class="text-sm text-muted-foreground">
      Showing {{ startItem }} to {{ endItem }} of {{ totalItems }} results
    </div>
    <div class="flex items-center gap-2">
      <button
        @click="emit('update:page', currentPage - 1)"
        :disabled="currentPage <= 1"
        class="inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium border hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Icon name="lucide:chevron-left" class="h-4 w-4 mr-1" />
        Previous
      </button>
      <span class="text-sm text-muted-foreground px-2">
        Page {{ currentPage }} of {{ totalPages }}
      </span>
      <button
        @click="emit('update:page', currentPage + 1)"
        :disabled="currentPage >= totalPages"
        class="inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium border hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Next
        <Icon name="lucide:chevron-right" class="h-4 w-4 ml-1" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  currentPage: number
  totalItems: number
  pageSize: number
}>()

const emit = defineEmits<{
  'update:page': [page: number]
}>()

const totalPages = computed(() => Math.max(1, Math.ceil(props.totalItems / props.pageSize)))

const startItem = computed(() => {
  if (props.totalItems === 0) return 0
  return (props.currentPage - 1) * props.pageSize + 1
})

const endItem = computed(() => {
  return Math.min(props.currentPage * props.pageSize, props.totalItems)
})
</script>
