import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '../lib/client.js'
import { loadConfig, ensureConfig } from '../lib/config.js'
import { resolveProjectId, resolveOrganizationId } from '../lib/resolve.js'
import { Variable } from '../lib/types.js'
import { parseEnvFile } from '../lib/parser.js'

export const diffCommand = new Command('diff')
  .description('Show differences between local .env and EnvManager')
  .option('--org <name>', 'Organization name (required if you belong to multiple)')
  .option('-e, --environment <name>', 'Environment name (default: from config or "development")')
  .option('-p, --project <id>', 'Project ID (default: from config)')
  .option('-i, --input <file>', 'Input file path (default: .env)')
  .option('--keys-only', 'Only show key names, not values')
  .option('--tag <tags...>', 'Filter by tags (untagged variables always included)')
  .action(async (options) => {
    const spinner = ora('Comparing...').start()
    
    try {
      let config = loadConfig()
      let projectInput = options.project || config?.project_id

      if (!projectInput) {
        spinner.stop()
        config = await ensureConfig()
        projectInput = options.project || config.project_id
        spinner.start('Comparing...')
      }

      if (!projectInput) {
        spinner.fail('No project specified')
        process.exit(1)
      }

      const envName = options.environment || config?.environment || 'development'
      const inputFile = resolve(options.input || '.env')
      const keysOnly = options.keysOnly === true

      let localVars = new Map<string, string>()
      
      if (existsSync(inputFile)) {
        const content = readFileSync(inputFile, 'utf-8')
        localVars = parseEnvFile(content)
      }

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

      spinner.text = 'Fetching environment...'
      const { data: environment, error: envError } = await client
        .from('environments')
        .select('id')
        .eq('project_id', projectId)
        .ilike('name', envName)
        .single()

      if (envError || !environment) {
        spinner.fail(`Environment "${envName}" not found`)
        process.exit(1)
      }

      spinner.text = 'Fetching remote variables...'
      const { data: remoteVarsData, error: varError } = await client.rpc('get_variables_for_sync', {
        p_environment_id: environment.id,
        p_sync_secrets: true,
        p_sync_variables: true,
        p_include_fallbacks: false,
      })

      if (varError) {
        spinner.fail('Failed to fetch remote variables')
        console.error(chalk.red(varError.message))
        process.exit(1)
      }

      const filterTags: string[] = options.tag || config?.tags || []
      const filteredRemoteData = filterTags.length > 0
        ? ((remoteVarsData as Variable[]) || []).filter(v => {
            const t = v.tags || []
            return t.length === 0 || t.some(tag => filterTags.includes(tag))
          })
        : (remoteVarsData as Variable[]) || []

      const remoteVars = new Map<string, Variable>()
      for (const v of filteredRemoteData) {
        remoteVars.set(v.key, v)
      }

      spinner.stop()

      const allKeys = new Set([...localVars.keys(), ...remoteVars.keys()])
      const added: string[] = []
      const removed: string[] = []
      const modified: string[] = []
      const unchanged: string[] = []

      for (const key of allKeys) {
        const localVal = localVars.get(key)
        const remoteVar = remoteVars.get(key)

        if (localVal !== undefined && !remoteVar) {
          added.push(key)
        } else if (localVal === undefined && remoteVar) {
          removed.push(key)
        } else if (localVal !== remoteVar?.value) {
          modified.push(key)
        } else {
          unchanged.push(key)
        }
      }

      if (added.length === 0 && removed.length === 0 && modified.length === 0) {
        console.log(chalk.green('\nNo differences found.'))
        console.log(chalk.gray(`${unchanged.length} variables in sync.`))
        process.exit(0)
      }

      console.log('')

      if (added.length > 0) {
        console.log(chalk.green(`+ ${added.length} to add (local only):`))
        added.sort().forEach(key => {
          if (keysOnly) {
            console.log(chalk.green(`  + ${key}`))
          } else {
            const val = localVars.get(key) || ''
            const display = val.length > 30 ? val.substring(0, 30) + '...' : val
            console.log(chalk.green(`  + ${key}=${display}`))
          }
        })
        console.log('')
      }

      if (removed.length > 0) {
        console.log(chalk.red(`- ${removed.length} to remove (remote only):`))
        removed.sort().forEach(key => {
          const remoteVar = remoteVars.get(key)
          const secretBadge = remoteVar?.is_secret ? chalk.yellow(' [secret]') : ''
          console.log(chalk.red(`  - ${key}${secretBadge}`))
        })
        console.log('')
      }

      if (modified.length > 0) {
        console.log(chalk.yellow(`~ ${modified.length} modified:`))
        modified.sort().forEach(key => {
          const remoteVar = remoteVars.get(key)
          const secretBadge = remoteVar?.is_secret ? chalk.yellow(' [secret]') : ''
          console.log(chalk.yellow(`  ~ ${key}${secretBadge}`))
        })
        console.log('')
      }

      console.log(chalk.gray(`${unchanged.length} unchanged`))

    } catch (error) {
      spinner.fail('Diff failed')
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'))
      process.exit(1)
    }
  })
