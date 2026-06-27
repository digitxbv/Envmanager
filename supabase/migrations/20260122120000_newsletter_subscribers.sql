-- =====================================================
-- Newsletter Subscribers Table
-- =====================================================
-- Stores email subscriptions for the marketing newsletter
-- Uses simple email storage with status tracking

-- Create newsletter_subscribers table
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced')),
    source TEXT, -- Where they signed up (blog, docs, homepage, etc.)
    ip_address INET, -- For rate limiting and fraud prevention
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unsubscribed_at TIMESTAMPTZ
);

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_email ON newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_status ON newsletter_subscribers(status);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_created_at ON newsletter_subscribers(created_at DESC);

-- Enable RLS
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anonymous inserts (for public signup)
CREATE POLICY "Allow anonymous newsletter signup"
    ON newsletter_subscribers
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- Policy: Allow authenticated users to view all subscribers (for admin)
CREATE POLICY "Allow authenticated users to view subscribers"
    ON newsletter_subscribers
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy: Allow subscribers to unsubscribe themselves (via email match)
-- Note: This would typically be handled via a secure unsubscribe link/token

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_newsletter_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trigger_newsletter_updated_at
    BEFORE UPDATE ON newsletter_subscribers
    FOR EACH ROW
    EXECUTE FUNCTION update_newsletter_updated_at();

-- Function to subscribe to newsletter (handles duplicates gracefully)
CREATE OR REPLACE FUNCTION subscribe_to_newsletter(
    p_email TEXT,
    p_source TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
    v_existing RECORD;
BEGIN
    -- Validate email format
    IF p_email IS NULL OR p_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Invalid email format'
        );
    END IF;

    -- Normalize email to lowercase
    p_email := LOWER(TRIM(p_email));

    -- Check if email already exists
    SELECT * INTO v_existing FROM newsletter_subscribers WHERE email = p_email;

    IF v_existing IS NOT NULL THEN
        -- If already subscribed and active, just return success
        IF v_existing.status = 'active' THEN
            RETURN json_build_object(
                'success', true,
                'message', 'Already subscribed',
                'new_subscriber', false
            );
        END IF;

        -- If previously unsubscribed, reactivate
        UPDATE newsletter_subscribers
        SET status = 'active',
            unsubscribed_at = NULL,
            source = COALESCE(p_source, source)
        WHERE email = p_email;

        RETURN json_build_object(
            'success', true,
            'message', 'Subscription reactivated',
            'new_subscriber', false
        );
    END IF;

    -- Insert new subscriber
    INSERT INTO newsletter_subscribers (email, source, ip_address)
    VALUES (p_email, p_source, p_ip_address);

    RETURN json_build_object(
        'success', true,
        'message', 'Successfully subscribed',
        'new_subscriber', true
    );
EXCEPTION
    WHEN unique_violation THEN
        -- Handle race condition
        RETURN json_build_object(
            'success', true,
            'message', 'Already subscribed',
            'new_subscriber', false
        );
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', 'An error occurred. Please try again.'
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anonymous users
GRANT EXECUTE ON FUNCTION subscribe_to_newsletter(TEXT, TEXT, INET) TO anon;
GRANT EXECUTE ON FUNCTION subscribe_to_newsletter(TEXT, TEXT, INET) TO authenticated;

-- Function to get newsletter stats (for admin dashboard)
CREATE OR REPLACE FUNCTION get_newsletter_stats()
RETURNS JSON AS $$
DECLARE
    v_total INTEGER;
    v_active INTEGER;
    v_unsubscribed INTEGER;
    v_last_7_days INTEGER;
    v_last_30_days INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total FROM newsletter_subscribers;
    SELECT COUNT(*) INTO v_active FROM newsletter_subscribers WHERE status = 'active';
    SELECT COUNT(*) INTO v_unsubscribed FROM newsletter_subscribers WHERE status = 'unsubscribed';
    SELECT COUNT(*) INTO v_last_7_days FROM newsletter_subscribers
        WHERE created_at > NOW() - INTERVAL '7 days' AND status = 'active';
    SELECT COUNT(*) INTO v_last_30_days FROM newsletter_subscribers
        WHERE created_at > NOW() - INTERVAL '30 days' AND status = 'active';

    RETURN json_build_object(
        'total', v_total,
        'active', v_active,
        'unsubscribed', v_unsubscribed,
        'last_7_days', v_last_7_days,
        'last_30_days', v_last_30_days
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only authenticated users can view stats
GRANT EXECUTE ON FUNCTION get_newsletter_stats() TO authenticated;
