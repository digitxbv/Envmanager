-- Email Enumeration Prevention (Security PRD 06)
-- Replace generic get_user_by_email with scoped, admin-only functions

-- 1. Create check_user_for_invitation (admin-only check for invitation flow)
CREATE OR REPLACE FUNCTION check_user_for_invitation(
  target_email TEXT,
  org_id UUID
)
RETURNS TABLE (user_exists BOOLEAN, already_member BOOLEAN)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only org admins/owners can check
  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    EXISTS (SELECT 1 FROM auth.users WHERE email = target_email),
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN auth.users u ON om.user_id = u.id
      WHERE u.email = target_email AND om.organization_id = org_id
    );
END;
$$ LANGUAGE plpgsql;

-- 2. Create add_member_by_email (admin-only, encapsulates full direct-add flow server-side)
-- Returns true if member was added, false otherwise (generic - no info leak)
CREATE OR REPLACE FUNCTION add_member_by_email(
  target_email TEXT,
  org_id UUID,
  member_role TEXT DEFAULT 'member'
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Validate role
  IF member_role NOT IN ('admin', 'member', 'viewer') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  -- Only org admins/owners can add members
  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Look up user (no info leaked to client)
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = target_email;

  -- User doesn't exist - return false (generic)
  IF target_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Already a member - return false (generic)
  IF EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id AND user_id = target_user_id
  ) THEN
    RETURN FALSE;
  END IF;

  -- Add member
  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (org_id, target_user_id, member_role);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 3. Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION check_user_for_invitation(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION add_member_by_email(TEXT, UUID, TEXT) TO authenticated;

-- 4. Drop the generic email lookup function
DROP FUNCTION IF EXISTS get_user_by_email(TEXT);

-- 5. Add comments
COMMENT ON FUNCTION check_user_for_invitation IS 'Admin-only: Check if email exists and is already an org member. Used for invitation flow.';
COMMENT ON FUNCTION add_member_by_email IS 'Admin-only: Add a user to an organization by email. Returns true if added, false otherwise (no info leak).';
