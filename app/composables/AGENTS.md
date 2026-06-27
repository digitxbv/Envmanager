# COMPOSABLES

Business logic layer. Stores handle UI state; composables handle everything else.

## INVENTORY

| Composable | Lines | Purpose |
|------------|-------|---------|
| `useTeamManagement` | 753 | Team CRUD, roles, env access, invitations |
| `useLimits` | 303 | Billing tier enforcement |
| `useBilling` | 301 | Subscription, Stripe checkout/portal |
| `usePostHog` | 122 | Analytics wrapper (graceful degradation) |
| `useFormLoading` | 95 | Generic form state (loading/error/success) |
| `usePasswordValidation` | 89 | Password strength with Zod |
| `usePlans` | 86 | Plan data fetching |
| `useSupabaseErrorHandler` | 85 | Auth error detection, auto-logout |

## DEPENDENCY GRAPH

```
useTeamManagement
  ├── useSupabaseClient()
  ├── useSupabaseUser()
  ├── useSupabaseErrorHandler()
  ├── useLimits()
  └── $toast

useLimits
  ├── useSupabaseClient()
  ├── useBillingStore
  ├── useOrganizationStore
  └── useBilling()

useBilling
  ├── useSupabaseClient()
  ├── useBillingStore
  └── $toast
```

## PATTERNS

### Limit Enforcement
```typescript
const { checkLimit, enforceLimit } = useLimits()

// Check before action
if (!checkLimit('projects')) {
  // Dispatches 'billing:limit-reached' event for modal
  enforceLimit('projects')
  return
}
```

### Error Handling Wrapper
```typescript
const { withErrorHandling } = useSupabaseErrorHandler()

const result = await withErrorHandling(async () => {
  return await supabase.from('table').select()
})
// Auto-handles auth errors (401/403) with logout + redirect
```

### Form State
```typescript
const { isLoading, error, withLoading } = useFormLoading()

await withLoading(async () => {
  await saveData()
})
// Automatically sets isLoading, catches errors
```

## CONVENTIONS

- All composables return typed interfaces
- Use RPC functions for atomic operations (not raw queries)
- Fire-and-forget logging (don't throw on log failures)
- Parallel queries with `Promise.all()` for performance

## ANTI-PATTERNS

| Don't | Do Instead |
|-------|------------|
| Raw INSERT/UPDATE for team access | Use `update_user_environment_access` RPC |
| Throw on billing log failure | Fire-and-forget `logBillingEvent()` |
| Check limits after action | Check BEFORE with `checkLimit()` |
| Store business state in Pinia | Use composables; Pinia = UI state only |

## KEY RPCS USED

- `get_organization_members_with_emails` - Team listing
- `get_user_environment_access` - User's env IDs
- `update_user_environment_access` - Atomic access update
- `create_invitation` / `accept_invitation` / `cancel_invitation` / `resend_invitation`
