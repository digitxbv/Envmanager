-- =====================================================
-- Platform Admin: Integration Read Access
-- Allows platform admins to view integrations across all orgs
-- =====================================================

CREATE POLICY "Platform admins can view all integrations"
  ON platform_integrations FOR SELECT
  TO authenticated
  USING ((SELECT is_platform_admin()));

CREATE POLICY "Platform admins can view all GitHub installations"
  ON github_installations FOR SELECT
  TO authenticated
  USING ((SELECT is_platform_admin()));
