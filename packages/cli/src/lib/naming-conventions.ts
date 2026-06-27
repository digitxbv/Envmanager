// SYNC: also update utils/naming-conventions.ts

export interface NamingRule {
  case?: 'SCREAMING_SNAKE_CASE' | 'snake_case' | 'PascalCase' | 'camelCase'
  patterns?: Array<{ match: string; description: string; example?: string }>
  forbidden?: Array<{ match: string; reason: string }>
}

export interface NamingConventionConfig {
  rules: NamingRule
  enforcement_mode: 'warn' | 'block'
  template_name?: string
}

export interface NamingValidationResult {
  valid: boolean
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
  suggestions: string[]
}

export interface ValidationIssue {
  type: 'case' | 'pattern' | 'forbidden'
  message: string
  suggestion?: string
}

// --- Case detection helpers ---

function isScreamingSnakeCase(name: string): boolean {
  return /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/.test(name)
}

function isSnakeCase(name: string): boolean {
  return /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(name)
}

function isPascalCase(name: string): boolean {
  return /^[A-Z][a-zA-Z0-9]*$/.test(name)
}

function isCamelCase(name: string): boolean {
  return /^[a-z][a-zA-Z0-9]*$/.test(name)
}

// --- Case conversion ---

function splitIntoWords(name: string): string[] {
  // Handle SCREAMING_SNAKE_CASE and snake_case
  if (name.includes('_')) {
    return name.split('_').filter(Boolean)
  }
  // Handle PascalCase and camelCase
  return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').split('_').filter(Boolean)
}

export function convertToCase(name: string, targetCase: string): string {
  const words = splitIntoWords(name)
  if (words.length === 0) return name

  switch (targetCase) {
    case 'SCREAMING_SNAKE_CASE':
      return words.map(w => w.toUpperCase()).join('_')
    case 'snake_case':
      return words.map(w => w.toLowerCase()).join('_')
    case 'PascalCase':
      return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('')
    case 'camelCase':
      return words.map((w, i) => {
        if (i === 0) return w.toLowerCase()
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      }).join('')
    default:
      return name
  }
}

// --- Validation ---

export function validateVariableName(name: string, config: NamingConventionConfig): NamingValidationResult {
  const issues: ValidationIssue[] = []

  // Case check
  if (config.rules.case) {
    let caseValid = false
    switch (config.rules.case) {
      case 'SCREAMING_SNAKE_CASE': caseValid = isScreamingSnakeCase(name); break
      case 'snake_case': caseValid = isSnakeCase(name); break
      case 'PascalCase': caseValid = isPascalCase(name); break
      case 'camelCase': caseValid = isCamelCase(name); break
    }
    if (!caseValid) {
      const suggestion = convertToCase(name, config.rules.case)
      issues.push({
        type: 'case',
        message: `Must be ${config.rules.case}`,
        suggestion
      })
    }
  }

  // Pattern checks
  if (config.rules.patterns) {
    for (const pattern of config.rules.patterns) {
      try {
        const regex = new RegExp(pattern.match)
        if (!regex.test(name)) {
          issues.push({
            type: 'pattern',
            message: pattern.description,
            suggestion: pattern.example
          })
        }
      } catch {
        // Skip invalid regex patterns
      }
    }
  }

  // Forbidden checks
  if (config.rules.forbidden) {
    for (const rule of config.rules.forbidden) {
      try {
        const regex = new RegExp(rule.match, 'i')
        if (regex.test(name)) {
          issues.push({
            type: 'forbidden',
            message: rule.reason
          })
        }
      } catch {
        // Skip invalid regex patterns
      }
    }
  }

  const isBlock = config.enforcement_mode === 'block'
  const suggestions = issues
    .map(i => i.suggestion)
    .filter((s): s is string => !!s)

  return {
    valid: isBlock ? issues.length === 0 : true,
    errors: isBlock ? issues : [],
    warnings: isBlock ? [] : issues,
    suggestions: [...new Set(suggestions)]
  }
}

// --- Templates ---

export const TEMPLATES: Record<string, NamingConventionConfig> = {
  standard: {
    rules: {
      case: 'SCREAMING_SNAKE_CASE',
      forbidden: [
        { match: '^(password|secret|key|token)$', reason: 'Too generic — use a descriptive name like DB_PASSWORD or API_KEY' }
      ]
    },
    enforcement_mode: 'warn',
    template_name: 'standard'
  },
  nextjs: {
    rules: {
      case: 'SCREAMING_SNAKE_CASE',
      patterns: [
        { match: '^NEXT_PUBLIC_', description: 'Client-side variables must start with NEXT_PUBLIC_', example: 'NEXT_PUBLIC_API_URL' }
      ]
    },
    enforcement_mode: 'warn',
    template_name: 'nextjs'
  },
  vite: {
    rules: {
      case: 'SCREAMING_SNAKE_CASE',
      patterns: [
        { match: '^VITE_', description: 'Client-side variables must start with VITE_', example: 'VITE_API_URL' }
      ]
    },
    enforcement_mode: 'warn',
    template_name: 'vite'
  },
  strict: {
    rules: {
      case: 'SCREAMING_SNAKE_CASE',
      forbidden: [
        { match: '^(password|secret|key|token)$', reason: 'Too generic — use a descriptive name' },
        { match: '[a-z]', reason: 'Lowercase characters not allowed in strict mode' },
        { match: '^[0-9]', reason: 'Must not start with a number' },
        { match: '__', reason: 'Double underscores not allowed' }
      ]
    },
    enforcement_mode: 'block',
    template_name: 'strict'
  }
}

export function getTemplate(templateName: string): NamingConventionConfig | null {
  return TEMPLATES[templateName] || null
}
