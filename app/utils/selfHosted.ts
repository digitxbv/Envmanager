// =====================================================
// Self-hosted (EM_SELF_HOSTED) decision helpers
// =====================================================
// Pure functions so the gating logic is unit-testable without Nuxt.
// The boolean flag is read by callers via useRuntimeConfig().public.selfHosted.

/**
 * Unlimited resource limits applied to every org when self-hosted.
 * -1 means unlimited (matches the convention in useLimits / subscription_plans.limits).
 */
export const SELF_HOSTED_LIMITS: Readonly<Record<string, number>> = Object.freeze({
  projects: -1,
  environments_per_project: -1,
  variables_per_environment: -1,
  team_members: -1,
  audit_log_retention_days: -1,
})

/** Resolve the limits to enforce: unlimited when self-hosted, otherwise the plan's limits. */
export const effectiveLimits = (
  selfHosted: boolean,
  planLimits: Record<string, number>,
): Record<string, number> => (selfHosted ? { ...SELF_HOSTED_LIMITS } : planLimits)

/** A self-hosted workspace is never locked; otherwise defer to the billing lock state. */
export const isWorkspaceLocked = (selfHosted: boolean, locked: boolean): boolean =>
  selfHosted ? false : locked

/** Registration is allowed in SaaS mode, or in self-hosted mode only for the first user. */
export const canRegister = (selfHosted: boolean, isFirstUser: boolean): boolean =>
  !selfHosted || isFirstUser
