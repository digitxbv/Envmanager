-- Fix: Variable delete fails due to FK constraint on audit log
-- 
-- Problem: AFTER DELETE trigger tries to insert audit log with variable_id = OLD.id,
-- but by then the variable is already deleted, causing FK violation.
--
-- Solution: For DELETE operations, insert NULL as variable_id since the FK allows NULL.

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
        -- FIX: Use NULL for DELETE since variable no longer exists (FK allows NULL)
        CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE COALESCE(NEW.id, OLD.id) END,
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
  'Audit log trigger for variable changes. Uses NULL for variable_id on DELETE to avoid FK constraint violation.';
