<template>
  <nav aria-label="Breadcrumb" v-bind="$attrs">
    <ol class="flex items-center gap-1.5 text-sm">
      <li v-for="(item, index) in items" :key="index" class="flex items-center gap-1.5">
        <Icon
          v-if="index > 0"
          name="lucide:chevron-right"
          class="h-3.5 w-3.5 text-muted-foreground/60 shrink-0"
        />
        <NuxtLink
          v-if="item.to && index < items.length - 1"
          :to="item.to"
          class="text-muted-foreground hover:text-foreground transition-colors"
        >
          {{ item.label }}
        </NuxtLink>
        <span
          v-else
          class="text-foreground font-medium"
        >
          {{ item.label }}
        </span>
      </li>
    </ol>
  </nav>
</template>

<script setup>
defineOptions({
  inheritAttrs: false
})

defineProps({
  items: {
    type: Array,
    required: true,
    validator: (val) => val.every((item) => typeof item.label === 'string')
  }
})
</script>
