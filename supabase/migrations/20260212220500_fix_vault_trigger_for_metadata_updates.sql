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
  IF NEW.is_secret = false THEN
    IF OLD.is_secret = true AND OLD.vault_secret_id IS NOT NULL THEN
      DELETE FROM vault.secrets WHERE id = OLD.vault_secret_id;
      NEW.vault_secret_id := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD.is_secret = true
    AND NEW.is_secret = true
    AND (NEW.value IS NULL OR NEW.value = '') THEN
    IF OLD.vault_secret_id IS NULL THEN
      RAISE EXCEPTION 'Secret variable missing vault reference';
    END IF;

    NEW.vault_secret_id := OLD.vault_secret_id;
    NEW.value := NULL;
    RETURN NEW;
  END IF;

  IF NEW.value IS NULL OR NEW.value = '' THEN
    RAISE EXCEPTION 'Secret variables cannot have empty values';
  END IF;

  secret_name := 'variable_' || NEW.environment_id::TEXT || '_' || NEW.key;

  IF TG_OP = 'UPDATE' AND OLD.vault_secret_id IS NOT NULL THEN
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
    secret_uuid := vault.create_secret(
      NEW.value,
      secret_name,
      'Environment: ' || NEW.environment_id::TEXT || ', Key: ' || NEW.key
    );
    NEW.vault_secret_id := secret_uuid;
  END IF;

  NEW.value := NULL;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION create_vault_secret_for_variable() IS
  'Automatically creates/updates Vault secrets for variables marked as is_secret=true. Allows metadata-only updates when no plaintext value is provided.';
