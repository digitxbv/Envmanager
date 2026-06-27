import chalk from 'chalk'
import ora from 'ora'
import { writeFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from './client.js'
import { generateTemplate } from './template-simple.js'
import { resolveOrganizationId } from './resolve.js'
import { Variable } from './types.js'
import { Config } from './config.js'
import { selectProject, selectEnvironment, selectService } from './interactive.js'

export interface InteractiveInitOptions {
  format?: 'simple' | 'yaml'
}

/**
 * Run the interactive init flow: select project, environment, service, write config.
 * Returns the resulting Config or null if aborted.
 */
export async function runInteractiveInit(
  options: InteractiveInitOptions = {}
): Promise<Config | null> {
  const spinner = ora('Connecting to EnvManager...').start()
  const format = options.format || 'simple'
  const configPath = resolve('envmanager.json')
  const templatePath = resolve(format === 'yaml' ? '.env.template.yaml' : '.env.template')

  try {
    spinner.text = 'Authenticating...'
    const client = await createClient()

    // Resolve organization
    let organizationId: string
    try {
      organizationId = await resolveOrganizationId(undefined, client)
    } catch (error) {
      spinner.fail(error instanceof Error ? error.message : 'Failed to resolve organization')
      return null
    }

    spinner.text = 'Fetching projects...'
    const { data: projects, error: projectError } = await client
      .from('projects')
      .select('id, name, friendly_id')
      .eq('organization_id', organizationId)

    if (projectError || !projects?.length) {
      spinner.fail('No projects found in organization')
      return null
    }

    spinner.stop()

    // Interactive project selection
    const project = await selectProject(projects)
    const projectId = project.id
    const projectName = project.name

    const envSpinner = ora('Fetching environments...').start()
    const { data: environments, error: envError } = await client
      .from('environments')
      .select('id, name')
      .eq('project_id', projectId)

    if (envError || !environments?.length) {
      envSpinner.fail('No environments found in project')
      return null
    }

    envSpinner.stop()

    // Interactive environment selection
    const environment = await selectEnvironment(environments, 'development')

    // Check for services
    let selectedServiceName: string | undefined
    let serviceIdForSync: string | undefined
    const { data: projectServices } = await client
      .from('services')
      .select('id, name')
      .eq('project_id', projectId)
      .order('sort_order')

    if (projectServices && projectServices.length > 0) {
      const service = await selectService(projectServices)
      if (service) {
        selectedServiceName = service.name
        serviceIdForSync = service.id
      }
    }

    const varSpinner = ora('Fetching variables...').start()
    const rpcParams: Record<string, unknown> = {
      p_environment_id: environment.id,
      p_sync_secrets: false,
      p_sync_variables: true,
      p_include_fallbacks: false,
      ...(serviceIdForSync && { p_service_id: serviceIdForSync }),
    }

    const { data: variables, error: varError } = await client.rpc('get_variables_for_sync', rpcParams)

    if (varError) {
      varSpinner.fail('Failed to fetch variables')
      console.error(chalk.red(varError.message))
      return null
    }

    const varsArray = (variables || []) as Variable[]

    varSpinner.text = 'Writing configuration...'

    const config: Record<string, string> = {
      project_id: projectId,
      environment: environment.name,
    }
    if (selectedServiceName) {
      config.service = selectedServiceName
    }
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n')

    const templateVars = varsArray.map(v => ({
      key: v.key,
      value: v.is_secret ? undefined : (v.value || undefined),
      isSecret: v.is_secret,
    }))

    const simpleContent = generateTemplate(templateVars, { includeDefaults: true })
    writeFileSync(templatePath, simpleContent)

    const serviceInfo = selectedServiceName ? ` (service: ${selectedServiceName})` : ''
    varSpinner.succeed(`Project initialized${serviceInfo}`)
    console.log('')
    console.log(chalk.green('Created:'))
    console.log(chalk.gray(`  ${configPath}`))
    console.log(chalk.gray(`  ${templatePath}`))
    console.log('')
    console.log(chalk.cyan('Next steps:'))
    console.log(chalk.gray('  1. Run `envmanager pull` to fetch current values'))
    console.log(chalk.gray('  2. Run `envmanager dev` to start real-time sync'))

    return config as unknown as Config
  } catch (error) {
    spinner.fail('Init failed')
    console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'))
    return null
  }
}
