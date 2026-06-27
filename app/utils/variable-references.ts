// SYNC: also update packages/cli/src/lib/variable-references.ts

export const REFERENCE_PATTERN = /\$\{([A-Z_][A-Z0-9_]*)\}/g
export const MAX_DEPTH = 10

export interface VariableInput {
  key: string
  value: string | null
  fallbackValue?: string | null
  isSecret?: boolean
}

export interface ResolvedVariable {
  key: string
  rawValue: string | null
  resolvedValue: string
  source: 'explicit' | 'fallback' | 'empty'
  references: string[]
  referencedBy: string[]
  unresolvedRefs: string[]
  hasCircularRef: boolean
}

/**
 * Extract ${VAR} tokens from a value string.
 * Escaped \${ sequences are ignored.
 */
export function parseReferences(value: string): string[] {
  // Remove escaped sequences before parsing
  const cleaned = value.replace(/\\\$\{/g, '___ESCAPED___')
  const refs: string[] = []
  const pattern = new RegExp(REFERENCE_PATTERN.source, 'g')
  let match: RegExpExecArray | null
  while ((match = pattern.exec(cleaned)) !== null) {
    const ref = match[1]
    if (ref) {
      refs.push(ref)
    }
  }
  return refs
}

/**
 * Detect circular reference chains in a set of variables.
 * Returns arrays of keys forming each cycle.
 */
export function detectCircularReferences(variables: VariableInput[]): string[][] {
  const graph = new Map<string, string[]>()
  for (const v of variables) {
    const base = v.value || v.fallbackValue || ''
    graph.set(v.key, parseReferences(base))
  }

  const cycles: string[][] = []
  const visited = new Set<string>()
  const inStack = new Set<string>()

  function dfs(key: string, stack: string[]) {
    if (inStack.has(key)) {
      // Found cycle — extract the cycle portion
      const cycleStart = stack.indexOf(key)
      cycles.push(stack.slice(cycleStart))
      return
    }
    if (visited.has(key)) return

    visited.add(key)
    inStack.add(key)
    stack.push(key)

    const deps = graph.get(key) || []
    for (const dep of deps) {
      if (graph.has(dep)) {
        dfs(dep, stack)
      }
    }

    stack.pop()
    inStack.delete(key)
  }

  for (const key of graph.keys()) {
    dfs(key, [])
  }

  return cycles
}

/**
 * Resolve a single variable's value against a map of all variables.
 */
export function resolveValue(
  key: string,
  variables: Map<string, VariableInput>,
  depth: number = 0,
  _stack: Set<string> = new Set()
): ResolvedVariable {
  const variable = variables.get(key)

  if (!variable) {
    return {
      key,
      rawValue: null,
      resolvedValue: '',
      source: 'empty',
      references: [],
      referencedBy: [],
      unresolvedRefs: [key],
      hasCircularRef: false,
    }
  }

  // Secret variables are NOT resolved — preserve raw value
  if (variable.isSecret) {
    const base = variable.value ?? variable.fallbackValue ?? ''
    const source: ResolvedVariable['source'] = variable.value ? 'explicit' : variable.fallbackValue ? 'fallback' : 'empty'
    return {
      key,
      rawValue: variable.value,
      resolvedValue: base,
      source,
      references: parseReferences(base),
      referencedBy: [],
      unresolvedRefs: [],
      hasCircularRef: false,
    }
  }

  // Determine base value and source
  let base: string
  let source: ResolvedVariable['source']
  if (variable.value !== null && variable.value !== undefined && variable.value !== '') {
    base = variable.value
    source = 'explicit'
  } else if (variable.fallbackValue !== null && variable.fallbackValue !== undefined && variable.fallbackValue !== '') {
    base = variable.fallbackValue
    source = 'fallback'
  } else {
    return {
      key,
      rawValue: variable.value,
      resolvedValue: '',
      source: 'empty',
      references: [],
      referencedBy: [],
      unresolvedRefs: [],
      hasCircularRef: false,
    }
  }

  const references = parseReferences(base)
  const unresolvedRefs: string[] = []
  let hasCircularRef = false

  // Resolve references in the base value
  // First handle escaped sequences
  let resolved = base.replace(/\\\$\{/g, '___ESCAPED___')

  const pattern = new RegExp(REFERENCE_PATTERN.source, 'g')
  resolved = resolved.replace(pattern, (fullMatch, refKey: string) => {
    // Circular reference check
    if (_stack.has(refKey)) {
      hasCircularRef = true
      unresolvedRefs.push(refKey)
      return fullMatch
    }

    // Max depth check
    if (depth >= MAX_DEPTH) {
      unresolvedRefs.push(refKey)
      return fullMatch
    }

    // Variable doesn't exist
    if (!variables.has(refKey)) {
      unresolvedRefs.push(refKey)
      return fullMatch
    }

    // Recurse
    const newStack = new Set(_stack)
    newStack.add(key)
    const inner = resolveValue(refKey, variables, depth + 1, newStack)

    if (inner.hasCircularRef) {
      hasCircularRef = true
    }
    unresolvedRefs.push(...inner.unresolvedRefs)

    return inner.resolvedValue
  })

  // Restore escaped sequences
  resolved = resolved.replace(/___ESCAPED___/g, '${')

  return {
    key,
    rawValue: variable.value,
    resolvedValue: resolved,
    source,
    references,
    referencedBy: [],
    unresolvedRefs: [...new Set(unresolvedRefs)],
    hasCircularRef,
  }
}

/**
 * Resolve all variables in an environment.
 * Populates referencedBy for each variable.
 */
export function resolveAll(variables: VariableInput[]): ResolvedVariable[] {
  const varMap = new Map<string, VariableInput>()
  for (const v of variables) {
    varMap.set(v.key, v)
  }

  const results = variables.map(v => resolveValue(v.key, varMap))

  // Populate referencedBy
  const referencedByMap = new Map<string, string[]>()
  for (const v of variables) {
    referencedByMap.set(v.key, [])
  }

  for (const result of results) {
    for (const ref of result.references) {
      const existing = referencedByMap.get(ref)
      if (existing) {
        existing.push(result.key)
      }
    }
  }

  for (const result of results) {
    result.referencedBy = referencedByMap.get(result.key) || []
  }

  return results
}
