<template>
  <div class="w-full overflow-auto rounded-lg border border-border" v-bind="$attrs">
    <table class="w-full caption-bottom text-sm">
      <thead class="border-b border-border bg-muted/50">
        <tr>
          <th v-if="selectable" class="h-10 w-10 px-3 align-middle">
            <input
              type="checkbox"
              :checked="allFilteredSelected"
              :indeterminate="someSelected && !allFilteredSelected"
              class="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
              @change="toggleSelectAll"
            />
          </th>
          <th
            v-for="column in columns"
            :key="column.key"
            :class="[
              'h-10 px-4 text-left align-middle font-medium text-muted-foreground',
              column.class || ''
            ]"
          >
            {{ column.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <!-- Loading state -->
        <tr v-if="loading">
          <td :colspan="totalColumns" class="h-32 text-center">
            <div class="flex items-center justify-center gap-2 text-muted-foreground">
              <Icon name="lucide:loader-2" class="h-4 w-4 animate-spin" />
              <span class="text-sm">Loading...</span>
            </div>
          </td>
        </tr>

        <!-- Empty state -->
        <tr v-else-if="!data || data.length === 0">
          <td :colspan="totalColumns" class="h-32 text-center">
            <slot name="empty">
              <p class="text-sm text-muted-foreground">
                {{ emptyMessage }}
              </p>
            </slot>
          </td>
        </tr>

        <!-- Data rows -->
        <tr
          v-else
          v-for="(row, index) in data"
          :key="index"
          class="border-b border-border last:border-0 transition-colors hover:bg-muted/50"
        >
          <td v-if="selectable" class="w-10 px-3 align-middle">
            <input
              type="checkbox"
              :checked="selectedRows.has(String(row[rowKey]))"
              class="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
              @change="toggleRow(String(row[rowKey]))"
            />
          </td>
          <td
            v-for="column in columns"
            :key="column.key"
            :class="[
              'p-4 align-middle',
              column.class || ''
            ]"
          >
            <slot :name="`cell-${column.key}`" :row="row" :value="row[column.key]" :index="index">
              {{ row[column.key] }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts" generic="T extends Record<string, unknown>">
import type { PropType } from 'vue'

defineOptions({
  inheritAttrs: false
})

type DataTableColumn = {
  key: string
  label: string
  class?: string
}

defineSlots<{
  [key: `cell-${string}`]: (props: { row: T; value: unknown; index: number }) => unknown
  empty: () => unknown
}>()

const props = defineProps({
  columns: {
    type: Array as PropType<readonly DataTableColumn[]>,
    required: true,
    validator: (val: DataTableColumn[]) => val.every((col) => 'key' in col && 'label' in col)
  },
  data: {
    type: Array as PropType<readonly T[]>,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  emptyMessage: {
    type: String,
    default: 'No results found.'
  },
  selectable: {
    type: Boolean,
    default: false
  },
  selectedRows: {
    type: Set as unknown as PropType<Set<string>>,
    default: () => new Set<string>()
  },
  rowKey: {
    type: String,
    default: 'id'
  }
})

const emit = defineEmits<{
  'update:selectedRows': [value: Set<string>]
}>()

const totalColumns = computed(() => props.columns.length + (props.selectable ? 1 : 0))

const allFilteredSelected = computed(() => {
  if (!props.data || props.data.length === 0) return false
  return props.data.every(row => props.selectedRows.has(String(row[props.rowKey])))
})

const someSelected = computed(() => {
  if (!props.data || props.data.length === 0) return false
  return props.data.some(row => props.selectedRows.has(String(row[props.rowKey])))
})

function toggleSelectAll() {
  const next = new Set(props.selectedRows)
  if (allFilteredSelected.value) {
    // Deselect all currently visible rows
    for (const row of props.data) {
      next.delete(String(row[props.rowKey]))
    }
  } else {
    // Select all currently visible rows
    for (const row of props.data) {
      next.add(String(row[props.rowKey]))
    }
  }
  emit('update:selectedRows', next)
}

function toggleRow(id: string) {
  const next = new Set(props.selectedRows)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  emit('update:selectedRows', next)
}
</script>
