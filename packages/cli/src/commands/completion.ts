import { Command } from 'commander'
import { createClient } from '../lib/client.js'
import { loadConfig } from '../lib/config.js'
import { getCredentials } from '../lib/credentials.js'

const COMMANDS = [
  'login',
  'logout', 
  'whoami',
  'pull',
  'push',
  'diff',
  'list',
  'config',
  'dev',
  'init',
  'template',
  'validate',
  'completion',
]

const LIST_RESOURCES = ['projects', 'environments', 'variables']

const bashScript = `
_envmanager_completions() {
  local cur prev words cword
  _init_completion || return

  local completions
  completions=$(envmanager __complete "\${COMP_WORDS[@]:1}" 2>/dev/null)
  
  if [[ $? -eq 0 ]]; then
    COMPREPLY=($(compgen -W "$completions" -- "$cur"))
  fi
}

complete -F _envmanager_completions envmanager
`.trim()

const zshScript = `
#compdef envmanager

_envmanager() {
  local completions
  completions=("\${(@f)$(envmanager __complete "\${words[@]:1}" 2>/dev/null)}")
  
  if [[ \${#completions[@]} -gt 0 ]]; then
    _describe 'envmanager' completions
  fi
}

compdef _envmanager envmanager
`.trim()

const fishScript = `
function __fish_envmanager_complete
  set -l tokens (commandline -opc)
  set -l current (commandline -ct)
  envmanager __complete $tokens[2..-1] $current 2>/dev/null
end

complete -c envmanager -f -a '(__fish_envmanager_complete)'
`.trim()

async function getCompletions(args: string[]): Promise<string[]> {
  if (args.length === 0) {
    return COMMANDS
  }

  const command = args[0]
  const lastArg = args[args.length - 1] ?? ''
  const prevArg = args.length > 1 ? args[args.length - 2] : ''

  if (args.length === 1 && !COMMANDS.includes(command)) {
    return COMMANDS.filter(c => c.startsWith(command))
  }

  if (command === 'list' && args.length === 2) {
    return LIST_RESOURCES.filter(r => r.startsWith(lastArg))
  }

  if (prevArg === '--project' || prevArg === '-p') {
    return await getProjectCompletions(lastArg)
  }

  if (prevArg === '--environment' || prevArg === '-e') {
    const projectArg = findArgValue(args, ['--project', '-p'])
    return await getEnvironmentCompletions(lastArg, projectArg)
  }

  const commandsWithProject = ['pull', 'push', 'diff', 'list', 'dev', 'validate', 'template']
  const commandsWithEnv = ['pull', 'push', 'diff', 'dev', 'validate', 'template']

  const suggestions: string[] = []

  if (commandsWithProject.includes(command) && !hasArg(args, ['--project', '-p'])) {
    suggestions.push('--project')
  }

  if (commandsWithEnv.includes(command) && !hasArg(args, ['--environment', '-e'])) {
    suggestions.push('--environment')
  }

  switch (command) {
    case 'pull':
      if (!hasArg(args, ['--output', '-o'])) suggestions.push('--output')
      if (!hasArg(args, ['--force', '-f'])) suggestions.push('--force')
      if (!hasArg(args, ['--no-secrets'])) suggestions.push('--no-secrets')
      break
    case 'push':
      if (!hasArg(args, ['--input', '-i'])) suggestions.push('--input')
      if (!hasArg(args, ['--secrets'])) suggestions.push('--secrets')
      if (!hasArg(args, ['--all-secrets'])) suggestions.push('--all-secrets')
      if (!hasArg(args, ['--dry-run'])) suggestions.push('--dry-run')
      break
    case 'list':
      if (!hasArg(args, ['--verbose', '-v'])) suggestions.push('--verbose')
      break
    case 'dev':
      if (!hasArg(args, ['--output', '-o'])) suggestions.push('--output')
      if (!hasArg(args, ['--watch', '-w'])) suggestions.push('--watch')
      break
    case 'template':
      if (args.length === 2) {
        return ['generate', 'sync', 'validate'].filter(s => s.startsWith(lastArg))
      }
      break
    case 'completion':
      if (args.length === 2) {
        return ['bash', 'zsh', 'fish'].filter(s => s.startsWith(lastArg))
      }
      break
    case 'config':
      if (args.length === 2) {
        return ['show'].filter(s => s.startsWith(lastArg))
      }
      break
  }

  return suggestions.filter(s => s.startsWith(lastArg))
}

function findArgValue(args: string[], flags: string[]): string | undefined {
  for (let i = 0; i < args.length - 1; i++) {
    if (flags.includes(args[i])) {
      return args[i + 1]
    }
  }
  return undefined
}

function hasArg(args: string[], flags: string[]): boolean {
  return args.some(a => flags.includes(a))
}

async function getProjectCompletions(prefix: string): Promise<string[]> {
  try {
    if (!getCredentials()) return []
    
    const client = await createClient()
    
    const { data: { user } } = await client.auth.getUser()
    if (!user) return []

    const { data: memberships } = await client
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)

    if (!memberships || memberships.length === 0) return []
    
    const orgIds = memberships.map(m => m.organization_id)
    
    const { data: projects } = await client
      .from('projects')
      .select('name')
      .in('organization_id', orgIds)
      .order('name')
    
    if (!projects) return []
    
    return projects
      .map(p => p.name)
      .filter(name => name.toLowerCase().startsWith(prefix.toLowerCase()))
  } catch {
    return []
  }
}

async function getEnvironmentCompletions(prefix: string, projectName?: string): Promise<string[]> {
  try {
    if (!getCredentials()) return []
    
    const client = await createClient()
    const config = loadConfig()
    
    let projectId = config?.project_id
    
    if (projectName) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (isUUID.test(projectName)) {
        projectId = projectName
      } else {
        const { data: project } = await client
          .from('projects')
          .select('id')
          .ilike('name', projectName)
          .single()
        
        if (project) {
          projectId = project.id
        }
      }
    }
    
    const defaultEnvs = ['development', 'staging', 'production', 'test']
    
    if (!projectId) {
      return defaultEnvs.filter(e => e.startsWith(prefix.toLowerCase()))
    }
    
    const { data: environments } = await client
      .from('environments')
      .select('name')
      .eq('project_id', projectId)
      .order('name')
    
    if (!environments) {
      return defaultEnvs.filter(e => e.startsWith(prefix.toLowerCase()))
    }
    
    return environments
      .map(e => e.name)
      .filter(name => name.toLowerCase().startsWith(prefix.toLowerCase()))
  } catch {
    return ['development', 'staging', 'production', 'test']
      .filter(e => e.startsWith(prefix.toLowerCase()))
  }
}

export const completeCommand = new Command('__complete')
  .description('Internal command for shell completion')
  .allowUnknownOption()
  .allowExcessArguments()
  .argument('[args...]', 'Arguments to complete')
  .action(async (args: string[]) => {
    try {
      const completions = await getCompletions(args || [])
      completions.forEach(c => console.log(c))
    } catch {
      process.exit(1)
    }
  })

export const completionCommand = new Command('completion')
  .description('Generate shell completion script')
  .argument('<shell>', 'Shell type: bash, zsh, or fish')
  .action((shell: string) => {
    switch (shell.toLowerCase()) {
      case 'bash':
        console.log(bashScript)
        console.log('\n# Add to ~/.bashrc:')
        console.log('# eval "$(envmanager completion bash)"')
        break
      case 'zsh':
        console.log(zshScript)
        console.log('\n# Add to ~/.zshrc:')
        console.log('# eval "$(envmanager completion zsh)"')
        break
      case 'fish':
        console.log(fishScript)
        console.log('\n# Save to ~/.config/fish/completions/envmanager.fish:')
        console.log('# envmanager completion fish > ~/.config/fish/completions/envmanager.fish')
        break
      default:
        console.error(`Unknown shell: ${shell}`)
        console.error('Supported: bash, zsh, fish')
        process.exit(1)
    }
  })
