import { resolveAll, type VariableInput, type ResolvedVariable } from '@/utils/variable-references'

interface DependencyInfo {
  references: string[]
  referencedBy: string[]
  hasCircular: boolean
}

interface ImpactedVariable {
  key: string
  rawValue: string
  environmentName: string
}

export function useVariableDependencies(allVariables: MaybeRef<VariableInput[]>) {
  const resolvedVariables = computed<ResolvedVariable[]>(() =>
    resolveAll(unref(allVariables))
  )

  function getDependencies(key: string): DependencyInfo {
    const resolved = resolvedVariables.value.find(r => r.key === key)
    if (!resolved) {
      return { references: [], referencedBy: [], hasCircular: false }
    }
    return {
      references: resolved.references,
      referencedBy: resolved.referencedBy,
      hasCircular: resolved.hasCircularRef,
    }
  }

  function getImpactedVariables(key: string): ImpactedVariable[] {
    const deps = getDependencies(key)
    return deps.referencedBy.map(refKey => {
      const resolved = resolvedVariables.value.find(r => r.key === refKey)
      return {
        key: refKey,
        rawValue: resolved?.rawValue || '',
        environmentName: '', // Filled by the caller with context
      }
    })
  }

  return {
    resolvedVariables,
    getDependencies,
    getImpactedVariables,
  }
}
