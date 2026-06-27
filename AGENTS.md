# AGENTS.md

## Build & Run Commands

```bash
npm install                  # Install dependencies
npm run dev                  # Dev server at http://localhost:4400
npm run build                # Production build
npm run generate             # Static site generation
```

### Build Verification Preference
- Do not run `npm run build` by default after every change.
- Run targeted verification first (LSP diagnostics, focused unit/E2E tests).
- Run `npm run build` only when explicitly requested by the user or when changes are broad enough that build-level validation is required.

## Test Commands

```bash
npm test                     # Run all vitest tests (watch mode)
npm run test:unit            # Unit tests only (run once)
npx vitest run tests/unit/form-loading.test.ts          # Single unit test file
npx vitest run -t "should initialize with default"      # Single test by name

npm run test:e2e             # All Playwright E2E tests
npx playwright test tests/e2e/full-flow-signup-onboarding-variables.spec.ts  # Single E2E test
npx playwright test --project=chromium tests/e2e/team-management.spec.ts     # Single E2E, single browser
```

### Baseline E2E Test (DO NOT MODIFY)
`tests/e2e/full-flow-signup-onboarding-variables.spec.ts` — must pass for every PR. Cannot be modified without owner approval.

### Playwright Report Behavior
- Never open Playwright HTML reports automatically.
- Do not run `npx playwright show-report` unless the user explicitly requests it.
- When running Playwright tests, use `PLAYWRIGHT_HTML_OPEN=never` to prevent browser tabs from opening.

## Supabase Commands

```bash
supabase migration new <name>                       # Create new migration
supabase db reset                                   # Reset local DB + run all migrations
supabase gen types --local > types/database.types.ts  # Regenerate DB types (run after schema changes)
```

**DO NOT** run `supabase db push` locally — use migrations.
**DO NOT** run `supabase functions serve` — functions are served by local Supabase stack.

## Local Dev Ports

| Service | Port | URL |
|---------|------|-----|
| Nuxt Frontend | 4400 | http://localhost:4400 |
| Supabase API | 54431 | http://127.0.0.1:54431 |
| Postgres | 54432 | postgresql://postgres:postgres@127.0.0.1:54432/postgres |
| Supabase Studio | 54433 | http://127.0.0.1:54433 |
| Mailpit (Email) | 54434 | http://127.0.0.1:54434 |

Assume `npm run dev` and Supabase local are already running.

## Code Style

### TypeScript & Formatting
- **No ESLint/Prettier** configured — follow existing file conventions
- 2-space indentation, single quotes, no semicolons in Vue `<script>` blocks
- Semicolons used in standalone `.ts` files (composables, stores, types)
- `type` module (ESM imports everywhere)

### Naming Conventions
- **Composables**: `use` prefix, camelCase — `useTeamManagement.ts`, `useBilling.ts`
- **Stores (Pinia)**: `use` prefix + `Store` suffix — `useOrganizationStore`, `useBillingStore`
- **Components**: PascalCase — `Button.vue`, `PasswordInput.vue`
- **Pages**: kebab-case following Nuxt file-based routing
- **Types**: PascalCase for interfaces/types — `TeamMember`, `PlanLimits`
- **Type files**: `*.types.ts` in `/types/` directory
- **Migrations**: timestamp prefix — `20260211131401_description.sql`

### Vue Components
- `<template>` first, then `<script setup>`, then `<style>` (if any)
- Use `<script setup>` (Composition API) — no Options API
- Props via `defineProps()` with type validators
- Tailwind classes directly in template (HSL CSS variable theme system)
- Icons via `<Icon name="lucide:icon-name" />` (nuxt-icon module)
- Modals use `<Teleport to="body">` pattern
- Toast notifications: `const { $toast } = useNuxtApp()` then `$toast.success()`

### Composables
- Export a single function matching the filename: `export const useBilling = () => { ... }`
- Or `export function useFormLoading(): UseFormLoadingReturn { ... }` with explicit return type
- Return typed interfaces for public API
- Use `ref()` for loading/error state, `reactive()` for form objects
- Section headers with `// =====================================================` comment blocks
- JSDoc on public methods

### Pinia Stores
- Options API style: `defineStore('name', { state, getters, actions })`
- State typed with `as` casts: `null as string | null`
- Stores hold UI state only; business logic lives in composables

### Supabase Integration (CRITICAL)
- **MUST** use `useSupabaseClient()` for ALL database operations
- **NEVER** create custom API endpoints or use `fetch()` for Supabase resources
- User ID: `useSupabaseUser()` returns JWT payload — use `user.value?.id ?? user.value?.sub`
- Use RPC functions for atomic operations, not raw multi-step queries
- After schema changes: `supabase gen types --local > types/database.types.ts`

### Error Handling
- Try/catch with typed error messages: `err instanceof Error ? err.message : 'An unexpected error occurred'`
- Use `useSupabaseErrorHandler()` `withErrorHandling()` wrapper for auto-handling auth errors
- Use `useFormLoading()` `withLoading()` wrapper for form state management
- Console logging with prefix: `console.warn('[useBilling] No organization selected')`
- Fire-and-forget for non-critical operations (logging, analytics) — don't throw

### Imports
- Type imports: `import type { X } from '~/types/...'`
- Path alias: `~/` for project root (configured in vitest + nuxt)
- Vue utilities auto-imported by Nuxt (`ref`, `computed`, `watch`, etc.)
- Supabase composables auto-imported (`useSupabaseClient`, `useSupabaseUser`)
- Pinia stores auto-imported by `@pinia/nuxt`

### Tests
- **Unit tests** (Vitest): `tests/unit/*.test.ts` — happy-dom environment, globals enabled
- **E2E tests** (Playwright): `tests/e2e/*.spec.ts` — chromium + firefox projects
- **E2E helpers**: `tests/e2e/helpers/` — `loginAsSeededUser()`, `registerAndLogin()`
- Test core functionality only, not every error scenario
- Prefer extending existing test files over creating new ones
- Only mock external API calls; avoid mocking internal functions

## Architecture Quick Reference

```
pages/              → Nuxt file-based routing
components/         → Vue components (ui/ for base components)
composables/        → Business logic (useX pattern)
stores/             → Pinia stores (UI state only)
middleware/         → Route guards (auth.ts)
layouts/            → Page layouts (default, auth, dashboard)
types/              → TypeScript type definitions
supabase/migrations → SQL migrations (supabase migration new)
supabase/functions  → Deno Edge Functions
server/             → Nuxt server middleware
packages/cli        → CLI package (@envmanager-cli/cli, built with tsup)
tests/unit          → Vitest unit tests
tests/e2e           → Playwright E2E tests
```

### Key RPC Functions
- `decrypt_variable_value(variable_id)` — Decrypt secret from Vault
- `bulk_insert_variables(...)` — Bulk import with vault handling
- `create_invitation` / `accept_invitation` / `cancel_invitation` / `resend_invitation`
- `get_organization_members_with_emails()` — Team listing with auth.users join
- `get_user_environment_access()` — Granular access checking
- `get_platform_stats()` — Platform-wide totals + subscription distribution (platform admin)
- `get_platform_organization_counts(org_id)` — Per-organization project/environment/variable counts (platform admin)

### Security
- RLS enforces tenant isolation (dual-check: org membership + environment access)
- Secrets encrypted via Supabase Vault (pgsodium)
- Audit logging to `variable_audit_log` table
- Protected routes via `/middleware/auth.ts` (includes MFA check)

### CLI Package
- npm: `@envmanager-cli/cli` — built with tsup
- Release: bump `packages/cli/package.json` version → `git tag cli-vX.Y.Z` → push
- CI: `.github/workflows/cli-publish.yml` on `cli-v*` tags (OIDC trusted publishing)
