type SchemaFieldType = 'string' | 'number' | 'boolean' | 'url' | 'email' | 'port' | 'json' | 'enum'

interface SchemaField {
  type: SchemaFieldType
  required?: boolean
  default?: string
  description?: string
  enum?: string[]
  pattern?: string
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
}

type EnvSchema = Record<string, SchemaField>

export interface ValidationError {
  key: string
  message: string
  value?: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: string[]
}

const fieldTypeValidators: Record<SchemaFieldType, (value: string) => boolean> = {
  string: () => true,
  number: (v) => !isNaN(Number(v)),
  boolean: (v) => ['true', 'false', '1', '0', 'yes', 'no'].includes(v.toLowerCase()),
  url: (v) => { try { new URL(v); return true } catch { return false } },
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  port: (v) => { const n = Number(v); return !isNaN(n) && n >= 1 && n <= 65535 },
  json: (v) => { try { JSON.parse(v); return true } catch { return false } },
  enum: () => true
}

function validateValue(key: string, value: string | null, field: SchemaField): ValidationError | null {
  const actualValue = value ?? field.default ?? ''

  if (field.required !== false && !actualValue) {
    return { key, message: `${key} is required` }
  }

  if (!actualValue) return null

  const validator = fieldTypeValidators[field.type]
  if (!validator(actualValue)) {
    return { key, message: `${key} must be a valid ${field.type}`, value: actualValue }
  }

  if (field.enum && !field.enum.includes(actualValue)) {
    return { key, message: `${key} must be one of: ${field.enum.join(', ')}`, value: actualValue }
  }

  if (field.pattern) {
    const regex = new RegExp(field.pattern)
    if (!regex.test(actualValue)) {
      return { key, message: `${key} does not match pattern`, value: actualValue }
    }
  }

  if (field.type === 'number' || field.type === 'port') {
    const num = Number(actualValue)
    if (field.minimum !== undefined && num < field.minimum) {
      return { key, message: `${key} must be >= ${field.minimum}`, value: actualValue }
    }
    if (field.maximum !== undefined && num > field.maximum) {
      return { key, message: `${key} must be <= ${field.maximum}`, value: actualValue }
    }
  }

  if (field.type === 'string') {
    if (field.minLength !== undefined && actualValue.length < field.minLength) {
      return { key, message: `${key} must be at least ${field.minLength} characters`, value: actualValue }
    }
    if (field.maxLength !== undefined && actualValue.length > field.maxLength) {
      return { key, message: `${key} must be at most ${field.maxLength} characters`, value: actualValue }
    }
  }

  return null
}

export function useSchemaValidation() {
  const supabase = useSupabaseClient()
  const schemaCache = ref<Map<string, EnvSchema | null>>(new Map())

  async function fetchSchema(environmentId: string): Promise<EnvSchema | null> {
    if (schemaCache.value.has(environmentId)) {
      return schemaCache.value.get(environmentId) ?? null
    }

    const { data, error } = await supabase.rpc('get_environment_schema', {
      p_environment_id: environmentId
    })

    if (error || !data) {
      schemaCache.value.set(environmentId, null)
      return null
    }

    const schema = data as unknown as EnvSchema
    schemaCache.value.set(environmentId, schema)
    return schema
  }

  function clearSchemaCache(environmentId?: string) {
    if (environmentId) {
      schemaCache.value.delete(environmentId)
    } else {
      schemaCache.value.clear()
    }
  }

  async function validateVariable(
    environmentId: string,
    key: string,
    value: string | null
  ): Promise<ValidationResult> {
    const schema = await fetchSchema(environmentId)
    
    if (!schema) {
      return { valid: true, errors: [], warnings: [] }
    }

    const field = schema[key]
    if (!field) {
      return { valid: true, errors: [], warnings: [`${key} is not defined in schema`] }
    }

    const error = validateValue(key, value, field)
    if (error) {
      return { valid: false, errors: [error], warnings: [] }
    }

    return { valid: true, errors: [], warnings: [] }
  }

  async function validateVariables(
    environmentId: string,
    variables: Array<{ key: string; value: string | null }>
  ): Promise<ValidationResult> {
    const schema = await fetchSchema(environmentId)
    
    if (!schema) {
      return { valid: true, errors: [], warnings: [] }
    }

    const errors: ValidationError[] = []
    const warnings: string[] = []
    const schemaKeys = new Set(Object.keys(schema))
    const variableKeys = new Set(variables.map(v => v.key))

    for (const variable of variables) {
      const field = schema[variable.key]
      if (!field) {
        warnings.push(`${variable.key} is not defined in schema`)
        continue
      }

      const error = validateValue(variable.key, variable.value, field)
      if (error) {
        errors.push(error)
      }
    }

    for (const schemaKey of schemaKeys) {
      const field = schema[schemaKey]
      if (!field) continue
      if (field.required !== false && !variableKeys.has(schemaKey)) {
        errors.push({ key: schemaKey, message: `${schemaKey} is required but missing` })
      }
    }

    return { valid: errors.length === 0, errors, warnings }
  }

  return {
    fetchSchema,
    clearSchemaCache,
    validateVariable,
    validateVariables
  }
}
