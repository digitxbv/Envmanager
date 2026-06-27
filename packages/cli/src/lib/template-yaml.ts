import yaml from 'js-yaml'

export type VariableType = 'string' | 'number' | 'boolean' | 'url' | 'email' | 'port' | 'path'

export interface YamlTemplateVariable {
  name: string
  type: VariableType
  required: boolean
  default?: string
  description?: string
  example?: string
  enum?: string[]
  pattern?: string
  min?: number
  max?: number
}

export interface YamlTemplate {
  version: string
  name?: string
  description?: string
  variables: YamlTemplateVariable[]
}

interface RawYamlVariable {
  type?: string
  required?: boolean
  default?: string | number | boolean
  description?: string
  example?: string | number | boolean
  enum?: (string | number)[]
  pattern?: string
  min?: number
  max?: number
}

export function parseYamlTemplate(content: string): YamlTemplate {
  const parsed = yaml.load(content) as Record<string, unknown>
  
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid YAML template: must be an object')
  }

  const version = String(parsed.version || '1')
  const name = parsed.name as string | undefined
  const description = parsed.description as string | undefined
  const rawVariables = (parsed.variables || parsed.env || {}) as Record<string, RawYamlVariable | null>

  const variables: YamlTemplateVariable[] = []

  for (const [varName, config] of Object.entries(rawVariables)) {
    if (config === null) {
      variables.push({
        name: varName,
        type: 'string',
        required: true
      })
      continue
    }

    variables.push({
      name: varName,
      type: (config.type as VariableType) || 'string',
      required: config.required !== false,
      default: config.default !== undefined ? String(config.default) : undefined,
      description: config.description,
      example: config.example !== undefined ? String(config.example) : undefined,
      enum: config.enum?.map(String),
      pattern: config.pattern,
      min: config.min,
      max: config.max
    })
  }

  return { version, name, description, variables }
}

export function validateValue(value: string, variable: YamlTemplateVariable): { valid: boolean; error?: string } {
  if (!value && variable.required && !variable.default) {
    return { valid: false, error: `${variable.name} is required` }
  }

  const actualValue = value || variable.default || ''

  if (!actualValue && !variable.required) {
    return { valid: true }
  }

  if (variable.enum && !variable.enum.includes(actualValue)) {
    return { valid: false, error: `${variable.name} must be one of: ${variable.enum.join(', ')}` }
  }

  if (variable.pattern) {
    const regex = new RegExp(variable.pattern)
    if (!regex.test(actualValue)) {
      return { valid: false, error: `${variable.name} does not match pattern: ${variable.pattern}` }
    }
  }

  switch (variable.type) {
    case 'number': {
      const num = Number(actualValue)
      if (isNaN(num)) {
        return { valid: false, error: `${variable.name} must be a number` }
      }
      if (variable.min !== undefined && num < variable.min) {
        return { valid: false, error: `${variable.name} must be >= ${variable.min}` }
      }
      if (variable.max !== undefined && num > variable.max) {
        return { valid: false, error: `${variable.name} must be <= ${variable.max}` }
      }
      break
    }

    case 'boolean': {
      const lower = actualValue.toLowerCase()
      if (!['true', 'false', '1', '0', 'yes', 'no'].includes(lower)) {
        return { valid: false, error: `${variable.name} must be a boolean` }
      }
      break
    }

    case 'url': {
      try {
        new URL(actualValue)
      } catch {
        return { valid: false, error: `${variable.name} must be a valid URL` }
      }
      break
    }

    case 'email': {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(actualValue)) {
        return { valid: false, error: `${variable.name} must be a valid email` }
      }
      break
    }

    case 'port': {
      const port = Number(actualValue)
      if (isNaN(port) || port < 1 || port > 65535) {
        return { valid: false, error: `${variable.name} must be a valid port (1-65535)` }
      }
      break
    }

    case 'path': {
      if (!actualValue.startsWith('/') && !actualValue.startsWith('./') && !actualValue.startsWith('../')) {
        return { valid: false, error: `${variable.name} must be a valid path` }
      }
      break
    }
  }

  return { valid: true }
}

export function validateYamlTemplate(
  template: YamlTemplate,
  env: Map<string, string>
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  const templateKeys = new Set(template.variables.map(v => v.name))

  for (const variable of template.variables) {
    const value = env.get(variable.name)
    const result = validateValue(value || '', variable)
    
    if (!result.valid && result.error) {
      errors.push(result.error)
    }
  }

  for (const key of env.keys()) {
    if (!templateKeys.has(key)) {
      warnings.push(`Extra variable not in template: ${key}`)
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

export function generateYamlTemplate(
  variables: Array<{ key: string; value?: string; isSecret?: boolean; description?: string }>,
  options: { name?: string; description?: string } = {}
): string {
  const template: Record<string, unknown> = {
    version: '1'
  }

  if (options.name) {
    template.name = options.name
  }

  if (options.description) {
    template.description = options.description
  }

  const vars: Record<string, Record<string, unknown>> = {}

  for (const v of variables.sort((a, b) => a.key.localeCompare(b.key))) {
    const varConfig: Record<string, unknown> = {
      type: 'string',
      required: true
    }

    if (v.description) {
      varConfig.description = v.description
    }

    if (v.value && !v.isSecret) {
      varConfig.example = v.value
    }

    vars[v.key] = varConfig
  }

  template.variables = vars

  return yaml.dump(template, { lineWidth: -1, quotingType: '"' })
}
