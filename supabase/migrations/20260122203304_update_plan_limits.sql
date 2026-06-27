-- Update Free plan limits:
-- - 1 project (down from 3)
-- - Unlimited variables (up from 50)
-- - 1 integration (new limit)
UPDATE subscription_plans
SET
    limits = '{
        "projects": 1,
        "environments_per_project": 3,
        "variables_per_environment": -1,
        "team_members": 1,
        "integrations": 1,
        "audit_log_retention_days": 7
    }'::jsonb,
    description = 'Perfect for getting started with one project',
    updated_at = NOW()
WHERE id = 'free';

-- Update Pro Monthly plan: unlimited team members and integrations
UPDATE subscription_plans
SET
    limits = '{
        "projects": -1,
        "environments_per_project": -1,
        "variables_per_environment": -1,
        "team_members": -1,
        "integrations": -1,
        "audit_log_retention_days": 90
    }'::jsonb,
    description = 'Unlimited everything for professional teams',
    updated_at = NOW()
WHERE id = 'pro_monthly';

-- Update Pro Annual plan: unlimited team members and integrations
UPDATE subscription_plans
SET
    limits = '{
        "projects": -1,
        "environments_per_project": -1,
        "variables_per_environment": -1,
        "team_members": -1,
        "integrations": -1,
        "audit_log_retention_days": 365
    }'::jsonb,
    description = 'Unlimited everything for professional teams (17% off)',
    updated_at = NOW()
WHERE id = 'pro_annual';
