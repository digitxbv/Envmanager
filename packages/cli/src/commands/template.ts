import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { parse as parseDotenv } from 'dotenv'
import { createClient } from '../lib/client.js'
import { loadConfig } from '../lib/config.js'
import { parseTemplate, substituteTemplate, validateAgainstTemplate } from '../lib/template-simple.js'
import { parseYamlTemplate, validateYamlTemplate } from '../lib/template-yaml.js'
import { Variable } from '../lib/types.js'

export const templateCommand = new Command('template')
  .description('Manage environment templates')

templateCommand
  .command('generate')
  .description('Generate .env file from template and EnvManager values')
  .option('-t, --template <file>', 'Template file (default: .env.template or .env.template.yaml)')
  .option('-o, --output <file>', 'Output file (default: .env)')
  .option('-e, --environment <name>', 'Environment name (default: "development")')
  .option('-p, --project <id>', 'Project ID (default: from config)')
  .option('-f, --force', 'Overwrite existing output file')
  .action(async (options) => {
    const spinner = ora('Generating .env from template...').start()

    try {
      const config = loadConfig()
      const projectId = options.project || config?.project_id
      const envName = options.environment || config?.environment || 'development'
      const outputPath = resolve(options.output || '.env')

      let templatePath = options.template
      let isYaml = false

      if (!templatePath) {
        if (existsSync('.env.template.yaml')) {
          templatePath = '.env.template.yaml'
          isYaml = true
        } else if (existsSync('.env.template')) {
          templatePath = '.env.template'
        } else {
          spinner.fail('No template file found')
          console.log(chalk.yellow('\nCreate .env.template or .env.template.yaml first'))
          console.log(chalk.gray('  Run `envmanager init` to generate from EnvManager'))
          process.exit(1)
        }
      }

      templatePath = resolve(templatePath)
      isYaml = templatePath.endsWith('.yaml') || templatePath.endsWith('.yml')

      if (!existsSync(templatePath)) {
        spinner.fail(`Template file not found: ${templatePath}`)
        process.exit(1)
      }

      if (existsSync(outputPath) && !options.force) {
        spinner.stop()
        console.log(chalk.yellow(`\nFile ${outputPath} already exists. Use --force to overwrite.`))
        process.exit(1)
      }

      if (!projectId) {
        spinner.fail('No project specified')
        console.log(chalk.yellow('\nSpecify --project or create envmanager.json'))
        process.exit(1)
      }

      spinner.text = 'Authenticating...'
      const client = await createClient()

      spinner.text = 'Fetching environment...'
      const { data: environment, error: envError } = await client
        .from('environments')
        .select('id, name')
        .eq('project_id', projectId)
        .eq('name', envName)
        .single()

      if (envError || !environment) {
        spinner.fail(`Environment "${envName}" not found`)
        process.exit(1)
      }

      spinner.text = 'Fetching variables...'
      const { data: variables, error: varError } = await client.rpc('get_variables_for_sync', {
        p_environment_id: environment.id,
        p_sync_secrets: true,
        p_sync_variables: true,
        p_include_fallbacks: false,
      })

      if (varError) {
        spinner.fail('Failed to fetch variables')
        process.exit(1)
      }

      const varsArray = (variables || []) as Variable[]
      const valuesMap = new Map<string, string>()
      for (const v of varsArray) {
        if (v.value !== null) {
          valuesMap.set(v.key, v.value)
        }
      }

      spinner.text = 'Generating output...'
      const templateContent = readFileSync(templatePath, 'utf-8')

      if (isYaml) {
        const parsed = parseYamlTemplate(templateContent)
        const lines: string[] = []

        for (const variable of parsed.variables.sort((a, b) => a.name.localeCompare(b.name))) {
          const value = valuesMap.get(variable.name) || variable.default || ''
          const needsQuotes = value.includes(' ') || value.includes('\n') || value.includes('"')
          const formatted = needsQuotes ? `"${value.replace(/"/g, '\\"')}"` : value
          lines.push(`${variable.name}=${formatted}`)
        }

        writeFileSync(outputPath, lines.join('\n') + '\n')
      } else {
        const parsed = parseTemplate(templateContent)
        const { result, missing } = substituteTemplate(templateContent, valuesMap)

        if (missing.length > 0) {
          spinner.warn('Generated with missing variables')
          console.log(chalk.yellow('\nMissing variables (using placeholders):'))
          for (const m of missing) {
            console.log(chalk.yellow(`  - ${m}`))
          }
        }

        const lines = result.split('\n').filter(line => {
          const trimmed = line.trim()
          return !trimmed.startsWith('#') && trimmed.includes('=')
        })

        writeFileSync(outputPath, lines.join('\n') + '\n')
      }

      spinner.succeed(`Generated ${outputPath}`)
      console.log(chalk.gray(`  From template: ${templatePath}`))
      console.log(chalk.gray(`  Environment: ${envName}`))

    } catch (error) {
      spinner.fail('Generate failed')
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'))
      process.exit(1)
    }
  })

templateCommand
  .command('sync')
  .description('Compare template with EnvManager and report differences')
  .option('-t, --template <file>', 'Template file (default: .env.template or .env.template.yaml)')
  .option('-e, --environment <name>', 'Environment name (default: "development")')
  .option('-p, --project <id>', 'Project ID (default: from config)')
  .action(async (options) => {
    const spinner = ora('Comparing template with EnvManager...').start()

    try {
      const config = loadConfig()
      const projectId = options.project || config?.project_id
      const envName = options.environment || config?.environment || 'development'

      let templatePath = options.template
      let isYaml = false

      if (!templatePath) {
        if (existsSync('.env.template.yaml')) {
          templatePath = '.env.template.yaml'
          isYaml = true
        } else if (existsSync('.env.template')) {
          templatePath = '.env.template'
        } else {
          spinner.fail('No template file found')
          process.exit(1)
        }
      }

      templatePath = resolve(templatePath)
      isYaml = templatePath.endsWith('.yaml') || templatePath.endsWith('.yml')

      if (!existsSync(templatePath)) {
        spinner.fail(`Template file not found: ${templatePath}`)
        process.exit(1)
      }

      if (!projectId) {
        spinner.fail('No project specified')
        process.exit(1)
      }

      spinner.text = 'Authenticating...'
      const client = await createClient()

      spinner.text = 'Fetching environment...'
      const { data: environment, error: envError } = await client
        .from('environments')
        .select('id, name')
        .eq('project_id', projectId)
        .eq('name', envName)
        .single()

      if (envError || !environment) {
        spinner.fail(`Environment "${envName}" not found`)
        process.exit(1)
      }

      spinner.text = 'Fetching variables...'
      const { data: variables, error: varError } = await client.rpc('get_variables_for_sync', {
        p_environment_id: environment.id,
        p_sync_secrets: false,
        p_sync_variables: true,
        p_include_fallbacks: false,
      })

      if (varError) {
        spinner.fail('Failed to fetch variables')
        process.exit(1)
      }

      const varsArray = (variables || []) as Variable[]
      const remoteKeys = new Set(varsArray.map(v => v.key))
      const templateContent = readFileSync(templatePath, 'utf-8')

      let templateKeys: Set<string>

      if (isYaml) {
        const parsed = parseYamlTemplate(templateContent)
        templateKeys = new Set(parsed.variables.map(v => v.name))
      } else {
        const parsed = parseTemplate(templateContent)
        templateKeys = new Set(parsed.variables.map(v => v.key))
      }

      const missingInRemote: string[] = []
      const missingInTemplate: string[] = []
      const inBoth: string[] = []

      for (const key of templateKeys) {
        if (remoteKeys.has(key)) {
          inBoth.push(key)
        } else {
          missingInRemote.push(key)
        }
      }

      for (const key of remoteKeys) {
        if (!templateKeys.has(key)) {
          missingInTemplate.push(key)
        }
      }

      spinner.stop()

      console.log('')
      console.log(chalk.cyan('Template Sync Report'))
      console.log(chalk.gray(`Template: ${templatePath}`))
      console.log(chalk.gray(`Environment: ${envName}`))
      console.log('')

      if (missingInRemote.length === 0 && missingInTemplate.length === 0) {
        console.log(chalk.green('Template and EnvManager are in sync'))
        console.log(chalk.gray(`${inBoth.length} variables matched`))
      } else {
        if (missingInRemote.length > 0) {
          console.log(chalk.yellow(`Missing in EnvManager (${missingInRemote.length}):`))
          for (const key of missingInRemote.sort()) {
            console.log(chalk.yellow(`  + ${key}`))
          }
          console.log('')
        }

        if (missingInTemplate.length > 0) {
          console.log(chalk.blue(`Missing in template (${missingInTemplate.length}):`))
          for (const key of missingInTemplate.sort()) {
            console.log(chalk.blue(`  - ${key}`))
          }
          console.log('')
        }

        console.log(chalk.gray(`${inBoth.length} variables matched`))
      }

    } catch (error) {
      spinner.fail('Sync check failed')
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'))
      process.exit(1)
    }
  })

templateCommand
  .command('validate')
  .description('Validate local .env file against template')
  .option('-t, --template <file>', 'Template file (default: .env.template or .env.template.yaml)')
  .option('-i, --input <file>', 'Input .env file (default: .env)')
  .action(async (options) => {
    const spinner = ora('Validating .env against template...').start()

    try {
      const inputPath = resolve(options.input || '.env')

      if (!existsSync(inputPath)) {
        spinner.fail(`Input file not found: ${inputPath}`)
        process.exit(1)
      }

      let templatePath = options.template
      let isYaml = false

      if (!templatePath) {
        if (existsSync('.env.template.yaml')) {
          templatePath = '.env.template.yaml'
          isYaml = true
        } else if (existsSync('.env.template')) {
          templatePath = '.env.template'
        } else {
          spinner.fail('No template file found')
          process.exit(1)
        }
      }

      templatePath = resolve(templatePath)
      isYaml = templatePath.endsWith('.yaml') || templatePath.endsWith('.yml')

      if (!existsSync(templatePath)) {
        spinner.fail(`Template file not found: ${templatePath}`)
        process.exit(1)
      }

      const envContent = readFileSync(inputPath, 'utf-8')
      const envVars = new Map(Object.entries(parseDotenv(envContent)))
      const templateContent = readFileSync(templatePath, 'utf-8')

      spinner.stop()

      if (isYaml) {
        const parsed = parseYamlTemplate(templateContent)
        const result = validateYamlTemplate(parsed, envVars)

        console.log('')
        if (result.valid && result.warnings.length === 0) {
          console.log(chalk.green('Validation passed'))
        } else {
          if (result.errors.length > 0) {
            console.log(chalk.red(`Validation failed (${result.errors.length} errors):`))
            for (const error of result.errors) {
              console.log(chalk.red(`  - ${error}`))
            }
          }

          if (result.warnings.length > 0) {
            console.log(chalk.yellow(`\nWarnings (${result.warnings.length}):`))
            for (const warning of result.warnings) {
              console.log(chalk.yellow(`  - ${warning}`))
            }
          }

          if (!result.valid) {
            process.exit(1)
          }
        }
      } else {
        const parsed = parseTemplate(templateContent)
        const result = validateAgainstTemplate(parsed, envVars)

        console.log('')
        if (result.valid && result.extra.length === 0) {
          console.log(chalk.green('Validation passed'))
        } else {
          if (result.missing.length > 0) {
            console.log(chalk.red(`Missing required variables (${result.missing.length}):`))
            for (const key of result.missing) {
              console.log(chalk.red(`  - ${key}`))
            }
          }

          if (result.extra.length > 0) {
            console.log(chalk.yellow(`\nExtra variables not in template (${result.extra.length}):`))
            for (const key of result.extra) {
              console.log(chalk.yellow(`  - ${key}`))
            }
          }

          if (!result.valid) {
            process.exit(1)
          }
        }
      }

    } catch (error) {
      spinner.fail('Validation failed')
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'))
      process.exit(1)
    }
  })
