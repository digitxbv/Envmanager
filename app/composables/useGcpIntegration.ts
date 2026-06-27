// =====================================================
// GCP Secret Manager Integration Composable
// =====================================================
// GCP-specific integration using the platform factory
// Handles connection, validation, and sync to GCP Secret Manager

import { createPlatformIntegration } from './usePlatformIntegration'
import type { PlatformConfig } from '~/types/integration.types'
import type { Database } from '~/types/database.types'

// =====================================================
// GCP Platform Config
// =====================================================

export const GCP_CONFIG: PlatformConfig = {
  id: 'gcp',
  name: 'Google Cloud',
  icon: 'simple-icons:googlecloud',
  color: '#4285F4',
  description: 'Sync environment variables to Google Cloud Secret Manager',
  supportsInstanceUrl: false,
  supportsSkipSsl: false
}

// =====================================================
// GCP-Specific Types
// =====================================================

export interface GcpValidationResult {
  valid: boolean
  project_id: string
  service_account_email: string
  error?: string
}

// =====================================================
// Create Composable via Factory
// =====================================================

const basePlatformIntegration = createPlatformIntegration(
  GCP_CONFIG,
  { syncFunctionName: 'gcp-sync' }
)

// =====================================================
// Extended GCP Composable
// =====================================================

export function useGcpIntegration() {
  const base = basePlatformIntegration()
  const client = useSupabaseClient<Database>()
  const { $toast } = useNuxtApp()

  // Additional GCP-specific state
  const validating = ref(false)
  const validationResult = ref<GcpValidationResult | null>(null)

  /**
   * Validate GCP service account credentials
   */
  const validateCredentials = async (
    serviceAccountJson: string,
    projectId: string
  ): Promise<GcpValidationResult> => {
    validating.value = true
    validationResult.value = null

    try {
      const { data, error } = await client.functions.invoke('gcp-validate', {
        body: { service_account_json: serviceAccountJson, project_id: projectId }
      })

      if (error) throw error

      validationResult.value = data as GcpValidationResult
      return validationResult.value

    } catch (err) {
      console.error('[useGcpIntegration] Validation failed:', err)
      const result: GcpValidationResult = {
        valid: false,
        project_id: projectId,
        service_account_email: '',
        error: err instanceof Error ? err.message : 'Validation failed'
      }
      validationResult.value = result
      return result
    } finally {
      validating.value = false
    }
  }

  /**
   * Connect GCP account (store service account JSON in Vault, create connection)
   */
  const connect = async (
    organizationId: string,
    serviceAccountJson: string,
    name: string,
    projectId: string
  ): Promise<boolean> => {
    base.loading.value = true

    try {
      // Store service account JSON in Vault and create connection using RPC
      // p_metadata stores the project_id for sync function to use
      const { data: integrationId, error } = await client.rpc('create_platform_integration', {
        p_organization_id: organizationId,
        p_platform: 'gcp',
        p_name: name,
        p_api_token: serviceAccountJson,
        p_metadata: { project_id: projectId }
      })

      if (error) throw error

      // Refresh connection
      await base.fetchOrgConnection(organizationId)
      $toast.success('Google Cloud connected successfully')
      return true

    } catch (err) {
      console.error('[useGcpIntegration] Connect failed:', err)
      $toast.error('Failed to connect Google Cloud')
      return false
    } finally {
      base.loading.value = false
    }
  }

  return {
    // From base
    ...base,

    // GCP-specific state
    validating,
    validationResult,

    // GCP-specific methods
    validateCredentials,
    connect
  }
}
