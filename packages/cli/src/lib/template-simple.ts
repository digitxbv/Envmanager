export interface TemplateVariable {
  key: string
  placeholder: string
  defaultValue: string | null
  required: boolean
  comment: string | null
}

export interface ParsedTemplate {
  variables: TemplateVariable[]
  comments: string[]
  raw: string
}

const PLACEHOLDER_REGEX = /\$\{([A-Z_][A-Z0-9_]*)(?::([^}]*))?\}/g
const LINE_VAR_REGEX = /^([A-Z_][A-Z0-9_]*)=(.*)$/

export function parseTemplate(content: string): ParsedTemplate {
  const variables: TemplateVariable[] = []
  const comments: string[] = []
  const lines = content.split('\n')
  
  let currentComment: string | null = null

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed.startsWith('#')) {
      currentComment = trimmed.substring(1).trim()
      comments.push(currentComment)
      continue
    }

    if (!trimmed) {
      currentComment = null
      continue
    }

    const match = trimmed.match(LINE_VAR_REGEX)
    if (match) {
      const [, key, value] = match
      const placeholderMatch = value.match(/^\$\{([A-Z_][A-Z0-9_]*)(?::([^}]*))?\}$/)
      
      if (placeholderMatch) {
        const [, placeholderKey, defaultValue] = placeholderMatch
        variables.push({
          key,
          placeholder: placeholderKey,
          defaultValue: defaultValue ?? null,
          required: defaultValue === undefined,
          comment: currentComment
        })
      } else {
        variables.push({
          key,
          placeholder: key,
          defaultValue: value || null,
          required: false,
          comment: currentComment
        })
      }
      currentComment = null
    }
  }

  return { variables, comments, raw: content }
}

export function extractPlaceholders(content: string): Map<string, { defaultValue: string | null; required: boolean }> {
  const placeholders = new Map<string, { defaultValue: string | null; required: boolean }>()
  
  let match
  while ((match = PLACEHOLDER_REGEX.exec(content)) !== null) {
    const [, name, defaultValue] = match
    placeholders.set(name, {
      defaultValue: defaultValue ?? null,
      required: defaultValue === undefined
    })
  }
  
  return placeholders
}

export function substituteTemplate(
  template: string,
  values: Map<string, string>,
  options: { throwOnMissing?: boolean } = {}
): { result: string; missing: string[] } {
  const missing: string[] = []
  
  const result = template.replace(PLACEHOLDER_REGEX, (match, name, defaultValue) => {
    if (values.has(name)) {
      return values.get(name)!
    }
    
    if (defaultValue !== undefined) {
      return defaultValue
    }
    
    missing.push(name)
    
    if (options.throwOnMissing) {
      throw new Error(`Missing required variable: ${name}`)
    }
    
    return match
  })

  return { result, missing }
}

export function generateTemplate(
  variables: Array<{ key: string; value?: string; isSecret?: boolean; description?: string }>,
  options: { includeDefaults?: boolean; includeComments?: boolean } = {}
): string {
  const lines: string[] = []
  
  for (const v of variables.sort((a, b) => a.key.localeCompare(b.key))) {
    if (options.includeComments && v.description) {
      lines.push(`# ${v.description}`)
    }
    
    if (v.isSecret) {
      lines.push(`${v.key}=\${${v.key}}`)
    } else if (options.includeDefaults && v.value) {
      lines.push(`${v.key}=\${${v.key}:${v.value}}`)
    } else {
      lines.push(`${v.key}=\${${v.key}}`)
    }
  }
  
  return lines.join('\n') + '\n'
}

export function validateAgainstTemplate(
  template: ParsedTemplate,
  env: Map<string, string>
): { valid: boolean; missing: string[]; extra: string[] } {
  const required = template.variables
    .filter(v => v.required)
    .map(v => v.key)
  
  const templateKeys = new Set(template.variables.map(v => v.key))
  const envKeys = new Set(env.keys())
  
  const missing = required.filter(k => !env.has(k))
  const extra = Array.from(envKeys).filter(k => !templateKeys.has(k))
  
  return {
    valid: missing.length === 0,
    missing,
    extra
  }
}
