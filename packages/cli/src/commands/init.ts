import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '../lib/client.js'
import { generateTemplate } from '../lib/template-simple.js'
import { generateYamlTemplate } from '../lib/template-yaml.js'
import { resolveProjectId, resolveOrganizationId, resolveServiceId } from '../lib/resolve.js'
import { Variable } from '../lib/types.js'
import { isInteractive, selectProject, selectEnvironment, selectService } from '../lib/interactive.js'

export const initCommand = new Command('init')
  .description('Initialize project configuration and generate .env.template from EnvManager')
  .option('--org <name>', 'Organization name (required if you belong to multiple)')
  .option('-e, --environment <name>', 'Environment name (default: "development")')
  .option('-p, --project <id>', 'Project ID')
  .option('--format <type>', 'Template format: simple or yaml (default: simple)', 'simple')
  .option('-f, --force', 'Overwrite existing files without prompting')
  .option('--service <name>', 'Service name to scope variables to')
  .action(async (options) => {
    const spinner = ora('Initializing project...').start()

    try {
      const configPath = resolve('envmanager.json')
      const format = options.format as 'simple' | 'yaml'
      const templatePath = resolve(format === 'yaml' ? '.env.template.yaml' : '.env.template')

      if (existsSync(configPath) && !options.force) {
        spinner.stop()
        console.log(chalk.yellow(`\nFile ${configPath} already exists. Use --force to overwrite.`))
        process.exit(1)
      }

      if (existsSync(templatePath) && !options.force) {
        spinner.stop()
        console.log(chalk.yellow(`\nFile ${templatePath} already exists. Use --force to overwrite.`))
        process.exit(1)
      }

      spinner.text = 'Authenticating...'
      const client = await createClient()

      // Resolve organization (auto-selects for single-org users)
      let organizationId: string
      try {
        organizationId = await resolveOrganizationId(options.org, client)
      } catch (error) {
        spinner.fail(error instanceof Error ? error.message : 'Failed to resolve organization')
        process.exit(1)
      }

      spinner.text = 'Fetching projects...'
      const { data: projects, error: projectError } = await client
        .from('projects')
        .select('id, name, friendly_id')
        .eq('organization_id', organizationId)

      if (projectError || !projects?.length) {
        spinner.fail('No projects found in organization')
        process.exit(1)
      }

      let projectId: string
      let projectName = ''

      if (options.project) {
        // Resolve project from flag (accepts UUID, friendly ID, or name)
        try {
          projectId = await resolveProjectId(options.project, client, organizationId)
          const found = projects.find(p => p.id === projectId)
          projectName = found?.name || ''
        } catch (error) {
          spinner.fail(error instanceof Error ? error.message : 'Failed to resolve project')
          process.exit(1)
        }
      } else if (isInteractive() && projects.length > 1) {
        // Interactive selection
        spinner.stop()
        const selected = await selectProject(projects)
        projectId = selected.id
        projectName = selected.name
      } else if (projects.length === 1) {
        projectId = projects[0].id
        projectName = projects[0].name
      } else {
        spinner.stop()
        console.log(chalk.yellow('\nMultiple projects found. Please specify with --project <id-or-name>:'))
        for (const p of projects) {
          const friendlyId = p.friendly_id ? `#${p.friendly_id}` : ''
          console.log(chalk.gray(`  ${friendlyId} ${p.name}`))
        }
        process.exit(1)
      }

      spinner.text = 'Fetching environments...'
      const { data: environments, error: envListError } = await client
        .from('environments')
        .select('id, name')
        .eq('project_id', projectId)

      if (envListError || !environments?.length) {
        spinner.fail('No environments found in project')
        process.exit(1)
      }

      let environment: { id: string; name: string }

      if (options.environment) {
        const found = environments.find(e => e.name.toLowerCase() === options.environment.toLowerCase())
        if (!found) {
          spinner.stop()
          console.log(chalk.yellow(`\nEnvironment "${options.environment}" not found. Available:`))
          for (const e of environments) {
            console.log(chalk.gray(`  ${e.name}`))
          }
          process.exit(1)
        }
        environment = found
      } else if (isInteractive() && environments.length > 1) {
        spinner.stop()
        environment = await selectEnvironment(environments, 'development')
      } else {
        // Default to "development" or first available
        const defaultEnv = environments.find(e => e.name.toLowerCase() === 'development')
        environment = defaultEnv || environments[0]
      }

      // Check for services
      let selectedServiceName: string | undefined
      let serviceIdForSync: string | undefined
      const { data: projectServices } = await client
        .from('services')
        .select('id, name')
        .eq('project_id', projectId)
        .order('sort_order')

      if (options.service) {
        spinner.text = 'Resolving service...'
        try {
          serviceIdForSync = await resolveServiceId(options.service, client, projectId)
          selectedServiceName = options.service
        } catch (error) {
          spinner.fail(error instanceof Error ? error.message : 'Failed to resolve service')
          process.exit(1)
        }
      } else if (isInteractive() && projectServices && projectServices.length > 0) {
        spinner.stop()
        const service = await selectService(projectServices)
        if (service) {
          selectedServiceName = service.name
          serviceIdForSync = service.id
        }
      } else if (projectServices && projectServices.length > 0) {
        spinner.stop()
        console.log(chalk.gray('\n  Use --service <name> to scope variables to a specific service.'))
        console.log(chalk.gray('  Without --service, all variables will be synced.\n'))
        spinner.start('Fetching variables...')
      }

      spinner.text = 'Fetching variables...'
      const rpcParams: Record<string, unknown> = {
        p_environment_id: environment.id,
        p_sync_secrets: false,
        p_sync_variables: true,
        p_include_fallbacks: false,
        ...(serviceIdForSync && { p_service_id: serviceIdForSync }),
      }

      const { data: variables, error: varError } = await client.rpc('get_variables_for_sync', rpcParams)

      if (varError) {
        spinner.fail('Failed to fetch variables')
        console.error(chalk.red(varError.message))
        process.exit(1)
      }

      const varsArray = (variables || []) as Variable[]

      spinner.text = 'Writing configuration...'

      const config: Record<string, string> = {
        project_id: projectId,
        environment: environment.name
      }
      if (selectedServiceName) {
        config.service = selectedServiceName
      }
      writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n')

      const templateVars = varsArray.map(v => ({
        key: v.key,
        value: v.is_secret ? undefined : (v.value || undefined),
        isSecret: v.is_secret
      }))

      if (format === 'yaml') {
        const yamlContent = generateYamlTemplate(templateVars, { name: projectName })
        writeFileSync(templatePath, yamlContent)
      } else {
        const simpleContent = generateTemplate(templateVars, { includeDefaults: true })
        writeFileSync(templatePath, simpleContent)
      }

      const serviceInfo = selectedServiceName ? ` (service: ${selectedServiceName})` : ''
      spinner.succeed(`Project initialized${serviceInfo}`)
      console.log('')
      console.log(chalk.green('Created:'))
      console.log(chalk.gray(`  ${configPath}`))
      console.log(chalk.gray(`  ${templatePath}`))
      console.log('')
      console.log(chalk.cyan('Next steps:'))
      console.log(chalk.gray('  1. Review and customize the template'))
      console.log(chalk.gray('  2. Run `envmanager pull` to fetch current values'))
      console.log(chalk.gray('  3. Run `envmanager dev` to start real-time sync'))

    } catch (error) {
      spinner.fail('Init failed')
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'))
      process.exit(1)
    }
  })
