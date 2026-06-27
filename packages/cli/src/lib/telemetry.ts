import { PostHog } from 'posthog-node'
import { homedir } from 'os'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { randomUUID } from 'crypto'
import { getStoredApiUrl } from './credentials.js'

/**
 * Anonymous CLI usage analytics.
 *
 * Design notes (see also the web app's `app/plugins/posthog.client.ts`):
 * - Events are stitched to the SAME PostHog person as the web app by using the
 *   Supabase user id (the JWT `sub`) as the distinct id. This is what makes the
 *   cross-surface funnel (web signup -> CLI pull) possible.
 * - This is a secrets product: we ONLY send counts, booleans, enums and
 *   durations. Never variable keys, values, file paths, or org/project/env names.
 * - Telemetry never blocks, slows, or crashes a command. Every failure is
 *   swallowed; flushing is time-boxed.
 * - Honors `DO_NOT_TRACK`, `ENVMANAGER_TELEMETRY=0`, `config set telemetry off`,
 *   and auto-disables for self-hosted / local API endpoints.
 */

// Public, write-only project key — safe to ship (same key the web bundle uses).
const DEFAULT_POSTHOG_KEY = 'phc_mSUtA90ar4560h6u9oMOCAfE7YTvHL8aXftP5B81dE'
const DEFAULT_POSTHOG_HOST = 'https://e.envmanager.com'
const DEFAULT_API_URL = 'https://rhopfaburfflrdwpowcd.supabase.co'

const STATE_DIR = join(homedir(), '.envmanager')
const STATE_FILE = join(STATE_DIR, 'telemetry.json')

const NOTICE = `
EnvManager collects anonymous usage analytics (command names, success/failure,
counts and durations — never your variables, values, or file contents).
This helps us see whether features like \`pull\` actually work for people.
Opt out any time:  envmanager config telemetry off   (or set DO_NOT_TRACK=1)
`

interface TelemetryState {
  anonymousId?: string
  enabled?: boolean // explicit opt-in/out; undefined = default (on)
  noticeShown?: boolean
}

let cliVersion = '0.0.0'
let distinctId: string | null = null
let client: PostHog | null = null
let didCapture = false

function loadState(): TelemetryState {
  try {
    if (!existsSync(STATE_FILE)) return {}
    return JSON.parse(readFileSync(STATE_FILE, 'utf-8')) as TelemetryState
  } catch {
    return {}
  }
}

function saveState(state: TelemetryState): void {
  try {
    if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true })
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
  } catch {
    /* ignore — telemetry preferences are best-effort */
  }
}

function getApiUrl(): string {
  return process.env.ENVMANAGER_API_URL || getStoredApiUrl() || DEFAULT_API_URL
}

function getKey(): string {
  return process.env.ENVMANAGER_POSTHOG_KEY || DEFAULT_POSTHOG_KEY
}

function getHost(): string {
  return process.env.ENVMANAGER_POSTHOG_HOST || DEFAULT_POSTHOG_HOST
}

function envDisabled(): boolean {
  if (process.env.DO_NOT_TRACK && process.env.DO_NOT_TRACK !== '0' && process.env.DO_NOT_TRACK !== 'false') {
    return true
  }
  const flag = process.env.ENVMANAGER_TELEMETRY?.toLowerCase()
  return flag === '0' || flag === 'false' || flag === 'off' || flag === 'no'
}

/** Self-hosted or local installs should never phone home to our cloud PostHog. */
function isSelfHostedOrLocal(): boolean {
  return getApiUrl() !== DEFAULT_API_URL
}

export function isTelemetryEnabled(): boolean {
  if (envDisabled()) return false
  if (loadState().enabled === false) return false
  if (!getKey()) return false
  if (isSelfHostedOrLocal()) return false
  return true
}

/** Decode the `sub` (Supabase user id) claim from a JWT without verifying it. */
export function decodeJwtSub(token?: string | null): string | null {
  if (!token) return null
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'))
    return typeof json.sub === 'string' ? json.sub : null
  } catch {
    return null
  }
}

/** Normalize an environment name into a privacy-safe bucket (never the raw name). */
export function environmentKind(name?: string): string {
  const n = (name || '').toLowerCase()
  if (!n) return 'unknown'
  if (n.includes('prod')) return 'production'
  if (n.includes('stag')) return 'staging'
  if (n.includes('preview') || n.startsWith('pr-')) return 'preview'
  if (n.includes('test') || n.includes('qa')) return 'test'
  if (n.includes('dev') || n.includes('local')) return 'development'
  return 'other'
}

/** Map a thrown runtime error to a stable error_code (used by pull/push catch blocks). */
export function classifyError(error: unknown): string {
  const msg = (error instanceof Error ? error.message : String(error ?? '')).toLowerCase()
  if (/not authenticated|envmanager login|login first/.test(msg)) return 'not_authenticated'
  if (/refresh|session expired|expired|jwt|unauthorized|401/.test(msg)) return 'auth_expired'
  if (/http 5\d\d|service unavailable|bad gateway|gateway timeout|internal server error/.test(msg)) return 'server_error'
  if (/fetch failed|network|enotfound|econnrefused|econnreset|timeout|socket/.test(msg)) return 'network_error'
  return 'unknown'
}

function detectCI(): boolean {
  return Boolean(
    process.env.CI ||
      process.env.GITHUB_ACTIONS ||
      process.env.GITLAB_CI ||
      process.env.CIRCLECI ||
      process.env.BUILDKITE ||
      process.env.JENKINS_URL ||
      process.env.TF_BUILD,
  )
}

function ensureAnonymousId(): string {
  const state = loadState()
  if (state.anonymousId) return state.anonymousId
  const id = randomUUID()
  saveState({ ...state, anonymousId: id })
  return id
}

function getDistinctId(): string {
  return distinctId || ensureAnonymousId()
}

function superProperties(): Record<string, unknown> {
  return {
    cli_version: cliVersion,
    os: process.platform,
    arch: process.arch,
    node_version: process.version,
    is_ci: detectCI(),
  }
}

function getClient(): PostHog {
  if (!client) {
    client = new PostHog(getKey(), {
      host: getHost(),
      // Batch a whole invocation's events into ONE request flushed at exit: fewer
      // round-trips, and a single sent_at so PostHog's clock-skew correction can't
      // reorder events fired milliseconds apart (e.g. login_started/_completed).
      flushAt: 50,
      flushInterval: 0, // no periodic timer keeping the process alive
      fetchRetryCount: 0, // fail fast — never retry-loop and hang the CLI
      requestTimeout: 2000, // bound a black-holing endpoint
      disableGeoip: true,
    })
    client.on('error', () => {
      /* swallow — telemetry must never surface to the user */
    })
  }
  return client
}

/** The running CLI version (set via initTelemetry at startup). */
export function getCliVersion(): string {
  return cliVersion
}

/** Set up super-property context and show the one-time notice. Call once at startup. */
export function initTelemetry(opts: { cliVersion: string }): void {
  cliVersion = opts.cliVersion
  if (!isTelemetryEnabled()) return
  const state = loadState()
  if (!state.noticeShown) {
    process.stderr.write(NOTICE)
    saveState({ ...state, anonymousId: state.anonymousId ?? randomUUID(), noticeShown: true })
  }
}

/** Stitch this run's events to the Supabase user behind the given access token. */
export function setUserFromToken(token?: string | null): void {
  const sub = decodeJwtSub(token)
  if (sub) distinctId = sub
}

/** Fire-and-forget event capture. Safe to call unconditionally; no-ops when disabled. */
export function track(event: string, properties: Record<string, unknown> = {}): void {
  try {
    if (!isTelemetryEnabled()) return
    const clean: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(properties)) {
      if (v !== undefined) clean[k] = v
    }
    getClient().capture({
      distinctId: getDistinctId(),
      event,
      properties: { ...superProperties(), ...clean },
      // Stamp at call time so the event reflects when it actually occurred, not
      // when the batch is flushed at process exit.
      timestamp: new Date(),
    })
    didCapture = true
  } catch {
    /* never let analytics break a command */
  }
}

/**
 * Flush queued events before the process exits. Time-boxed so it can't hang the
 * CLI. Returns true if a flush was attempted — when it is, the caller should
 * `process.exit()` promptly: a black-holing analytics host can otherwise keep an
 * undici socket open (and Node alive) for ~10s after this resolves.
 */
export async function flushTelemetry(): Promise<boolean> {
  if (!client || !didCapture) return false
  const c = client
  client = null
  didCapture = false
  // posthog-node logs send failures to console.error unconditionally (in both
  // shutdown() and captureImmediate()). Mute console.error for the brief, bounded
  // flush window so a down analytics endpoint never prints noise to the user.
  const originalError = console.error
  console.error = () => {}
  try {
    await Promise.race([
      c.shutdown(1500),
      new Promise<void>((resolve) => setTimeout(resolve, 1500)),
    ])
  } catch {
    /* ignore flush failures */
  } finally {
    console.error = originalError
  }
  return true
}

/** Persist an explicit telemetry opt-in/out (for `envmanager config telemetry on|off`). */
export function setTelemetryEnabled(enabled: boolean): void {
  saveState({ ...loadState(), enabled })
}

/** Human-readable status for `envmanager config telemetry status`. */
export function telemetryStatusLine(): string {
  if (envDisabled()) return 'disabled (DO_NOT_TRACK / ENVMANAGER_TELEMETRY)'
  if (isSelfHostedOrLocal()) return 'disabled (self-hosted or local API endpoint)'
  if (loadState().enabled === false) return 'disabled (config telemetry off)'
  return 'enabled'
}
