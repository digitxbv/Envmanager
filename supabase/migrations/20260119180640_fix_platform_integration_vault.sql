-- Fix create_platform_integration to use vault.create_secret() instead of direct INSERT
-- This fixes the "permission denied for function _crypto_aead_det_noncegen" error

CREATE OR REPLACE FUNCTION create_platform_integration(
    p_organization_id UUID,
    p_platform TEXT,
    p_name TEXT,
    p_api_token TEXT,
    p_instance_url TEXT DEFAULT NULL,
    p_skip_ssl_verify BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
    v_vault_id UUID;
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

    -- Store token in vault using vault.create_secret() function
    v_vault_id := vault.create_secret(
        p_api_token,
        format('%s_%s_%s_token', p_organization_id, p_platform, extract(epoch from now())::bigint),
        format('Platform integration token for %s in org %s', p_platform, p_organization_id)
    );

    -- Create integration record
    INSERT INTO platform_integrations (
        organization_id,
        platform,
        name,
        instance_url,
        skip_ssl_verify,
        api_token_vault_id,
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
        true,
        NOW(),
        auth.uid()
    )
    RETURNING id INTO v_integration_id;

    RETURN v_integration_id;
END;
$$;

COMMENT ON FUNCTION create_platform_integration IS 'Creates platform integration with token stored in Vault using vault.create_secret()';
