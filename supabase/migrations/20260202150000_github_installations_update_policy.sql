-- Add UPDATE policy for github_installations
-- Allows org owners/admins to disconnect (set uninstalled_at)

CREATE POLICY "Owners and admins can update GitHub installations"
    ON github_installations FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = github_installations.organization_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = github_installations.organization_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin')
        )
    );

-- Grant UPDATE permission
GRANT UPDATE ON github_installations TO authenticated;
