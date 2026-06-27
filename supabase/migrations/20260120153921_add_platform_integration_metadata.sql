-- =====================================================
-- ADD METADATA COLUMN TO PLATFORM INTEGRATIONS
-- Migration: 20260120153921_add_platform_integration_metadata.sql
-- Description: Add metadata JSONB column for platform-specific settings (e.g., workspaceId)
-- =====================================================

ALTER TABLE platform_integrations
ADD COLUMN metadata JSONB DEFAULT '{}';

COMMENT ON COLUMN platform_integrations.metadata IS 'Platform-specific metadata (e.g., Railway workspaceId)';
