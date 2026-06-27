-- =====================================================
-- Lifecycle Retention Emails (Phase 2)
-- =====================================================

-- Log of every lifecycle email we've sent (idempotency + audit).
-- UNIQUE(user_id, email_type) guarantees a given email is sent at most once.
CREATE TABLE lifecycle_email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL CHECK (email_type IN ('welcome', 'how_to_pull', 'invite_team', 'trial_ending')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  provider_message_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('sent', 'suppressed')),
  UNIQUE (user_id, email_type)
);

-- Marketing-email suppression. Absent row = subscribed; timestamp present = unsubscribed.
CREATE TABLE email_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  marketing_unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Both tables are server-side only (lifecycle logic runs as service role).
ALTER TABLE lifecycle_email_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_preferences ENABLE ROW LEVEL SECURITY;
-- No policies for authenticated/anon: only the service role (which bypasses RLS) may touch these.

-- Returns the users due for a lifecycle email TODAY for days 1/3/11.
-- Welcome (day 0) is sent inline on signup and is never returned here.
CREATE OR REPLACE FUNCTION get_due_lifecycle_emails()
RETURNS TABLE (user_id UUID, email TEXT, email_type TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  -- Day 1: how-to-pull. Skip if the user's owned org has ever used a CLI key.
  SELECT u.id, u.email::TEXT, 'how_to_pull'::TEXT
  FROM auth.users u
  JOIN LATERAL (
    SELECT om.organization_id
    FROM organization_members om
    WHERE om.user_id = u.id AND om.role = 'owner'
    ORDER BY om.created_at ASC
    LIMIT 1
  ) owned ON TRUE
  WHERE u.created_at >= now() - INTERVAL '2 days'
    AND u.created_at <  now() - INTERVAL '1 days'
    AND NOT EXISTS (SELECT 1 FROM lifecycle_email_log l WHERE l.user_id = u.id AND l.email_type = 'how_to_pull')
    AND NOT EXISTS (SELECT 1 FROM email_preferences p WHERE p.user_id = u.id AND p.marketing_unsubscribed_at IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM api_keys ak WHERE ak.organization_id = owned.organization_id AND ak.last_used_at IS NOT NULL)

  UNION ALL
  -- Day 3: invite-team. Skip if org already has >1 member or any invitation sent.
  SELECT u.id, u.email::TEXT, 'invite_team'::TEXT
  FROM auth.users u
  JOIN LATERAL (
    SELECT om.organization_id
    FROM organization_members om
    WHERE om.user_id = u.id AND om.role = 'owner'
    ORDER BY om.created_at ASC
    LIMIT 1
  ) owned ON TRUE
  WHERE u.created_at >= now() - INTERVAL '4 days'
    AND u.created_at <  now() - INTERVAL '3 days'
    AND NOT EXISTS (SELECT 1 FROM lifecycle_email_log l WHERE l.user_id = u.id AND l.email_type = 'invite_team')
    AND NOT EXISTS (SELECT 1 FROM email_preferences p WHERE p.user_id = u.id AND p.marketing_unsubscribed_at IS NOT NULL)
    AND (SELECT count(*) FROM organization_members om2 WHERE om2.organization_id = owned.organization_id) = 1
    AND NOT EXISTS (SELECT 1 FROM organization_invitations oi WHERE oi.organization_id = owned.organization_id)

  UNION ALL
  -- Day 11: trial-ending. Only for still-trialing orgs whose trial ends within 3 days.
  SELECT u.id, u.email::TEXT, 'trial_ending'::TEXT
  FROM auth.users u
  JOIN LATERAL (
    SELECT om.organization_id
    FROM organization_members om
    WHERE om.user_id = u.id AND om.role = 'owner'
    ORDER BY om.created_at ASC
    LIMIT 1
  ) owned ON TRUE
  JOIN organization_subscriptions s ON s.organization_id = owned.organization_id
  WHERE u.created_at >= now() - INTERVAL '12 days'
    AND u.created_at <  now() - INTERVAL '11 days'
    AND NOT EXISTS (SELECT 1 FROM lifecycle_email_log l WHERE l.user_id = u.id AND l.email_type = 'trial_ending')
    AND NOT EXISTS (SELECT 1 FROM email_preferences p WHERE p.user_id = u.id AND p.marketing_unsubscribed_at IS NOT NULL)
    AND s.status = 'trialing'
    AND s.trial_end_date IS NOT NULL
    AND s.trial_end_date >= now()
    AND s.trial_end_date <= now() + INTERVAL '3 days';
END;
$$;

-- Lock down: SECURITY DEFINER functions are granted to PUBLIC by default.
-- Only the service role (which runs the lifecycle job) should call this.
REVOKE EXECUTE ON FUNCTION get_due_lifecycle_emails() FROM PUBLIC;
