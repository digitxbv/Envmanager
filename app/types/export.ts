export type ExportFormat = 'k8s-secret' | 'k8s-configmap' | 'docker-compose' | 'dotenv' | 'vercel-cli' | 'railway-cli' | 'render-cli' | 'envmanager-cli'

export interface ExportVariable {
  key: string
  value: string
  isSecret: boolean
}

export interface K8sExportConfig {
  name: string           // Resource name (must be valid K8s DNS subdomain)
  namespace: string      // Default: 'default'
  labels?: Record<string, string>
}

export interface ExportConfig extends K8sExportConfig {
  format: ExportFormat
  includeSecrets: boolean
  selectedIds?: string[] // If empty/undefined, include all
}
