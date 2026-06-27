import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '../lib/client.js'
import { loadConfig, ensureConfig } from '../lib/config.js'
import { resolveProjectId, resolveOrganizationId, resolveServiceId } from '../lib/resolve.js'
import { track, flushTelemetry, environmentKind, classifyError, getCliVersion } from '../lib/telemetry.js'
import { Variable } from '../lib/types.js'
import { resolveAll, detectCircularReferences, type VariableInput, type ResolvedVariable } from '../lib/variable-references.js'
import { formatVariables, sanitizeK8sName, EXPORT_FORMATS, type ExportFormat, type ExportVariable, type K8sConfig } from '../lib/formatters.js'

export const pullCommand = new Command('pull')
  .description('Pull environment variables from EnvManager to local .env file')
  .option('--org <name>', 'Organization name (required if you belong to multiple)')
  .option('-e, --environment <name>', 'Environment name (default: from config or "development")')
  .option('-p, --project <id>', 'Project ID (default: from config)')
  .option('-o, --output <file>', 'Output file path (default: .env)')
  .option('--no-secrets', 'Exclude secret values (will be empty)')
  .option('-f, --force', 'Overwrite existing file without prompting')
  .option('-r, --resolve-references', 'Resolve ${VAR} references to their values')
  .option('-F, --include-fallbacks', 'Include fallback values for empty variables')
  .option('-s, --show-sources', 'Show value source as inline comments')
  .option('--format <type>', `Export format (${EXPORT_FORMATS.join(', ')})`)
  .option('--k8s-namespace <ns>', 'Kubernetes namespace (default: "default")')
  .option('--k8s-name <name>', 'Kubernetes resource name')
  .option('--tag <tags...>', 'Filter by tags (untagged variables always included)')
  .option('--service <name>', 'Filter by service name')
  .action(async (options) => {
    const startedAt = Date.now()
    const spinner = ora('Connecting to EnvManager...').start()
    let environmentName: string | undefined

    const bail = async (error_code: string): Promise<never> => {
      track('cli_pull_completed', {
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
        spinner.start('Connecting to EnvManager...')
      }

      if (!projectInput) {
        spinner.fail('No project specified')
        return bail('project_not_specified')
      }

      const envName = options.environment || config?.environment || 'development'
      environmentName = envName
      const outputFile = resolve(options.output || config?.output || '.env')
      const includeSecrets = options.secrets !== false
      const shouldResolve = options.resolveReferences === true
      const shouldFallback = options.includeFallbacks === true
      const shouldShowSources = options.showSources === true

      // Resolve export format
      const formatInput = options.format || config?.format || 'dotenv'
      if (!EXPORT_FORMATS.includes(formatInput)) {
        spinner.fail(`Invalid format "${formatInput}". Valid formats: ${EXPORT_FORMATS.join(', ')}`)
        return bail('invalid_format')
      }
      const format = formatInput as ExportFormat

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
      const { data: environments, error: envError } = await client
        .from('environments')
        .select('id, name')
        .eq('project_id', projectId)
        .ilike('name', envName)
        .single()

      if (envError || !environments) {
        spinner.fail(`Environment "${envName}" not found in project`)
        console.log(chalk.gray('\nAvailable environments:'))
        const { data: allEnvs } = await client
          .from('environments')
          .select('name')
          .eq('project_id', projectId)
        allEnvs?.forEach(e => console.log(chalk.gray(`  - ${e.name}`)))
        return bail('environment_not_found')
      }

      const environmentId = environments.id

      spinner.text = 'Fetching variables...'
      const rpcParams: Record<string, unknown> = {
        p_environment_id: environmentId,
        p_sync_secrets: includeSecrets,
        p_sync_variables: true,
        p_include_fallbacks: shouldFallback || false,
        ...(serviceId && { p_service_id: serviceId }),
      }

      const { data: variables, error: varError } = await client.rpc('get_variables_for_sync', rpcParams)

      if (varError) {
        spinner.fail('Failed to fetch variables')
        console.error(chalk.red(varError.message))
        return bail('rpc_error')
      }

      if (!variables || variables.length === 0) {
        spinner.warn('No variables found')
        track('cli_pull_completed', {
          status: 'empty',
          duration_ms: Date.now() - startedAt,
          variable_count: 0,
          environment_kind: environmentKind(environmentName),
        })
        await flushTelemetry()
        process.exit(0)
      }

      if (existsSync(outputFile) && !options.force) {
        spinner.stop()
        console.log(chalk.yellow(`\nFile ${outputFile} already exists.`))
        console.log(chalk.gray('Use --force to overwrite.'))
        return bail('file_exists')
      }

      const filterTags: string[] = options.tag || config?.tags || []
      const vars = filterTags.length > 0
        ? (variables as Variable[])
            .filter(v => {
              const t = v.tags || []
              return t.length === 0 || t.some(tag => filterTags.includes(tag))
            })
            .sort((a, b) => a.key.localeCompare(b.key))
        : (variables as Variable[]).sort((a, b) => a.key.localeCompare(b.key))

      // Resolve references if requested
      let resolvedMap: Map<string, ResolvedVariable> | null = null
      if (shouldResolve) {
        spinner.text = 'Resolving variable references...'

        const inputs: VariableInput[] = vars.map(v => ({
          key: v.key,
          value: v.value,
          fallbackValue: v.fallback_value ?? null,
          isSecret: v.is_secret,
        }))

        // Warn about circular references
        const cycles = detectCircularReferences(inputs)
        if (cycles.length > 0) {
          spinner.stop()
          for (const cycle of cycles) {
            console.log(chalk.yellow(`Warning: circular reference detected: ${cycle.join(' -> ')} -> ${cycle[0]}`))
          }
          spinner.start('Resolving variable references...')
        }

        const resolved = resolveAll(inputs)
        resolvedMap = new Map(resolved.map(r => [r.key, r]))
      }

      spinner.text = `Writing ${format} output...`

      // Build export variables with resolved/fallback values
      const exportVars: ExportVariable[] = vars.map(v => {
        let value: string
        if (resolvedMap) {
          value = resolvedMap.get(v.key)!.resolvedValue
        } else if (shouldFallback && (!v.value || v.value === '') && v.fallback_value) {
          value = v.fallback_value
        } else {
          value = v.value || ''
        }
        return { key: v.key, value, isSecret: v.is_secret }
      })

      let content: string
      if (format === 'dotenv' && (shouldShowSources || shouldResolve)) {
        // Dotenv with inline comments needs special handling
        content = vars
          .map(v => {
            let value: string
            let source: ResolvedVariable['source'] | null = null

            if (resolvedMap) {
              const resolved = resolvedMap.get(v.key)!
              value = resolved.resolvedValue
              source = resolved.source
            } else if (shouldFallback && (!v.value || v.value === '') && v.fallback_value) {
              value = v.fallback_value
              source = 'fallback'
            } else {
              value = v.value || ''
            }

            const needsQuotes = value.includes(' ') || value.includes('\n') || value.includes('"')
            const formattedValue = needsQuotes ? `"${value.replace(/"/g, '\\"')}"` : value
            let line = `${v.key}=${formattedValue}`

            if (shouldShowSources && resolvedMap) {
              const resolved = resolvedMap.get(v.key)!
              if (resolved.references.length > 0 && resolved.source !== 'empty') {
                line += `  # resolved from ${resolved.rawValue ?? v.value ?? ''}`
              } else if (resolved.source === 'fallback') {
                line += `  # fallback value`
              }
            } else if (shouldShowSources && source === 'fallback') {
              line += `  # fallback value`
            }

            return line
          })
          .join('\n')
      } else {
        // Build k8s config if needed
        let k8sConfig: K8sConfig | undefined
        if (format === 'k8s-secret' || format === 'k8s-configmap') {
          const defaultName = format === 'k8s-secret' ? 'app-secrets' : 'app-config'
          k8sConfig = {
            name: sanitizeK8sName(options.k8sName || config?.k8s_name || defaultName),
            namespace: options.k8sNamespace || config?.k8s_namespace || 'default',
          }
        }
        content = formatVariables(exportVars, format, k8sConfig)
      }

      writeFileSync(outputFile, content + '\n')

      const secretCount = vars.filter(v => v.is_secret).length
      const plainCount = vars.length - secretCount

      const serviceInfo = serviceName ? ` (service: ${serviceName})` : ''
      const tagInfo = filterTags.length > 0 ? ` (tags: ${filterTags.join(', ')})` : ''
      spinner.succeed(`Pulled ${vars.length} variables to ${outputFile} (${format})${serviceInfo}${tagInfo}`)
      console.log(chalk.gray(`  ${plainCount} plain, ${secretCount} secrets`))

      track('cli_pull_completed', {
        status: 'success',
        duration_ms: Date.now() - startedAt,
        variable_count: vars.length,
        secret_count: secretCount,
        plain_count: plainCount,
        format,
        environment_kind: environmentKind(environmentName),
        include_secrets: includeSecrets,
        used_resolve_references: shouldResolve,
        used_fallbacks: shouldFallback,
        used_service: Boolean(serviceId),
        used_tag_filter: filterTags.length > 0,
      })

      // Fire-and-forget: log CLI pull access
      client.rpc('log_variable_access', {
        p_environment_id: environmentId,
        p_access_type: 'cli_pull',
        p_metadata: { cli_version: getCliVersion() },
      }).then(() => {}, () => { /* ignore tracking failures */ })

    } catch (error) {
      spinner.fail('Pull failed')
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'))
      return bail(classifyError(error))
    }
  })
