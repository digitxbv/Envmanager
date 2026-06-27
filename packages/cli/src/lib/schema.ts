import { z } from 'zod'

export type SchemaFieldType = 'string' | 'number' | 'boolean' | 'url' | 'email' | 'port' | 'json'

export interface SchemaField {
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

export type EnvSchema = Record<string, SchemaField>

const fieldTypeValidators: Record<SchemaFieldType, (value: string) => boolean> = {
  string: () => true,
  number: (v) => !isNaN(Number(v)),
  boolean: (v) => ['true', 'false', '1', '0', 'yes', 'no'].includes(v.toLowerCase()),
  url: (v) => { try { new URL(v); return true } catch { return false } },
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  port: (v) => { const n = Number(v); return !isNaN(n) && n >= 1 && n <= 65535 },
  json: (v) => { try { JSON.parse(v); return true } catch { return false } }
}

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

export function validateEnvAgainstSchema(
  env: Map<string, string>,
  schema: EnvSchema
): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: string[] = []

  for (const [key, field] of Object.entries(schema)) {
    const value = env.get(key)
    const actualValue = value ?? field.default

    if (field.required !== false && !actualValue) {
      errors.push({ key, message: `${key} is required` })
      continue
    }

    if (!actualValue) continue

    const validator = fieldTypeValidators[field.type]
    if (!validator(actualValue)) {
      errors.push({ key, message: `${key} must be a valid ${field.type}`, value: actualValue })
      continue
    }

    if (field.enum && !field.enum.includes(actualValue)) {
      errors.push({ key, message: `${key} must be one of: ${field.enum.join(', ')}`, value: actualValue })
      continue
    }

    if (field.pattern) {
      const regex = new RegExp(field.pattern)
      if (!regex.test(actualValue)) {
        errors.push({ key, message: `${key} does not match pattern: ${field.pattern}`, value: actualValue })
        continue
      }
    }

    if (field.type === 'number') {
      const num = Number(actualValue)
      if (field.minimum !== undefined && num < field.minimum) {
        errors.push({ key, message: `${key} must be >= ${field.minimum}`, value: actualValue })
      }
      if (field.maximum !== undefined && num > field.maximum) {
        errors.push({ key, message: `${key} must be <= ${field.maximum}`, value: actualValue })
      }
    }

    if (field.type === 'string') {
      if (field.minLength !== undefined && actualValue.length < field.minLength) {
        errors.push({ key, message: `${key} must be at least ${field.minLength} characters`, value: actualValue })
      }
      if (field.maxLength !== undefined && actualValue.length > field.maxLength) {
        errors.push({ key, message: `${key} must be at most ${field.maxLength} characters`, value: actualValue })
      }
    }
  }

  const schemaKeys = new Set(Object.keys(schema))
  for (const key of env.keys()) {
    if (!schemaKeys.has(key)) {
      warnings.push(`${key} is not defined in schema`)
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

export function schemaToZod(schema: EnvSchema): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {}

  for (const [key, field] of Object.entries(schema)) {
    let zodType: z.ZodTypeAny

    switch (field.type) {
      case 'number':
        zodType = z.string().transform(Number).pipe(z.number())
        if (field.minimum !== undefined) zodType = (zodType as z.ZodNumber).min(field.minimum)
        if (field.maximum !== undefined) zodType = (zodType as z.ZodNumber).max(field.maximum)
        break

      case 'boolean':
        zodType = z.string().transform(v => ['true', '1', 'yes'].includes(v.toLowerCase()))
        break

      case 'url':
        zodType = z.string().url()
        break

      case 'email':
        zodType = z.string().email()
        break

      case 'port':
        zodType = z.string().transform(Number).pipe(z.number().int().min(1).max(65535))
        break

      case 'json':
        zodType = z.string().transform(v => JSON.parse(v))
        break

      default:
        zodType = z.string()
        if (field.minLength) zodType = (zodType as z.ZodString).min(field.minLength)
        if (field.maxLength) zodType = (zodType as z.ZodString).max(field.maxLength)
        if (field.pattern) zodType = (zodType as z.ZodString).regex(new RegExp(field.pattern))
    }

    if (field.enum) {
      zodType = z.enum(field.enum as [string, ...string[]])
    }

    if (field.required === false) {
      zodType = zodType.optional()
      if (field.default) {
        zodType = zodType.default(field.default)
      }
    }

    shape[key] = zodType
  }

  return z.object(shape)
}

export function schemaToJson(schema: EnvSchema): object {
  const properties: Record<string, object> = {}
  const required: string[] = []

  for (const [key, field] of Object.entries(schema)) {
    const prop: Record<string, unknown> = {}

    switch (field.type) {
      case 'number':
      case 'port':
        prop.type = 'number'
        if (field.minimum !== undefined) prop.minimum = field.minimum
        if (field.maximum !== undefined) prop.maximum = field.maximum
        break
      case 'boolean':
        prop.type = 'boolean'
        break
      default:
        prop.type = 'string'
        if (field.minLength !== undefined) prop.minLength = field.minLength
        if (field.maxLength !== undefined) prop.maxLength = field.maxLength
        if (field.pattern) prop.pattern = field.pattern
    }

    if (field.type === 'url') prop.format = 'uri'
    if (field.type === 'email') prop.format = 'email'
    if (field.enum) prop.enum = field.enum
    if (field.default !== undefined) prop.default = field.default
    if (field.description) prop.description = field.description

    properties[key] = prop

    if (field.required !== false) {
      required.push(key)
    }
  }

  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    properties,
    required,
    additionalProperties: true
  }
}

export function jsonToSchema(json: Record<string, unknown>): EnvSchema {
  const schema: EnvSchema = {}
  
  if (!json || typeof json !== 'object') {
    return schema
  }

  for (const [key, value] of Object.entries(json)) {
    if (!value || typeof value !== 'object') continue
    
    const field = value as Record<string, unknown>
    const schemaField: SchemaField = { type: 'string' }

    if (field.type === 'number') {
      schemaField.type = 'number'
      if (typeof field.minimum === 'number') schemaField.minimum = field.minimum
      if (typeof field.maximum === 'number') schemaField.maximum = field.maximum
    } else if (field.type === 'boolean') {
      schemaField.type = 'boolean'
    } else {
      if (field.format === 'uri' || field.format === 'url') schemaField.type = 'url'
      else if (field.format === 'email') schemaField.type = 'email'
      else if (typeof field.pattern === 'string' && field.pattern.includes('^postgres')) schemaField.type = 'url'
    }

    if (Array.isArray(field.enum)) schemaField.enum = field.enum as string[]
    if (typeof field.pattern === 'string') schemaField.pattern = field.pattern
    if (typeof field.default === 'string') schemaField.default = field.default
    if (typeof field.description === 'string') schemaField.description = field.description
    if (typeof field.minLength === 'number') schemaField.minLength = field.minLength
    if (typeof field.maxLength === 'number') schemaField.maxLength = field.maxLength
    if (field.required === false) schemaField.required = false
    else schemaField.required = true

    schema[key] = schemaField
  }

  return schema
}
