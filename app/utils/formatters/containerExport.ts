import * as yaml from 'js-yaml'
import type { ExportVariable, K8sExportConfig } from '~/types/export'

/**
 * Base64 encode a string, handling unicode safely
 */
export function base64Encode(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
}

/**
 * Sanitize a name to be valid K8s resource name (DNS subdomain format)
 * - lowercase
 * - alphanumeric and hyphens only
 * - no leading/trailing hyphens
 * - max 63 chars
 */
export function sanitizeK8sName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 63)
}

/**
 * Generate Kubernetes Secret YAML with base64-encoded values
 */
export function toKubernetesSecret(
  variables: ExportVariable[],
  config: K8sExportConfig
): string {
  const data: Record<string, string> = {}
  for (const v of variables) {
    data[v.key] = base64Encode(v.value)
  }

  const manifest = {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: {
      name: config.name,
      namespace: config.namespace,
      ...(config.labels && Object.keys(config.labels).length > 0 ? { labels: config.labels } : {})
    },
    type: 'Opaque',
    data
  }

  return yaml.dump(manifest, { lineWidth: -1, quotingType: '"' })
}

/**
 * Generate Kubernetes ConfigMap YAML with plain values
 */
export function toKubernetesConfigMap(
  variables: ExportVariable[],
  config: K8sExportConfig
): string {
  const data: Record<string, string> = {}
  for (const v of variables) {
    data[v.key] = v.value
  }

  const manifest = {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: {
      name: config.name,
      namespace: config.namespace,
      ...(config.labels && Object.keys(config.labels).length > 0 ? { labels: config.labels } : {})
    },
    data
  }

  return yaml.dump(manifest, { lineWidth: -1, quotingType: '"' })
}

/**
 * Generate Docker Compose environment section snippet
 * Returns a YAML snippet to paste into services definition
 */
export function toDockerCompose(variables: ExportVariable[]): string {
  const envData: Record<string, string> = {}
  for (const v of variables) {
    envData[v.key] = v.value
  }

  const snippet = {
    services: {
      app: {
        environment: envData
      }
    }
  }

  const yamlOutput = yaml.dump(snippet, { lineWidth: -1, quotingType: '"' })

  return `# Docker Compose environment section
# Copy this into your docker-compose.yml and replace 'app' with your service name
${yamlOutput}`
}

/**
 * Generate .env file format (KEY=value)
 */
export function toDotEnv(variables: ExportVariable[]): string {
  return variables
    .map(v => {
      // Quote values with spaces, newlines, equals, or special chars
      const needsQuotes = /[\s='"#\n\r]/.test(v.value)
      const value = needsQuotes
        ? `"${v.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`
        : v.value
      return `${v.key}=${value}`
    })
    .join('\n')
}

/**
 * Generate Vercel CLI commands to add environment variables
 * Docs: https://vercel.com/docs/cli/env
 */
export function toVercelCLI(variables: ExportVariable[]): string {
  if (variables.length === 0) {
    return '# No variables to export'
  }

  const header = `# Vercel CLI commands to add environment variables
# Run these commands in your project directory
# Docs: https://vercel.com/docs/cli/env
# Note: You may need to run 'vercel login' first

`

  const commands = variables.map(v => {
    // Check if value contains newlines
    if (v.value.includes('\n')) {
      // Use heredoc for multiline values
      const escapedValue = v.value.replace(/'/g, "'\\''")
      return `vercel env add ${v.key} production << 'EOF'\n${escapedValue}\nEOF`
    } else {
      // Escape quotes in value
      const escapedValue = v.value.replace(/'/g, "'\\''")
      return `echo '${escapedValue}' | vercel env add ${v.key} production`
    }
  }).join('\n\n')

  return header + commands
}

/**
 * Generate Railway CLI commands to set environment variables
 * Docs: https://docs.railway.app/reference/cli-api#variables-set
 */
export function toRailwayCLI(variables: ExportVariable[]): string {
  if (variables.length === 0) {
    return '# No variables to export'
  }

  const header = `# Railway CLI commands to set environment variables
# Run these commands in your project directory
# Docs: https://docs.railway.app/reference/cli-api#variables-set
# Note: You may need to run 'railway login' first

`

  const commands = variables.map(v => {
    // Escape quotes in value
    const escapedValue = v.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    return `railway variables set ${v.key}="${escapedValue}"`
  }).join('\n')

  return header + commands
}

/**
 * Generate Render CLI commands to set environment variables
 * Docs: https://render.com/docs/cli
 */
export function toRenderCLI(variables: ExportVariable[]): string {
  if (variables.length === 0) {
    return '# No variables to export'
  }

  const header = `# Render CLI commands to set environment variables
# Run these commands in your project directory
# Docs: https://render.com/docs/cli
# Note: You may need to authenticate first

`

  const commands = variables.map(v => {
    // Escape quotes and special shell characters
    const escapedValue = v.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    return `render env:set ${v.key}="${escapedValue}"`
  }).join('\n')

  return header + commands
}
