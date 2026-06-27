<template>
  <div class="space-y-2">
    <div class="relative">
      <input
        :id="inputId"
        :type="showPassword ? 'text' : 'password'"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :autocomplete="autocomplete"
        @input="handleInput"
        class="block w-full rounded-md border-0 py-2.5 px-4 pr-10 text-base text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-700 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 dark:focus:ring-primary-400 leading-6 bg-white dark:bg-gray-800 disabled:bg-gray-50 dark:disabled:bg-gray-900 disabled:cursor-not-allowed transition-all duration-200 hover:ring-gray-400 dark:hover:ring-gray-600"
        :aria-label="ariaLabel"
        :aria-describedby="showStrength ? `${inputId}-strength` : undefined"
        :aria-invalid="hasErrors"
      />
      <button
        type="button"
        @click="toggleShowPassword"
        class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        :aria-label="showPassword ? 'Hide password' : 'Show password'"
        tabindex="-1"
      >
        <svg
          v-if="showPassword"
          class="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
          />
        </svg>
        <svg
          v-else
          class="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </svg>
      </button>
    </div>

    <!-- Password Strength Indicator -->
    <PasswordStrength
      v-if="showStrength && modelValue"
      :id="`${inputId}-strength`"
      :password="modelValue"
      :validation="validation"
    />

    <!-- Error Messages -->
    <div
      v-if="hasErrors && showErrors"
      class="text-sm text-red-600 dark:text-red-400"
      role="alert"
    >
      <ul class="list-disc list-inside">
        <li v-for="error in validation.errors" :key="error">
          {{ error }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { validatePassword } from '~/composables/usePasswordValidation'
import PasswordStrength from '~/components/forms/PasswordStrength.vue'

interface Props {
  modelValue: string
  placeholder?: string
  disabled?: boolean
  showStrength?: boolean
  showErrors?: boolean
  ariaLabel?: string
  inputId?: string
  autocomplete?: string
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Enter password',
  disabled: false,
  showStrength: true,
  showErrors: false,
  ariaLabel: 'Password',
  inputId: 'password-input',
  autocomplete: 'current-password'
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const showPassword = ref(false)

const validation = computed(() => validatePassword(props.modelValue))
const hasErrors = computed(() => !validation.value.isValid && props.modelValue.length > 0)

const toggleShowPassword = () => {
  showPassword.value = !showPassword.value
}

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}
</script>