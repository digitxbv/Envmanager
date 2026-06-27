-- Migration: Add audit trigger for access level changes
-- Logs to variable_audit_log with variable_id=NULL, action='access_level_changed'

-- Extend action constraint to allow 'access_level_changed'
ALTER TABLE variable_audit_log
DROP CONSTRAINT IF EXISTS variable_audit_log_action_check;

ALTER TABLE variable_audit_log
ADD CONSTRAINT variable_audit_log_action_check
CHECK (action IN ('created', 'updated', 'deleted', 'access_level_changed'));

CREATE OR REPLACE FUNCTION log_access_level_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.access_level IS DISTINCT FROM NEW.access_level THEN
    INSERT INTO variable_audit_log (
      id, variable_id, organization_id, environment_id, user_id, action, old_value, new_value
    ) VALUES (
      gen_random_uuid(),
      NULL,
      COALESCE(NEW.organization_id, OLD.organization_id),
      NEW.environment_id,
      NEW.user_id,
      'access_level_changed',
      OLD.access_level,
      NEW.access_level
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_access_level_change
  AFTER UPDATE ON environment_access
  FOR EACH ROW
  EXECUTE FUNCTION log_access_level_change();
