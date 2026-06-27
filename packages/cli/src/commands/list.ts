import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { createClient } from '../lib/client.js'
import { loadConfig } from '../lib/config.js'
import { resolveProjectId, resolveOrganizationId } from '../lib/resolve.js'

export const listCommand = new Command('list')
  .description('List projects, environments, or variables')
  .argument('[resource]', 'Resource to list: projects, environments, variables', 'projects')
  .option('--org <name>', 'Organization name (required if you belong to multiple)')
  .option('-p, --project <name-or-id>', 'Project name or ID (for environments/variables)')
  .option('-e, --environment <name>', 'Environment name (default: "development")')
  .option('-v, --verbose', 'Show IDs')
  .action(async (resource, options) => {
    const spinner = ora('Connecting...').start()
    
    try {
      const config = loadConfig()
      const client = await createClient()

      switch (resource) {
        case 'projects':
        case 'project': {
          spinner.text = 'Fetching projects...'
          
          const { data: { user: currentUser } } = await client.auth.getUser()
          if (!currentUser) throw new Error('Not authenticated')

          const { data: memberships, error: memberError } = await client
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', currentUser.id)

          if (memberError) throw new Error(memberError.message)
          
          const orgIds = memberships?.map(m => m.organization_id) || []
          
          if (orgIds.length === 0) {
            spinner.warn('No organizations found')
            process.exit(0)
          }

           const { data: projects, error: projError } = await client
             .from('projects')
             .select('id, name, friendly_id, organization_id, organizations(name)')
             .in('organization_id', orgIds)
             .order('name')
          
          if (projError) throw new Error(projError.message)
          
          if (!projects || projects.length === 0) {
            spinner.warn('No projects found')
            process.exit(0)
          }

          spinner.succeed(`Found ${projects.length} projects`)
          console.log('')
          
           projects.forEach(p => {
             const org = p.organizations as { name: string } | { name: string }[] | null
             const orgName = Array.isArray(org) ? org[0]?.name : org?.name || 'Unknown'
             const friendlyId = p.friendly_id ? `#${p.friendly_id}` : ''
             if (options.verbose) {
               console.log(`  ${chalk.green(friendlyId.padEnd(4))} ${chalk.cyan(p.id)}  ${p.name} ${chalk.gray(`(${orgName})`)}`)
             } else {
               console.log(`  ${chalk.green(friendlyId.padEnd(4))} ${p.name} ${chalk.gray(`(${orgName})`)}`)
             }
           })
          
           if (!options.verbose && projects.length > 0) {
             console.log(chalk.gray('\n  Use -v to show UUIDs'))
           }
          break
        }

        case 'environments':
        case 'envs':
        case 'env': {
          const projectInput = options.project || config?.project_id
          
          if (!projectInput) {
            spinner.fail('No project specified')
            console.log(chalk.yellow('\nSpecify a project with --project <id-or-name>'))
            process.exit(1)
          }

          let organizationId: string
          try {
            organizationId = await resolveOrganizationId(options.org, client, projectInput)
          } catch (error) {
            spinner.fail(error instanceof Error ? error.message : 'Failed to resolve organization')
            process.exit(1)
          }

          let projectId: string
          try {
            spinner.text = 'Resolving project...'
            projectId = await resolveProjectId(projectInput, client, organizationId)
          } catch (error) {
            spinner.fail(error instanceof Error ? error.message : 'Failed to resolve project')
            process.exit(1)
          }

          spinner.text = 'Fetching environments...'
          
           const { data: environments, error: envError } = await client
             .from('environments')
             .select('id, name, friendly_id, created_at')
             .eq('project_id', projectId)
             .order('name')
          
          if (envError) throw new Error(envError.message)
          
          if (!environments || environments.length === 0) {
            spinner.warn('No environments found')
            process.exit(0)
          }

          spinner.succeed(`Found ${environments.length} environments`)
          console.log('')
          
           environments.forEach(e => {
             const friendlyId = e.friendly_id ? `#${e.friendly_id}` : ''
             if (options.verbose) {
               console.log(`  ${chalk.green(friendlyId.padEnd(4))} ${chalk.cyan(e.id)}  ${e.name}`)
             } else {
               console.log(`  ${chalk.green(friendlyId.padEnd(4))} ${e.name}`)
             }
           })
          break
        }

        case 'variables':
        case 'vars':
        case 'var': {
          const projectInput = options.project || config?.project_id
          const envName = options.environment || config?.environment || 'development'
          
          if (!projectInput) {
            spinner.fail('No project specified')
            console.log(chalk.yellow('\nSpecify a project with --project <id-or-name>'))
            process.exit(1)
          }

          let organizationId: string
          try {
            organizationId = await resolveOrganizationId(options.org, client, projectInput)
          } catch (error) {
            spinner.fail(error instanceof Error ? error.message : 'Failed to resolve organization')
            process.exit(1)
          }

          let projectId: string
          try {
            spinner.text = 'Resolving project...'
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

          spinner.text = 'Fetching variables...'
          
          const { data: variables, error: varError } = await client
            .from('variables')
            .select('id, key, is_secret, created_at')
            .eq('environment_id', environment.id)
            .order('key')
          
          if (varError) throw new Error(varError.message)
          
          if (!variables || variables.length === 0) {
            spinner.warn(`No variables in ${envName}`)
            process.exit(0)
          }

          const secretCount = variables.filter(v => v.is_secret).length
          spinner.succeed(`Found ${variables.length} variables (${secretCount} secrets)`)
          console.log('')
          
          variables.forEach(v => {
            const badge = v.is_secret ? chalk.yellow(' [secret]') : ''
            console.log(`  ${v.key}${badge}`)
          })
          break
        }

        default:
          spinner.fail(`Unknown resource: ${resource}`)
          console.log(chalk.gray('\nAvailable: projects, environments, variables'))
          process.exit(1)
      }

    } catch (error) {
      spinner.fail('Failed to list')
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'))
      process.exit(1)
    }
  })
