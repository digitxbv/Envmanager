# SUPABASE MIGRATIONS

14 migrations defining schema, RLS, triggers, and RPC functions.

## MIGRATION ORDER

| # | File | Purpose |
|---|------|---------|
| 1 | `20251019_initial_schema` | Core tables, 31 RLS policies |
| 2 | `20251020_onboarding_function` | `create_organization_with_owner` RPC |
| 3 | `20251020_auto_grant_env_access` | Auto-grant on env creation |
| 4 | `20251020_vault_encryption` | Secret storage via pgsodium |
| 5 | `20251020_billing_schema` | Plans, subscriptions, events |
| 6 | `20251020_extend_organizations` | Trial logic |
| 7 | `20251020_security_trial_fixes` | Explicit DENY policies |
| 8 | `20251022_team_management` | Member/access RPC functions |
| 9 | `20251022_env_access_update` | Atomic access update RPC |
| 10 | `20251023_fix_ambiguous_user_id` | Team function fixes |
| 11 | `20251027_invitation_system` | Full invitation lifecycle |
| 12 | `20251027_fix_invitation_return` | Return type fix |
| 13 | `20260117_import_history` | Bulk import audit |
| 14 | `20260117_conflict_detection` | Optimistic locking |

## SCHEMA

```
organizations
  └── organization_members (user_id, role)
        └── projects
              └── environments
                    ├── environment_access (user_id)
                    └── variables
                          └── variable_audit_log
```

## RLS PATTERNS

### Dual-Check (Variables)
```sql
USING (
    organization_id IN (SELECT get_user_organization_ids())
    AND environment_id IN (SELECT get_user_environment_ids())
);
```
Both org membership AND env access required.

### Helper Functions
- `get_user_organization_ids()` - All orgs user belongs to
- `get_user_environment_ids()` - All envs user can access

### Explicit DENY (Billing)
```sql
CREATE POLICY "No direct subscription modification"
ON organization_subscriptions FOR ALL
TO authenticated
USING (false);
```
Only service role can modify subscriptions.

## VAULT ENCRYPTION

**Triggers handle automatically:**
- INSERT with `is_secret=true` -> creates vault secret
- UPDATE changing to secret -> creates vault secret
- DELETE -> cleans up vault secret

**Decryption:**
```sql
SELECT decrypt_variable_value(variable_id);
-- Returns plaintext only if user has access
```

## CONVENTIONS

- Migrations are atomic (schema + triggers + functions + RLS + grants)
- All tables have `created_at`, `updated_at` with auto-update trigger
- Audit log is immutable (no UPDATE/DELETE policies)
- RPC functions use SECURITY DEFINER for privileged ops

## AFTER MIGRATION

```bash
supabase db reset                                    # Apply migrations
supabase gen types --local > types/database.types.ts # Regenerate types
```

## KEY RPC FUNCTIONS

| Function | SECURITY | Purpose |
|----------|----------|---------|
| `create_organization_with_owner` | DEFINER | Bootstrap org (bypasses RLS) |
| `decrypt_variable_value` | DEFINER | Vault decryption with RLS check |
| `bulk_insert_variables` | DEFINER | Import with vault handling |
| `update_user_environment_access` | DEFINER | Atomic access replacement |
| `create_invitation` | DEFINER | Invitation with validation |
| `accept_invitation` | DEFINER | Atomic membership creation |
