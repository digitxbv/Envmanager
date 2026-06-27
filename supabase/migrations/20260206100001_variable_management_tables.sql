-- Migration: Variable Management — New Tables
-- PRDs: 03 (Naming Conventions), 04 (Version History/Snapshots), 02 (Access Tracking)

-- 1. Naming Conventions table
CREATE TABLE naming_conventions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  rules JSONB NOT NULL,
  enforcement_mode TEXT NOT NULL DEFAULT 'warn' CHECK (enforcement_mode IN ('warn', 'block')),
  template_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Unique index using COALESCE to treat NULL project_id as a single org-level entry
CREATE UNIQUE INDEX idx_naming_conventions_org_project
  ON naming_conventions (organization_id, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'));

-- 2. Environment Snapshots table
CREATE TABLE environment_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  snapshot_data JSONB NOT NULL,
  variable_count INTEGER NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Variable Access Log table
CREATE TABLE variable_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variable_id UUID REFERENCES variables(id) ON DELETE SET NULL,
  environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  access_type TEXT NOT NULL CHECK (access_type IN ('cli_pull', 'api_fetch', 'web_view', 'web_decrypt')),
  accessed_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB
);
