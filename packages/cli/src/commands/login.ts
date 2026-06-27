import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { existsSync } from 'fs'
import { resolve } from 'path'
import { loginWithBrowser, loginManual } from '../lib/auth.js'
import { getCredentials, getStoredApiKey } from '../lib/credentials.js'
import { isInteractive } from '../lib/interactive.js'
import { track, flushTelemetry, setUserFromToken } from '../lib/telemetry.js'

function classifyLoginError(error: unknown): string {
  const msg = (error instanceof Error ? error.message : '').toLowerCase()
  if (msg.includes('timed out')) return 'login_timeout'
  if (msg.includes('already in use')) return 'login_port_in_use'
  if (msg.includes('state mismatch')) return 'login_state_mismatch'
  if (msg.includes('no auth code')) return 'no_code'
  if (msg.includes('invalid')) return 'invalid_code'
  return 'unknown'
}

function isHeadless(): boolean {
  // No display server on Linux = headless
  if (process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
    return true
  }
  // SSH session without display forwarding
  if (process.env.SSH_CONNECTION && !process.env.DISPLAY) {
    return true
  }
  return false
}

export const loginCommand = new Command('login')
  .description('Authenticate with EnvManager')
  .option('--manual', 'Manual mode: paste an auth code instead of opening a browser')
  .option('--browser', 'Force browser mode even on headless servers')
  .action(async (options: { manual?: boolean; browser?: boolean }) => {
    const existingCreds = getCredentials()
    if (existingCreds?.email) {
      console.log(chalk.yellow(`Already logged in as ${existingCreds.email}`))
      console.log(chalk.gray('Run `envmanager logout` first to switch accounts.'))
      track('cli_login_completed', { status: 'already_authenticated' })
      return
    }

    const useManual = options.manual || (!options.browser && isHeadless())
    const method = useManual ? 'manual' : 'browser'
    track('cli_login_started', { method })

    try {
      if (useManual) {
        if (!options.manual && isHeadless()) {
          console.log(chalk.gray('Headless environment detected, using manual mode.\n'))
        }
        await loginManual()
      } else {
        const spinner = ora('Opening browser for authentication...').start()
        spinner.text = 'Waiting for authentication...'
        const { email } = await loginWithBrowser()
        spinner.succeed('Authentication successful!')
        if (email) {
          console.log(chalk.green(`\nLogged in as ${email}`))
        }
      }

      setUserFromToken(getCredentials()?.accessToken)
      track('cli_login_completed', {
        status: 'success',
        method,
        auth_type: getStoredApiKey() ? 'api_key' : 'session',
      })

      // Offer interactive init if no config exists in current directory
      const configExists = existsSync(resolve('envmanager.json')) || existsSync(resolve('.envmanagerrc'))
      if (!configExists && isInteractive()) {
        console.log('')
        const { confirm } = await import('@inquirer/prompts')
        const wantsInit = await confirm({
          message: 'Set up a project in this directory?',
          default: true,
        })
        if (wantsInit) {
          const { runInteractiveInit } = await import('../lib/interactive-init.js')
          await runInteractiveInit()
        } else {
          console.log(chalk.gray('\nYou can run `envmanager init` later to set up a project.'))
          console.log(chalk.gray('Run `envmanager list` to see your projects.'))
        }
      } else {
        console.log(chalk.gray('\nYou can now use envmanager commands.'))
        console.log(chalk.gray('Run `envmanager list` to see your projects.'))
      }
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'))
      track('cli_login_completed', { status: 'error', method, error_code: classifyLoginError(error) })
      await flushTelemetry()
      process.exit(1)
    }
  })
