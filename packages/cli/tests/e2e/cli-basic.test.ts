import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { runCli, createTestDir, cleanupDir } from './setup'

describe('CLI Basic Commands', () => {
  let testDir: string

  beforeEach(() => {
    testDir = createTestDir()
  })

  afterEach(() => {
    cleanupDir(testDir)
  })

  describe('--version', () => {
    it('should display version number', () => {
      const result = runCli('--version', testDir)
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/)
    })
  })

  describe('--help', () => {
    it('should display help message with description', () => {
      const result = runCli('--help', testDir)
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('CLI for EnvManager')
      expect(result.stdout).toContain('Commands:')
    })

    it('should list all available commands', () => {
      const result = runCli('--help', testDir)
      const commands = ['login', 'logout', 'whoami', 'pull', 'push', 'diff', 'list', 'dev', 'init', 'config', 'validate', 'template']
      for (const cmd of commands) {
        expect(result.stdout).toContain(cmd)
      }
    })
  })

  describe('command help', () => {
    const commands = ['login', 'logout', 'whoami', 'pull', 'push', 'diff', 'dev', 'init', 'validate']

    for (const cmd of commands) {
      it(`should display help for ${cmd} command`, () => {
        const result = runCli(`${cmd} --help`, testDir)
        expect(result.exitCode).toBe(0)
        expect(result.stdout.length).toBeGreaterThan(0)
      })
    }
  })

  describe('subcommand help', () => {
    it('should display help for list command', () => {
      const result = runCli('list --help', testDir)
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('projects')
    })

    it('should display help for config command', () => {
      const result = runCli('config --help', testDir)
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('show')
    })

    it('should display help for template command', () => {
      const result = runCli('template --help', testDir)
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('generate')
      expect(result.stdout).toContain('validate')
    })
  })

  describe('unknown command', () => {
    it('should show error for unknown command', () => {
      const result = runCli('unknown-command', testDir)
      expect(result.exitCode).not.toBe(0)
    })
  })
})

describe('CLI Config Command', () => {
  let testDir: string

  beforeEach(() => {
    testDir = createTestDir()
  })

  afterEach(() => {
    cleanupDir(testDir)
  })

  describe('config show', () => {
    it('should show no config when none exists', () => {
      const result = runCli('config show', testDir)
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('No configuration file found')
    })
  })
})
