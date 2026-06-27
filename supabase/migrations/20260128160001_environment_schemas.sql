-- Environment schemas table for Zod validation
-- Stores JSON schema definitions per environment

-- Create environment_schemas table
CREATE TABLE environment_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  schema_json JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  -- One schema per environment
  CONSTRAINT environment_schemas_unique_env UNIQUE (environment_id)
);

-- Indexes
CREATE INDEX environment_schemas_environment_id_idx ON environment_schemas(environment_id);
CREATE INDEX environment_schemas_organization_id_idx ON environment_schemas(organization_id);

-- Enable RLS
ALTER TABLE environment_schemas ENABLE ROW LEVEL SECURITY;

-- Dual-check RLS: Users need both org membership AND environment access
CREATE POLICY "Users can view environment schemas"
ON environment_schemas FOR SELECT
TO authenticated
USING (
  organization_id IN (SELECT get_user_organization_ids())
  AND environment_id IN (SELECT get_user_environment_ids())
);

CREATE POLICY "Users can create environment schemas"
ON environment_schemas FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (SELECT get_user_organization_ids())
  AND environment_id IN (SELECT get_user_environment_ids())
  AND created_by = auth.uid()
);

CREATE POLICY "Users can update environment schemas"
ON environment_schemas FOR UPDATE
TO authenticated
USING (
  organization_id IN (SELECT get_user_organization_ids())
  AND environment_id IN (SELECT get_user_environment_ids())
);

CREATE POLICY "Users can delete environment schemas"
ON environment_schemas FOR DELETE
TO authenticated
USING (
  organization_id IN (SELECT get_user_organization_ids())
  AND environment_id IN (SELECT get_user_environment_ids())
);

-- Trigger for updated_at
CREATE TRIGGER environment_schemas_updated_at
  BEFORE UPDATE ON environment_schemas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RPC: Save (upsert) environment schema
CREATE OR REPLACE FUNCTION save_environment_schema(
  p_environment_id UUID,
  p_schema_json JSONB
)
RETURNS environment_schemas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
  v_result environment_schemas;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Get organization_id from environment
  SELECT organization_id INTO v_org_id
  FROM environments WHERE id = p_environment_id;
  
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Environment not found';
  END IF;
  
  -- Verify user has access (org + env)
  IF NOT (
    v_org_id IN (SELECT get_user_organization_ids())
    AND p_environment_id IN (SELECT get_user_environment_ids())
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  -- Upsert schema
  INSERT INTO environment_schemas (environment_id, organization_id, schema_json, created_by)
  VALUES (p_environment_id, v_org_id, p_schema_json, v_user_id)
  ON CONFLICT (environment_id) DO UPDATE SET
    schema_json = EXCLUDED.schema_json,
    version = environment_schemas.version + 1,
    updated_at = now()
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$;

-- RPC: Get environment schema
CREATE OR REPLACE FUNCTION get_environment_schema(p_environment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
  v_schema JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Get organization_id from environment
  SELECT organization_id INTO v_org_id
  FROM environments WHERE id = p_environment_id;
  
  IF v_org_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Verify user has access (org + env)
  IF NOT (
    v_org_id IN (SELECT get_user_organization_ids())
    AND p_environment_id IN (SELECT get_user_environment_ids())
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  -- Get schema
  SELECT schema_json INTO v_schema
  FROM environment_schemas
  WHERE environment_id = p_environment_id;
  
  RETURN v_schema;
END;
$$;

-- Comment documenting JSON schema format
COMMENT ON TABLE environment_schemas IS 
'Stores JSON schema definitions for environment variable validation.
Schema format example:
{
  "DATABASE_URL": {"type": "string", "format": "url", "pattern": "^postgres://", "required": true},
  "PORT": {"type": "number", "minimum": 1, "maximum": 65535, "required": true},
  "LOG_LEVEL": {"type": "string", "enum": ["debug", "info", "warn", "error"], "default": "info"}
}';
