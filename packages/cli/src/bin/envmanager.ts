import { Command } from 'commander'
import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { loginCommand } from '../commands/login.js'
import { logoutCommand } from '../commands/logout.js'
import { whoamiCommand } from '../commands/whoami.js'
import { pullCommand } from '../commands/pull.js'
import { pushCommand } from '../commands/push.js'
import { diffCommand } from '../commands/diff.js'
import { listCommand } from '../commands/list.js'
import { configCommand } from '../commands/config.js'
import { devCommand } from '../commands/dev.js'
import { initCommand } from '../commands/init.js'
import { templateCommand } from '../commands/template.js'
import { validateCommand } from '../commands/validate.js'
import { completionCommand, completeCommand } from '../commands/completion.js'
import { debugCommand } from '../commands/debug.js'
import { runCommand } from '../commands/run.js'
import { initTelemetry, track, flushTelemetry } from '../lib/telemetry.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf-8'))

initTelemetry({ cliVersion: pkg.version })

const program = new Command()

program
  .name('envmanager')
  .description('CLI for EnvManager - secure environment variable management')
  .version(pkg.version)

program.enablePositionalOptions()

// pull / push / login emit their own richer lifecycle events; everything else
// gets a generic completion event here. process.exit() paths flush themselves.
const OWN_EVENTS = new Set(['pull', 'push', 'login', 'run'])

program.hook('preAction', (_thisCommand, actionCommand) => {
  ;(actionCommand as Command & { _startedAt?: number })._startedAt = Date.now()
})

program.hook('postAction', async (_thisCommand, actionCommand) => {
  const name = actionCommand.name()
  if (!OWN_EVENTS.has(name)) {
    const startedAt = (actionCommand as Command & { _startedAt?: number })._startedAt ?? Date.now()
    track('cli_command_completed', {
      command: name,
      status: 'success',
      duration_ms: Date.now() - startedAt,
    })
  }
  // Force exit once telemetry has flushed — a black-holing analytics host can
  // otherwise keep the process alive long after the command's work is done.
  if (await flushTelemetry()) {
    process.exit(typeof process.exitCode === 'number' ? process.exitCode : 0)
  }
})

program.addCommand(loginCommand)
program.addCommand(logoutCommand)
program.addCommand(whoamiCommand)
program.addCommand(pullCommand)
program.addCommand(pushCommand)
program.addCommand(diffCommand)
program.addCommand(listCommand)
program.addCommand(configCommand)
program.addCommand(devCommand)
program.addCommand(initCommand)
program.addCommand(templateCommand)
program.addCommand(validateCommand)
program.addCommand(completionCommand)
program.addCommand(completeCommand)
program.addCommand(debugCommand)
program.addCommand(runCommand)

program.parse()
