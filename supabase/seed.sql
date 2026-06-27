-- Update Stripe Price IDs for test/development (FALLBACK only)
-- Primary price resolution uses Stripe lookup keys equal to the plan id ('pro_monthly', 'pro_annual').
-- These DB values are only used when the lookup key is not set on the Stripe price (e.g. live mode pending).
-- pro_monthly: $9/month USD on "EnvManager Pro (Monthly)" (prod_THhTyJhTXLFdhE)
-- pro_annual:  $90/year USD on "EnvManager Pro (Annual)"  (prod_THhUc4BnKgiRUb)
UPDATE "public"."subscription_plans"
SET stripe_price_id = 'price_1SsVsqH1cVpr7e6a550D7rlb', updated_at = NOW()
WHERE id = 'pro_monthly';

UPDATE "public"."subscription_plans"
SET stripe_price_id = 'price_1ThGAKH1cVpr7e6agV8Bp67s', updated_at = NOW()
WHERE id = 'pro_annual';

-- =====================================================
-- SEED DATA: Test User with Organization, Project, Environments
-- =====================================================

-- Create test user (owner@example.com / Test12345678!)
-- Use PostgreSQL's crypt() to generate bcrypt hash
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  role,
  aud,
  confirmation_token,
  recovery_token,
  email_change,
  email_change_token_new,
  email_change_token_current,
  phone_change,
  phone_change_token,
  reauthentication_token,
  is_sso_user,
  is_anonymous
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  '00000000-0000-0000-0000-000000000000',
  'owner@example.com',
  crypt('Test12345678!', gen_salt('bf')),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Owner User"}',
  NOW(),
  NOW(),
  'authenticated',
  'authenticated',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  false,
  false
) ON CONFLICT (id) DO NOTHING;

-- Create identities entry for the user (required for auth to work)
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  created_at,
  updated_at,
  last_sign_in_at
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  '{"sub": "a1b2c3d4-e5f6-7890-abcd-ef1234567890", "email": "owner@example.com"}',
  'email',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  NOW(),
  NOW(),
  NOW()
) ON CONFLICT (provider, provider_id) DO NOTHING;

-- Disable billing trigger during seed (it requires auth.uid())
ALTER TABLE organizations DISABLE TRIGGER create_subscription_on_org_insert;

-- Create organization
INSERT INTO organizations (id, name)
VALUES ('11111111-1111-1111-1111-111111111111', 'DigitX Test Org')
ON CONFLICT (id) DO NOTHING;

-- Re-enable trigger
ALTER TABLE organizations ENABLE TRIGGER create_subscription_on_org_insert;

-- Manually create the subscription (since trigger was disabled)
-- Use pro_monthly for trial to match production behavior
INSERT INTO organization_subscriptions (organization_id, plan_id, status, trial_start_date, trial_end_date)
VALUES ('11111111-1111-1111-1111-111111111111', 'pro_monthly', 'trialing', NOW(), NOW() + INTERVAL '14 days')
ON CONFLICT (organization_id) DO NOTHING;

-- Link user to organization as owner
INSERT INTO organization_members (organization_id, user_id, role)
VALUES ('11111111-1111-1111-1111-111111111111', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'owner')
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- =====================================================
-- Additional test users (same org, no environment access)
-- Password for all: Test12345678!
-- =====================================================

-- Admin user: admin@example.com
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  role, aud, confirmation_token, recovery_token, email_change,
  email_change_token_new, email_change_token_current, phone_change,
  phone_change_token, reauthentication_token, is_sso_user, is_anonymous
) VALUES (
  'b2c3d4e5-f6a7-8901-bcde-f23456789012',
  '00000000-0000-0000-0000-000000000000',
  'admin@example.com',
  crypt('Test12345678!', gen_salt('bf')),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Admin User"}',
  NOW(), NOW(), 'authenticated', 'authenticated',
  '', '', '', '', '', '', '', '', false, false
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, created_at, updated_at, last_sign_in_at)
VALUES (
  'b2c3d4e5-f6a7-8901-bcde-f23456789012',
  'b2c3d4e5-f6a7-8901-bcde-f23456789012',
  '{"sub": "b2c3d4e5-f6a7-8901-bcde-f23456789012", "email": "admin@example.com"}',
  'email', 'b2c3d4e5-f6a7-8901-bcde-f23456789012', NOW(), NOW(), NOW()
) ON CONFLICT (provider, provider_id) DO NOTHING;

INSERT INTO organization_members (organization_id, user_id, role)
VALUES ('11111111-1111-1111-1111-111111111111', 'b2c3d4e5-f6a7-8901-bcde-f23456789012', 'admin')
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Viewer user: viewer@example.com
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  role, aud, confirmation_token, recovery_token, email_change,
  email_change_token_new, email_change_token_current, phone_change,
  phone_change_token, reauthentication_token, is_sso_user, is_anonymous
) VALUES (
  'c3d4e5f6-a7b8-9012-cdef-345678901234',
  '00000000-0000-0000-0000-000000000000',
  'viewer@example.com',
  crypt('Test12345678!', gen_salt('bf')),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Viewer User"}',
  NOW(), NOW(), 'authenticated', 'authenticated',
  '', '', '', '', '', '', '', '', false, false
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, created_at, updated_at, last_sign_in_at)
VALUES (
  'c3d4e5f6-a7b8-9012-cdef-345678901234',
  'c3d4e5f6-a7b8-9012-cdef-345678901234',
  '{"sub": "c3d4e5f6-a7b8-9012-cdef-345678901234", "email": "viewer@example.com"}',
  'email', 'c3d4e5f6-a7b8-9012-cdef-345678901234', NOW(), NOW(), NOW()
) ON CONFLICT (provider, provider_id) DO NOTHING;

INSERT INTO organization_members (organization_id, user_id, role)
VALUES ('11111111-1111-1111-1111-111111111111', 'c3d4e5f6-a7b8-9012-cdef-345678901234', 'viewer')
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Member user: member@example.com
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  role, aud, confirmation_token, recovery_token, email_change,
  email_change_token_new, email_change_token_current, phone_change,
  phone_change_token, reauthentication_token, is_sso_user, is_anonymous
) VALUES (
  'd4e5f6a7-b8c9-0123-def0-456789012345',
  '00000000-0000-0000-0000-000000000000',
  'member@example.com',
  crypt('Test12345678!', gen_salt('bf')),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Member User"}',
  NOW(), NOW(), 'authenticated', 'authenticated',
  '', '', '', '', '', '', '', '', false, false
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, created_at, updated_at, last_sign_in_at)
VALUES (
  'd4e5f6a7-b8c9-0123-def0-456789012345',
  'd4e5f6a7-b8c9-0123-def0-456789012345',
  '{"sub": "d4e5f6a7-b8c9-0123-def0-456789012345", "email": "member@example.com"}',
  'email', 'd4e5f6a7-b8c9-0123-def0-456789012345', NOW(), NOW(), NOW()
) ON CONFLICT (provider, provider_id) DO NOTHING;

INSERT INTO organization_members (organization_id, user_id, role)
VALUES ('11111111-1111-1111-1111-111111111111', 'd4e5f6a7-b8c9-0123-def0-456789012345', 'member')
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Create project
INSERT INTO projects (id, organization_id, name, description)
VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Test Project', 'A test project for development')
ON CONFLICT (id) DO NOTHING;

-- Create environments
INSERT INTO environments (id, project_id, organization_id, name)
VALUES
  ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'development'),
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'production')
ON CONFLICT (id) DO NOTHING;

-- Grant environment access to user
INSERT INTO environment_access (environment_id, organization_id, user_id, granted_by)
VALUES
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890')
ON CONFLICT (environment_id, user_id) DO NOTHING;

-- Disable audit log trigger during seed (requires auth.uid())
ALTER TABLE variables DISABLE TRIGGER log_variable_changes;

-- Create variables for DEVELOPMENT environment
-- Normal variables
INSERT INTO variables (organization_id, environment_id, key, value, is_secret)
VALUES
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'APP_NAME', 'EnvManager Dev', false),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'DEBUG_MODE', 'true', false)
ON CONFLICT (environment_id, key) WHERE service_id IS NULL DO NOTHING;

-- Secret variables (vault trigger handles encryption automatically)
INSERT INTO variables (organization_id, environment_id, key, value, is_secret)
VALUES
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'API_KEY', 'dev-secret-api-key-12345', true),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'DATABASE_URL', 'postgres://dev:secret@localhost:5432/devdb', true),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'BREVO_API_KEY', 'PLACEHOLDER_BREVO_KEY', true)
ON CONFLICT (environment_id, key) WHERE service_id IS NULL DO NOTHING;

-- Create variables for PRODUCTION environment
-- Normal variables
INSERT INTO variables (organization_id, environment_id, key, value, is_secret)
VALUES
  ('11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 'APP_NAME', 'EnvManager Prod', false),
  ('11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 'DEBUG_MODE', 'false', false)
ON CONFLICT (environment_id, key) WHERE service_id IS NULL DO NOTHING;

-- Secret variables
INSERT INTO variables (organization_id, environment_id, key, value, is_secret)
VALUES
  ('11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 'API_KEY', 'prod-secret-api-key-67890', true),
  ('11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 'DATABASE_URL', 'postgres://prod:supersecret@db.prod.com:5432/proddb', true)
ON CONFLICT (environment_id, key) WHERE service_id IS NULL DO NOTHING;

-- Re-enable audit log trigger
ALTER TABLE variables ENABLE TRIGGER log_variable_changes;

-- =====================================================
-- SEED DATA: Platform Admin
-- =====================================================

INSERT INTO platform_admins (user_id)
VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
ON CONFLICT (user_id) DO NOTHING;

-- =====================================================
-- SEED DATA: Default Proxy Templates
-- =====================================================

INSERT INTO proxy_templates (name, slug, description, icon, category, target_url, http_method, target_headers, secret_hints, pass_through_body, sort_order)
VALUES (
    'Brevo',
    'brevo',
    'Send transactional emails via the Brevo (formerly Sendinblue) API',
    'lucide:mail',
    'email',
    'https://api.brevo.com/v3/smtp/email',
    'POST',
    '{"Content-Type": "application/json", "Accept": "application/json"}',
    '[{"inject_as": "header", "key": "api-key", "variable_name_hint": "BREVO_API_KEY"}]',
    true,
    0
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO proxy_templates (name, slug, description, icon, category, target_url, http_method, target_headers, secret_hints, pass_through_body, sort_order)
VALUES (
    'Stripe',
    'stripe',
    'Create charges and manage payments via the Stripe API',
    'lucide:credit-card',
    'payment',
    'https://api.stripe.com/v1/charges',
    'POST',
    '{"Content-Type": "application/x-www-form-urlencoded"}',
    '[{"inject_as": "header", "key": "Authorization", "template": "Bearer ${value}", "variable_name_hint": "STRIPE_SECRET_KEY"}]',
    true,
    1
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO proxy_templates (name, slug, description, icon, category, target_url, http_method, target_headers, secret_hints, pass_through_body, sort_order)
VALUES (
    'OpenAI',
    'openai',
    'Send chat completion requests to the OpenAI API',
    'lucide:brain',
    'ai',
    'https://api.openai.com/v1/chat/completions',
    'POST',
    '{"Content-Type": "application/json"}',
    '[{"inject_as": "header", "key": "Authorization", "template": "Bearer ${value}", "variable_name_hint": "OPENAI_API_KEY"}]',
    true,
    2
) ON CONFLICT (slug) DO NOTHING;

-- Email: SendGrid
INSERT INTO proxy_templates (name, slug, description, icon, category, target_url, http_method, target_headers, secret_hints, pass_through_body, sort_order)
VALUES (
    'SendGrid',
    'sendgrid',
    'Send transactional emails via the Twilio SendGrid API',
    'lucide:send',
    'email',
    'https://api.sendgrid.com/v3/mail/send',
    'POST',
    '{"Content-Type": "application/json"}',
    '[{"inject_as": "header", "key": "Authorization", "template": "Bearer ${value}", "variable_name_hint": "SENDGRID_API_KEY"}]',
    true,
    3
) ON CONFLICT (slug) DO NOTHING;

-- Email: Resend
INSERT INTO proxy_templates (name, slug, description, icon, category, target_url, http_method, target_headers, secret_hints, pass_through_body, sort_order)
VALUES (
    'Resend',
    'resend',
    'Send transactional emails via the Resend API',
    'lucide:mail-plus',
    'email',
    'https://api.resend.com/emails',
    'POST',
    '{"Content-Type": "application/json"}',
    '[{"inject_as": "header", "key": "Authorization", "template": "Bearer ${value}", "variable_name_hint": "RESEND_API_KEY"}]',
    true,
    4
) ON CONFLICT (slug) DO NOTHING;

-- Email: Postmark
INSERT INTO proxy_templates (name, slug, description, icon, category, target_url, http_method, target_headers, secret_hints, pass_through_body, sort_order)
VALUES (
    'Postmark',
    'postmark',
    'Send transactional emails via the Postmark API',
    'lucide:mail-check',
    'email',
    'https://api.postmarkapp.com/email',
    'POST',
    '{"Content-Type": "application/json", "Accept": "application/json"}',
    '[{"inject_as": "header", "key": "X-Postmark-Server-Token", "variable_name_hint": "POSTMARK_SERVER_TOKEN"}]',
    true,
    5
) ON CONFLICT (slug) DO NOTHING;

-- AI: Anthropic Claude
INSERT INTO proxy_templates (name, slug, description, icon, category, target_url, http_method, target_headers, secret_hints, pass_through_body, sort_order)
VALUES (
    'Anthropic Claude',
    'anthropic',
    'Send messages to the Anthropic Claude API',
    'lucide:bot',
    'ai',
    'https://api.anthropic.com/v1/messages',
    'POST',
    '{"Content-Type": "application/json", "anthropic-version": "2023-06-01"}',
    '[{"inject_as": "header", "key": "x-api-key", "variable_name_hint": "ANTHROPIC_API_KEY"}]',
    true,
    6
) ON CONFLICT (slug) DO NOTHING;

-- AI: Mistral
INSERT INTO proxy_templates (name, slug, description, icon, category, target_url, http_method, target_headers, secret_hints, pass_through_body, sort_order)
VALUES (
    'Mistral',
    'mistral',
    'Send chat completion requests to the Mistral AI API',
    'lucide:wind',
    'ai',
    'https://api.mistral.ai/v1/chat/completions',
    'POST',
    '{"Content-Type": "application/json"}',
    '[{"inject_as": "header", "key": "Authorization", "template": "Bearer ${value}", "variable_name_hint": "MISTRAL_API_KEY"}]',
    true,
    7
) ON CONFLICT (slug) DO NOTHING;

-- AI: Groq
INSERT INTO proxy_templates (name, slug, description, icon, category, target_url, http_method, target_headers, secret_hints, pass_through_body, sort_order)
VALUES (
    'Groq',
    'groq',
    'Send chat completion requests to the Groq API (OpenAI-compatible)',
    'lucide:zap',
    'ai',
    'https://api.groq.com/openai/v1/chat/completions',
    'POST',
    '{"Content-Type": "application/json"}',
    '[{"inject_as": "header", "key": "Authorization", "template": "Bearer ${value}", "variable_name_hint": "GROQ_API_KEY"}]',
    true,
    8
) ON CONFLICT (slug) DO NOTHING;

-- Payment: Paddle
INSERT INTO proxy_templates (name, slug, description, icon, category, target_url, http_method, target_headers, secret_hints, pass_through_body, sort_order)
VALUES (
    'Paddle',
    'paddle',
    'Create transactions via the Paddle billing API',
    'lucide:receipt',
    'payment',
    'https://api.paddle.com/transactions',
    'POST',
    '{"Content-Type": "application/json"}',
    '[{"inject_as": "header", "key": "Authorization", "template": "Bearer ${value}", "variable_name_hint": "PADDLE_API_KEY"}]',
    true,
    9
) ON CONFLICT (slug) DO NOTHING;

-- Payment: LemonSqueezy
INSERT INTO proxy_templates (name, slug, description, icon, category, target_url, http_method, target_headers, secret_hints, pass_through_body, sort_order)
VALUES (
    'LemonSqueezy',
    'lemonsqueezy',
    'Create checkouts via the Lemon Squeezy API',
    'lucide:shopping-cart',
    'payment',
    'https://api.lemonsqueezy.com/v1/checkouts',
    'POST',
    '{"Content-Type": "application/vnd.api+json", "Accept": "application/vnd.api+json"}',
    '[{"inject_as": "header", "key": "Authorization", "template": "Bearer ${value}", "variable_name_hint": "LEMONSQUEEZY_API_KEY"}]',
    true,
    10
) ON CONFLICT (slug) DO NOTHING;

-- Payment: Mollie
INSERT INTO proxy_templates (name, slug, description, icon, category, target_url, http_method, target_headers, secret_hints, pass_through_body, sort_order)
VALUES (
    'Mollie',
    'mollie',
    'Create payments via the Mollie API',
    'lucide:wallet',
    'payment',
    'https://api.mollie.com/v2/payments',
    'POST',
    '{"Content-Type": "application/json"}',
    '[{"inject_as": "header", "key": "Authorization", "template": "Bearer ${value}", "variable_name_hint": "MOLLIE_API_KEY"}]',
    true,
    11
) ON CONFLICT (slug) DO NOTHING;

-- Support: Intercom
INSERT INTO proxy_templates (name, slug, description, icon, category, target_url, http_method, target_headers, secret_hints, pass_through_body, sort_order)
VALUES (
    'Intercom',
    'intercom',
    'Send messages and create conversations via the Intercom API',
    'lucide:message-circle',
    'support',
    'https://api.intercom.io/messages',
    'POST',
    '{"Content-Type": "application/json", "Intercom-Version": "2.15"}',
    '[{"inject_as": "header", "key": "Authorization", "template": "Bearer ${value}", "variable_name_hint": "INTERCOM_ACCESS_TOKEN"}]',
    true,
    12
) ON CONFLICT (slug) DO NOTHING;

-- CRM: HubSpot
INSERT INTO proxy_templates (name, slug, description, icon, category, target_url, http_method, target_headers, secret_hints, pass_through_body, sort_order)
VALUES (
    'HubSpot',
    'hubspot',
    'Create contacts and manage CRM objects via the HubSpot API',
    'lucide:users',
    'crm',
    'https://api.hubapi.com/crm/v3/objects/contacts',
    'POST',
    '{"Content-Type": "application/json"}',
    '[{"inject_as": "header", "key": "Authorization", "template": "Bearer ${value}", "variable_name_hint": "HUBSPOT_ACCESS_TOKEN"}]',
    true,
    13
) ON CONFLICT (slug) DO NOTHING;

-- Notifications: OneSignal
INSERT INTO proxy_templates (name, slug, description, icon, category, target_url, http_method, target_headers, secret_hints, pass_through_body, sort_order)
VALUES (
    'OneSignal',
    'onesignal',
    'Send push notifications via the OneSignal API',
    'lucide:bell',
    'notifications',
    'https://api.onesignal.com/notifications',
    'POST',
    '{"Content-Type": "application/json"}',
    '[{"inject_as": "header", "key": "Authorization", "template": "Key ${value}", "variable_name_hint": "ONESIGNAL_REST_API_KEY"}]',
    true,
    14
) ON CONFLICT (slug) DO NOTHING;
