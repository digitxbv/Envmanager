import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { runCli, createTestDir, cleanupDir, createEnvFile, createSchemaFile, writeFile } from './setup'

describe('CLI Validate Command', () => {
  let testDir: string

  beforeEach(() => {
    testDir = createTestDir()
  })

  afterEach(() => {
    cleanupDir(testDir)
  })

  describe('with local schema', () => {
    it('should pass validation for valid env file', () => {
      createEnvFile(testDir, {
        PORT: '3000',
        DEBUG: 'true',
      })

      createSchemaFile(testDir, {
        PORT: { type: 'number', required: true },
        DEBUG: { type: 'boolean' },
      })

      const result = runCli('validate --schema schema.json', testDir)
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('passed')
    })

    it('should fail validation for missing required field', () => {
      createEnvFile(testDir, {
        DEBUG: 'true',
      })

      createSchemaFile(testDir, {
        PORT: { type: 'number', required: true },
        DEBUG: { type: 'boolean' },
      })

      const result = runCli('validate --schema schema.json', testDir)
      expect(result.exitCode).not.toBe(0)
      expect(result.stdout + result.stderr).toMatch(/PORT|required|missing/i)
    })

    it('should fail validation for invalid type', () => {
      createEnvFile(testDir, {
        PORT: 'not-a-number',
      })

      createSchemaFile(testDir, {
        PORT: { type: 'number', required: true },
      })

      const result = runCli('validate --schema schema.json', testDir)
      expect(result.exitCode).not.toBe(0)
      expect(result.stdout + result.stderr).toMatch(/PORT|number|invalid/i)
    })

    it('should warn about extra variables not in schema', () => {
      createEnvFile(testDir, {
        PORT: '3000',
        EXTRA_VAR: 'value',
      })

      createSchemaFile(testDir, {
        PORT: { type: 'number' },
      })

      const result = runCli('validate --schema schema.json', testDir)
      expect(result.stdout).toMatch(/EXTRA_VAR|warning|not defined/i)
    })

    it('should fail in strict mode with extra variables', () => {
      createEnvFile(testDir, {
        PORT: '3000',
        EXTRA_VAR: 'value',
      })

      createSchemaFile(testDir, {
        PORT: { type: 'number' },
      })

      const result = runCli('validate --schema schema.json --strict', testDir)
      expect(result.exitCode).not.toBe(0)
    })

    it('should validate enum values', () => {
      createEnvFile(testDir, {
        LOG_LEVEL: 'debug',
      })

      createSchemaFile(testDir, {
        LOG_LEVEL: { type: 'string', enum: ['debug', 'info', 'warn', 'error'] },
      })

      const result = runCli('validate --schema schema.json', testDir)
      expect(result.exitCode).toBe(0)
    })

    it('should fail for invalid enum value', () => {
      createEnvFile(testDir, {
        LOG_LEVEL: 'verbose',
      })

      createSchemaFile(testDir, {
        LOG_LEVEL: { type: 'string', enum: ['debug', 'info', 'warn', 'error'] },
      })

      const result = runCli('validate --schema schema.json', testDir)
      expect(result.exitCode).not.toBe(0)
      expect(result.stdout + result.stderr).toMatch(/LOG_LEVEL|enum|must be/i)
    })

    it('should validate number ranges', () => {
      createEnvFile(testDir, {
        PORT: '80000',
      })

      createSchemaFile(testDir, {
        PORT: { type: 'number', minimum: 1, maximum: 65535 },
      })

      const result = runCli('validate --schema schema.json', testDir)
      expect(result.exitCode).not.toBe(0)
      expect(result.stdout + result.stderr).toMatch(/PORT|max|65535/i)
    })
  })

  describe('with custom input file', () => {
    it('should validate specified input file', () => {
      writeFile(testDir, '.env.production', 'PORT=3000\n')
      createSchemaFile(testDir, {
        PORT: { type: 'number', required: true },
      })

      const result = runCli('validate --schema schema.json --input .env.production', testDir)
      expect(result.exitCode).toBe(0)
    })
  })

  describe('error handling', () => {
    it('should fail when input file not found', () => {
      createSchemaFile(testDir, { PORT: { type: 'number' } })
      
      const result = runCli('validate --schema schema.json --input nonexistent.env', testDir)
      expect(result.exitCode).not.toBe(0)
      expect(result.stdout + result.stderr).toMatch(/not found/i)
    })

    it('should fail when schema file not found', () => {
      createEnvFile(testDir, { PORT: '3000' })
      
      const result = runCli('validate --schema nonexistent.json', testDir)
      expect(result.exitCode).not.toBe(0)
      expect(result.stdout + result.stderr).toMatch(/not found/i)
    })
  })
})
