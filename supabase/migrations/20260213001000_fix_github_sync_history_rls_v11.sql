-- =====================================================
-- Fix github_sync_history RLS for v1.1 architecture
-- =====================================================
-- v1.1 writes sync history rows with env_config_id, while legacy rows used
-- sync_config_id. The original SELECT policy only checked sync_config_id,
-- which hides new rows from authenticated users.

DROP POLICY IF EXISTS "Users can view sync history for accessible environments"
  ON github_sync_history;

CREATE POLICY "Users can view sync history for accessible environments"
  ON github_sync_history FOR SELECT
  TO authenticated
  USING (
    (
      env_config_id IS NOT NULL
      AND env_config_id IN (
        SELECT gec.id
        FROM github_environment_configs gec
        WHERE gec.environment_id IN (SELECT get_user_environment_ids())
      )
    )
    OR
    (
      sync_config_id IS NOT NULL
      AND sync_config_id IN (
        SELECT gsc.id
        FROM github_sync_configs gsc
        WHERE gsc.environment_id IN (SELECT get_user_environment_ids())
      )
    )
  );
