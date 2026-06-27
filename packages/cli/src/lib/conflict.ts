export interface VariableDiff {
  key: string
  localValue: string | null
  remoteValue: string | null
  type: 'added_local' | 'added_remote' | 'removed_local' | 'removed_remote' | 'modified'
}

export interface ConflictResult {
  added: VariableDiff[]
  removed: VariableDiff[]
  modified: VariableDiff[]
  unchanged: string[]
}

export function detectChanges(
  local: Map<string, string>,
  remote: Map<string, { key: string; value: string | null }>
): ConflictResult {
  const result: ConflictResult = {
    added: [],
    removed: [],
    modified: [],
    unchanged: []
  }

  const remoteMap = new Map<string, string | null>()
  for (const [_, v] of remote) {
    remoteMap.set(v.key, v.value)
  }

  for (const [key, localValue] of local) {
    if (!remoteMap.has(key)) {
      result.added.push({
        key,
        localValue,
        remoteValue: null,
        type: 'added_local'
      })
    } else {
      const remoteValue = remoteMap.get(key) ?? null
      if (localValue !== remoteValue) {
        result.modified.push({
          key,
          localValue,
          remoteValue,
          type: 'modified'
        })
      } else {
        result.unchanged.push(key)
      }
    }
  }

  for (const [key, remoteValue] of remoteMap) {
    if (!local.has(key)) {
      result.removed.push({
        key,
        localValue: null,
        remoteValue,
        type: 'removed_local'
      })
    }
  }

  return result
}

export type ConflictResolution = 'keep_local' | 'keep_remote' | 'skip'

export interface ResolvedVariable {
  key: string
  value: string | null
  action: 'set' | 'delete' | 'skip'
}

export function applyResolution(
  diff: VariableDiff,
  resolution: ConflictResolution
): ResolvedVariable {
  switch (resolution) {
    case 'keep_local':
      return {
        key: diff.key,
        value: diff.localValue,
        action: diff.localValue === null ? 'delete' : 'set'
      }
    case 'keep_remote':
      return {
        key: diff.key,
        value: diff.remoteValue,
        action: diff.remoteValue === null ? 'delete' : 'set'
      }
    case 'skip':
      return {
        key: diff.key,
        value: null,
        action: 'skip'
      }
  }
}

export function mergeWithRemote(
  local: Map<string, string>,
  remoteVariables: Array<{ key: string; value: string | null }>,
  strategy: 'local_wins' | 'remote_wins' | 'merge_new'
): Map<string, string> {
  const result = new Map<string, string>()

  switch (strategy) {
    case 'local_wins':
      for (const v of remoteVariables) {
        if (v.value !== null && !local.has(v.key)) {
          result.set(v.key, v.value)
        }
      }
      for (const [key, value] of local) {
        result.set(key, value)
      }
      break

    case 'remote_wins': {
      const remoteKeys = new Set(remoteVariables.map(v => v.key))
      // Keep local keys only if they also exist in remote
      for (const [key, value] of local) {
        if (remoteKeys.has(key)) {
          result.set(key, value)
        }
      }
      // Overlay remote values (remote wins)
      for (const v of remoteVariables) {
        if (v.value !== null) {
          result.set(v.key, v.value)
        }
      }
      break
    }

    case 'merge_new':
      for (const [key, value] of local) {
        result.set(key, value)
      }
      for (const v of remoteVariables) {
        if (v.value !== null && !local.has(v.key)) {
          result.set(v.key, v.value)
        }
      }
      break
  }

  return result
}
