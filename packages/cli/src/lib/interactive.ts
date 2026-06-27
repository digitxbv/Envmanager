import { select, confirm } from '@inquirer/prompts'

export function isInteractive(): boolean {
  return !!process.stdin.isTTY
}

interface SelectableItem {
  id: string
  name: string
}

export async function selectProject(projects: SelectableItem[]): Promise<SelectableItem> {
  if (projects.length === 1) return projects[0]

  const selected = await select({
    message: 'Select a project',
    choices: projects.map(p => ({
      name: p.name,
      value: p,
    })),
  })

  return selected
}

export async function selectEnvironment(
  environments: SelectableItem[],
  defaultName?: string
): Promise<SelectableItem> {
  if (environments.length === 1) return environments[0]

  const defaultEnv = defaultName
    ? environments.find(e => e.name.toLowerCase() === defaultName.toLowerCase())
    : undefined

  const selected = await select({
    message: 'Select an environment',
    choices: environments.map(e => ({
      name: e.name,
      value: e,
    })),
    default: defaultEnv,
  })

  return selected
}

export async function selectService(
  services: SelectableItem[]
): Promise<SelectableItem | null> {
  const ALL_VARS = { id: '', name: 'All variables (no service filter)' }

  const selected = await select({
    message: 'Select a service',
    choices: [
      { name: ALL_VARS.name, value: ALL_VARS },
      ...services.map(s => ({
        name: s.name,
        value: s,
      })),
    ],
  })

  return selected.id === '' ? null : selected
}

export async function confirmInit(): Promise<boolean> {
  return confirm({
    message: 'No envmanager.json found. Set up a project in this directory?',
    default: true,
  })
}
