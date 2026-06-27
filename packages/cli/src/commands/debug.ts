import { Command } from 'commander'
import chalk from 'chalk'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { createClient } from '../lib/client.js'
import { loadConfig, getConfigPath } from '../lib/config.js'
import { getCredentials, getApiKeyFromEnv, getStoredApiKey, getStoredApiUrl } from '../lib/credentials.js'

function getCliVersion(): string {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url))
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf-8'))
    return pkg.version || 'unknown'
  } catch {
    return 'unknown'
  }
}

export const debugCommand = new Command('debug')
  .description('Collect diagnostic info for troubleshooting')
  .action(async () => {
    const lines: string[] = []
    const log = (msg: string) => lines.push(msg)

    log('=== EnvManager CLI Debug Report ===')
    log(`Timestamp: ${new Date().toISOString()}`)
    log(`CLI Version: ${getCliVersion()}`)
    log(`Node: ${process.version}`)
    log(`Platform: ${process.platform} ${process.arch}`)
    log('')

    // Config
    log('--- Config ---')
    const configPath = getConfigPath()
    const config = loadConfig()
    log(`Config file: ${configPath || 'not found'}`)
    if (config) {
      log(`  project_id: ${config.project_id || 'not set'}`)
      log(`  project_name: ${config.project_name || 'not set'}`)
      log(`  environment: ${config.environment || 'not set'}`)
      log(`  organization_id: ${config.organization_id || 'not set'}`)
      log(`  api_url: ${config.api_url || 'not set'}`)
    }
    log('')

    // Auth
    log('--- Authentication ---')
    const envApiKey = getApiKeyFromEnv()
    const storedApiKey = getStoredApiKey()
    const storedApiUrl = getStoredApiUrl()
    const creds = getCredentials()

    if (envApiKey) {
      log(`Auth method: Environment API key (${envApiKey.substring(0, 11)}...)`)
    } else if (storedApiKey) {
      log(`Auth method: CLI session key (${storedApiKey.substring(0, 11)}...)`)
    } else if (creds?.accessToken) {
      log('Auth method: Legacy session tokens')
      if (creds.expiresAt) {
        const remaining = Math.round((creds.expiresAt - Date.now()) / 1000)
        log(`  Token expires in: ${remaining > 0 ? `${remaining}s` : 'EXPIRED'}`)
      }
    } else {
      log('Auth method: Not authenticated')
    }
    log(`API URL: ${storedApiUrl || process.env.ENVMANAGER_API_URL || 'default (production)'}`)
    log('')

    // API connectivity & user
    log('--- API Connection ---')
    try {
      const start = Date.now()
      const client = await createClient()
      const authTime = Date.now() - start
      log(`Auth exchange: ${authTime}ms`)

      const userStart = Date.now()
      const { data: { user }, error: userError } = await client.auth.getUser()
      const userTime = Date.now() - userStart
      log(`getUser: ${userTime}ms`)

      if (userError) {
        log(`  ERROR: ${userError.message}`)
      } else if (user) {
        log(`  User ID: ${user.id}`)
        log(`  Email: ${user.email}`)
      }

      // Orgs
      if (user) {
        const orgStart = Date.now()
        const { data: memberships, error: orgError } = await client
          .from('organization_members')
          .select('organization_id, role, organizations(id, name)')
          .eq('user_id', user.id)
        const orgTime = Date.now() - orgStart
        log(`Org query: ${orgTime}ms`)

        if (orgError) {
          log(`  ERROR: ${orgError.message}`)
        } else if (memberships) {
          log(`  Organizations (${memberships.length}):`)
          memberships.forEach(m => {
            const org = m.organizations as { id: string; name: string } | { id: string; name: string }[] | null
            const orgName = Array.isArray(org) ? org[0]?.name : org?.name || 'Unknown'
            const orgId = Array.isArray(org) ? org[0]?.id : org?.id || '?'
            log(`    - ${orgName} (${m.role}) [${orgId.substring(0, 8)}...]`)
          })
        }
      }
    } catch (error) {
      log(`  ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    log('')
    log('=== End Debug Report ===')

    // Print all lines
    const output = lines.join('\n')
    console.log(output)

    console.log('')
    console.log(chalk.gray('Copy the output above and share it for troubleshooting.'))
    console.log(chalk.gray('Note: API keys are partially redacted. No secrets are exposed.'))
  })
