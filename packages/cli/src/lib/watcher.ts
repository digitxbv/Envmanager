import { watch, FSWatcher } from 'fs'
import { existsSync, readFileSync } from 'fs'
import { EventEmitter } from 'events'
import { parse as parseDotenv } from 'dotenv'

export interface FileChangeEvent {
  type: 'change' | 'rename'
  path: string
  variables: Map<string, string>
}

export interface FileWatcherEvents {
  change: (event: FileChangeEvent) => void
  error: (error: Error) => void
}

export class EnvFileWatcher extends EventEmitter {
  private watcher: FSWatcher | null = null
  private filePath: string
  private lastContent: string = ''
  private debounceTimeout: NodeJS.Timeout | null = null
  private readonly debounceMs: number

  constructor(filePath: string, debounceMs: number = 300) {
    super()
    this.filePath = filePath
    this.debounceMs = debounceMs
  }

  start(): void {
    if (this.watcher) {
      return
    }

    if (!existsSync(this.filePath)) {
      this.emit('error', new Error(`File not found: ${this.filePath}`))
      return
    }

    this.lastContent = this.readFile()

    this.watcher = watch(this.filePath, (eventType) => {
      if (this.debounceTimeout) {
        clearTimeout(this.debounceTimeout)
      }

      this.debounceTimeout = setTimeout(() => {
        this.handleFileChange(eventType as 'change' | 'rename')
      }, this.debounceMs)
    })

    this.watcher.on('error', (error) => {
      this.emit('error', error)
    })
  }

  stop(): void {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout)
      this.debounceTimeout = null
    }

    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
  }

  private readFile(): string {
    try {
      return readFileSync(this.filePath, 'utf-8')
    } catch {
      return ''
    }
  }

  private handleFileChange(eventType: 'change' | 'rename'): void {
    if (!existsSync(this.filePath)) {
      this.emit('change', {
        type: eventType,
        path: this.filePath,
        variables: new Map()
      })
      return
    }

    const currentContent = this.readFile()
    
    if (currentContent === this.lastContent) {
      return
    }

    this.lastContent = currentContent

    const parsed = parseDotenv(currentContent)
    const variables = new Map(Object.entries(parsed))

    this.emit('change', {
      type: eventType,
      path: this.filePath,
      variables
    })
  }

  getCurrentVariables(): Map<string, string> {
    const content = this.readFile()
    const parsed = parseDotenv(content)
    return new Map(Object.entries(parsed))
  }
}

export { parseEnvFile } from './parser.js'

export function formatEnvFile(variables: Map<string, string>): string {
  const lines: string[] = []
  
  const sortedKeys = Array.from(variables.keys()).sort()
  
  for (const key of sortedKeys) {
    const value = variables.get(key) || ''
    const needsQuotes = value.includes(' ') || value.includes('\n') || value.includes('"') || value.includes("'")
    const formattedValue = needsQuotes ? `"${value.replace(/"/g, '\\"')}"` : value
    lines.push(`${key}=${formattedValue}`)
  }
  
  return lines.join('\n') + '\n'
}
