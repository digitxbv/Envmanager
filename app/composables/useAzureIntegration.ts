// =====================================================
// Azure Key Vault Integration Composable
// =====================================================
// Azure-specific integration using the platform factory
// Handles connection, validation, and sync to Azure Key Vault

import { createPlatformIntegration } from './usePlatformIntegration'
import type { PlatformConfig } from '~/types/integration.types'
import type { Database } from '~/types/database.types'

// =====================================================
// Azure Platform Config
// =====================================================

export const AZURE_CONFIG: PlatformConfig = {
  id: 'azure',
  name: 'Azure Key Vault',
  icon: 'simple-icons:microsoftazure',
  color: '#0078D4',
  description: 'Sync environment variables to Azure Key Vault',
  supportsInstanceUrl: false,
  supportsSkipSsl: false
}

// =====================================================
// Azure-Specific Types
// =====================================================

export interface AzureValidationResult {
  valid: boolean
  vault_name: string
  error?: string
}

// =====================================================
// Create Composable via Factory
// =====================================================

const basePlatformIntegration = createPlatformIntegration(
  AZURE_CONFIG,
  { syncFunctionName: 'azure-sync' }
)

// =====================================================
// Extended Azure Composable
// =====================================================

export function useAzureIntegration() {
  const base = basePlatformIntegration()
  const client = useSupabaseClient<Database>()
  const { $toast } = useNuxtApp()

  // Additional Azure-specific state
  const validating = ref(false)
  const validationResult = ref<AzureValidationResult | null>(null)

  /**
   * Validate Azure service principal credentials
   */
  const validateCredentials = async (
    tenantId: string,
    clientId: string,
    clientSecret: string,
    vaultUrl: string
  ): Promise<AzureValidationResult> => {
    validating.value = true
    validationResult.value = null

    try {
      const { data, error } = await client.functions.invoke('azure-validate', {
        body: { tenant_id: tenantId, client_id: clientId, client_secret: clientSecret, vault_url: vaultUrl }
      })

      if (error) throw error

      validationResult.value = data as AzureValidationResult
      return validationResult.value

    } catch (err) {
      console.error('[useAzureIntegration] Validation failed:', err)
      const result: AzureValidationResult = {
        valid: false,
        vault_name: '',
        error: err instanceof Error ? err.message : 'Validation failed'
      }
      validationResult.value = result
      return result
    } finally {
      validating.value = false
    }
  }

  /**
   * Connect Azure account (store client secret in Vault, create connection)
   */
  const connect = async (
    organizationId: string,
    clientSecret: string,
    name: string,
    tenantId: string,
    clientId: string,
    vaultUrl: string
  ): Promise<boolean> => {
    base.loading.value = true

    try {
      // Store client secret in Vault and create connection using RPC
      // p_metadata stores tenant_id, client_id, and vault_url for sync function to use
      const { data: integrationId, error } = await client.rpc('create_platform_integration', {
        p_organization_id: organizationId,
        p_platform: 'azure',
        p_name: name,
        p_api_token: clientSecret,
        p_metadata: { tenant_id: tenantId, client_id: clientId, vault_url: vaultUrl }
      })

      if (error) throw error

      // Refresh connection
      await base.fetchOrgConnection(organizationId)
      $toast.success('Azure Key Vault connected successfully')
      return true

    } catch (err) {
      console.error('[useAzureIntegration] Connect failed:', err)
      $toast.error('Failed to connect Azure Key Vault')
      return false
    } finally {
      base.loading.value = false
    }
  }

  return {
    // From base
    ...base,

    // Azure-specific state
    validating,
    validationResult,

    // Azure-specific methods
    validateCredentials,
    connect
  }
}
