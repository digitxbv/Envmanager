-- Enable secure Realtime for variables table
-- Uses environment-specific channels with safe payload (no secret values)

-- Enable realtime publication for variables table
ALTER PUBLICATION supabase_realtime ADD TABLE variables;

-- Set replica identity to FULL for UPDATE/DELETE event data
ALTER TABLE variables REPLICA IDENTITY FULL;

-- Trigger function that broadcasts variable changes to environment-specific channels
-- SECURITY: Does NOT include actual values - only metadata
CREATE OR REPLACE FUNCTION broadcast_variable_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_channel TEXT;
  v_payload JSONB;
  v_action TEXT;
BEGIN
  -- Determine action type
  IF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
    v_channel := 'variables:' || OLD.environment_id::TEXT;
    v_payload := jsonb_build_object(
      'action', v_action,
      'variable_id', OLD.id,
      'key', OLD.key,
      'environment_id', OLD.environment_id,
      'is_secret', OLD.is_secret,
      'timestamp', extract(epoch from now())
    );
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'UPDATE';
    v_channel := 'variables:' || NEW.environment_id::TEXT;
    v_payload := jsonb_build_object(
      'action', v_action,
      'variable_id', NEW.id,
      'key', NEW.key,
      'environment_id', NEW.environment_id,
      'is_secret', NEW.is_secret,
      'old_key', OLD.key,
      'timestamp', extract(epoch from now())
    );
  ELSE -- INSERT
    v_action := 'INSERT';
    v_channel := 'variables:' || NEW.environment_id::TEXT;
    v_payload := jsonb_build_object(
      'action', v_action,
      'variable_id', NEW.id,
      'key', NEW.key,
      'environment_id', NEW.environment_id,
      'is_secret', NEW.is_secret,
      'timestamp', extract(epoch from now())
    );
  END IF;
  
  -- IMPORTANT: Do NOT include 'value' or 'vault_secret_id' in payload!
  -- Clients must fetch actual values via secure RPC (get_variables_for_sync)
  
  -- Broadcast to environment-specific channel
  PERFORM pg_notify(
    'supabase_realtime',
    json_build_object(
      'schema', 'public',
      'table', 'variables',
      'type', 'broadcast',
      'channel', v_channel,
      'payload', v_payload
    )::TEXT
  );
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Create trigger for INSERT, UPDATE, DELETE
DROP TRIGGER IF EXISTS variables_broadcast_trigger ON variables;

CREATE TRIGGER variables_broadcast_trigger
  AFTER INSERT OR UPDATE OR DELETE ON variables
  FOR EACH ROW
  EXECUTE FUNCTION broadcast_variable_change();

-- Document the security model
COMMENT ON FUNCTION broadcast_variable_change() IS 
'Broadcasts variable changes to environment-specific Realtime channels.

SECURITY MODEL:
- Does NOT include actual values in payload - only metadata (id, key, is_secret)
- Clients must verify environment access before subscribing
- After receiving notification, clients call get_variables_for_sync RPC to get actual values
- RPC enforces RLS (dual-check: org + env access)

CHANNEL FORMAT: variables:{environment_id}

PAYLOAD EXAMPLE:
{
  "action": "UPDATE",
  "variable_id": "uuid",
  "key": "DATABASE_URL", 
  "environment_id": "uuid",
  "is_secret": true,
  "timestamp": 1706457600
}';
