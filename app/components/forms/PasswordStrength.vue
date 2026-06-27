<template>
  <div v-if="password" class="space-y-3 mt-2">
    <!-- Strength Bar -->
    <div class="flex items-center gap-2">
      <div class="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          :class="strengthBarClass"
          class="h-full transition-all duration-300 ease-in-out"
          :style="{ width: strengthWidth }"
        />
      </div>
      <span :class="strengthTextClass" class="text-sm font-medium min-w-[60px]">
        {{ strengthLabel }}
      </span>
    </div>

    <!-- Requirements Checklist -->
    <div class="space-y-1">
      <div class="flex items-center gap-2 text-sm">
        <span :class="validation.meetsMinLength ? 'text-green-600 dark:text-green-400' : 'text-gray-400'">
          {{ validation.meetsMinLength ? 'OK' : 'NO' }}
        </span>
        <span :class="validation.meetsMinLength ? 'text-gray-700 dark:text-gray-300' : 'text-gray-500'">
          At least 8 characters
        </span>
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400 pt-1">Stronger with:</p>
      <div class="flex items-center gap-2 text-sm">
        <span :class="validation.hasUppercase ? 'text-green-600 dark:text-green-400' : 'text-gray-400'">
          {{ validation.hasUppercase ? 'OK' : 'NO' }}
        </span>
        <span :class="validation.hasUppercase ? 'text-gray-700 dark:text-gray-300' : 'text-gray-500'">
          One uppercase letter
        </span>
      </div>
      <div class="flex items-center gap-2 text-sm">
        <span :class="validation.hasLowercase ? 'text-green-600 dark:text-green-400' : 'text-gray-400'">
          {{ validation.hasLowercase ? 'OK' : 'NO' }}
        </span>
        <span :class="validation.hasLowercase ? 'text-gray-700 dark:text-gray-300' : 'text-gray-500'">
          One lowercase letter
        </span>
      </div>
      <div class="flex items-center gap-2 text-sm">
        <span :class="validation.hasNumber ? 'text-green-600 dark:text-green-400' : 'text-gray-400'">
          {{ validation.hasNumber ? 'OK' : 'NO' }}
        </span>
        <span :class="validation.hasNumber ? 'text-gray-700 dark:text-gray-300' : 'text-gray-500'">
          One number
        </span>
      </div>
      <div class="flex items-center gap-2 text-sm">
        <span :class="validation.hasSpecialChar ? 'text-green-600 dark:text-green-400' : 'text-gray-400'">
          {{ validation.hasSpecialChar ? 'OK' : 'NO' }}
        </span>
        <span :class="validation.hasSpecialChar ? 'text-gray-700 dark:text-gray-300' : 'text-gray-500'">
          One special character
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PasswordValidation } from '~/composables/usePasswordValidation'

interface Props {
  password: string
  validation: PasswordValidation
}

const props = defineProps<Props>()

const strengthWidth = computed(() => {
  switch (props.validation.strength) {
    case 'weak':
      return '25%'
    case 'fair':
      return '50%'
    case 'good':
      return '75%'
    case 'strong':
      return '100%'
    default:
      return '0%'
  }
})

const strengthBarClass = computed(() => {
  switch (props.validation.strength) {
    case 'weak':
      return 'bg-red-500'
    case 'fair':
      return 'bg-orange-500'
    case 'good':
      return 'bg-yellow-500'
    case 'strong':
      return 'bg-green-500'
    default:
      return 'bg-gray-300'
  }
})

const strengthTextClass = computed(() => {
  switch (props.validation.strength) {
    case 'weak':
      return 'text-red-600 dark:text-red-400'
    case 'fair':
      return 'text-orange-600 dark:text-orange-400'
    case 'good':
      return 'text-yellow-600 dark:text-yellow-400'
    case 'strong':
      return 'text-green-600 dark:text-green-400'
    default:
      return 'text-gray-500'
  }
})

const strengthLabel = computed(() => {
  switch (props.validation.strength) {
    case 'weak':
      return 'Weak'
    case 'fair':
      return 'Fair'
    case 'good':
      return 'Good'
    case 'strong':
      return 'Strong'
    default:
      return ''
  }
})
</script>
