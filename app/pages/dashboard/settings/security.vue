<template>
  <div class="space-y-6">
    <Card>
      <template #header>
        <h2 class="text-base font-semibold">Two-Factor Authentication</h2>
      </template>

      <div v-if="mfaLoading && !showDisable2faConfirm && !showRegenerateConfirm" class="flex justify-center py-8">
        <Icon name="lucide:loader-2" class="animate-spin h-5 w-5 text-primary" />
      </div>

      <!-- MFA Enrolled -->
      <div v-else-if="hasMfa" class="space-y-4">
        <div class="flex items-center gap-3 p-4 rounded-lg bg-success/10 border border-success/20">
          <Icon name="lucide:shield-check" class="h-5 w-5 text-success flex-shrink-0" />
          <div>
            <p class="font-medium text-success">Two-factor authentication is enabled</p>
            <p class="text-sm text-muted-foreground">Your account is protected with an authenticator app</p>
          </div>
        </div>

        <!-- Recovery Codes Status -->
        <div class="flex items-center gap-3 p-4 rounded-lg bg-muted border border-border">
          <Icon name="lucide:key-round" class="h-5 w-5 text-muted-foreground flex-shrink-0" />
          <div class="flex-1">
            <p class="text-sm font-medium">{{ remainingRecoveryCodes }} recovery codes remaining</p>
            <p v-if="remainingRecoveryCodes < 3 && remainingRecoveryCodes > 0" class="text-sm text-warning">
              Consider regenerating your recovery codes
            </p>
            <p v-if="remainingRecoveryCodes === 0" class="text-sm text-destructive">
              No recovery codes left. Regenerate now.
            </p>
          </div>
        </div>

        <!-- Disable 2FA Confirmation -->
        <div v-if="showDisable2faConfirm" class="p-4 rounded-lg border border-destructive/30 bg-destructive/5 space-y-3">
          <p class="text-sm font-medium">Enter your TOTP code to disable 2FA</p>
          <form @submit.prevent="handleConfirmDisable2fa" class="flex gap-2">
            <Input
              v-model="disable2faCode"
              type="text"
              inputmode="numeric"
              placeholder="000000"
              maxlength="6"
              :disabled="mfaLoading"
              class="max-w-[160px]"
            />
            <Button type="submit" variant="destructive" :loading="mfaLoading" :disabled="disable2faCode.length !== 6">
              Confirm
            </Button>
            <Button variant="outline" @click="showDisable2faConfirm = false; disable2faCode = ''" :disabled="mfaLoading">
              Cancel
            </Button>
          </form>
          <div v-if="mfaError" class="text-sm text-destructive">{{ mfaError }}</div>
        </div>

        <!-- Regenerate Codes Confirmation -->
        <div v-else-if="showRegenerateConfirm" class="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
          <p class="text-sm font-medium">Enter your TOTP code to regenerate recovery codes</p>
          <form @submit.prevent="handleConfirmRegenerate" class="flex gap-2">
            <Input
              v-model="regenerateCode"
              type="text"
              inputmode="numeric"
              placeholder="000000"
              maxlength="6"
              :disabled="mfaLoading"
              class="max-w-[160px]"
            />
            <Button type="submit" :loading="mfaLoading" :disabled="regenerateCode.length !== 6">
              Regenerate
            </Button>
            <Button variant="outline" @click="showRegenerateConfirm = false; regenerateCode = ''" :disabled="mfaLoading">
              Cancel
            </Button>
          </form>
          <div v-if="mfaError" class="text-sm text-destructive">{{ mfaError }}</div>
        </div>

        <!-- Action Buttons -->
        <div v-else class="flex gap-3">
          <Button variant="outline" @click="showRegenerateConfirm = true; mfaError = ''">
            <Icon name="lucide:refresh-cw" class="mr-2 h-4 w-4" />
            Regenerate Recovery Codes
          </Button>
          <Button variant="destructive" @click="showDisable2faConfirm = true; mfaError = ''">
            <Icon name="lucide:shield-off" class="mr-2 h-4 w-4" />
            Disable 2FA
          </Button>
        </div>
      </div>

      <!-- Enrollment Flow -->
      <div v-else-if="enrollmentData" class="space-y-6">
        <p class="text-sm text-muted-foreground">
          Scan the QR code with your authenticator app (e.g. Google Authenticator, Authy), then enter the verification code below.
        </p>
        <div class="flex justify-center">
          <img :src="enrollmentData.qrCode" alt="QR Code" class="w-48 h-48" />
        </div>
        <div class="space-y-2">
          <p class="text-sm font-medium">Can't scan the QR code?</p>
          <code class="block p-3 bg-muted rounded-md text-sm break-all select-all">{{ enrollmentData.secret }}</code>
        </div>
        <form @submit.prevent="handleVerifyEnrollment" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-muted-foreground mb-2">Verification Code</label>
            <Input
              v-model="verificationCode"
              type="text"
              inputmode="numeric"
              placeholder="000000"
              maxlength="6"
              :disabled="mfaLoading"
              required
            />
          </div>
          <div v-if="mfaError" class="text-sm text-destructive">{{ mfaError }}</div>
          <div class="flex gap-3">
            <Button type="submit" :loading="mfaLoading" :disabled="verificationCode.length !== 6">
              Verify & Enable
            </Button>
            <Button variant="outline" @click="cancelEnrollment" :disabled="mfaLoading">
              Cancel
            </Button>
          </div>
        </form>
      </div>

      <!-- Not Enrolled -->
      <div v-else class="space-y-4">
        <p class="text-sm text-muted-foreground">
          Add an extra layer of security to your account by enabling two-factor authentication with an authenticator app.
        </p>
        <div v-if="mfaError" class="text-sm text-destructive">{{ mfaError }}</div>
        <Button @click="handleEnrollMfa" :loading="mfaLoading">
          <Icon name="lucide:shield-plus" class="mr-2 h-4 w-4" />
          Enable 2FA
        </Button>
      </div>
    </Card>

    <!-- Recovery Codes Modal -->
    <ClientOnly>
      <RecoveryCodesModal
        v-model="showRecoveryCodesModal"
        :codes="recoveryCodes"
      />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import RecoveryCodesModal from '@/components/security/RecoveryCodesModal.vue'

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth']
})

// =====================================================
// Core Composables
// =====================================================

const supabase = useSupabaseClient()
const { $toast } = useNuxtApp()
const { logAuthEvent } = useAuthAudit()

// =====================================================
// MFA State
// =====================================================

const mfaLoading = ref(false)
const mfaError = ref('')
const hasMfa = ref(false)
const mfaFactorId = ref('')
const enrollmentData = ref<{ qrCode: string; secret: string; factorId: string } | null>(null)
const verificationCode = ref('')
const recoveryCodes = ref<string[]>([])
const showRecoveryCodesModal = ref(false)
const remainingRecoveryCodes = ref(0)
const showDisable2faConfirm = ref(false)
const disable2faCode = ref('')
const showRegenerateConfirm = ref(false)
const regenerateCode = ref('')

// =====================================================
// Methods - MFA
// =====================================================

const loadMfaStatus = async () => {
  mfaLoading.value = true
  mfaError.value = ''
  try {
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (error) throw error
    const verifiedFactor = data.totp?.find(f => f.status === 'verified')
    hasMfa.value = !!verifiedFactor
    mfaFactorId.value = verifiedFactor?.id || ''

    // Load recovery code count if MFA is enabled
    if (hasMfa.value) {
      const { data: countData, error: countError } = await supabase.rpc('get_remaining_recovery_codes_count')
      if (!countError) {
        remainingRecoveryCodes.value = countData ?? 0
      }
    }
  } catch (e: any) {
    mfaError.value = e.message || 'Failed to load MFA status'
  } finally {
    mfaLoading.value = false
  }
}

const handleEnrollMfa = async () => {
  mfaLoading.value = true
  mfaError.value = ''
  try {
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
    if (error) throw error
    enrollmentData.value = {
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
      factorId: data.id
    }
  } catch (e: any) {
    mfaError.value = e.message || 'Failed to start enrollment'
  } finally {
    mfaLoading.value = false
  }
}

const handleVerifyEnrollment = async () => {
  if (!enrollmentData.value || verificationCode.value.length !== 6) return
  mfaLoading.value = true
  mfaError.value = ''
  try {
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: enrollmentData.value.factorId
    })
    if (challengeError) throw challengeError

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: enrollmentData.value.factorId,
      challengeId: challengeData.id,
      code: verificationCode.value
    })
    if (verifyError) throw verifyError

    // Generate recovery codes
    const { data: codes, error: codesError } = await supabase.rpc('generate_recovery_codes')
    if (codesError) {
      console.error('Failed to generate recovery codes:', codesError)
    } else if (codes) {
      recoveryCodes.value = codes
      showRecoveryCodesModal.value = true
    }

    logAuthEvent('mfa_enabled', true)
    $toast.success('Two-factor authentication enabled')
    enrollmentData.value = null
    verificationCode.value = ''
    await loadMfaStatus()
  } catch (e: any) {
    mfaError.value = e.message || 'Invalid code. Please try again.'
    verificationCode.value = ''
  } finally {
    mfaLoading.value = false
  }
}

const cancelEnrollment = async () => {
  if (enrollmentData.value) {
    // Unenroll the unverified factor to clean up
    await supabase.auth.mfa.unenroll({ factorId: enrollmentData.value.factorId })
    enrollmentData.value = null
    verificationCode.value = ''
    mfaError.value = ''
  }
}

const handleConfirmDisable2fa = async () => {
  if (!mfaFactorId.value || disable2faCode.value.length !== 6) return
  mfaLoading.value = true
  mfaError.value = ''
  try {
    // Verify TOTP code first
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: mfaFactorId.value
    })
    if (challengeError) throw challengeError

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: mfaFactorId.value,
      challengeId: challengeData.id,
      code: disable2faCode.value
    })
    if (verifyError) throw verifyError

    // Unenroll the factor
    const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaFactorId.value })
    if (error) throw error

    logAuthEvent('mfa_disabled', true)
    showDisable2faConfirm.value = false
    disable2faCode.value = ''
    $toast.success('Two-factor authentication disabled')
    await loadMfaStatus()
  } catch (e: any) {
    mfaError.value = e.message || 'Invalid code. Please try again.'
    disable2faCode.value = ''
  } finally {
    mfaLoading.value = false
  }
}

const handleConfirmRegenerate = async () => {
  if (!mfaFactorId.value || regenerateCode.value.length !== 6) return
  mfaLoading.value = true
  mfaError.value = ''
  try {
    // Verify TOTP code first
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: mfaFactorId.value
    })
    if (challengeError) throw challengeError

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: mfaFactorId.value,
      challengeId: challengeData.id,
      code: regenerateCode.value
    })
    if (verifyError) throw verifyError

    // Generate new recovery codes
    const { data: codes, error: codesError } = await supabase.rpc('generate_recovery_codes')
    if (codesError) throw codesError

    recoveryCodes.value = codes || []
    showRecoveryCodesModal.value = true
    showRegenerateConfirm.value = false
    regenerateCode.value = ''
    $toast.success('Recovery codes regenerated')
    await loadMfaStatus()
  } catch (e: any) {
    mfaError.value = e.message || 'Invalid code. Please try again.'
    regenerateCode.value = ''
  } finally {
    mfaLoading.value = false
  }
}

// =====================================================
// Lifecycle
// =====================================================

onMounted(() => {
  loadMfaStatus()
})
</script>
