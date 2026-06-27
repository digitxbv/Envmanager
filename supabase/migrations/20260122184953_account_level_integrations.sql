-- =====================================================
-- ACCOUNT LEVEL INTEGRATIONS (SIMPLIFIED)
-- Migration: 20260122184953_account_level_integrations.sql
-- Description: Organization-level integrations only. Projects enable/disable org integrations.
-- =====================================================

-- =====================================================
-- Step 1: Add CASCADE to platform_sync_configs.connection_id
-- When org integration is deleted, all project sync configs are auto-deleted
-- =====================================================

-- First, drop the existing foreign key constraint
ALTER TABLE platform_sync_configs
DROP CONSTRAINT IF EXISTS platform_sync_configs_connection_id_fkey;

-- Re-add with CASCADE
ALTER TABLE platform_sync_configs
ADD CONSTRAINT platform_sync_configs_connection_id_fkey
    FOREIGN KEY (connection_id) REFERENCES platform_integrations(id) ON DELETE CASCADE;

-- =====================================================
-- Step 2: Simplify unique constraint on platform_integrations
-- One active connection per platform per org (no scope needed - all are org-level)
-- =====================================================

-- Drop existing constraint if it exists
ALTER TABLE platform_integrations
DROP CONSTRAINT IF EXISTS platform_integrations_organization_id_platform_disconnected_key;

-- Drop the scope-based indexes if they exist (from previous migration attempts)
DROP INDEX IF EXISTS idx_unique_org_connection;
DROP INDEX IF EXISTS idx_unique_project_connection;
DROP INDEX IF EXISTS idx_platform_integrations_scope;
DROP INDEX IF EXISTS idx_platform_integrations_project;

-- Remove scope column if it exists
ALTER TABLE platform_integrations
DROP COLUMN IF EXISTS scope;

-- Remove project_id column if it exists
ALTER TABLE platform_integrations
DROP COLUMN IF EXISTS project_id;

-- Remove the check constraint if it exists
ALTER TABLE platform_integrations
DROP CONSTRAINT IF EXISTS check_scope_project_id;

-- Add simple unique constraint: one active connection per platform per org
CREATE UNIQUE INDEX idx_unique_platform_connection
    ON platform_integrations(organization_id, platform)
    WHERE disconnected_at IS NULL;

-- =====================================================
-- Step 3: Update create_platform_integration RPC function
-- Simplified - no scope/project_id parameters
-- =====================================================

-- Drop ALL existing function signatures to avoid ambiguity
DROP FUNCTION IF EXISTS create_platform_integration(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS create_platform_integration(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT);
DROP FUNCTION IF EXISTS create_platform_integration(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, UUID);

-- Recreate simplified version (org-level only)
CREATE OR REPLACE FUNCTION create_platform_integration(
    p_organization_id UUID,
    p_platform TEXT,
    p_name TEXT,
    p_api_token TEXT,
    p_instance_url TEXT DEFAULT NULL,
    p_skip_ssl_verify BOOLEAN DEFAULT false,
    p_ca_cert TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
    v_vault_id UUID;
    v_ca_cert_vault_id UUID;
    v_integration_id UUID;
BEGIN
    -- Check user has admin/owner role in organization
    IF NOT EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_id = p_organization_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    ) THEN
        RAISE EXCEPTION 'Access denied: requires owner or admin role';
    END IF;

    -- Store token in vault
    v_vault_id := vault.create_secret(
        p_api_token,
        format('%s_%s_%s_token', p_organization_id, p_platform, extract(epoch from now())::bigint),
        format('Platform integration token for %s in org %s', p_platform, p_organization_id)
    );

    -- Store CA cert in vault if provided
    IF p_ca_cert IS NOT NULL AND p_ca_cert != '' THEN
        v_ca_cert_vault_id := vault.create_secret(
            p_ca_cert,
            format('%s_%s_%s_ca_cert', p_organization_id, p_platform, extract(epoch from now())::bigint),
            format('CA certificate for %s in org %s', p_platform, p_organization_id)
        );
    END IF;

    -- Create integration record
    INSERT INTO platform_integrations (
        organization_id,
        platform,
        name,
        instance_url,
        skip_ssl_verify,
        api_token_vault_id,
        ca_cert_vault_id,
        token_valid,
        token_validated_at,
        connected_by
    )
    VALUES (
        p_organization_id,
        p_platform,
        p_name,
        p_instance_url,
        p_skip_ssl_verify,
        v_vault_id,
        v_ca_cert_vault_id,
        true,
        now(),
        auth.uid()
    )
    RETURNING id INTO v_integration_id;

    RETURN v_integration_id;
END;
$$;

-- =====================================================
-- Grants
-- =====================================================

GRANT EXECUTE ON FUNCTION create_platform_integration(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) TO authenticated;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE platform_integrations IS 'Organization-level platform integrations. Projects enable/disable via platform_sync_configs.';
