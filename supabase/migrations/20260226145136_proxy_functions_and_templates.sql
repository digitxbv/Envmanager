-- =====================================================
-- PROXY FUNCTIONS & TEMPLATES
-- Migration: 20260226145136_proxy_functions_and_templates.sql
-- Description: Add proxy_templates (global admin-managed), proxy_functions (org-scoped),
--              proxy_function_audit_log, proxy_invocations, RLS policies, indexes,
--              triggers, and increment_proxy_invocation RPC
-- =====================================================

-- Required for gen_random_bytes()
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- =====================================================
-- 1. proxy_templates table (global, admin-managed)
-- =====================================================

CREATE TABLE proxy_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,
    category TEXT NOT NULL DEFAULT 'general',

    -- Pre-fill config
    target_url TEXT NOT NULL,
    http_method TEXT NOT NULL DEFAULT 'POST' CHECK (http_method IN ('GET', 'POST', 'PUT', 'DELETE')),
    target_headers JSONB NOT NULL DEFAULT '{}',
    secret_hints JSONB NOT NULL DEFAULT '[]',
    request_body_template JSONB,
    pass_through_body BOOLEAN NOT NULL DEFAULT true,

    -- Admin
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_proxy_templates_active ON proxy_templates(is_active, sort_order);
CREATE INDEX idx_proxy_templates_category ON proxy_templates(category);

CREATE TRIGGER proxy_templates_updated_at
    BEFORE UPDATE ON proxy_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS for proxy_templates
ALTER TABLE proxy_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proxy_templates_select" ON proxy_templates
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "proxy_templates_insert" ON proxy_templates
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT is_platform_admin()));

CREATE POLICY "proxy_templates_update" ON proxy_templates
    FOR UPDATE TO authenticated
    USING ((SELECT is_platform_admin()))
    WITH CHECK ((SELECT is_platform_admin()));

CREATE POLICY "proxy_templates_delete" ON proxy_templates
    FOR DELETE TO authenticated
    USING ((SELECT is_platform_admin()));

CREATE POLICY "proxy_templates_service_role" ON proxy_templates
    FOR ALL USING (auth.role() = 'service_role');

GRANT SELECT ON proxy_templates TO authenticated;

-- =====================================================
-- 2. proxy_functions table (org-scoped)
-- =====================================================

CREATE TABLE proxy_functions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,

    -- Config
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,

    -- Target
    target_url TEXT NOT NULL,
    http_method TEXT NOT NULL DEFAULT 'POST' CHECK (http_method IN ('GET', 'POST', 'PUT', 'DELETE')),
    target_headers JSONB NOT NULL DEFAULT '{}',

    -- Secret injection
    secret_mappings JSONB NOT NULL DEFAULT '[]',

    -- Security
    secret_token TEXT NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
    allowed_origins JSONB NOT NULL DEFAULT '["*"]',

    -- Request config
    request_body_template JSONB,
    pass_through_body BOOLEAN NOT NULL DEFAULT true,

    -- Metadata
    template_id UUID REFERENCES proxy_templates(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(environment_id, slug)
);

CREATE INDEX idx_proxy_functions_org ON proxy_functions(organization_id);
CREATE INDEX idx_proxy_functions_env ON proxy_functions(environment_id);
CREATE INDEX idx_proxy_functions_enabled ON proxy_functions(environment_id, enabled);

CREATE TRIGGER proxy_functions_updated_at
    BEFORE UPDATE ON proxy_functions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS for proxy_functions (dual-check pattern)
ALTER TABLE proxy_functions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proxy_functions_select" ON proxy_functions
    FOR SELECT USING (
        organization_id IN (SELECT get_user_organization_ids())
        AND environment_id IN (SELECT get_user_environment_ids())
    );

CREATE POLICY "proxy_functions_insert" ON proxy_functions
    FOR INSERT WITH CHECK (
        organization_id IN (SELECT get_user_organization_ids())
        AND environment_id IN (SELECT get_user_environment_ids())
        AND EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_id = proxy_functions.organization_id
            AND user_id = auth.uid()
            AND role IN ('admin', 'owner')
        )
    );

CREATE POLICY "proxy_functions_update" ON proxy_functions
    FOR UPDATE USING (
        organization_id IN (SELECT get_user_organization_ids())
        AND environment_id IN (SELECT get_user_environment_ids())
        AND EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_id = proxy_functions.organization_id
            AND user_id = auth.uid()
            AND role IN ('admin', 'owner')
        )
    );

CREATE POLICY "proxy_functions_delete" ON proxy_functions
    FOR DELETE USING (
        organization_id IN (SELECT get_user_organization_ids())
        AND environment_id IN (SELECT get_user_environment_ids())
        AND EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_id = proxy_functions.organization_id
            AND user_id = auth.uid()
            AND role IN ('admin', 'owner')
        )
    );

CREATE POLICY "proxy_functions_service_role" ON proxy_functions
    FOR ALL USING (auth.role() = 'service_role');

GRANT SELECT, INSERT, UPDATE, DELETE ON proxy_functions TO authenticated;

-- =====================================================
-- 3. proxy_function_audit_log table
-- =====================================================

CREATE TABLE proxy_function_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proxy_function_id UUID NOT NULL,
    organization_id UUID NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'enabled', 'disabled')),
    changed_by UUID REFERENCES auth.users(id),
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_proxy_function_audit_log_proxy ON proxy_function_audit_log(proxy_function_id);
CREATE INDEX idx_proxy_function_audit_log_org ON proxy_function_audit_log(organization_id);

ALTER TABLE proxy_function_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proxy_function_audit_log_select" ON proxy_function_audit_log
    FOR SELECT TO authenticated
    USING (organization_id IN (SELECT get_user_organization_ids()));

CREATE POLICY "proxy_function_audit_log_service_role" ON proxy_function_audit_log
    FOR ALL USING (auth.role() = 'service_role');

GRANT SELECT ON proxy_function_audit_log TO authenticated;

-- Audit trigger function
CREATE OR REPLACE FUNCTION log_proxy_function_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    audit_action TEXT;
    audit_changes JSONB;
BEGIN
    IF TG_OP = 'INSERT' THEN
        audit_action := 'created';
        audit_changes := jsonb_build_object(
            'name', NEW.name,
            'slug', NEW.slug,
            'target_url', NEW.target_url,
            'http_method', NEW.http_method,
            'enabled', NEW.enabled
        );
    ELSIF TG_OP = 'UPDATE' THEN
        -- Check for enabled/disabled toggle specifically
        IF OLD.enabled != NEW.enabled THEN
            audit_action := CASE WHEN NEW.enabled THEN 'enabled' ELSE 'disabled' END;
        ELSE
            audit_action := 'updated';
        END IF;
        audit_changes := jsonb_build_object(
            'old', jsonb_build_object(
                'name', OLD.name,
                'slug', OLD.slug,
                'target_url', OLD.target_url,
                'http_method', OLD.http_method,
                'enabled', OLD.enabled,
                'allowed_origins', OLD.allowed_origins
            ),
            'new', jsonb_build_object(
                'name', NEW.name,
                'slug', NEW.slug,
                'target_url', NEW.target_url,
                'http_method', NEW.http_method,
                'enabled', NEW.enabled,
                'allowed_origins', NEW.allowed_origins
            )
        );
    ELSIF TG_OP = 'DELETE' THEN
        audit_action := 'deleted';
        audit_changes := jsonb_build_object(
            'name', OLD.name,
            'slug', OLD.slug,
            'target_url', OLD.target_url
        );
    END IF;

    INSERT INTO proxy_function_audit_log (
        proxy_function_id,
        organization_id,
        action,
        changed_by,
        changes
    ) VALUES (
        COALESCE(NEW.id, OLD.id),
        COALESCE(NEW.organization_id, OLD.organization_id),
        audit_action,
        auth.uid(),
        audit_changes
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

CREATE TRIGGER log_proxy_function_changes
    AFTER INSERT OR UPDATE OR DELETE ON proxy_functions
    FOR EACH ROW
    EXECUTE FUNCTION log_proxy_function_change();

-- =====================================================
-- 4. proxy_invocations table (usage tracking)
-- =====================================================

CREATE TABLE proxy_invocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proxy_function_id UUID NOT NULL REFERENCES proxy_functions(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    period TEXT NOT NULL,
    call_count INTEGER NOT NULL DEFAULT 0,
    last_called_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(proxy_function_id, period)
);

CREATE INDEX idx_proxy_invocations_org_period ON proxy_invocations(organization_id, period);

CREATE TRIGGER proxy_invocations_updated_at
    BEFORE UPDATE ON proxy_invocations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS: service role only
ALTER TABLE proxy_invocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proxy_invocations_select" ON proxy_invocations
    FOR SELECT TO authenticated
    USING (organization_id IN (SELECT get_user_organization_ids()));

CREATE POLICY "proxy_invocations_service_role" ON proxy_invocations
    FOR ALL USING (auth.role() = 'service_role');

GRANT SELECT ON proxy_invocations TO authenticated;

-- =====================================================
-- 5. increment_proxy_invocation RPC
-- =====================================================

CREATE OR REPLACE FUNCTION increment_proxy_invocation(
    p_proxy_function_id UUID,
    p_organization_id UUID,
    p_monthly_limit INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    current_period TEXT := to_char(now(), 'YYYY-MM');
    current_count INTEGER;
BEGIN
    INSERT INTO proxy_invocations (proxy_function_id, organization_id, period, call_count, last_called_at)
    VALUES (p_proxy_function_id, p_organization_id, current_period, 1, now())
    ON CONFLICT (proxy_function_id, period)
    DO UPDATE SET call_count = proxy_invocations.call_count + 1, last_called_at = now(), updated_at = now()
    RETURNING call_count INTO current_count;

    -- Return true if under limit, false if exceeded
    RETURN current_count <= p_monthly_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. Update billing plan limits
-- =====================================================

UPDATE subscription_plans
SET
    limits = limits || '{"proxy_functions": 3, "proxy_invocations_monthly": 500}'::jsonb,
    updated_at = NOW()
WHERE id = 'free';

UPDATE subscription_plans
SET
    limits = limits || '{"proxy_functions": 25, "proxy_invocations_monthly": 5000}'::jsonb,
    updated_at = NOW()
WHERE id = 'pro_monthly';

UPDATE subscription_plans
SET
    limits = limits || '{"proxy_functions": 25, "proxy_invocations_monthly": 5000}'::jsonb,
    updated_at = NOW()
WHERE id = 'pro_annual';

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE proxy_templates IS 'Global admin-managed templates that pre-fill the proxy creation wizard';
COMMENT ON TABLE proxy_functions IS 'Organization-scoped proxy function configurations, tied to environments';
COMMENT ON TABLE proxy_function_audit_log IS 'Audit trail for proxy function create/update/delete/enable/disable actions';
COMMENT ON TABLE proxy_invocations IS 'Monthly invocation counters per proxy function for usage tracking and billing limits';
COMMENT ON FUNCTION increment_proxy_invocation(UUID, UUID, INTEGER) IS 'Atomically increment invocation counter and check against monthly limit. Returns true if under limit.';
