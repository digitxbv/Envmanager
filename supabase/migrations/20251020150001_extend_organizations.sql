-- =====================================================
-- Extend Organizations Table for Billing
-- Migration: 20251020150001_extend_organizations.sql
-- Description: Add billing-related columns to organizations table
--              and create trigger for auto-subscription creation
-- =====================================================

-- Add billing-related columns to organizations
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS billing_email TEXT;

-- Create index for faster Stripe customer lookups
CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer_id
    ON organizations(stripe_customer_id)
    WHERE stripe_customer_id IS NOT NULL;

-- =====================================================
-- Auto-create Free Subscription for New Organizations
-- =====================================================

CREATE OR REPLACE FUNCTION create_free_subscription_for_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Create a free subscription for the new organization
    INSERT INTO organization_subscriptions (
        organization_id,
        plan_id,
        status,
        trial_start_date,
        trial_end_date
    ) VALUES (
        NEW.id,
        'free',
        'trialing',  -- Start with 14-day trial on Pro features
        NOW(),
        NOW() + INTERVAL '14 days'
    );

    -- Log the subscription creation
    INSERT INTO billing_events (
        organization_id,
        event_type,
        to_plan_id,
        details,
        triggered_by
    ) VALUES (
        NEW.id,
        'trial_started',
        'free',
        jsonb_build_object(
            'trial_days', 14,
            'auto_created', true
        ),
        auth.uid()
    );

    RETURN NEW;
END;
$$;

-- Create trigger to auto-create subscription
CREATE TRIGGER create_subscription_on_org_insert
    AFTER INSERT ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION create_free_subscription_for_org();

-- =====================================================
-- Backfill Existing Organizations
-- =====================================================
-- Create subscriptions for any organizations that don't have one

DO $$
DECLARE
    org_record RECORD;
BEGIN
    FOR org_record IN
        SELECT o.id
        FROM organizations o
        LEFT JOIN organization_subscriptions os ON o.id = os.organization_id
        WHERE os.id IS NULL
    LOOP
        -- Create free subscription for existing org
        INSERT INTO organization_subscriptions (
            organization_id,
            plan_id,
            status,
            trial_start_date,
            trial_end_date
        ) VALUES (
            org_record.id,
            'free',
            'trialing',
            NOW(),
            NOW() + INTERVAL '14 days'
        );

        -- Log the event
        INSERT INTO billing_events (
            organization_id,
            event_type,
            to_plan_id,
            details
        ) VALUES (
            org_record.id,
            'trial_started',
            'free',
            jsonb_build_object(
                'trial_days', 14,
                'backfilled', true
            )
        );
    END LOOP;
END $$;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON COLUMN organizations.stripe_customer_id IS 'Stripe Customer ID for billing operations';
COMMENT ON COLUMN organizations.billing_email IS 'Email address for billing communications (can differ from user email)';
