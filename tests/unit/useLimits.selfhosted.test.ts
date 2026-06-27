import { describe, it, expect } from 'vitest'
import { effectiveLimits, SELF_HOSTED_LIMITS } from '../../app/utils/selfHosted'

// getEffectiveLimits() resolves to: effectiveLimits(selfHosted, plan.limits ?? {})
// These cases lock in the behaviour the composable must produce.
describe('useLimits.getEffectiveLimits selection', () => {
  const freePlan = {
    projects: 3,
    environments_per_project: 3,
    variables_per_environment: 50,
    team_members: 1,
    audit_log_retention_days: 7,
  }

  it('returns unlimited limits when self-hosted, ignoring the subscription plan', () => {
    expect(effectiveLimits(true, freePlan)).toEqual(SELF_HOSTED_LIMITS)
  })

  it('returns the subscription plan limits when not self-hosted', () => {
    expect(effectiveLimits(false, freePlan)).toEqual(freePlan)
  })

  it('returns unlimited even when no subscription plan is loaded (self-hosted)', () => {
    expect(effectiveLimits(true, {})).toEqual(SELF_HOSTED_LIMITS)
  })
})
