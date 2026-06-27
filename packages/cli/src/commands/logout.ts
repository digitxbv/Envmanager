import { Command } from 'commander'
import chalk from 'chalk'
import { clearCredentials, getCredentials } from '../lib/credentials.js'

export const logoutCommand = new Command('logout')
  .description('Log out of EnvManager')
  .action(() => {
    const creds = getCredentials()
    
    if (!creds) {
      console.log(chalk.yellow('Not currently logged in.'))
      return
    }
    
    const email = creds.email || 'unknown user'
    clearCredentials()
    console.log(chalk.green(`Logged out from ${email}`))
  })
