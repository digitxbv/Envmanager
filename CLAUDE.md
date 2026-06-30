# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EnvManager is a B2B SaaS application for secure environment variable management built with:
- **Frontend**: Nuxt 4, Vue 3, TypeScript
- **Styling**: Tailwind CSS with custom design system
- **Backend**: Supabase (PostgreSQL + Auth)
- **UI Components**: Custom Vue components with Headless UI

## Development Commands

```bash
# Install dependencies
npm install

# Run development server (accessible on network at HOST=0.0.0.0)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Generate static site
npm run generate
```

## Architecture

### Directory Structure
- `/pages`: Nuxt pages with file-based routing
  - `/auth`: Authentication pages (login, register, callback)
  - `/dashboard`: Protected dashboard area
  - `/dashboard/projects/[id]`: Dynamic project management pages
- `/components`: Reusable Vue components
  - `/ui`: Core UI components (Button, Input, etc.)
- `/layouts`: Page layouts (default, auth, dashboard)
- `/middleware`: Route middleware (auth protection)
- `/supabase/migrations`: Migrations (supabase migration new)

### Authentication Flow
- Supabase Auth handles user authentication
- Protected routes use `/middleware/auth.ts`
- Redirect configuration in `nuxt.config.ts`:
  - Login redirect: `/auth/login`
  - Callback: `/auth/callback`
  - Protected paths: `/dashboard/**`

### Key Features
1. **Multi-tenant project management**: Users can create multiple projects
2. **Environment separation**: Each project has multiple environments
3. **Variable management**: Store regular and secret environment variables
4. **Collaboration**: Invite team members with different access levels
5. **Audit logging**: Track all changes for compliance
6. **Row-Level Security (RLS)**: Database-level security policies

### UI Patterns
- Uses Tailwind CSS with HSL color system for theme support
- Custom CSS variables for theming (--primary, --secondary, etc.)
- Toast notifications via `vue-sonner` plugin
- Icons from `@heroicons/vue` and Nuxt Icon module
- Dark mode support via `@nuxtjs/color-mode`

## Important Implementation Notes

### Supabase Integration (Constitutional Requirement)
- Client initialized automatically via `@nuxtjs/supabase` module
- **MUST** use `useSupabaseClient()` composable for ALL database operations
- **MUST** use Supabase JS client methods exclusively:
  - Database: `supabase.from('table').select()`, `.insert()`, `.update()`, `.delete()`
  - Auth: `supabase.auth.signUp()`, `.signInWithPassword()`, `.signOut()`
  - Storage: `supabase.storage.from('bucket').upload()`, `.download()`
  - Functions: `supabase.functions.invoke('function-name')`
- Authentication state available via `useSupabaseUser()`
- **IMPORTANT**: `useSupabaseUser()` returns the JWT payload, NOT the full Supabase user object. The user ID is in `sub`, not `id`. Always use `user.value?.id ?? user.value?.sub` or just `user.value?.sub` when accessing the user ID.
- **NEVER** create custom API endpoints or use fetch() for Supabase resources
- When changing the schema (tables, rls, functions, auth, etc) after running migrations / db reset. Run supabase gen types --local > types/database.types.ts. To have correct types.


### State Management
- Uses Pinia

### Type Safety
- TypeScript enabled throughout
- Database types can be generated from Supabase schema

### Security Considerations
- All sensitive operations require authentication
- RLS policies enforce data isolation between tenants (dual-check: org membership + environment access)
- Variable values marked as secrets are encrypted via Supabase Vault (pgsodium)
- Audit logging for compliance requirements (`variable_audit_log` table)

### Local Development Ports
| Service | Port | URL |
|---------|------|-----|
| Nuxt Frontend | 4400 | http://localhost:4400 |
| Supabase API | 54431 | http://127.0.0.1:54431 |
| Database (Postgres) | 54432 | postgresql://postgres:postgres@127.0.0.1:54432/postgres |
| Supabase Studio | 54433 | http://127.0.0.1:54433 |
| Mailpit (Email) | 54434 | http://127.0.0.1:54434 |

### Development Assumptions
- **Always assume** the user has `npm run dev` running (frontend on port 4400)
- **Always assume** Supabase local is running
- **MUST** run `supabase functions serve --no-verify-jwt` to serve Edge Functions locally — this is required for any feature that calls edge functions (integrations, sync, validation, etc.)
- **DO NOT** run `supabase db push` locally - use migrations instead (`supabase migration new`)
- **Always check** if `npm run dev` is already running before trying to start it
- **DO NOT** run `npm run build` by default after every change
- Use targeted verification first (LSP diagnostics, focused unit/E2E tests)
- Run `npm run build` only when explicitly requested by the user or when changes are broad enough to require build-level validation

### Key RPC Functions
- `decrypt_variable_value(variable_id)` - Decrypt secret from Vault
- `bulk_insert_variables(...)` - Bulk import with proper vault handling
- `create_invitation/accept_invitation/cancel_invitation/resend_invitation` - Invitation flow
- `get_organization_members_with_emails()` - Team listing with auth.users join
- `get_user_environment_access()` - Granular access checking

### CLI Package & Publishing
- **npm package**: `@envmanager-cli/cli` (published at https://www.npmjs.com/package/@envmanager-cli/cli)
- **Install**: `npm install -g @envmanager-cli/cli`
- **Release process**: Bump version in `packages/cli/package.json` → commit → `git tag cli-vX.Y.Z` → `git push && git push --tags`
- **Automation**: `.github/workflows/cli-publish.yml` triggers on `cli-v*` tags, uses npm Trusted Publishing (OIDC, no token secrets)
- **Build tool**: tsup (config in `packages/cli/tsup.config.ts`)
- **Entry points**: `dist/bin/envmanager.js` (CLI binary), `dist/index.js` (library)

### Known Patterns
- Composables in `/composables` handle business logic (billing, limits, team management)
- Modals use `<Teleport to="body">` pattern
- Toast notifications via `$toast` from vue-sonner
- Form state typically uses `reactive()` for form objects, `ref()` for loading/error states

## Mandatory Testing Requirements

### Manual MCP Testing (MANDATORY FOR EVERY FEATURE)

**After implementing ANY feature or change that affects the UI, you MUST manually test it using Playwright MCP:**
1. **Navigate to the relevant page** using `browser_navigate`
2. **Interact with the feature** using `browser_snapshot`, `browser_click`, `browser_type` etc.
3. **Verify it works correctly** - confirm the expected behavior, check toast messages, error states, etc.
4. **Do NOT skip this step** - running only the baseline E2E test is NOT sufficient. You must verify your specific feature works.

This applies even when no new Playwright test scripts are being written. The baseline E2E test checks the core flow, but it does NOT test your specific feature.

### Playwright MCP Session Management (CRITICAL)
- **ALWAYS start a fresh browser session** — call `browser_close` first to kill any existing session, then `browser_navigate` to open a new one
- **NEVER open new tabs** in an existing Playwright browser session — another agent or previous session may own that browser instance, and adding tabs causes conflicts
- **If you get errors** (e.g., "Opening in existing browser session", connection failures), call `browser_close` and retry with a fresh session
- This applies to ALL agents — if multiple agents need Playwright, each must manage its own clean session

### Playwright Report Behavior
- **NEVER** auto-open Playwright HTML reports.
- **NEVER** run `npx playwright show-report` unless the user explicitly asks for it.
- When running Playwright tests from CLI, set `PLAYWRIGHT_HTML_OPEN=never`.

### Testing Workflow (MUST FOLLOW IN ORDER)

**Before writing ANY Playwright test scripts, you MUST:**
1. **Use Playwright MCP first** - Manually test the feature using `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type` etc.
2. **Verify it works** - Interact with the UI, take snapshots, confirm the feature behaves correctly
3. **Then write tests** - Only after manual verification, write the Playwright test scripts

**DO NOT skip straight to writing `npx playwright test` scripts. Manual MCP testing comes first.**

### Baseline E2E Test (DO NOT MODIFY)
The file `tests/e2e/full-flow-signup-onboarding-variables.spec.ts` is a **MANDATORY baseline test** that:
- **MUST pass** for every feature and PR
- **CANNOT be skipped** under any circumstances
- **CANNOT be modified** without explicit written approval from the project owner

This test validates the core user journey:
1. User signup
2. Onboarding completion
3. Adding normal and secret environment variables
4. Secret decryption functionality

**Run before any PR:** `npx playwright test tests/e2e/full-flow-signup-onboarding-variables.spec.ts`

See `docs/prds/TEST_GUIDELINES.md` for full testing requirements.

### Documentation Requirements
Every feature requires user-facing documentation **after tests pass**. Documentation must:
- Be written in English for non-technical users
- Live in `content/docs/` using Nuxt Content MDC format
- Include purpose, prerequisites, step-by-step guide, and screenshots
- Use the `/user-documentation` skill to create documentation

**No feature is complete without user documentation.**

See `docs/prds/DOCUMENTATION_GUIDELINES.md` for full documentation requirements.

### Marking Features Complete
When a PRD feature is fully complete (tests pass + documentation written), mark it as done:
1. Add ✅ prefix to the feature in `docs/prds/README.md` (e.g., `2. ✅ [Feature Name](...)`)
2. PRD numbering format: `XX.YY` where XX = category, YY = feature (e.g., 07.02 = Quality of Life > Import .env)
