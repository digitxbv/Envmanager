import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { runCli, createTestDir, cleanupDir, createEnvFile, createTemplateFile, writeFile } from './setup'

describe('CLI Template Command', () => {
  let testDir: string

  beforeEach(() => {
    testDir = createTestDir()
  })

  afterEach(() => {
    cleanupDir(testDir)
  })

  describe('template validate', () => {
    it('should pass when all template variables present', () => {
      createTemplateFile(testDir, [
        { key: 'PORT' },
        { key: 'DATABASE_URL' },
      ])

      createEnvFile(testDir, {
        PORT: '3000',
        DATABASE_URL: 'postgres://localhost:5432/db',
      })

      const result = runCli('template validate', testDir)
      expect(result.exitCode).toBe(0)
    })

    it('should report extra variables not in template', () => {
      createTemplateFile(testDir, [
        { key: 'PORT' },
      ])

      createEnvFile(testDir, {
        PORT: '3000',
        EXTRA_VAR: 'value',
      })

      const result = runCli('template validate', testDir)
      expect(result.stdout).toMatch(/EXTRA_VAR|extra|not in template/i)
    })

    it('should use custom template file', () => {
      writeFile(testDir, 'custom.template', 'PORT=\nAPI_KEY=\n')
      createEnvFile(testDir, { PORT: '3000', API_KEY: 'abc123' })

      const result = runCli('template validate --template custom.template', testDir)
      expect(result.exitCode).toBe(0)
    })

    it('should validate custom input file', () => {
      createTemplateFile(testDir, [{ key: 'PORT' }])
      writeFile(testDir, '.env.local', 'PORT=3000\n')

      const result = runCli('template validate --input .env.local', testDir)
      expect(result.exitCode).toBe(0)
    })
  })

  describe('template generate --help', () => {
    it('should show help for generate command', () => {
      const result = runCli('template generate --help', testDir)
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('generate')
    })
  })

  describe('template sync --help', () => {
    it('should show help for sync command', () => {
      const result = runCli('template sync --help', testDir)
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('sync')
    })
  })

  describe('error handling', () => {
    it('should fail when template file not found', () => {
      createEnvFile(testDir, { PORT: '3000' })
      
      const result = runCli('template validate --template nonexistent.template', testDir)
      expect(result.exitCode).not.toBe(0)
      expect(result.stdout + result.stderr).toMatch(/not found/i)
    })

    it('should fail when input file not found', () => {
      createTemplateFile(testDir, [{ key: 'PORT' }])
      
      const result = runCli('template validate --input nonexistent.env', testDir)
      expect(result.exitCode).not.toBe(0)
      expect(result.stdout + result.stderr).toMatch(/not found/i)
    })
  })
})
