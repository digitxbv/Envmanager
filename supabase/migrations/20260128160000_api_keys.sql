-- API Keys table for CLI/CI authentication
-- Allows users to create API keys that inherit their permissions

-- Enable pgcrypto for bcrypt hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create api_keys table
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,  -- bcrypt hash via pgcrypto
  key_prefix TEXT NOT NULL, -- First 11 chars for display (em_xxxxxxxx)
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  CONSTRAINT api_keys_name_length CHECK (char_length(name) >= 1 AND char_length(name) <= 100)
);

-- Indexes
CREATE INDEX api_keys_user_id_idx ON api_keys(user_id);
CREATE INDEX api_keys_organization_id_idx ON api_keys(organization_id);
CREATE INDEX api_keys_key_prefix_idx ON api_keys(key_prefix);

-- Enable RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Users can view their own keys
CREATE POLICY "Users can view own API keys"
ON api_keys FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can create keys for orgs they belong to
CREATE POLICY "Users can create API keys in their orgs"
ON api_keys FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (SELECT get_user_organization_ids())
  AND user_id = auth.uid()
);

-- Users can delete their own keys
CREATE POLICY "Users can delete own API keys"
ON api_keys FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- RPC: Create API key
CREATE OR REPLACE FUNCTION create_api_key(
  p_organization_id UUID,
  p_name TEXT,
  p_expires_in_days INTEGER DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id UUID;
  v_raw_key TEXT;
  v_key_hash TEXT;
  v_key_prefix TEXT;
  v_expires_at TIMESTAMPTZ;
  v_key_id UUID;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Verify user is member of organization
  IF NOT EXISTS (
    SELECT 1 FROM organization_members 
    WHERE organization_id = p_organization_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;
  
  -- Generate random key: em_ + 32 bytes base64url encoded
  v_raw_key := 'em_' || replace(replace(encode(gen_random_bytes(32), 'base64'), '+', '-'), '/', '_');
  v_key_prefix := substring(v_raw_key, 1, 11); -- 'em_' + first 8 chars
  v_key_hash := crypt(v_raw_key, gen_salt('bf', 10));
  
  -- Calculate expiration
  IF p_expires_in_days IS NOT NULL THEN
    v_expires_at := now() + (p_expires_in_days || ' days')::INTERVAL;
  END IF;
  
  -- Insert key
  INSERT INTO api_keys (organization_id, user_id, name, key_hash, key_prefix, expires_at)
  VALUES (p_organization_id, v_user_id, p_name, v_key_hash, v_key_prefix, v_expires_at)
  RETURNING id INTO v_key_id;
  
  -- Return key (only time plaintext is shown)
  RETURN json_build_object(
    'id', v_key_id,
    'key', v_raw_key,
    'prefix', v_key_prefix,
    'expires_at', v_expires_at
  );
END;
$$;

-- RPC: Validate API key (returns user_id if valid, null otherwise)
CREATE OR REPLACE FUNCTION validate_api_key(p_api_key TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key_record RECORD;
BEGIN
  -- Find key by prefix match and hash verification
  SELECT id, user_id, expires_at INTO v_key_record
  FROM api_keys
  WHERE key_prefix = substring(p_api_key, 1, 11)
    AND key_hash = crypt(p_api_key, key_hash);
  
  IF v_key_record IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Check expiration
  IF v_key_record.expires_at IS NOT NULL AND v_key_record.expires_at < now() THEN
    RETURN NULL;
  END IF;
  
  -- Update last_used_at
  UPDATE api_keys SET last_used_at = now() WHERE id = v_key_record.id;
  
  RETURN v_key_record.user_id;
END;
$$;

-- RPC: Revoke (delete) API key
CREATE OR REPLACE FUNCTION revoke_api_key(p_key_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM api_keys
  WHERE id = p_key_id AND user_id = auth.uid();
  
  RETURN FOUND;
END;
$$;

-- RPC: List user's API keys (without exposing hashes)
CREATE OR REPLACE FUNCTION list_api_keys(p_organization_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  name TEXT,
  key_prefix TEXT,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ak.id,
    ak.organization_id,
    ak.name,
    ak.key_prefix,
    ak.last_used_at,
    ak.expires_at,
    ak.created_at
  FROM api_keys ak
  WHERE ak.user_id = auth.uid()
    AND (p_organization_id IS NULL OR ak.organization_id = p_organization_id)
  ORDER BY ak.created_at DESC;
END;
$$;
