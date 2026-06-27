import { describe, it, expect } from 'vitest'
import {
  SELF_HOSTED_LIMITS,
  effectiveLimits,
  isWorkspaceLocked,
  canRegister,
} from '../../app/utils/selfHosted'

describe('SELF_HOSTED_LIMITS', () => {
  it('is the exact unlimited limits object', () => {
    expect(SELF_HOSTED_LIMITS).toEqual({
      projects: -1,
      environments_per_project: -1,
      variables_per_environment: -1,
      team_members: -1,
      audit_log_retention_days: -1,
    })
  })
})

describe('effectiveLimits', () => {
  it('returns unlimited limits when self-hosted, ignoring the plan', () => {
    expect(effectiveLimits(true, { projects: 3, team_members: 1 })).toEqual(SELF_HOSTED_LIMITS)
  })

  it('returns the plan limits unchanged when not self-hosted', () => {
    const plan = { projects: 3, environments_per_project: 3, variables_per_environment: 50, team_members: 1, audit_log_retention_days: 7 }
    expect(effectiveLimits(false, plan)).toEqual(plan)
  })
})

describe('isWorkspaceLocked', () => {
  it('never locks a self-hosted workspace even if billing says locked', () => {
    expect(isWorkspaceLocked(true, true)).toBe(false)
  })

  it('passes the billing lock state through when not self-hosted', () => {
    expect(isWorkspaceLocked(false, true)).toBe(true)
    expect(isWorkspaceLocked(false, false)).toBe(false)
  })
})

describe('canRegister', () => {
  it('always allows registration in SaaS mode', () => {
    expect(canRegister(false, false)).toBe(true)
    expect(canRegister(false, true)).toBe(true)
  })

  it('in self-hosted mode only allows the first user', () => {
    expect(canRegister(true, true)).toBe(true)
    expect(canRegister(true, false)).toBe(false)
  })
})
