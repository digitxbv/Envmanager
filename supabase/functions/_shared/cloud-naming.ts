// Sanitizes EnvManager variable keys into valid cloud provider secret names

/**
 * Sanitizes an EnvManager variable key into a valid secret name
 * for the target cloud provider.
 *
 * @param key      - The original variable key (e.g., "DATABASE_URL")
 * @param platform - Target cloud provider
 * @param prefix   - Optional prefix to prepend (e.g., "envmanager/prod/")
 * @returns        - Sanitized name valid for the target platform
 */
export function sanitizeSecretName(
  key: string,
  platform: 'gcp' | 'azure' | 'aws',
  prefix?: string,
): string {
  const raw = (prefix ?? '') + key

  let result: string

  switch (platform) {
    case 'gcp':
      result = sanitizeGcp(raw)
      break
    case 'azure':
      result = sanitizeAzure(raw)
      break
    case 'aws':
      result = sanitizeAws(raw)
      break
  }

  if (!result) {
    throw new Error(`Sanitized name is empty for key "${key}" on platform "${platform}"`)
  }

  return result
}

/**
 * Detects name collisions after sanitization — multiple original keys
 * that map to the same sanitized name.
 *
 * @param vars - Array of { name: sanitized name, originalKey: original variable key }
 * @returns Array of human-readable collision error messages (empty if no collisions)
 */
export function detectNameCollisions(
  vars: Array<{ name: string; originalKey: string }>,
): string[] {
  const byName = new Map<string, string[]>()
  for (const v of vars) {
    const existing = byName.get(v.name)
    if (existing) {
      existing.push(v.originalKey)
    } else {
      byName.set(v.name, [v.originalKey])
    }
  }

  const errors: string[] = []
  for (const [name, keys] of byName) {
    if (keys.length > 1) {
      errors.push(`Keys [${keys.join(', ')}] all map to sanitized name "${name}"`)
    }
  }
  return errors
}

function sanitizeGcp(name: string): string {
  // Replace invalid chars with underscore
  let result = name.replace(/[^a-zA-Z0-9_-]/g, '_')
  // Must start with a letter
  if (result && !/^[a-zA-Z]/.test(result)) {
    result = 's_' + result
  }
  // Max 255 characters
  return result.slice(0, 255)
}

function sanitizeAzure(name: string): string {
  // Replace underscores with hyphens
  let result = name.replace(/_/g, '-')
  // Replace any remaining invalid chars with hyphens
  result = result.replace(/[^a-zA-Z0-9-]/g, '-')
  // Collapse consecutive hyphens
  result = result.replace(/-{2,}/g, '-')
  // Strip leading hyphens
  result = result.replace(/^-+/, '')
  // Max 127 characters, then strip any trailing hyphens produced by truncation
  return result.slice(0, 127).replace(/-+$/, '')
}

function sanitizeAws(name: string): string {
  // Replace invalid chars with underscore
  const result = name.replace(/[^a-zA-Z0-9/_+=.@-]/g, '_')
  // Max 512 characters
  return result.slice(0, 512)
}
