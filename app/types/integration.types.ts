// =====================================================
// Shared Integration Types
// =====================================================
// Types shared across all platform integrations (Vercel, Railway, Render, Dokploy, Coolify)
// Platform-specific composables import these for consistency

import type { Json } from '~/types/database.types'

// =====================================================
// Platform Configuration (static per platform)
// =====================================================

export interface PlatformConfig {
  id: string                      // 'vercel', 'railway', 'render', 'dokploy', 'coolify'
  name: string                    // Display name
  icon: string                    // Icon name (e.g., 'simple-icons:vercel')
  color: string                   // Brand color hex
  description: string             // Short description
  supportsInstanceUrl: boolean    // true for self-hosted (Dokploy, Coolify)
  supportsSkipSsl: boolean        // true for self-hosted
}

// =====================================================
// Platform Connection (token-based auth, not OAuth)
// Organization-level only - simplified architecture
// =====================================================

export interface PlatformConnection {
  id: string
  organization_id: string
  platform: string
  name: string                    // User-defined connection name
  instance_url?: string | null    // For self-hosted platforms
  skip_ssl_verify?: boolean
  token_valid: boolean | null
  token_validated_at: string | null
  token_error: string | null
  connected_by: string
  connected_at: string
  disconnected_at: string | null
  metadata?: Json | null
}

// =====================================================
// Sync Configuration
// =====================================================

// Sync configuration (links EnvManager project to platform target)
export interface SyncConfig {
  id: string
  connection_id: string
  project_id: string
  // Platform-specific target info stored as JSON (includes environment mappings)
  target: Json
  auto_sync: boolean
  sync_secrets: boolean
  sync_variables: boolean
  last_synced_at: string | null
  last_status: SyncStatus | null
  last_error?: string | null
  created_at: string
  updated_at: string
}

// Sync status enum
export type SyncStatus = 'success' | 'partial' | 'failed'

// =====================================================
// Sync History
// =====================================================

export interface SyncHistoryEntry {
  id: string
  env_config_id: string  // References environment_integration_configs.id (v1.1)
  triggered_by: string
  trigger_type: 'auto' | 'manual'
  variables_synced: number
  secrets_synced: number
  status: SyncStatus
  error_message: string | null
  details: Json | null
  created_at: string
}

// =====================================================
// Sync Result (returned from sync operations)
// =====================================================

export interface SyncResult {
  success: boolean
  status: SyncStatus
  variables_synced: number
  secrets_synced: number
  errors?: Array<{ key: string; error: string }>
}

// =====================================================
// UI Types
// =====================================================

// Pending change (for UI display)
export interface PendingChange {
  key: string
  type: 'added' | 'modified' | 'removed'
}
