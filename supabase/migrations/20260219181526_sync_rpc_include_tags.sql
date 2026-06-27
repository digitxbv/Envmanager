-- Update get_variables_for_sync to include tags column
-- Must drop first because return type is changing (adding tags column)

DROP FUNCTION IF EXISTS get_variables_for_sync(UUID, BOOLEAN, BOOLEAN, BOOLEAN);

CREATE OR REPLACE FUNCTION get_variables_for_sync(
    p_environment_id UUID,
    p_sync_secrets BOOLEAN DEFAULT true,
    p_sync_variables BOOLEAN DEFAULT true,
    p_include_fallbacks BOOLEAN DEFAULT false
)
RETURNS TABLE (
    id UUID,
    key TEXT,
    value TEXT,
    is_secret BOOLEAN,
    fallback_value TEXT,
    tags TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
BEGIN
    RETURN QUERY
    SELECT
        v.id,
        v.key,
        CASE
            WHEN v.is_secret THEN
                CASE
                    WHEN p_include_fallbacks
                         AND (SELECT ds.decrypted_secret FROM vault.decrypted_secrets ds WHERE ds.id = v.vault_secret_id) IS NULL
                         AND v.fallback_value IS NOT NULL
                    THEN v.fallback_value
                    ELSE (SELECT ds.decrypted_secret FROM vault.decrypted_secrets ds WHERE ds.id = v.vault_secret_id)
                END
            ELSE
                CASE
                    WHEN p_include_fallbacks
                         AND (v.value IS NULL OR v.value = '')
                         AND v.fallback_value IS NOT NULL
                    THEN v.fallback_value
                    ELSE v.value
                END
        END AS value,
        v.is_secret,
        v.fallback_value,
        v.tags
    FROM variables v
    WHERE v.environment_id = p_environment_id
      AND (
          (v.is_secret = true AND p_sync_secrets = true)
          OR
          (v.is_secret = false AND p_sync_variables = true)
      )
    ORDER BY v.key;
END;
$$;
