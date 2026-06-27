import type { Variable } from './types.js'

export interface ScopeOptions {
  only?: string[] // explicit allow-list from --only
  except?: string[] // keys to exclude (--except)
  all?: boolean // --all escape hatch
  configKeys?: string[] // agent.allowed_keys from envmanager.json
}

/** Pick which fetched vars to expose, enforcing the explicit-scope rule.
 * Throws if no scope is set, or if --only/config names a key that wasn't fetched. */
export function selectScopedVars(vars: Variable[], opts: ScopeOptions): Variable[] {
  const byKey = new Map(vars.map((v) => [v.key, v]))
  const except = new Set(opts.except ?? [])
  // Validate --except keys against the fetched set, so a typo (e.g. `--all --except
  // SECRET_TPYO`) can't silently leave the secret exposed — the opposite of intent.
  const unknownExcept = [...except].filter((k) => !byKey.has(k))
  if (unknownExcept.length > 0) {
    throw new Error(
      `Unknown variable(s) in --except: ${unknownExcept.join(', ')}. Not found in this environment.`,
    )
  }
  const allow = opts.only ?? opts.configKeys // flag wins over config (only is set first)

  if (allow !== undefined) {
    if (allow.length === 0) {
      throw new Error('Empty variable allow-list. Provide at least one key, or use --all.')
    }
    const missing = allow.filter((k) => !byKey.has(k))
    if (missing.length > 0) {
      throw new Error(
        `Unknown variable(s): ${missing.join(', ')}. Not found in this environment.`,
      )
    }
    return allow.map((k) => byKey.get(k)!).filter((v) => !except.has(v.key))
  }

  if (opts.all) {
    return vars.filter((v) => !except.has(v.key))
  }

  throw new Error(
    'No variable scope set. Specify --only KEY1,KEY2, --all, or add "agent.allowed_keys" to envmanager.json.',
  )
}

const PLACEHOLDER = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g

/** Replace {{KEY}} placeholders in each arg with values from the map.
 * Fail-closed: any unresolved placeholder throws (never a silent empty value). */
export function substitutePlaceholders(args: string[], values: Map<string, string>): string[] {
  const missing = new Set<string>()
  const out = args.map((arg) =>
    arg.replace(PLACEHOLDER, (match, key: string) => {
      const v = values.get(key)
      if (v === undefined) {
        missing.add(key)
        return match
      }
      return v
    }),
  )
  if (missing.size > 0) {
    throw new Error(
      `Placeholder(s) not in scope: ${[...missing].map((k) => `{{${k}}}`).join(', ')}`,
    )
  }
  return out
}
