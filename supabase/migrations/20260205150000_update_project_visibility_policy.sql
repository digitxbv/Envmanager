-- Migration: Update project visibility policy
-- Users only see projects where they have environment access, unless owner/admin

-- Drop existing policy
DROP POLICY IF EXISTS "Users can view organization projects" ON projects;

-- New policy: owner/admin see all, others see only projects with env access
CREATE POLICY "Users can view accessible projects"
    ON projects FOR SELECT
    TO authenticated
    USING (
        organization_id IN (SELECT get_user_organization_ids())
        AND (
            -- Owner/admin can see all projects in their org
            EXISTS (
                SELECT 1 FROM organization_members om
                WHERE om.organization_id = projects.organization_id
                AND om.user_id = auth.uid()
                AND om.role IN ('owner', 'admin')
            )
            OR
            -- Others only see projects where they have env access
            EXISTS (
                SELECT 1 FROM environments e
                JOIN environment_access ea ON ea.environment_id = e.id
                WHERE e.project_id = projects.id
                AND ea.user_id = auth.uid()
            )
        )
    );
