import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { writeFileSync, existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { parse as parseDotenv } from 'dotenv'
import { createClient, refreshClientAuth } from '../lib/client.js'
import { loadConfig, ensureConfig } from '../lib/config.js'
import {
  subscribeToVariableChanges,
  fetchAllVariables,
  type VariableChangeEvent
} from '../lib/realtime.js'
import { EnvFileWatcher, formatEnvFile } from '../lib/watcher.js'
import { mergeWithRemote } from '../lib/conflict.js'
import { resolveProjectId, resolveOrganizationId, resolveServiceId } from '../lib/resolve.js'
import { Variable } from '../lib/types.js'

export const devCommand = new Command('dev')
  .description('Start real-time sync daemon - watches for remote variable changes')
  .option('--org <name>', 'Organization name (required if you belong to multiple)')
  .option('-e, --environment <name>', 'Environment name (default: from config or "development")')
  .option('-p, --project <id>', 'Project ID (default: from config)')
  .option('--output <file>', 'Output file path (default: .env)')
  .option('--no-watch', 'Disable local file watching')
  .option('--strategy <type>', 'Merge strategy: remote_wins, local_wins, merge_new (default: remote_wins)', 'remote_wins')
  .option('--tag <tags...>', 'Filter by tags (untagged variables always included)')
  .option('--service <name>', 'Filter by service name')
  .action(async (options) => {
    const spinner = ora('Starting dev mode...').start()
    
    try {
      let config = loadConfig()
      let projectInput = options.project || config?.project_id

      if (!projectInput) {
        spinner.stop()
        config = await ensureConfig()
        projectInput = options.project || config.project_id
        spinner.start('Starting dev mode...')
      }

      if (!projectInput) {
        spinner.fail('No project specified')
        process.exit(1)
      }

      const envName = options.environment || config?.environment || 'development'
      const outputFile = resolve(options.output || '.env')
      const watchLocal = options.watch !== false
      const strategy = options.strategy as 'remote_wins' | 'local_wins' | 'merge_new'

      spinner.text = 'Authenticating...'
      const client = await createClient()

      // Resolve organization (auto-selects for single-org users)
      let organizationId: string
      try {
        organizationId = await resolveOrganizationId(options.org, client, projectInput)
      } catch (error) {
        spinner.fail(error instanceof Error ? error.message : 'Failed to resolve organization')
        process.exit(1)
      }

      // Resolve project (accepts UUID, friendly ID, or name)
      let projectId: string
      try {
        projectId = await resolveProjectId(projectInput, client, organizationId)
      } catch (error) {
        spinner.fail(error instanceof Error ? error.message : 'Failed to resolve project')
        process.exit(1)
      }

      // Resolve service (from flag or config)
      const serviceName = options.service || config?.service
      let serviceId: string | undefined
      if (serviceName) {
        try {
          serviceId = await resolveServiceId(serviceName, client, projectId)
        } catch (error) {
          spinner.fail(error instanceof Error ? error.message : 'Failed to resolve service')
          process.exit(1)
        }
      }

      spinner.text = 'Fetching environment...'
      const { data: environment, error: envError } = await client
        .from('environments')
        .select('id, name, project_id')
        .eq('project_id', projectId)
        .ilike('name', envName)
        .single()

      if (envError || !environment) {
        spinner.fail(`Environment "${envName}" not found in project`)
        process.exit(1)
      }

      const environmentId = environment.id

      const filterTags: string[] = options.tag || config?.tags || []
      const applyTagFilter = <T extends { tags?: string[] }>(vars: T[]): T[] => {
        if (filterTags.length === 0) return vars
        return vars.filter(v => {
          const t = v.tags || []
          return t.length === 0 || t.some(tag => filterTags.includes(tag))
        })
      }

      spinner.text = 'Performing initial sync...'
      const remoteVariables = applyTagFilter(await fetchAllVariables(environmentId, true, serviceId))
      
      let localVariables = new Map<string, string>()
      if (existsSync(outputFile)) {
        const content = readFileSync(outputFile, 'utf-8')
        localVariables = new Map(Object.entries(parseDotenv(content)))
      }

      const merged = mergeWithRemote(
        localVariables,
        remoteVariables,
        strategy
      )
      
      writeFileSync(outputFile, formatEnvFile(merged))
      
      spinner.text = 'Connecting to realtime...'
      
      let fileWatcher: EnvFileWatcher | null = null
      let isPaused = false
      let lastRemoteKeys: string | null = null // serialized key list for change detection

      // Sync remote state to local .env file
      async function syncRemoteToLocal(silent = false): Promise<boolean> {
        const updatedVariables = applyTagFilter(await fetchAllVariables(environmentId, true, serviceId))
        const currentLocal = new Map<string, string>()
        if (existsSync(outputFile)) {
          const content = readFileSync(outputFile, 'utf-8')
          Object.entries(parseDotenv(content)).forEach(([k, v]) => {
            currentLocal.set(k, v)
          })
        }

        const newMerged = mergeWithRemote(currentLocal, updatedVariables, strategy)

        // Check if anything actually changed
        const remoteKeySig = [...newMerged.entries()].sort().map(([k, v]) => `${k}=${v}`).join('\n')
        if (remoteKeySig === lastRemoteKeys) return false
        lastRemoteKeys = remoteKeySig

        if (!silent) {
          // Detect what changed for logging
          const timestamp = new Date().toLocaleTimeString()
          for (const key of currentLocal.keys()) {
            if (!newMerged.has(key)) {
              console.log(chalk.red(`[${timestamp}] - ${key}`))
            }
          }
          for (const [key] of newMerged) {
            if (!currentLocal.has(key)) {
              console.log(chalk.green(`[${timestamp}] + ${key}`))
            }
          }
        }

        writeFileSync(outputFile, formatEnvFile(newMerged))
        return true
      }

      // Set initial signature
      const initialKeys = [...merged.entries()].sort().map(([k, v]) => `${k}=${v}`).join('\n')
      lastRemoteKeys = initialKeys

      const subscription = await subscribeToVariableChanges(
        environmentId,
        async (event: VariableChangeEvent) => {
          if (isPaused) return

          const timestamp = new Date().toLocaleTimeString()

          switch (event.action) {
            case 'INSERT':
              console.log(chalk.green(`[${timestamp}] + ${event.key}`))
              break
            case 'UPDATE':
              if (event.old_key && event.old_key !== event.key) {
                console.log(chalk.yellow(`[${timestamp}] ~ ${event.old_key} -> ${event.key}`))
              } else {
                console.log(chalk.yellow(`[${timestamp}] ~ ${event.key}`))
              }
              break
            case 'DELETE':
              console.log(chalk.red(`[${timestamp}] - ${event.key}`))
              break
          }

          isPaused = true
          try {
            await syncRemoteToLocal(true) // silent — we already logged the event
          } finally {
            isPaused = false
          }
        },
        (status, message) => {
          switch (status) {
            case 'connected':
              console.log(chalk.green('  Realtime connected'))
              break
            case 'disconnected':
              console.log(chalk.yellow('\nDisconnected from realtime'))
              break
            case 'reconnecting':
              console.log(chalk.yellow(`\nReconnecting... ${message || ''}`))
              break
            case 'error':
              console.log(chalk.red(`\nRealtime error: ${message || ''}`))
              break
          }
        }
      )

      if (watchLocal) {
        fileWatcher = new EnvFileWatcher(outputFile)
        fileWatcher.on('change', () => {
          if (!isPaused) {
            console.log(chalk.gray(`[${new Date().toLocaleTimeString()}] Local file changed`))
          }
        })
        fileWatcher.on('error', (error) => {
          console.error(chalk.red(`File watcher error: ${error.message}`))
        })
        fileWatcher.start()
      }

      spinner.succeed('Dev mode started')
      console.log('')
      console.log(chalk.cyan('  Project:'), projectId)
      console.log(chalk.cyan('  Environment:'), envName)
      if (serviceName) {
        console.log(chalk.cyan('  Service:'), serviceName)
      }
      console.log(chalk.cyan('  Output:'), outputFile)
      console.log(chalk.cyan('  Strategy:'), strategy)
      console.log(chalk.cyan('  Watching:'), watchLocal ? 'local + remote' : 'remote only')
      console.log('')
      console.log(chalk.gray('Watching for changes. Press Ctrl+C to stop.'))
      console.log('')

      let isCleaningUp = false

      // Periodic poll to catch missed realtime events (e.g. DELETEs)
      const POLL_INTERVAL_MS = 5000
      const pollInterval = setInterval(async () => {
        if (isPaused) return
        isPaused = true
        try {
          await syncRemoteToLocal()
        } catch {
          // Poll failed, will retry next interval
        } finally {
          isPaused = false
        }
      }, POLL_INTERVAL_MS)

      const TOKEN_REFRESH_INTERVAL_MS = 30 * 60 * 1000
      const refreshInterval = setInterval(async () => {
        try {
          await refreshClientAuth()
        } catch {
          // Token refresh failed, will retry on next interval
        }
      }, TOKEN_REFRESH_INTERVAL_MS)

      const cleanup = () => {
        if (isCleaningUp) {
          console.log(chalk.gray('\nForce exiting...'))
          process.exit(1)
        }
        isCleaningUp = true
        console.log(chalk.gray('\nStopping dev mode...'))
        
        clearInterval(pollInterval)
        clearInterval(refreshInterval)
        fileWatcher?.stop()
        
        subscription.unsubscribe()
          .catch(() => {})
          .finally(() => process.exit(0))
        
        setTimeout(() => {
          console.log(chalk.yellow('Cleanup timeout, forcing exit...'))
          process.exit(0)
        }, 2000)
      }

      process.on('SIGINT', cleanup)
      process.on('SIGTERM', cleanup)

      await new Promise(() => {})

    } catch (error) {
      spinner.fail('Dev mode failed')
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'))
      process.exit(1)
    }
  })
