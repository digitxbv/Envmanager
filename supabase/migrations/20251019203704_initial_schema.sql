-- =====================================================
-- Initial Schema: Multi-tenant Environment Variable Management
-- =====================================================
-- Created: 2025-10-19
-- Description: Complete database schema with RLS for B2B SaaS app
--              Hierarchy: Organizations → Projects → Environments → Variables

-- =====================================================
-- Core Tables
-- =====================================================

-- Organizations (Top-level tenant boundary)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Organization Members (User membership with roles)
CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

-- Projects (Belong to organizations)
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Environments (Belong to projects AND have direct org_id FK for simplified RLS)
CREATE TABLE environments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Environment Access (Explicit user access grants per environment)
CREATE TABLE environment_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    granted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(environment_id, user_id)
);

-- Variables (Have both organization_id and environment_id FKs for simplified RLS)
CREATE TABLE variables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT,
    is_secret BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(environment_id, key)
);

-- Variable Audit Log (Full audit trail of all variable changes)
CREATE TABLE variable_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variable_id UUID REFERENCES variables(id) ON DELETE SET NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- Indexes for Performance
-- =====================================================

-- Organization Members
CREATE INDEX idx_organization_members_organization_id ON organization_members(organization_id);
CREATE INDEX idx_organization_members_user_id ON organization_members(user_id);

-- Projects
CREATE INDEX idx_projects_organization_id ON projects(organization_id);

-- Environments
CREATE INDEX idx_environments_project_id ON environments(project_id);
CREATE INDEX idx_environments_organization_id ON environments(organization_id);

-- Environment Access
CREATE INDEX idx_environment_access_environment_id ON environment_access(environment_id);
CREATE INDEX idx_environment_access_user_id ON environment_access(user_id);
CREATE INDEX idx_environment_access_organization_id ON environment_access(organization_id);

-- Variables
CREATE INDEX idx_variables_organization_id ON variables(organization_id);
CREATE INDEX idx_variables_environment_id ON variables(environment_id);
CREATE INDEX idx_variables_key ON variables(key);

-- Variable Audit Log
CREATE INDEX idx_variable_audit_log_variable_id ON variable_audit_log(variable_id);
CREATE INDEX idx_variable_audit_log_organization_id ON variable_audit_log(organization_id);
CREATE INDEX idx_variable_audit_log_environment_id ON variable_audit_log(environment_id);
CREATE INDEX idx_variable_audit_log_user_id ON variable_audit_log(user_id);
CREATE INDEX idx_variable_audit_log_created_at ON variable_audit_log(created_at DESC);

-- =====================================================
-- Helper Functions for RLS
-- =====================================================

-- Get User's Organization IDs
CREATE OR REPLACE FUNCTION get_user_organization_ids()
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
    SELECT organization_id
    FROM organization_members
    WHERE user_id = auth.uid();
$$;

-- Get User's Environment IDs
CREATE OR REPLACE FUNCTION get_user_environment_ids()
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
    SELECT environment_id
    FROM environment_access
    WHERE user_id = auth.uid();
$$;

-- =====================================================
-- Trigger Functions
-- =====================================================

-- Update Timestamp Trigger Function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Variable Audit Log Trigger Function
CREATE OR REPLACE FUNCTION log_variable_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    action_type TEXT;
    old_val TEXT;
    new_val TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        action_type := 'created';
        old_val := NULL;
        new_val := NEW.value;
    ELSIF TG_OP = 'UPDATE' THEN
        action_type := 'updated';
        old_val := OLD.value;
        new_val := NEW.value;
    ELSIF TG_OP = 'DELETE' THEN
        action_type := 'deleted';
        old_val := OLD.value;
        new_val := NULL;
    END IF;

    INSERT INTO variable_audit_log (
        variable_id,
        organization_id,
        environment_id,
        user_id,
        action,
        old_value,
        new_value
    ) VALUES (
        COALESCE(NEW.id, OLD.id),
        COALESCE(NEW.organization_id, OLD.organization_id),
        COALESCE(NEW.environment_id, OLD.environment_id),
        auth.uid(),
        action_type,
        old_val,
        new_val
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;



-- =====================================================
-- Triggers
-- =====================================================

CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_environments_updated_at
    BEFORE UPDATE ON environments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_variables_updated_at
    BEFORE UPDATE ON variables
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER log_variable_changes
    AFTER INSERT OR UPDATE OR DELETE ON variables
    FOR EACH ROW
    EXECUTE FUNCTION log_variable_change();

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE environment_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE variable_audit_log ENABLE ROW LEVEL SECURITY;

-- Organizations Policies
CREATE POLICY "Users can view their organizations"
    ON organizations FOR SELECT
    TO authenticated
    USING (id IN (SELECT get_user_organization_ids()));

CREATE POLICY "Users can insert organizations"
    ON organizations FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Organization owners and admins can update"
    ON organizations FOR UPDATE
    TO authenticated
    USING (
        id IN (
            SELECT organization_id
            FROM organization_members
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Organization owners can delete"
    ON organizations FOR DELETE
    TO authenticated
    USING (
        id IN (
            SELECT organization_id
            FROM organization_members
            WHERE user_id = auth.uid()
            AND role = 'owner'
        )
    );

-- Organization Members Policies
CREATE POLICY "Users can view organization members"
    ON organization_members FOR SELECT
    TO authenticated
    USING (organization_id IN (SELECT get_user_organization_ids()));

CREATE POLICY "Organization owners and admins can insert members"
    ON organization_members FOR INSERT
    TO authenticated
    WITH CHECK (
        organization_id IN (
            SELECT organization_id
            FROM organization_members
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Organization owners and admins can update members"
    ON organization_members FOR UPDATE
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id
            FROM organization_members
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Organization owners and admins can delete members"
    ON organization_members FOR DELETE
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id
            FROM organization_members
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    );

-- Projects Policies
CREATE POLICY "Users can view organization projects"
    ON projects FOR SELECT
    TO authenticated
    USING (organization_id IN (SELECT get_user_organization_ids()));

CREATE POLICY "Organization members can insert projects"
    ON projects FOR INSERT
    TO authenticated
    WITH CHECK (organization_id IN (SELECT get_user_organization_ids()));

CREATE POLICY "Organization owners and admins can update projects"
    ON projects FOR UPDATE
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id
            FROM organization_members
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Organization owners and admins can delete projects"
    ON projects FOR DELETE
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id
            FROM organization_members
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    );

-- Environments Policies
CREATE POLICY "Users can view environments in accessible organizations"
    ON environments FOR SELECT
    TO authenticated
    USING (organization_id IN (SELECT get_user_organization_ids()));

CREATE POLICY "Organization members can insert environments"
    ON environments FOR INSERT
    TO authenticated
    WITH CHECK (organization_id IN (SELECT get_user_organization_ids()));

CREATE POLICY "Organization owners and admins can update environments"
    ON environments FOR UPDATE
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id
            FROM organization_members
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Organization owners and admins can delete environments"
    ON environments FOR DELETE
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id
            FROM organization_members
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    );

-- Environment Access Policies
CREATE POLICY "Users can view environment access in their organizations"
    ON environment_access FOR SELECT
    TO authenticated
    USING (organization_id IN (SELECT get_user_organization_ids()));

CREATE POLICY "Org admins can grant environment access"
    ON environment_access FOR INSERT
    TO authenticated
    WITH CHECK (
        organization_id IN (
            SELECT organization_id
            FROM organization_members
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Org admins can revoke environment access"
    ON environment_access FOR DELETE
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id
            FROM organization_members
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    );

-- Variables Policies (Dual-check: org access AND environment access)
CREATE POLICY "Users can view variables in accessible environments"
    ON variables FOR SELECT
    TO authenticated
    USING (
        organization_id IN (SELECT get_user_organization_ids())
        AND environment_id IN (SELECT get_user_environment_ids())
    );

CREATE POLICY "Users can insert variables in accessible environments"
    ON variables FOR INSERT
    TO authenticated
    WITH CHECK (
        organization_id IN (SELECT get_user_organization_ids())
        AND environment_id IN (SELECT get_user_environment_ids())
    );

CREATE POLICY "Users can update variables in accessible environments"
    ON variables FOR UPDATE
    TO authenticated
    USING (
        organization_id IN (SELECT get_user_organization_ids())
        AND environment_id IN (SELECT get_user_environment_ids())
    );

CREATE POLICY "Users can delete variables in accessible environments"
    ON variables FOR DELETE
    TO authenticated
    USING (
        organization_id IN (SELECT get_user_organization_ids())
        AND environment_id IN (SELECT get_user_environment_ids())
    );

-- Variable Audit Log Policies (Read-only)
CREATE POLICY "Users can view audit logs for their organizations"
    ON variable_audit_log FOR SELECT
    TO authenticated
    USING (organization_id IN (SELECT get_user_organization_ids()));

-- =====================================================
-- Grants
-- =====================================================

GRANT EXECUTE ON FUNCTION get_user_organization_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_environment_ids() TO authenticated;

GRANT ALL ON organizations TO authenticated;
GRANT ALL ON organization_members TO authenticated;
GRANT ALL ON projects TO authenticated;
GRANT ALL ON environments TO authenticated;
GRANT ALL ON environment_access TO authenticated;
GRANT ALL ON variables TO authenticated;
GRANT SELECT ON variable_audit_log TO authenticated;
