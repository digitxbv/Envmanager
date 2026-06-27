-- Function to create CLI session API key
-- Called when user authenticates via CLI login to create a persistent API key
-- instead of sharing browser session tokens.

CREATE OR REPLACE FUNCTION create_cli_session_key()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_org_id UUID;
  v_raw_key TEXT;
  v_key_hash TEXT;
  v_key_prefix TEXT;
  v_key_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get user's organization (first one if multiple)
  SELECT organization_id INTO v_org_id
  FROM organization_members
  WHERE user_id = v_user_id
  ORDER BY created_at
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'User has no organization';
  END IF;

  -- Delete old CLI session keys (keep only the newest one)
  DELETE FROM api_keys
  WHERE user_id = v_user_id
    AND name = 'CLI Session';

  -- Generate new key: em_ + 32 bytes base64url encoded
  v_raw_key := 'em_' || replace(replace(encode(gen_random_bytes(32), 'base64'), '+', '-'), '/', '_');
  v_key_prefix := substring(v_raw_key, 1, 11);
  v_key_hash := crypt(v_raw_key, gen_salt('bf', 10));
  v_expires_at := now() + interval '90 days';

  -- Insert with 90-day expiration
  INSERT INTO api_keys (organization_id, user_id, name, key_hash, key_prefix, expires_at)
  VALUES (v_org_id, v_user_id, 'CLI Session', v_key_hash, v_key_prefix, v_expires_at)
  RETURNING id INTO v_key_id;

  RETURN json_build_object(
    'key', v_raw_key,
    'expires_at', v_expires_at,
    'id', v_key_id
  );
END;
$$;
