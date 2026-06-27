-- Add cloud provider platforms (github, gcp, azure, aws) to platform_integrations
-- and add metadata JSONB column for provider-specific configuration

-- 1. Drop & recreate the CHECK constraint with new platform values
ALTER TABLE platform_integrations
    DROP CONSTRAINT platform_integrations_platform_check;

ALTER TABLE platform_integrations
    ADD CONSTRAINT platform_integrations_platform_check
    CHECK (platform IN ('vercel', 'railway', 'render', 'dokploy', 'coolify', 'github', 'gcp', 'azure', 'aws'));

-- 2. Add metadata column
ALTER TABLE platform_integrations ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL;

-- 3. Drop old function overload (different param count = separate overload in PostgreSQL)
DROP FUNCTION IF EXISTS create_platform_integration(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT);

-- 4. Create updated create_platform_integration RPC with p_metadata parameter
CREATE OR REPLACE FUNCTION create_platform_integration(
    p_organization_id UUID,
    p_platform TEXT,
    p_name TEXT,
    p_api_token TEXT,
    p_instance_url TEXT DEFAULT NULL,
    p_skip_ssl_verify BOOLEAN DEFAULT false,
    p_ca_cert TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
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
        connected_by,
        metadata
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
        auth.uid(),
        p_metadata
    )
    RETURNING id INTO v_integration_id;

    RETURN v_integration_id;
END;
$$;
