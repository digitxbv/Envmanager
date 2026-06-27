import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { getCredentials, isTokenExpired, getApiKeyFromEnv, getStoredApiKey } from '../lib/credentials.js'
import { createClient } from '../lib/client.js'

export const whoamiCommand = new Command('whoami')
  .description('Show current user and team memberships')
  .action(async () => {
    const envApiKey = getApiKeyFromEnv()
    const storedApiKey = getStoredApiKey()

    if (envApiKey) {
      console.log(chalk.blue('Authenticated via environment API key'))
      console.log(chalk.gray(`Key prefix: ${envApiKey.substring(0, 11)}...`))
      return
    }

    const creds = getCredentials()

    if (!creds) {
      console.log(chalk.yellow('Not logged in.'))
      console.log(chalk.gray('Run `envmanager login` to authenticate.'))
      return
    }

    // New flow: API key from login
    if (storedApiKey) {
      // Continue to fetch user info below
    } else if (isTokenExpired()) {
      // Legacy flow: session tokens
      console.log(chalk.yellow('Session expired.'))
      console.log(chalk.gray('Run `envmanager login` to re-authenticate.'))
      return
    }

    const spinner = ora('Fetching user info...').start()

    try {
      const client = await createClient()
      
      const { data: { user }, error: userError } = await client.auth.getUser()
      
      if (userError || !user) {
        spinner.fail('Failed to fetch user')
        console.error(chalk.red(userError?.message || 'Unknown error'))
        return
      }

      const { data: memberships, error: memberError } = await client
        .from('organization_members')
        .select('role, organizations(name)')
        .eq('user_id', user.id)
      
      if (memberError) {
        spinner.fail('Failed to fetch memberships')
        console.error(chalk.red(memberError.message))
        return
      }

      spinner.stop()

      console.log(chalk.green(`Logged in as ${user.email}`))

      if (storedApiKey) {
        console.log(chalk.gray(`Authenticated via CLI session key (${storedApiKey.substring(0, 11)}...)`))
      } else if (creds.expiresAt) {
        const expiresIn = Math.round((creds.expiresAt - Date.now()) / 1000 / 60)
        if (expiresIn > 0) {
          console.log(chalk.gray(`Session expires in ${expiresIn} minutes`))
        }
      }

      if (memberships && memberships.length > 0) {
        console.log('')
        console.log(chalk.white('Organizations:'))
        memberships.forEach(m => {
          const org = m.organizations as { name: string } | { name: string }[] | null
          const orgName = Array.isArray(org) ? org[0]?.name : org?.name || 'Unknown'
          console.log(`  ${orgName} ${chalk.gray(`(${m.role})`)}`)
        })
      }

    } catch (error) {
      spinner.fail('Failed to fetch user info')
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'))
    }
  })
