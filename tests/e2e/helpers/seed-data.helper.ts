/**
 * Seed Data Constants
 * These values match supabase/seed.sql exactly
 * DO NOT modify without updating seed.sql
 */

export const SEED_USER = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  email: 'owner@example.com',
  password: 'Test12345678!',
  fullName: 'Owner User'
} as const

export const SEED_ORG = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'DigitX Test Org'
} as const

export const SEED_PROJECT = {
  id: '22222222-2222-2222-2222-222222222222',
  name: 'Test Project',
  description: 'A test project for development'
} as const

export const SEED_ENVIRONMENTS = {
  development: {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'development'
  },
  production: {
    id: '44444444-4444-4444-4444-444444444444',
    name: 'production'
  }
} as const

export const SEED_GITHUB = {
  installationId: '55555555-5555-5555-5555-555555555555',
  accountLogin: 'test-org',
  accountType: 'Organization'
} as const

export const SEED_VARIABLES = {
  development: {
    regular: [
      { key: 'APP_NAME', value: 'EnvManager Dev' },
      { key: 'DEBUG_MODE', value: 'true' }
    ],
    secret: [
      { key: 'API_KEY', value: 'dev-secret-api-key-12345' },
      { key: 'DATABASE_URL', value: 'postgres://dev:secret@localhost:5432/devdb' }
    ]
  },
  production: {
    regular: [
      { key: 'APP_NAME', value: 'EnvManager Prod' },
      { key: 'DEBUG_MODE', value: 'false' }
    ],
    secret: [
      { key: 'API_KEY', value: 'prod-secret-api-key-67890' },
      { key: 'DATABASE_URL', value: 'postgres://prod:supersecret@db.prod.com:5432/proddb' }
    ]
  }
} as const

/**
 * URL helpers for navigating to seed data pages
 */
export const SEED_URLS = {
  project: `/dashboard/projects/${SEED_PROJECT.id}`,
  projectSettings: `/dashboard/projects/${SEED_PROJECT.id}/settings`,
  team: '/dashboard/team',
  billing: '/dashboard/billing'
} as const

/**
 * Plan limits for free tier (for billing tests)
 * Verify with: SELECT limits FROM subscription_plans WHERE id = 'free';
 */
export const FREE_PLAN_LIMITS = {
  projects: 1,
  environments_per_project: 3,
  variables_per_environment: -1,
  team_members: 1,
  integrations: 1,
  audit_log_retention_days: 7
} as const
