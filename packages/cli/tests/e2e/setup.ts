import { execSync } from 'child_process'
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs'
import { join } from 'path'

export const CLI_PATH = join(__dirname, '../../dist/bin/envmanager.js')

let testDirCounter = 0

export function createTestDir(): string {
  const dir = join(__dirname, `../../.test-tmp-${Date.now()}-${testDirCounter++}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

export function cleanupDir(dir: string): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true })
  }
}

export function runCli(args: string, cwd: string): {
  stdout: string
  stderr: string
  exitCode: number
} {
  try {
    const result = execSync(`node ${CLI_PATH} ${args}`, {
      cwd,
      encoding: 'utf-8',
      timeout: 30000,
      // Never emit telemetry (or show the first-run notice) from the test suite.
      env: { ...process.env, NO_COLOR: '1', ENVMANAGER_TELEMETRY: '0' },
    })
    return { stdout: result, stderr: '', exitCode: 0 }
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; status?: number }
    return {
      stdout: execError.stdout || '',
      stderr: execError.stderr || '',
      exitCode: execError.status || 1,
    }
  }
}

export function createEnvFile(dir: string, vars: Record<string, string>): void {
  const content = Object.entries(vars)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
  writeFileSync(join(dir, '.env'), content + '\n')
}

export function createSchemaFile(dir: string, schema: Record<string, unknown>): void {
  writeFileSync(join(dir, 'schema.json'), JSON.stringify(schema, null, 2))
}

export function createTemplateFile(dir: string, vars: { key: string; value?: string }[]): void {
  const content = vars
    .map((v) => `${v.key}=${v.value !== undefined ? v.value : ''}`)
    .join('\n')
  writeFileSync(join(dir, '.env.template'), content + '\n')
}

export function writeFile(dir: string, filename: string, content: string): void {
  writeFileSync(join(dir, filename), content)
}
