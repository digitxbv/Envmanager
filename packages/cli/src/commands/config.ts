import { Command } from 'commander'
import chalk from 'chalk'
import { loadConfig, getConfigPath } from '../lib/config.js'
import { setTelemetryEnabled, telemetryStatusLine } from '../lib/telemetry.js'

export const configCommand = new Command('config')
  .description('Manage project configuration')

configCommand
  .command('show')
  .description('Show current configuration')
  .action(() => {
    const configPath = getConfigPath()
    const config = loadConfig()
    
    if (!configPath || !config) {
      console.log(chalk.yellow('No configuration file found'))
      console.log('Run `envmanager init` to create one')
      return
    }
    
    console.log(chalk.green(`Config file: ${configPath}`))
    console.log(JSON.stringify(config, null, 2))
  })

configCommand
  .command('telemetry [setting]')
  .description('View or change anonymous usage analytics: on | off | status')
  .action((setting?: string) => {
    const value = (setting || 'status').toLowerCase()
    if (value === 'status') {
      console.log(`Telemetry: ${telemetryStatusLine()}`)
      return
    }
    if (['on', 'enable', 'enabled', 'true', '1'].includes(value)) {
      setTelemetryEnabled(true)
      console.log(chalk.green('Telemetry enabled — thanks, this helps us improve the CLI.'))
    } else if (['off', 'disable', 'disabled', 'false', '0'].includes(value)) {
      setTelemetryEnabled(false)
      console.log(chalk.green('Telemetry disabled.'))
    } else {
      console.log(chalk.red(`Unknown setting "${setting}". Use: on | off | status`))
      process.exit(1)
    }
  })

