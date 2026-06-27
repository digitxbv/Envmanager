// =====================================================
// AWS Secrets Manager Integration Composable
// =====================================================
// AWS-specific integration using the platform factory
// Handles connection, validation, and sync to AWS Secrets Manager

import { createPlatformIntegration } from './usePlatformIntegration'
import type { PlatformConfig } from '~/types/integration.types'
import type { Database } from '~/types/database.types'

// =====================================================
// AWS Platform Config
// =====================================================

export const AWS_CONFIG: PlatformConfig = {
  id: 'aws',
  name: 'AWS Secrets Manager',
  icon: 'simple-icons:amazonaws',
  color: '#FF9900',
  description: 'Sync environment variables to AWS Secrets Manager',
  supportsInstanceUrl: false,
  supportsSkipSsl: false
}

// =====================================================
// AWS-Specific Types
// =====================================================

export interface AwsValidationResult {
  valid: boolean
  account_id: string
  region: string
  error?: string
}

// =====================================================
// Create Composable via Factory
// =====================================================

const basePlatformIntegration = createPlatformIntegration(
  AWS_CONFIG,
  { syncFunctionName: 'aws-sync' }
)

// =====================================================
// Extended AWS Composable
// =====================================================

export function useAwsIntegration() {
  const base = basePlatformIntegration()
  const client = useSupabaseClient<Database>()
  const { $toast } = useNuxtApp()

  // Additional AWS-specific state
  const validating = ref(false)
  const validationResult = ref<AwsValidationResult | null>(null)

  /**
   * Validate AWS IAM credentials via STS GetCallerIdentity
   */
  const validateCredentials = async (
    accessKeyId: string,
    secretAccessKey: string,
    region: string
  ): Promise<AwsValidationResult> => {
    validating.value = true
    validationResult.value = null

    try {
      const { data, error } = await client.functions.invoke('aws-validate', {
        body: { access_key_id: accessKeyId, secret_access_key: secretAccessKey, region }
      })

      if (error) throw error

      validationResult.value = data as AwsValidationResult
      return validationResult.value

    } catch (err) {
      console.error('[useAwsIntegration] Validation failed:', err)
      const result: AwsValidationResult = {
        valid: false,
        account_id: '',
        region,
        error: err instanceof Error ? err.message : 'Validation failed'
      }
      validationResult.value = result
      return result
    } finally {
      validating.value = false
    }
  }

  /**
   * Connect AWS account (store secret access key in Vault, create connection)
   */
  const connect = async (
    organizationId: string,
    secretAccessKey: string,
    name: string,
    accessKeyId: string,
    region: string,
    accountId?: string
  ): Promise<boolean> => {
    base.loading.value = true

    try {
      // Store secret access key in Vault and create connection using RPC
      // p_metadata stores access_key_id, region, and account_id for display/sync
      const metadata: Record<string, string> = { access_key_id: accessKeyId, region }
      if (accountId) metadata.account_id = accountId

      const { data: integrationId, error } = await client.rpc('create_platform_integration', {
        p_organization_id: organizationId,
        p_platform: 'aws',
        p_name: name,
        p_api_token: secretAccessKey,
        p_metadata: metadata
      })

      if (error) throw error

      // Refresh connection
      await base.fetchOrgConnection(organizationId)
      $toast.success('AWS Secrets Manager connected successfully')
      return true

    } catch (err) {
      console.error('[useAwsIntegration] Connect failed:', err)
      $toast.error('Failed to connect AWS Secrets Manager')
      return false
    } finally {
      base.loading.value = false
    }
  }

  return {
    // From base
    ...base,

    // AWS-specific state
    validating,
    validationResult,

    // AWS-specific methods
    validateCredentials,
    connect
  }
}
