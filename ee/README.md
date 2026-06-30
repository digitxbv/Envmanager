# ee/ — Hosted / Enterprise-Only Code (PRIVATE)

Everything under `ee/` is **hosted-only** and lives **only in the private
repository**. It is never part of the public `envmanager` subset and must
never be merged upstream.

## What belongs here

- Billing integration glue that is private-repo-specific.
- Hosted-only features (usage metering, plan enforcement, internal admin).
- Anything we sell as part of the managed service rather than the OSS core.

Stripe **edge functions** (`supabase/functions/stripe-*`) and **billing UI**
(`app/components/billing/`) currently live in their existing locations and are
excluded from the public subset by `scripts/oss/private-only-paths.txt`. New
hosted-only code should prefer `ee/` so the public/private boundary stays
obvious and the exclusion list stays small.

## Rules

1. **Never** reference `ee/` from public code paths in a way that breaks the
   self-hosted build. Public/core code must run without `ee/` present.
2. Gate hosted behavior behind the operator flag: when `EM_SELF_HOSTED=true`,
   `ee/` features are off.
3. `ee/` is on the private side of the upstream boundary. When syncing from
   `upstream/main`, `ee/` is unaffected (it does not exist upstream).

## Sync runbook

For the full Approach-A sync runbook (routine `git merge upstream/main`,
conflict-surface table, and the `ee/` convention in context), see
[`docs/SYNC.md`](../docs/SYNC.md).
