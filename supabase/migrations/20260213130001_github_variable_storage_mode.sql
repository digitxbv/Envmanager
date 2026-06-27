-- =====================================================
-- GITHUB VARIABLE STORAGE MODE
-- Migration: 20260213130001_github_variable_storage_mode.sql
-- Description: Adds project-level option for GitHub sync destination type
--              for regular variables.
-- =====================================================

ALTER TABLE github_project_sync_configs
ADD COLUMN variable_storage_mode TEXT NOT NULL DEFAULT 'preserve_types';

ALTER TABLE github_project_sync_configs
ADD CONSTRAINT github_project_sync_configs_variable_storage_mode_check
CHECK (variable_storage_mode IN ('preserve_types', 'all_as_secrets'));

COMMENT ON COLUMN github_project_sync_configs.variable_storage_mode IS
  'Controls destination type for non-secret variables: preserve_types (default) or all_as_secrets.';
