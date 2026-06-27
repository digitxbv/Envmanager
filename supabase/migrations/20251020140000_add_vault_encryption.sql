-- =====================================================
-- SUPABASE VAULT INTEGRATION FOR SECRET VARIABLES
-- =====================================================
-- Created: 2025-10-20
-- Description: Store secret environment variables in Supabase Vault
--              Uses Vault's native API (vault.create_secret/vault.decrypted_secrets)
--              Scales to 100,000+ secrets across 10,000+ organizations
-- =====================================================

-- =====================================================
-- 1. SCHEMA CHANGES
-- =====================================================

-- Add vault_secret_id column to reference secrets in vault.secrets
ALTER TABLE variables
ADD COLUMN vault_secret_id UUID REFERENCES vault.secrets(id) ON DELETE CASCADE;

-- Create index for fast vault secret lookups
CREATE INDEX idx_variables_vault_secret_id ON variables(vault_secret_id);

-- Create partial index for performance with 100k+ secrets
-- This optimizes queries that filter by environment_id and is_secret=true
CREATE INDEX idx_variables_secrets ON variables(environment_id) WHERE is_secret = true;

COMMENT ON COLUMN variables.vault_secret_id IS
  'References a secret in vault.secrets when is_secret=true. The actual value is stored encrypted in Vault.';

-- =====================================================
-- 2. AUTO-CREATE VAULT SECRET ON INSERT/UPDATE
-- =====================================================

CREATE OR REPLACE FUNCTION create_vault_secret_for_variable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  secret_uuid UUID;
  secret_name TEXT;
BEGIN
  -- Only process secret variables
  IF NEW.is_secret = false THEN
    -- For non-secrets, clear vault_secret_id if it was previously a secret
    IF OLD.is_secret = true AND OLD.vault_secret_id IS NOT NULL THEN
      -- Delete old vault secret when converting from secret to regular
      DELETE FROM vault.secrets WHERE id = OLD.vault_secret_id;
      NEW.vault_secret_id := NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- For secret variables, create or update vault secret
  IF NEW.value IS NULL OR NEW.value = '' THEN
    RAISE EXCEPTION 'Secret variables cannot have empty values';
  END IF;

  -- Generate unique name for the secret
  secret_name := 'variable_' || NEW.environment_id::TEXT || '_' || NEW.key;

  -- Check if updating existing secret
  IF TG_OP = 'UPDATE' AND OLD.vault_secret_id IS NOT NULL THEN
    -- Update existing vault secret with error handling
    BEGIN
      PERFORM vault.update_secret(
        OLD.vault_secret_id,
        NEW.value,
        secret_name,
        'Environment: ' || NEW.environment_id::TEXT || ', Key: ' || NEW.key
      );
      NEW.vault_secret_id := OLD.vault_secret_id;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to update vault secret: %', SQLERRM;
    END;
  ELSE
    -- Create new vault secret
    secret_uuid := vault.create_secret(
      NEW.value,
      secret_name,
      'Environment: ' || NEW.environment_id::TEXT || ', Key: ' || NEW.key
    );
    NEW.vault_secret_id := secret_uuid;
  END IF;

  -- Clear the value column (actual value stored in Vault)
  NEW.value := NULL;

  RETURN NEW;
END;
$$;

-- Create trigger to auto-manage vault secrets
DROP TRIGGER IF EXISTS manage_vault_secrets_trigger ON variables;
CREATE TRIGGER manage_vault_secrets_trigger
  BEFORE INSERT OR UPDATE ON variables
  FOR EACH ROW
  EXECUTE FUNCTION create_vault_secret_for_variable();

COMMENT ON FUNCTION create_vault_secret_for_variable() IS
  'Automatically creates/updates Vault secrets for variables marked as is_secret=true. Stores the secret UUID reference in variables.vault_secret_id.';

-- =====================================================
-- 3. RPC FUNCTION: DECRYPT VARIABLE VALUE
-- =====================================================

CREATE OR REPLACE FUNCTION decrypt_variable_value(variable_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  var_record RECORD;
  decrypted_value TEXT;
BEGIN
  -- Check authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Fetch variable with RLS checks
  SELECT v.* INTO var_record
  FROM variables v
  WHERE v.id = variable_id
    AND v.organization_id IN (SELECT get_user_organization_ids())
    AND v.environment_id IN (SELECT get_user_environment_ids());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Variable not found or access denied';
  END IF;

  -- If not a secret, return the plain value
  IF var_record.is_secret = false THEN
    RETURN var_record.value;
  END IF;

  -- For secrets, retrieve from Vault
  IF var_record.vault_secret_id IS NULL THEN
    RAISE EXCEPTION 'Secret variable missing vault reference';
  END IF;

  -- Check if vault secret exists (detect orphaned references)
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE id = var_record.vault_secret_id) THEN
    RAISE EXCEPTION 'Vault secret not found - orphaned reference detected for variable %', variable_id;
  END IF;

  -- Query decrypted secret from Vault
  SELECT decrypted_secret INTO decrypted_value
  FROM vault.decrypted_secrets
  WHERE id = var_record.vault_secret_id;

  IF decrypted_value IS NULL THEN
    RAISE EXCEPTION 'Failed to decrypt secret from Vault';
  END IF;

  RETURN decrypted_value;
END;
$$;

GRANT EXECUTE ON FUNCTION decrypt_variable_value(UUID) TO authenticated;

COMMENT ON FUNCTION decrypt_variable_value IS
  'Decrypts a secret variable by retrieving it from vault.decrypted_secrets. Enforces RLS checks before returning the value.';

-- =====================================================
-- 4. UPDATE AUDIT LOG TRIGGER
-- =====================================================

-- Update log_variable_change to store vault_secret_id instead of plaintext
CREATE OR REPLACE FUNCTION log_variable_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    action_type TEXT;
    old_val TEXT;
    new_val TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        action_type := 'created';
        old_val := NULL;
        -- For secrets, store vault reference instead of value
        IF NEW.is_secret THEN
            new_val := 'vault:' || NEW.vault_secret_id::TEXT;
        ELSE
            new_val := NEW.value;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        action_type := 'updated';
        -- SECURITY FIX: Use vault reference if either old or new is a secret
        -- This prevents plaintext exposure when converting between secret/non-secret
        IF OLD.is_secret OR NEW.is_secret THEN
            old_val := 'vault:' || COALESCE(OLD.vault_secret_id::TEXT, 'none');
            new_val := 'vault:' || COALESCE(NEW.vault_secret_id::TEXT, 'none');
        ELSE
            old_val := OLD.value;
            new_val := NEW.value;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        action_type := 'deleted';
        -- For secrets, store vault reference instead of value
        IF OLD.is_secret THEN
            old_val := 'vault:' || OLD.vault_secret_id::TEXT;
        ELSE
            old_val := OLD.value;
        END IF;
        new_val := NULL;
    END IF;

    INSERT INTO variable_audit_log (
        variable_id,
        organization_id,
        environment_id,
        user_id,
        action,
        old_value,
        new_value
    ) VALUES (
        COALESCE(NEW.id, OLD.id),
        COALESCE(NEW.organization_id, OLD.organization_id),
        COALESCE(NEW.environment_id, OLD.environment_id),
        auth.uid(),
        action_type,
        old_val,
        new_val
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

COMMENT ON FUNCTION log_variable_change IS
  'Updated to store Vault secret references (vault:{uuid}) instead of plaintext values for secret variables.';

-- =====================================================
-- 5. CLEANUP FUNCTION FOR DELETED SECRETS
-- =====================================================

-- When a variable is deleted, also delete its vault secret
CREATE OR REPLACE FUNCTION cleanup_vault_secret_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
BEGIN
  -- Delete vault secret if it exists
  IF OLD.vault_secret_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = OLD.vault_secret_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS cleanup_vault_secret_trigger ON variables;
CREATE TRIGGER cleanup_vault_secret_trigger
  AFTER DELETE ON variables
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_vault_secret_on_delete();

COMMENT ON FUNCTION cleanup_vault_secret_on_delete IS
  'Automatically deletes vault secrets when the associated variable is deleted. Prevents orphaned secrets in Vault.';

-- =====================================================
-- 6. HELPER FUNCTION: BULK IMPORT WITH SECRETS
-- =====================================================

-- Helper function for bulk import that handles secret creation
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
      organization_id
    ) VALUES (
      var_item->>'key',
      var_item->>'value',
      import_as_secrets,
      environment_id_param,
      organization_id_param
    )
    RETURNING * INTO new_var;

    RETURN NEXT new_var;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION bulk_insert_variables(JSONB, UUID, UUID, BOOLEAN) TO authenticated;

COMMENT ON FUNCTION bulk_insert_variables IS
  'Bulk insert variables with automatic Vault secret creation for secrets. Used for import operations.';

-- =====================================================
-- 7. MIGRATION COMPLETE
-- =====================================================

-- Add helpful comment to variables table
COMMENT ON TABLE variables IS
  'Environment variables with optional Vault encryption. When is_secret=true, the value is stored in vault.secrets and referenced via vault_secret_id.';

-- Summary of changes:
-- ✅ Added vault_secret_id column to variables table
-- ✅ Created trigger to auto-create/update Vault secrets
-- ✅ Updated decrypt_variable_value() to query Vault
-- ✅ Updated audit log to store Vault references
-- ✅ Added cleanup trigger for deleted secrets
-- ✅ Added bulk import helper function
-- ✅ Properly using Vault's native API (no pgsodium direct usage)
