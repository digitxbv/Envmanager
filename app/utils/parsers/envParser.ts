import * as yaml from 'js-yaml'

export interface ParsedVariable {
  key: string
  value: string
  isSecret: boolean
}

export interface ParseResult {
  variables: ParsedVariable[]
  errors: string[]
  warnings: string[]
}

const SECRET_PATTERNS = /SECRET|KEY|TOKEN|PASSWORD|PRIVATE|AUTH|CREDENTIAL|API_KEY|APIKEY/i

export function isSecretKey(key: string): boolean {
  return SECRET_PATTERNS.test(key)
}

export function parseEnvFile(content: string, fileName: string): ParseResult {
  const ext = fileName.toLowerCase().split('.').pop() || ''

  switch (ext) {
    case 'json':
      return parseJSON(content)
    case 'yml':
    case 'yaml':
      return parseYAML(content, fileName)
    case 'env':
    default:
      return parseDotEnv(content)
  }
}

export function parseDotEnv(content: string): ParseResult {
  const variables: ParsedVariable[] = []
  const errors: string[] = []
  const warnings: string[] = []
  const seenKeys = new Set<string>()

  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? ''

    // Skip empty lines and comments
    if (!line || line.startsWith('#')) continue

    // Match KEY=value pattern, handling quoted values
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)

    if (match) {
      const key = match[1]
      const rawValue = match[2]
      if (!key || rawValue === undefined) {
        errors.push(`Line ${i + 1}: Invalid variable format`)
        continue
      }

      let value = rawValue

      // Handle quoted values
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }

      const trimmedKey = key.trim()

      if (seenKeys.has(trimmedKey)) {
        warnings.push(`Duplicate key "${trimmedKey}" on line ${i + 1} was ignored; using the first value.`)
        continue
      }

      seenKeys.add(trimmedKey)
      variables.push({
        key: trimmedKey,
        value: value,
        isSecret: isSecretKey(key)
      })
    } else if (line.includes('=')) {
      errors.push(`Line ${i + 1}: Invalid variable format`)
    }
  }

  return { variables, errors, warnings }
}

export function parseJSON(content: string): ParseResult {
  const variables: ParsedVariable[] = []
  const errors: string[] = []

  try {
    const data = JSON.parse(content)

    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      errors.push('JSON must be an object with key-value pairs')
      return { variables, errors, warnings: [] }
    }

    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        variables.push({
          key,
          value: String(value),
          isSecret: isSecretKey(key)
        })
      } else if (value !== null && value !== undefined) {
        // Stringify complex values
        variables.push({
          key,
          value: JSON.stringify(value),
          isSecret: isSecretKey(key)
        })
      }
    }
  } catch (e) {
    errors.push('Invalid JSON format')
  }

  return { variables, errors, warnings: [] }
}

export function parseYAML(content: string, fileName: string): ParseResult {
  const variables: ParsedVariable[] = []
  const errors: string[] = []

  try {
    const data = yaml.load(content) as Record<string, unknown>

    if (typeof data !== 'object' || data === null) {
      errors.push('YAML must contain key-value pairs')
      return { variables, errors, warnings: [] }
    }

    // Check if this is a docker-compose file
    if (fileName.includes('docker-compose') || fileName.includes('compose')) {
      return parseDockerCompose(data)
    }

    // Parse flat YAML
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        variables.push({
          key,
          value: String(value),
          isSecret: isSecretKey(key)
        })
      } else if (value !== null && value !== undefined) {
        variables.push({
          key,
          value: JSON.stringify(value),
          isSecret: isSecretKey(key)
        })
      }
    }
  } catch (e) {
    errors.push('Invalid YAML format')
  }

  return { variables, errors, warnings: [] }
}

export function parseDockerCompose(data: Record<string, unknown>): ParseResult {
  const variables: ParsedVariable[] = []
  const errors: string[] = []

  try {
    // Look for environment variables in services
    const services = data.services as Record<string, Record<string, unknown>> | undefined

    if (!services) {
      errors.push('No services found in docker-compose file')
      return { variables, errors, warnings: [] }
    }

    for (const [serviceName, service] of Object.entries(services)) {
      const env = service.environment

      if (Array.isArray(env)) {
        // Array format: ["KEY=value", "KEY2=value2"]
        for (const item of env) {
          if (typeof item === 'string') {
            const [key, ...valueParts] = item.split('=')
            if (key && valueParts.length > 0) {
              variables.push({
                key: key.trim(),
                value: valueParts.join('='),
                isSecret: isSecretKey(key)
              })
            }
          }
        }
      } else if (typeof env === 'object' && env !== null) {
        // Object format: { KEY: value, KEY2: value2 }
        for (const [key, value] of Object.entries(env as Record<string, unknown>)) {
          if (value !== null && value !== undefined) {
            variables.push({
              key,
              value: String(value),
              isSecret: isSecretKey(key)
            })
          }
        }
      }
    }

    // Deduplicate variables (keep first occurrence)
    const seen = new Set<string>()
    const unique = variables.filter(v => {
      if (seen.has(v.key)) return false
      seen.add(v.key)
      return true
    })

    return { variables: unique, errors, warnings: [] }
  } catch (e) {
    errors.push('Failed to parse docker-compose file')
    return { variables, errors, warnings: [] }
  }
}

export function getFileTypeLabel(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop() || ''

  switch (ext) {
    case 'json':
      return 'JSON'
    case 'yml':
    case 'yaml':
      return fileName.includes('docker-compose') || fileName.includes('compose')
        ? 'Docker Compose'
        : 'YAML'
    case 'env':
      return '.env'
    default:
      return '.env'
  }
}

export const SUPPORTED_EXTENSIONS = ['.env', '.json', '.yml', '.yaml']

export function isSupportedFile(fileName: string): boolean {
  const lowerName = fileName.toLowerCase()
  return SUPPORTED_EXTENSIONS.some(ext => lowerName.endsWith(ext)) ||
         lowerName.startsWith('.env')
}
