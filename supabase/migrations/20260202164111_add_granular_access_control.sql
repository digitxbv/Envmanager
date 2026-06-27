-- Migration: Add granular access control schema
-- Adds viewer role, access levels, and helper functions
-- Backward compatible: existing access becomes 'write'

BEGIN;

-- 1. Add viewer role to organization_members
ALTER TABLE organization_members
DROP CONSTRAINT IF EXISTS organization_members_role_check;

ALTER TABLE organization_members
ADD CONSTRAINT organization_members_role_check
CHECK (role IN ('owner', 'admin', 'member', 'viewer'));

-- 2. Add access_level to environment_access
-- Existing rows get 'write' via DEFAULT (backward compatible)
ALTER TABLE environment_access
ADD COLUMN IF NOT EXISTS access_level TEXT NOT NULL DEFAULT 'write'
CHECK (access_level IN ('read', 'write'));

-- 3. Add show_values_to_readers to environments
ALTER TABLE environments
ADD COLUMN IF NOT EXISTS show_values_to_readers BOOLEAN NOT NULL DEFAULT false;

-- 4. Create helper function for write access check
CREATE OR REPLACE FUNCTION has_environment_write_access(env_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM environment_access ea
    JOIN organization_members om ON om.organization_id = (
      SELECT organization_id FROM environments WHERE id = env_id
    ) AND om.user_id = auth.uid()
    WHERE ea.environment_id = env_id
    AND ea.user_id = auth.uid()
    AND ea.access_level = 'write'
    AND om.role != 'viewer'  -- Viewers never have write access
  );
$$;

-- 5. Create helper function for read access check
CREATE OR REPLACE FUNCTION has_environment_read_access(env_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM environment_access
    WHERE environment_id = env_id
    AND user_id = auth.uid()
  );
$$;

-- 6. Create helper to check if user can see values
CREATE OR REPLACE FUNCTION can_see_environment_values(env_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM environment_access ea
    JOIN environments e ON e.id = ea.environment_id
    WHERE ea.environment_id = env_id
    AND ea.user_id = auth.uid()
    AND (
      ea.access_level = 'write'  -- Writers always see values
      OR e.show_values_to_readers = true  -- Readers when allowed
    )
  );
$$;

-- 7. Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_environment_access_user_env_level
ON environment_access(user_id, environment_id, access_level);

COMMIT;
