import * as yaml from 'js-yaml'

export type ExportFormat = 'dotenv' | 'docker-compose' | 'k8s-secret' | 'k8s-configmap' | 'vercel' | 'railway' | 'render'

export const EXPORT_FORMATS: ExportFormat[] = [
  'dotenv', 'docker-compose', 'k8s-secret', 'k8s-configmap', 'vercel', 'railway', 'render'
]

export interface ExportVariable {
  key: string
  value: string
  isSecret: boolean
}

export interface K8sConfig {
  name: string
  namespace: string
}

/**
 * Sanitize a name to be valid K8s resource name (DNS subdomain format)
 */
export function sanitizeK8sName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 63)
}

export function toDotEnv(variables: ExportVariable[]): string {
  return variables
    .map(v => {
      const needsQuotes = /[\s='"#\n\r]/.test(v.value)
      const value = needsQuotes
        ? `"${v.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`
        : v.value
      return `${v.key}=${value}`
    })
    .join('\n')
}

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

  return `# Docker Compose environment section\n# Copy this into your docker-compose.yml and replace 'app' with your service name\n${yamlOutput}`
}

export function toKubernetesSecret(variables: ExportVariable[], config: K8sConfig): string {
  const data: Record<string, string> = {}
  for (const v of variables) {
    data[v.key] = Buffer.from(v.value).toString('base64')
  }

  const manifest = {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: {
      name: config.name,
      namespace: config.namespace,
    },
    type: 'Opaque',
    data
  }

  return yaml.dump(manifest, { lineWidth: -1, quotingType: '"' })
}

export function toKubernetesConfigMap(variables: ExportVariable[], config: K8sConfig): string {
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
    },
    data
  }

  return yaml.dump(manifest, { lineWidth: -1, quotingType: '"' })
}

export function toVercelCLI(variables: ExportVariable[]): string {
  if (variables.length === 0) return '# No variables to export'

  const header = `# Vercel CLI commands to add environment variables
# Run these commands in your project directory
# Docs: https://vercel.com/docs/cli/env
# Note: You may need to run 'vercel login' first

`

  const commands = variables.map(v => {
    if (v.value.includes('\n')) {
      const escapedValue = v.value.replace(/'/g, "'\\''")
      return `vercel env add ${v.key} production << 'EOF'\n${escapedValue}\nEOF`
    } else {
      const escapedValue = v.value.replace(/'/g, "'\\''")
      return `echo '${escapedValue}' | vercel env add ${v.key} production`
    }
  }).join('\n\n')

  return header + commands
}

export function toRailwayCLI(variables: ExportVariable[]): string {
  if (variables.length === 0) return '# No variables to export'

  const header = `# Railway CLI commands to set environment variables
# Run these commands in your project directory
# Docs: https://docs.railway.app/reference/cli-api#variables-set
# Note: You may need to run 'railway login' first

`

  const commands = variables.map(v => {
    const escapedValue = v.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    return `railway variables set ${v.key}="${escapedValue}"`
  }).join('\n')

  return header + commands
}

export function toRenderCLI(variables: ExportVariable[]): string {
  if (variables.length === 0) return '# No variables to export'

  const header = `# Render CLI commands to set environment variables
# Run these commands in your project directory
# Docs: https://render.com/docs/cli
# Note: You may need to authenticate first

`

  const commands = variables.map(v => {
    const escapedValue = v.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    return `render env:set ${v.key}="${escapedValue}"`
  }).join('\n')

  return header + commands
}

export function formatVariables(
  variables: ExportVariable[],
  format: ExportFormat,
  k8sConfig?: K8sConfig
): string {
  switch (format) {
    case 'dotenv':
      return toDotEnv(variables)
    case 'docker-compose':
      return toDockerCompose(variables)
    case 'k8s-secret':
      return toKubernetesSecret(variables, k8sConfig ?? { name: 'app-secrets', namespace: 'default' })
    case 'k8s-configmap':
      return toKubernetesConfigMap(variables, k8sConfig ?? { name: 'app-config', namespace: 'default' })
    case 'vercel':
      return toVercelCLI(variables)
    case 'railway':
      return toRailwayCLI(variables)
    case 'render':
      return toRenderCLI(variables)
  }
}
