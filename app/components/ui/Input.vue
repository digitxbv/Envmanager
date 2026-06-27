<template>
  <div class="relative">
    <input
      :class="[
        'flex h-11 w-full rounded-md border border-input bg-card text-card-foreground px-4 py-2.5 text-base leading-6 ring-offset-background transition-all duration-200',
        'placeholder:text-muted-foreground/60',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'hover:border-ring/50 focus:border-ring',
        type === 'password' && 'pr-12',
        className
      ]"
      :type="computedType"
      :disabled="disabled"
      :value="modelValue"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      v-bind="$attrs"
    />
    <button
      v-if="type === 'password'"
      type="button"
      @mousedown.prevent="showPassword = true"
      @mouseup.prevent="showPassword = false"
      @mouseleave="showPassword = false"
      @touchstart.prevent="showPassword = true"
      @touchend.prevent="showPassword = false"
      @touchcancel="showPassword = false"
      class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none transition-colors"
      :aria-label="showPassword ? 'Hide password' : 'Show password'"
    >
      <Icon v-if="showPassword" name="lucide:eye-off" class="h-5 w-5" />
      <Icon v-else name="lucide:eye" class="h-5 w-5" />
    </button>
  </div>
</template>

<script setup lang="ts">
defineOptions({
  inheritAttrs: false
})

const props = defineProps<{
  modelValue?: string | number
  disabled?: boolean
  type?: string
  className?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const showPassword = ref(false)

const computedType = computed(() => {
  if (props.type === 'password') {
    return showPassword.value ? 'text' : 'password'
  }
  return props.type || 'text'
})
</script>
