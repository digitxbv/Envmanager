-- Migration: Update RPCs to support fallback values
-- Depends on: 20260206100000_variable_management_columns.sql (fallback_value column)

-- =====================================================
-- 1. Update get_variables_for_sync to include fallback_value
-- =====================================================

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
    fallback_value TEXT
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
        v.fallback_value
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

-- =====================================================
-- 2. Update bulk_insert_variables to support fallback_value
-- =====================================================

CREATE OR REPLACE FUNCTION bulk_insert_variables(
  variables_data JSONB,
  environment_id_param UUID,
  organization_id_param UUID,
  import_as_secrets BOOLEAN DEFAULT false
)
RETURNS SETOF variables
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  var_item JSONB;
  new_var variables;
BEGIN
  -- Check RLS permissions: both environment access AND organization membership
  IF NOT EXISTS (
    SELECT 1 FROM environment_access ea
    JOIN environments e ON e.id = ea.environment_id
    WHERE ea.environment_id = environment_id_param
    AND ea.user_id = auth.uid()
    AND e.organization_id = organization_id_param
    AND e.organization_id IN (SELECT get_user_organization_ids())
  ) THEN
    RAISE EXCEPTION 'Access denied to environment or organization';
  END IF;

  -- Insert each variable
  FOR var_item IN SELECT * FROM jsonb_array_elements(variables_data)
  LOOP
    INSERT INTO variables (
      key,
      value,
      is_secret,
      environment_id,
      organization_id,
      fallback_value
    ) VALUES (
      var_item->>'key',
      var_item->>'value',
      import_as_secrets,
      environment_id_param,
      organization_id_param,
      (var_item->>'fallback_value')::TEXT
    )
    RETURNING * INTO new_var;

    RETURN NEXT new_var;
  END LOOP;
END;
$$;
