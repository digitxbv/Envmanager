import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { spawn } from 'node:child_process'
import { createClient } from '../lib/client.js'
import { loadConfig } from '../lib/config.js'
import { resolveProjectId, resolveOrganizationId, resolveServiceId } from '../lib/resolve.js'
import {
  track,
  flushTelemetry,
  environmentKind,
  classifyError,
  getCliVersion,
} from '../lib/telemetry.js'
import type { Variable } from '../lib/types.js'
import { selectScopedVars, substitutePlaceholders } from '../lib/run-core.js'
import { createScrubStream, MIN_SCRUB_LEN } from '../lib/scrub.js'

function parseList(val?: string): string[] | undefined {
  if (!val) return undefined
  return val
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export const runCommand = new Command('run')
  .description('Run a command with env vars injected, without exposing their values to the caller')
  .argument('[command...]', 'Command to run — use -- to separate (e.g. run --only KEY -- curl ...)')
  .option('--org <name>', 'Organization name (required if you belong to multiple)')
  .option('-e, --environment <name>', 'Environment name (default: from config or "development")')
  .option('-p, --project <id>', 'Project ID (default: from config)')
  .option('--service <name>', 'Filter by service name')
  .option('--only <keys>', 'Comma-separated variable keys to expose')
  .option('--except <keys>', 'Comma-separated variable keys to exclude')
  .option('--all', 'Expose all variables this credential can access')
  .option('--scrub-all', 'Redact non-secret values from output too (default: secrets only)')
  .passThroughOptions()
  .action(async (commandArgs: string[], options) => {
    const startedAt = Date.now()
    let environmentName: string | undefined

    const bail = async (errorCode: string): Promise<never> => {
      track('cli_run_completed', {
        status: 'error',
        error_code: errorCode,
        duration_ms: Date.now() - startedAt,
        environment_kind: environmentKind(environmentName),
      })
      await flushTelemetry()
      process.exit(1)
    }

    if (commandArgs.length === 0) {
      console.error(chalk.red('No command given. Usage: envmanager run --only KEY -- <command>'))
      return bail('no_command')
    }

    const config = loadConfig()
    const onlyKeys = parseList(options.only)
    const exceptKeys = parseList(options.except)
    const configKeys = config?.agent?.allowed_keys

    // Fail fast on no-scope BEFORE any network work.
    if (!onlyKeys && !options.all && !(configKeys && configKeys.length > 0)) {
      console.error(
        chalk.red(
          'No variable scope set. Specify --only KEY1,KEY2, --all, or add "agent.allowed_keys" to envmanager.json.',
        ),
      )
      return bail('no_scope')
    }

    const projectInput = options.project || config?.project_id
    environmentName = options.environment || config?.environment || 'development'

    const spinner = ora('Authenticating...').start()
    let client
    try {
      client = await createClient()
    } catch (error) {
      spinner.fail(error instanceof Error ? error.message : 'Authentication failed')
      return bail(classifyError(error))
    }

    let organizationId: string
    try {
      organizationId = await resolveOrganizationId(options.org, client, projectInput)
    } catch (error) {
      spinner.fail(error instanceof Error ? error.message : 'Failed to resolve organization')
      return bail('org_not_resolved')
    }

    let projectId: string
    try {
      projectId = await resolveProjectId(projectInput, client, organizationId)
    } catch (error) {
      spinner.fail(error instanceof Error ? error.message : 'Failed to resolve project')
      return bail('project_not_found')
    }

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
      .select('id, name')
      .eq('project_id', projectId)
      .ilike('name', environmentName!)
      .single()

    if (envError || !environment) {
      spinner.fail(`Environment "${environmentName}" not found in project`)
      return bail('environment_not_found')
    }
    const environmentId = environment.id as string

    spinner.text = 'Fetching variables...'
    const rpcParams: Record<string, unknown> = {
      p_environment_id: environmentId,
      p_sync_secrets: true,
      p_sync_variables: true,
      p_include_fallbacks: false,
      ...(serviceId && { p_service_id: serviceId }),
    }
    const { data: variables, error: varError } = await client.rpc('get_variables_for_sync', rpcParams)
    if (varError) {
      spinner.fail('Failed to fetch variables')
      console.error(chalk.red(varError.message))
      return bail('rpc_error')
    }

    let scoped: Variable[]
    try {
      scoped = selectScopedVars(variables as Variable[], {
        only: onlyKeys,
        except: exceptKeys,
        all: options.all,
        configKeys,
      })
    } catch (error) {
      spinner.fail(error instanceof Error ? error.message : 'Scope error')
      return bail('scope_error')
    }

    // Build the value map (for placeholders) + child env (for injection) + secret list (for scrub).
    const valueMap = new Map<string, string>()
    const childEnv: NodeJS.ProcessEnv = { ...process.env }
    const secretValues: string[] = []
    for (const v of scoped) {
      const val = v.value ?? ''
      valueMap.set(v.key, val)
      childEnv[v.key] = val
      if (options.scrubAll || v.is_secret) secretValues.push(val)
    }

    // Warn (naming keys only, never values) about values too short to scrub from output.
    const shortKeys = scoped
      .filter((v) => (options.scrubAll || v.is_secret) && v.value && v.value.length < MIN_SCRUB_LEN)
      .map((v) => v.key)
    if (shortKeys.length > 0) {
      console.error(
        chalk.yellow(
          `Warning: value(s) too short (< ${MIN_SCRUB_LEN} chars) to mask in output: ${shortKeys.join(', ')}`,
        ),
      )
    }

    let finalArgs: string[]
    try {
      finalArgs = substitutePlaceholders(commandArgs, valueMap)
    } catch (error) {
      spinner.fail(error instanceof Error ? error.message : 'Placeholder error')
      return bail('placeholder_error')
    }

    // Audit: log access now — secrets are decrypted at this point. Best-effort.
    try {
      await client.rpc('log_variable_access', {
        p_environment_id: environmentId,
        p_access_type: 'cli_pull',
        p_metadata: { cli_version: getCliVersion(), via: 'run' },
      })
    } catch {
      /* never let audit failure block the command */
    }

    spinner.stop()

    const [cmd, ...cmdArgs] = finalArgs
    let startError = false
    const exitCode: number = await new Promise<number>((resolve) => {
      // First event wins — on a spawn failure 'error' fires before 'close', and we
      // must not let the later 'close' overwrite the failure (would skew telemetry).
      let settled = false
      const finish = (code: number) => {
        if (!settled) {
          settled = true
          resolve(code)
        }
      }
      // shell:false (default) — a substituted secret value must never be shell-interpreted.
      const child = spawn(cmd, cmdArgs, { env: childEnv, stdio: ['inherit', 'pipe', 'pipe'] })
      child.stdout.pipe(createScrubStream(secretValues)).pipe(process.stdout)
      child.stderr.pipe(createScrubStream(secretValues)).pipe(process.stderr)
      child.on('error', (err) => {
        startError = true
        console.error(chalk.red(`Failed to start command: ${err.message}`))
        finish(127)
      })
      // 'close' (not 'exit') so all scrubbed output has drained before we resolve.
      child.on('close', (code, signal) => finish(signal ? 1 : (code ?? 0)))
    })

    track('cli_run_completed', {
      status: startError ? 'error' : 'success',
      error_code: startError ? 'spawn_failed' : undefined,
      exit_code: exitCode,
      duration_ms: Date.now() - startedAt,
      variable_count: scoped.length,
      secret_count: scoped.filter((v) => v.is_secret).length,
      scope_mode: onlyKeys ? 'only' : options.all ? 'all' : 'config',
      scrub_all: Boolean(options.scrubAll),
      environment_kind: environmentKind(environment.name),
    })

    // Let the program's postAction hook flush telemetry and exit with this code.
    process.exitCode = exitCode
  })
