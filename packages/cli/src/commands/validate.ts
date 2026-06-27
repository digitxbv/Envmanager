import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { parse as parseDotenv } from 'dotenv'
import { createClient } from '../lib/client.js'
import { loadConfig } from '../lib/config.js'
import { resolveProjectId, resolveOrganizationId } from '../lib/resolve.js'
import { validateEnvAgainstSchema, jsonToSchema, type EnvSchema } from '../lib/schema.js'

export const validateCommand = new Command('validate')
  .description('Validate local .env file against schema from EnvManager or local file')
  .option('-e, --environment <name>', 'Environment name (default: "development")')
  .option('-p, --project <id>', 'Project ID (default: from config)')
  .option('--org <name>', 'Organization name (required if you belong to multiple)')
  .option('-i, --input <file>', 'Input .env file (default: .env)')
  .option('-s, --schema <file>', 'Local schema JSON file (skip fetching from EnvManager)')
  .option('--strict', 'Fail on warnings (extra variables not in schema)')
  .action(async (options) => {
    const spinner = ora('Validating environment...').start()

    try {
      const config = loadConfig()
      const inputPath = resolve(options.input || '.env')

      if (!existsSync(inputPath)) {
        spinner.fail(`Input file not found: ${inputPath}`)
        process.exit(1)
      }

      const envContent = readFileSync(inputPath, 'utf-8')
      const envVars = new Map(Object.entries(parseDotenv(envContent)))

      let schema: EnvSchema

      if (options.schema) {
        spinner.text = 'Loading local schema...'
        const schemaPath = resolve(options.schema)
        
        if (!existsSync(schemaPath)) {
          spinner.fail(`Schema file not found: ${schemaPath}`)
          process.exit(1)
        }

        const schemaContent = readFileSync(schemaPath, 'utf-8')
        const schemaJson = JSON.parse(schemaContent) as Record<string, unknown>
        schema = jsonToSchema(schemaJson)
      } else {
        const projectInput = options.project || config?.project_id
        const envName = options.environment || config?.environment || 'development'

        if (!projectInput) {
          spinner.fail('No project specified')
          console.log(chalk.yellow('\nSpecify --project or use --schema for local validation'))
          process.exit(1)
        }

        spinner.text = 'Authenticating...'
        const client = await createClient()

        let organizationId: string
        try {
          organizationId = await resolveOrganizationId(options.org, client, projectInput)
        } catch (error) {
          spinner.fail(error instanceof Error ? error.message : 'Failed to resolve organization')
          process.exit(1)
        }

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
          .select('id, name')
          .eq('project_id', projectId)
          .ilike('name', envName)
          .single()

        if (envError || !environment) {
          spinner.fail(`Environment "${envName}" not found`)
          process.exit(1)
        }

        spinner.text = 'Fetching schema...'
        const { data: schemaJson, error: schemaError } = await client.rpc('get_environment_schema', {
          p_environment_id: environment.id
        })

        if (schemaError) {
          spinner.fail('Failed to fetch schema')
          console.error(chalk.red(schemaError.message))
          process.exit(1)
        }

        if (!schemaJson) {
          spinner.warn('No schema defined for this environment')
          console.log(chalk.yellow('\nTo create a schema, use the web UI or upload with:'))
          console.log(chalk.gray('  envmanager validate --schema schema.json'))
          process.exit(0)
        }

        schema = jsonToSchema(schemaJson as Record<string, unknown>)
      }

      spinner.text = 'Validating...'
      const result = validateEnvAgainstSchema(envVars, schema)

      spinner.stop()

      console.log('')
      console.log(chalk.cyan('Validation Results'))
      console.log(chalk.gray(`File: ${inputPath}`))
      console.log(chalk.gray(`Variables: ${envVars.size}`))
      console.log(chalk.gray(`Schema fields: ${Object.keys(schema).length}`))
      console.log('')

      if (result.valid && result.warnings.length === 0) {
        console.log(chalk.green('All validations passed'))
        process.exit(0)
      }

      if (result.errors.length > 0) {
        console.log(chalk.red(`Errors (${result.errors.length}):`))
        for (const error of result.errors) {
          console.log(chalk.red(`  - ${error.message}`))
          if (error.value) {
            console.log(chalk.gray(`    Value: "${error.value}"`))
          }
        }
        console.log('')
      }

      if (result.warnings.length > 0) {
        console.log(chalk.yellow(`Warnings (${result.warnings.length}):`))
        for (const warning of result.warnings) {
          console.log(chalk.yellow(`  - ${warning}`))
        }
        console.log('')
      }

      if (!result.valid) {
        console.log(chalk.red('Validation failed'))
        process.exit(1)
      }

      if (options.strict && result.warnings.length > 0) {
        console.log(chalk.red('Validation failed (strict mode)'))
        process.exit(1)
      }

      console.log(chalk.green('Validation passed with warnings'))

    } catch (error) {
      spinner.fail('Validation failed')
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'))
      process.exit(1)
    }
  })
