import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '../lib/client.js'
import { loadConfig, ensureConfig } from '../lib/config.js'
import { resolveProjectId, resolveOrganizationId, resolveServiceId } from '../lib/resolve.js'
import { track, flushTelemetry, environmentKind, classifyError } from '../lib/telemetry.js'
import { parseEnvFileAsArray } from '../lib/parser.js'
import { validateVariableName, type NamingConventionConfig } from '../lib/naming-conventions.js'

export const pushCommand = new Command('push')
  .description('Push local .env file to EnvManager')
  .option('--org <name>', 'Organization name (required if you belong to multiple)')
  .option('-e, --environment <name>', 'Environment name (default: from config or "development")')
  .option('-p, --project <id>', 'Project ID (default: from config)')
  .option('-i, --input <file>', 'Input file path (default: .env)')
  .option('--secrets <keys>', 'Comma-separated list of keys to mark as secrets')
  .option('--all-secrets', 'Mark all variables as secrets')
  .option('--service <name>', 'Push to specific service')
  .option('--dry-run', 'Show what would be pushed without making changes')
  .action(async (options) => {
    const startedAt = Date.now()
    const spinner = ora('Reading .env file...').start()
    let environmentName: string | undefined

    const bail = async (error_code: string): Promise<never> => {
      track('cli_push_completed', {
        status: 'error',
        error_code,
        duration_ms: Date.now() - startedAt,
        environment_kind: environmentKind(environmentName),
      })
      await flushTelemetry()
      process.exit(1)
    }

    try {
      let config = loadConfig()
      let projectInput = options.project || config?.project_id

      if (!projectInput) {
        spinner.stop()
        config = await ensureConfig()
        projectInput = options.project || config.project_id
        spinner.start('Reading .env file...')
      }

      if (!projectInput) {
        spinner.fail('No project specified')
        return bail('project_not_specified')
      }

      const envName = options.environment || config?.environment || 'development'
      environmentName = envName
      const inputFile = resolve(options.input || '.env')
      const secretKeys = options.secrets ? options.secrets.split(',').map((k: string) => k.trim()) : []
      const allSecrets = options.allSecrets === true

      if (!existsSync(inputFile)) {
        spinner.fail(`File not found: ${inputFile}`)
        return bail('file_not_found')
      }

      const content = readFileSync(inputFile, 'utf-8')
      const vars = parseEnvFileAsArray(content)

      if (vars.length === 0) {
        spinner.warn('No variables found in file')
        track('cli_push_completed', {
          status: 'empty',
          duration_ms: Date.now() - startedAt,
          variable_count: 0,
          environment_kind: environmentKind(environmentName),
        })
        await flushTelemetry()
        process.exit(0)
      }

      spinner.text = `Found ${vars.length} variables`

      if (options.dryRun) {
        spinner.succeed('Dry run - changes NOT applied')
        console.log(chalk.gray('\nVariables to push:'))
        vars.forEach(v => {
          const isSecret = allSecrets || secretKeys.includes(v.key)
          const secretBadge = isSecret ? chalk.yellow(' [secret]') : ''
          console.log(`  ${v.key}=${v.value.substring(0, 20)}${v.value.length > 20 ? '...' : ''}${secretBadge}`)
        })
        track('cli_push_completed', {
          status: 'success',
          dry_run: true,
          duration_ms: Date.now() - startedAt,
          variable_count: vars.length,
          environment_kind: environmentKind(environmentName),
        })
        await flushTelemetry()
        process.exit(0)
      }

      spinner.text = 'Authenticating...'
      const client = await createClient()

      // Resolve organization (auto-selects for single-org users)
      let organizationId: string
      try {
        organizationId = await resolveOrganizationId(options.org, client, projectInput)
      } catch (error) {
        spinner.fail(error instanceof Error ? error.message : 'Failed to resolve organization')
        return bail('org_not_resolved')
      }

      // Resolve project (accepts UUID, friendly ID, or name)
      let projectId: string
      try {
        projectId = await resolveProjectId(projectInput, client, organizationId)
      } catch (error) {
        spinner.fail(error instanceof Error ? error.message : 'Failed to resolve project')
        return bail('project_not_found')
      }

      // Resolve service (from flag or config)
      const serviceName = options.service || config?.service
      let serviceId: string | undefined
      if (serviceName) {
        try {
          serviceId = await resolveServiceId(serviceName, client, projectId)
        } catch (error) {
          spinner.fail(error instanceof Error ? error.message : 'Failed to resolve service')
          return bail('service_not_found')
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
        return bail('environment_not_found')
      }


      // Validate naming conventions
      spinner.text = 'Checking naming conventions...'
      const { data: namingRules } = await client
        .from('naming_conventions')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('project_id', projectId)
        .maybeSingle()

      // Fall back to org-level rules if no project override
      let namingConfig: NamingConventionConfig | null = null
      if (namingRules) {
        namingConfig = {
          rules: namingRules.rules as any,
          enforcement_mode: namingRules.enforcement_mode as 'warn' | 'block',
          template_name: namingRules.template_name || undefined
        }
      } else {
        const { data: orgRules } = await client
          .from('naming_conventions')
          .select('*')
          .eq('organization_id', organizationId)
          .is('project_id', null)
          .maybeSingle()

        if (orgRules) {
          namingConfig = {
            rules: orgRules.rules as any,
            enforcement_mode: orgRules.enforcement_mode as 'warn' | 'block',
            template_name: orgRules.template_name || undefined
          }
        }
      }

      if (namingConfig) {
        const issues: Array<{ key: string; message: string; suggestion?: string }> = []

        for (const v of vars) {
          const result = validateVariableName(v.key, namingConfig)
          const allIssues = [...result.errors, ...result.warnings]
          for (const issue of allIssues) {
            issues.push({ key: v.key, message: issue.message, suggestion: issue.suggestion })
          }
        }

        if (issues.length > 0) {
          const isBlock = namingConfig.enforcement_mode === 'block'

          console.log('')
          console.log(chalk[isBlock ? 'red' : 'yellow'](`  Naming convention ${isBlock ? 'errors' : 'warnings'}:`))
          for (const issue of issues) {
            const suggestion = issue.suggestion ? chalk.gray(` → ${issue.suggestion}`) : ''
            console.log(chalk[isBlock ? 'red' : 'yellow'](`    ${issue.key}: ${issue.message}${suggestion}`))
          }
          console.log('')

          if (isBlock) {
            spinner.fail('Push blocked by naming convention errors')
            track('cli_push_completed', {
              status: 'error',
              error_code: 'naming_block',
              naming_block_hit: true,
              duration_ms: Date.now() - startedAt,
              variable_count: vars.length,
              environment_kind: environmentKind(environmentName),
            })
            await flushTelemetry()
            process.exit(1)
          }
        }
      }

      spinner.text = 'Pushing variables...'

      const markAsSecrets = allSecrets || secretKeys.length > 0
      const variablesData = vars.map(v => ({
        key: v.key,
        value: v.value,
      }))

      // Delete existing variables first, then bulk insert (upsert pattern)
      // Get existing keys to determine insert vs update counts
      let existingQuery = client
        .from('variables')
        .select('key')
        .eq('environment_id', environment.id)
      if (serviceId) {
        existingQuery = existingQuery.eq('service_id', serviceId)
      } else {
        existingQuery = existingQuery.is('service_id', null)
      }
      const { data: existingVars } = await existingQuery

      const existingKeys = new Set((existingVars || []).map((v: { key: string }) => v.key))
      const keysToUpdate = variablesData.filter(v => existingKeys.has(v.key))
      const keysToInsert = variablesData.filter(v => !existingKeys.has(v.key))

      // Delete variables that will be overwritten
      if (keysToUpdate.length > 0) {
        let deleteQuery = client
          .from('variables')
          .delete()
          .eq('environment_id', environment.id)
          .in('key', keysToUpdate.map(v => v.key))
        if (serviceId) {
          deleteQuery = deleteQuery.eq('service_id', serviceId)
        } else {
          deleteQuery = deleteQuery.is('service_id', null)
        }
        const { error: deleteError } = await deleteQuery

        if (deleteError) {
          spinner.fail('Failed to update existing variables')
          console.error(chalk.red(deleteError.message))
          return bail('rpc_error')
        }
      }

      const { error: pushError } = await client.rpc('bulk_insert_variables', {
        variables_data: variablesData,
        environment_id_param: environment.id,
        organization_id_param: organizationId,
        import_as_secrets: markAsSecrets,
        ...(serviceId && { service_id_param: serviceId }),
      })

      if (pushError) {
        spinner.fail('Push failed')
        console.error(chalk.red(pushError.message))
        return bail('rpc_error')
      }

      const serviceInfo = serviceName ? ` (service: ${serviceName})` : ''
      spinner.succeed(`Pushed ${vars.length} variables to ${envName}${serviceInfo}`)
      if (keysToUpdate.length > 0) {
        console.log(chalk.gray(`  ${keysToInsert.length} inserted, ${keysToUpdate.length} updated`))
      }
      if (markAsSecrets) {
        console.log(chalk.gray(`  All marked as secrets`))
      }

      track('cli_push_completed', {
        status: 'success',
        dry_run: false,
        duration_ms: Date.now() - startedAt,
        variable_count: vars.length,
        inserted_count: keysToInsert.length,
        updated_count: keysToUpdate.length,
        all_secrets: markAsSecrets,
        used_service: Boolean(serviceId),
        naming_block_hit: false,
        environment_kind: environmentKind(environmentName),
      })

    } catch (error) {
      spinner.fail('Push failed')
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'))
      return bail(classifyError(error))
    }
  })
