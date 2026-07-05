import { PingArkApi } from './api'
import { resolveConfig } from './config'
import type { PingArkConfig, ResolvedConfig } from './types'

/** The largest body PingArk stores per ping (100 KiB). The server enforces it
 * too; we cap client-side so a huge body never wastes a request. */
const MAX_BODY_LENGTH = 100 * 1024

/**
 * Sends pings to PingArk and wraps a run with {@link PingArkClient.monitor}.
 *
 * Every ping is fail-open: a short timeout, swallowed errors, and no retries,
 * so monitoring can NEVER break or slow the job being monitored (PRD §5.7). The
 * only place an error surfaces is `monitor()`, which rethrows the wrapped
 * function's own error after reporting it, and {@link PingArkClient.api}, whose
 * management calls are setup tooling and throw on purpose.
 */
export class PingArkClient {
  /** The resolved configuration (options merged over env and defaults). */
  private readonly config: ResolvedConfig

  /** Lazily created management API client, shared across calls. */
  private managementApi?: PingArkApi

  /**
   * @param config optional overrides; anything omitted falls back to the
   *   `PINGARK_*` environment variables, then to defaults.
   */
  constructor(config: PingArkConfig = {}) {
    this.config = resolveConfig(config)
  }

  /**
   * Build the ping URL for a check and optional signal suffix. A check may be a
   * slug (combined with the configured ping key) or a full ping URL (used as-is,
   * for the UUID scheme).
   *
   * @param check the check slug, or a full `https://.../ping/...` URL
   * @param suffix '' (success) | 'start' | 'fail' | 'log' | an exit code
   */
  url(check: string, suffix = ''): string {
    const base = isUrl(check)
      ? check.replace(/\/+$/, '')
      : `${this.config.baseUrl}/ping/${this.config.pingKey}/${check}`

    return suffix === '' ? base : `${base}/${suffix}`
  }

  /**
   * Signal that a job has started, so PingArk can measure its run duration. A
   * start ping never moves the deadline (Architecture.md §4.3).
   */
  start(check?: string): Promise<void> {
    return this.send(this.resolve(check), 'start')
  }

  /**
   * Signal that a job finished successfully (re-arms the check). An optional
   * body is stored on the timeline, for example a short run summary.
   */
  success(check?: string, body?: string): Promise<void> {
    return this.send(this.resolve(check), '', body)
  }

  /**
   * Signal that a job failed (sends the check straight to down). Pass the caught
   * error to attach its message and stack trace as context, or a plain string,
   * or nothing.
   *
   * @param context an Error, a message, or undefined
   */
  fail(check?: string, context?: unknown): Promise<void> {
    return this.send(this.resolve(check), 'fail', renderContext(context))
  }

  /**
   * Report a process exit code. 0 counts as success (re-arms), any non-zero code
   * counts as a failure (Architecture.md §5.1), and the raw code is recorded on
   * the ping either way.
   *
   * @param code the process exit status (0-999)
   * @param context an optional Error or message
   */
  exitCode(check: string | undefined, code: number, context?: unknown): Promise<void> {
    return this.send(this.resolve(check), String(code), renderContext(context))
  }

  /**
   * Record a timeline event without changing the check's state (the /log signal,
   * Architecture.md §5.1): never arms, recovers, resumes, or alerts. Useful for
   * in-job progress notes such as "processed 5k of 20k rows".
   */
  log(check?: string, body?: string): Promise<void> {
    return this.send(this.resolve(check), 'log', body)
  }

  /**
   * Run a function as a monitored job: ping `start`, then `success` on resolve
   * or `fail` (with the thrown error as context) on throw. The original result
   * is returned and the original error is rethrown, so wrapping a job in
   * `monitor` never changes its outcome, only reports it.
   *
   * @param fn the job to run (sync or async)
   * @param check the check to report to (falls back to the default check)
   * @returns whatever `fn` returns
   */
  async monitor<T>(fn: () => T | Promise<T>, check?: string): Promise<T> {
    const slug = this.resolve(check)
    await this.start(slug)

    try {
      const result = await fn()
      await this.success(slug)

      return result
    } catch (error) {
      await this.fail(slug, error)
      throw error
    }
  }

  /**
   * The management API client, for creating and configuring checks from code
   * (see {@link PingArkApi}). It needs an API key and throws on error.
   */
  api(): PingArkApi {
    return (this.managementApi ??= new PingArkApi(this.config))
  }

  /**
   * Fire one ping, optionally with a text body (for example captured output on
   * failure). Silent on every failure by design, so monitoring can never break
   * the job.
   *
   * @param check the check slug or full ping URL (an empty value is a no-op)
   * @param suffix '' | 'start' | 'fail' | 'log' | exit code
   * @param body optional text body, POSTed as text/plain
   */
  async send(check: string, suffix = '', body?: string | null): Promise<void> {
    // The fail-open guard: never ping when disabled, unconfigured, or the check
    // could not be resolved. A silent no-op is the correct behaviour.
    if (check === '' || !this.config.enabled || (!isUrl(check) && !this.config.pingKey)) {
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs)

    try {
      const headers: Record<string, string> = { 'User-Agent': this.config.userAgent }
      const hasBody = body !== undefined && body !== null && body !== ''

      const init: {
        method: string
        headers: Record<string, string>
        signal: AbortSignal
        body?: string
      } = { method: 'GET', headers, signal: controller.signal }
      if (hasBody) {
        init.method = 'POST'
        headers['Content-Type'] = 'text/plain'
        init.body = truncateBody(body)
      }

      await fetch(this.url(check, suffix), init)
    } catch {
      // Never let monitoring break the job being monitored (PRD §5.7).
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * Resolve the check to ping, falling back to the configured default check when
   * none is given. Returns an empty string when nothing resolves, which
   * {@link PingArkClient.send} treats as a silent no-op.
   */
  private resolve(check?: string): string {
    return check ?? this.config.defaultCheck ?? ''
  }
}

/** Whether a check identifier is a full URL (the UUID/direct scheme). */
function isUrl(check: string): boolean {
  return /^https?:\/\//i.test(check)
}

/** Cap a body at 100 KiB so a huge payload never wastes a request. */
function truncateBody(body: string): string {
  return body.length > MAX_BODY_LENGTH ? body.slice(0, MAX_BODY_LENGTH) : body
}

/**
 * Normalise a failure context into a string body. An Error is rendered as its
 * stack (which includes the name and message), so failures carry real context
 * on the PingArk timeline; anything else is stringified.
 */
function renderContext(context?: unknown): string | undefined {
  if (context === undefined || context === null) {
    return undefined
  }

  if (context instanceof Error) {
    return context.stack ?? `${context.name}: ${context.message}`
  }

  return String(context)
}
