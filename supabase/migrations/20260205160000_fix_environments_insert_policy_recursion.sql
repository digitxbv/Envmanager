-- Migration: Fix infinite recursion in environments INSERT policy
-- Problem: environments INSERT policy joins projects, but projects SELECT policy joins environments
-- Solution: Use organization_id directly on environments table instead of joining through projects

-- Drop the problematic policy
DROP POLICY IF EXISTS "Non-viewers can create environments" ON environments;

-- New policy using organization_id directly (no circular dependency)
CREATE POLICY "Non-viewers can create environments"
ON environments FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid()
    AND role != 'viewer'
  )
);
