<template>
  <div class="space-y-6">
    <div class="space-y-2 text-center">
      <Icon name="lucide:shield-check" class="h-10 w-10 mx-auto text-primary" />
      <h1 class="text-2xl font-semibold tracking-tight">Two-Factor Authentication</h1>
      <p class="text-sm text-muted-foreground">
        {{ useRecoveryCode
          ? 'Enter one of your recovery codes'
          : 'Enter the 6-digit code from your authenticator app'
        }}
      </p>
    </div>

    <!-- TOTP Code Form -->
    <form v-if="!useRecoveryCode" @submit.prevent="handleVerify" class="space-y-4">
      <div class="space-y-2">
        <label for="code" class="text-sm font-medium">Verification Code</label>
        <Input
          id="code"
          v-model="code"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          placeholder="000000"
          maxlength="6"
          :disabled="loading"
          required
        />
      </div>

      <div v-if="error" class="text-sm text-destructive">
        {{ error }}
      </div>

      <Button type="submit" class="w-full" :loading="loading" :disabled="code.length !== 6">
        Verify
      </Button>

      <button
        type="button"
        class="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
        @click="useRecoveryCode = true; error = ''"
      >
        Lost your device? Use a recovery code
      </button>
    </form>

    <!-- Recovery Code Form -->
    <form v-else @submit.prevent="handleRecoveryVerify" class="space-y-4">
      <div class="space-y-2">
        <label for="recovery-code" class="text-sm font-medium">Recovery Code</label>
        <Input
          id="recovery-code"
          v-model="recoveryCode"
          type="text"
          placeholder="XXXXX-XXXXX"
          maxlength="11"
          :disabled="loading"
          required
        />
      </div>

      <div v-if="error" class="text-sm text-destructive">
        {{ error }}
      </div>

      <div v-if="recoveryWarning" class="p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm text-warning">
        {{ recoveryWarning }}
      </div>

      <Button type="submit" class="w-full" :loading="loading" :disabled="recoveryCode.length < 11">
        Verify Recovery Code
      </Button>

      <button
        type="button"
        class="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
        @click="useRecoveryCode = false; error = ''; recoveryCode = ''"
      >
        Use authenticator app instead
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'auth'
})

import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'

const client = useSupabaseClient()
const { $toast } = useNuxtApp()

const code = ref('')
const recoveryCode = ref('')
const loading = ref(false)
const error = ref('')
const factorId = ref('')
const challengeId = ref('')
const useRecoveryCode = ref(false)
const recoveryWarning = ref('')

interface RecoveryVerificationResult {
  success: boolean
  error?: string
  warning?: string
  remaining_codes?: number
}

function isRecoveryVerificationResult(value: unknown): value is RecoveryVerificationResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  return 'success' in value
}

onMounted(async () => {
  try {
    const { data, error: listError } = await client.auth.mfa.listFactors()
    if (listError) throw listError

    const totpFactor = data.totp?.[0]
    if (!totpFactor) {
      // No TOTP factor — user shouldn't be here
      navigateTo('/dashboard')
      return
    }

    factorId.value = totpFactor.id

    const { data: challengeData, error: challengeError } = await client.auth.mfa.challenge({
      factorId: totpFactor.id
    })
    if (challengeError) throw challengeError
    challengeId.value = challengeData.id
  } catch (e: any) {
    error.value = e.message || 'Failed to initialize MFA'
  }
})

const handleVerify = async () => {
  if (code.value.length !== 6) return

  loading.value = true
  error.value = ''

  try {
    const { error: verifyError } = await client.auth.mfa.verify({
      factorId: factorId.value,
      challengeId: challengeId.value,
      code: code.value
    })

    if (verifyError) throw verifyError

    $toast.success('Verified successfully')
    navigateTo('/dashboard')
  } catch (e: any) {
    error.value = e.message || 'Invalid code. Please try again.'
    code.value = ''
  } finally {
    loading.value = false
  }
}

const handleRecoveryVerify = async () => {
  if (recoveryCode.value.length < 11) return

  loading.value = true
  error.value = ''
  recoveryWarning.value = ''

  try {
    const { data, error: rpcError } = await client.rpc('verify_recovery_code', {
      input_code: recoveryCode.value
    })

    if (rpcError) throw rpcError

    const verificationResult = isRecoveryVerificationResult(data) ? data : null

    if (!verificationResult?.success) {
      error.value = verificationResult?.error || 'Invalid recovery code'
      recoveryCode.value = ''
      return
    }

    // Recovery session is now created server-side by verify_recovery_code RPC

    // Show warning if codes running low
    if (verificationResult.warning) {
      recoveryWarning.value = `${verificationResult.warning}. Only ${verificationResult.remaining_codes ?? 0} codes remaining.`
      // Brief delay so user can see the warning
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    $toast.success('Recovery code verified')
    navigateTo('/dashboard')
  } catch (e: any) {
    error.value = e.message || 'Failed to verify recovery code'
    recoveryCode.value = ''
  } finally {
    loading.value = false
  }
}
</script>
