import { existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { z } from 'zod'
import { EXPORT_FORMATS } from './formatters.js'

const ConfigSchema = z.object({
  project_id: z.string().uuid().optional(),
  project_name: z.string().optional(),
  environment: z.string().optional(),
  environment_id: z.string().uuid().optional(),
  organization_id: z.string().uuid().optional(),
  output: z.string().default('.env'),
  api_url: z.string().url().optional(),
  format: z.enum(EXPORT_FORMATS as [string, ...string[]]).optional(),
  k8s_namespace: z.string().optional(),
  k8s_name: z.string().optional(),
  tags: z.array(z.string()).optional(),
  service: z.string().optional(),
  agent: z
    .object({
      allowed_keys: z.array(z.string()).optional(),
    })
    .optional(),
})

export type Config = z.infer<typeof ConfigSchema>

const CONFIG_FILENAMES = ['envmanager.json', '.envmanagerrc']

function findConfigFile(startDir: string = process.cwd()): string | null {
  let currentDir = startDir
  
  while (currentDir !== dirname(currentDir)) {
    for (const filename of CONFIG_FILENAMES) {
      const configPath = join(currentDir, filename)
      if (existsSync(configPath)) {
        return configPath
      }
    }
    currentDir = dirname(currentDir)
  }
  
  return null
}

export function loadConfig(): Config | null {
  const configPath = findConfigFile()
  
  if (!configPath) {
    return null
  }
  
  try {
    const content = readFileSync(configPath, 'utf-8')
    const parsed = JSON.parse(content)
    return ConfigSchema.parse(parsed)
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Invalid config file:', error.errors)
    }
    return null
  }
}

export function getConfigPath(): string | null {
  return findConfigFile()
}

/**
 * Ensure a config exists. If missing and interactive, run the init flow.
 * In non-interactive mode (CI/piped), throws with a helpful message.
 */
export async function ensureConfig(): Promise<Config> {
  const existing = loadConfig()
  if (existing) return existing

  // Dynamic import to keep happy path fast
  const { isInteractive } = await import('./interactive.js')

  if (!isInteractive()) {
    console.error('No envmanager.json found.')
    console.error('Run `envmanager init` or use --project <id> to specify a project.')
    process.exit(1)
  }

  const { confirmInit } = await import('./interactive.js')
  const wantsInit = await confirmInit()

  if (!wantsInit) {
    console.error('Run `envmanager init` to set up a project in this directory.')
    process.exit(1)
  }

  const { runInteractiveInit } = await import('./interactive-init.js')
  const config = await runInteractiveInit()

  if (!config) {
    process.exit(1)
  }

  return config
}
