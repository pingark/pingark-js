import { resolveConfig } from './config'
import type {
  Channel,
  Check,
  CheckAttributes,
  Flip,
  Ping,
  PingArkConfig,
  ResolvedConfig,
} from './types'

/**
 * Thrown when a management API call returns a non-2xx response. Carries the
 * HTTP status and the raw response body, so callers can inspect what failed.
 */
export class PingArkApiError extends Error {
  /** The HTTP status code of the failed response. */
  readonly status: number

  /** The raw response body, useful for surfacing the server's error message. */
  readonly body: string

  /**
   * @param status the HTTP status code
   * @param body the raw response body
   * @param message a human-readable summary
   */
  constructor(status: number, body: string, message: string) {
    super(message)
    this.name = 'PingArkApiError'
    this.status = status
    this.body = body
  }
}

/**
 * A thin client for the PingArk management API (Architecture.md §10): create,
 * read, configure, pause, resume, and delete checks, and list their pings,
 * flips, and the project's channels.
 *
 * Unlike {@link PingArkClient}, this client is NOT on the monitoring hot path,
 * so it deliberately throws on any HTTP error (a {@link PingArkApiError}). It is
 * for setup and tooling, where a failure should surface, not be swallowed.
 * Authenticate with a read-write project API key (`apiKey`).
 */
export class PingArkApi {
  /** The resolved configuration this client authenticates and routes with. */
  private readonly config: ResolvedConfig

  /**
   * @param config a resolved config (from a {@link PingArkClient}) or plain
   *   options, which are resolved against the environment.
   */
  constructor(config: ResolvedConfig | PingArkConfig) {
    this.config = 'timeoutMs' in config ? (config as ResolvedConfig) : resolveConfig(config)
  }

  /**
   * List every check in the key's project.
   *
   * @returns the serialized check objects
   */
  async checks(): Promise<Check[]> {
    const data = await this.request('GET', '/checks')

    return (data as { checks?: Check[] }).checks ?? []
  }

  /**
   * Fetch a single check by id.
   *
   * @param id the check uuid
   */
  async check(id: string): Promise<Check> {
    const data = await this.request('GET', `/checks/${id}`)

    return (data as { check: Check }).check
  }

  /**
   * Create a check. See {@link CheckAttributes} for the field set (name, slug,
   * schedule_type, period/schedule_expr, timezone, grace, tags, channels,
   * filtering rules).
   *
   * @param attributes the check attributes
   */
  async createCheck(attributes: CheckAttributes): Promise<Check> {
    const data = await this.request('POST', '/checks', { json: attributes })

    return (data as { check: Check }).check
  }

  /**
   * Update a check. Only the keys you pass are changed; omitting `channels` or
   * `tags` leaves those attachments untouched (a partial update).
   *
   * @param id the check uuid
   * @param attributes the attributes to change
   */
  async updateCheck(id: string, attributes: CheckAttributes): Promise<Check> {
    const data = await this.request('PUT', `/checks/${id}`, { json: attributes })

    return (data as { check: Check }).check
  }

  /**
   * Delete a check permanently.
   *
   * @param id the check uuid
   */
  async deleteCheck(id: string): Promise<void> {
    await this.request('DELETE', `/checks/${id}`, { parse: false })
  }

  /**
   * Pause a check (stops it expecting pings and alerting) until resumed.
   *
   * @param id the check uuid
   */
  async pause(id: string): Promise<void> {
    await this.request('POST', `/checks/${id}/pause`, { parse: false })
  }

  /**
   * Resume a paused check.
   *
   * @param id the check uuid
   */
  async resume(id: string): Promise<void> {
    await this.request('POST', `/checks/${id}/resume`, { parse: false })
  }

  /**
   * List a check's recent pings, newest first.
   *
   * @param id the check uuid
   * @param limit how many to return (1-1000)
   */
  async pings(id: string, limit = 100): Promise<Ping[]> {
    const data = await this.request('GET', `/checks/${id}/pings`, { query: { limit } })

    return (data as { pings?: Ping[] }).pings ?? []
  }

  /**
   * Fetch the raw text body a single ping carried.
   *
   * @param id the check uuid
   * @param pingId the ping id (from the pings list)
   * @returns the stored body as plain text
   */
  async pingBody(id: string, pingId: number): Promise<string> {
    const response = await this.send('GET', `/checks/${id}/pings/${pingId}/body`)

    return response.text()
  }

  /**
   * List a check's status-change history (flips), newest first.
   *
   * @param id the check uuid
   * @param limit how many to return (1-1000)
   */
  async flips(id: string, limit = 100): Promise<Flip[]> {
    const data = await this.request('GET', `/checks/${id}/flips`, { query: { limit } })

    return (data as { flips?: Flip[] }).flips ?? []
  }

  /**
   * List the project's notification channels, so you can discover the ids to
   * attach to a check on create or update.
   */
  async channels(): Promise<Channel[]> {
    const data = await this.request('GET', '/channels')

    return (data as { channels?: Channel[] }).channels ?? []
  }

  /**
   * Perform a request and parse the JSON body (or return the raw parsed value).
   * Pass `parse: false` for endpoints with no body (delete, pause, resume).
   */
  private async request(
    method: string,
    path: string,
    options: { query?: Record<string, string | number>; json?: unknown; parse?: boolean } = {},
  ): Promise<unknown> {
    const response = await this.send(method, path, options)
    if (options.parse === false) {
      return undefined
    }

    return response.json()
  }

  /**
   * Build and fire an authenticated request against `/api/v1`, throwing a
   * {@link PingArkApiError} on any non-2xx response.
   *
   * @throws Error when no API key is configured
   * @throws PingArkApiError on a non-2xx response
   */
  private async send(
    method: string,
    path: string,
    options: { query?: Record<string, string | number>; json?: unknown } = {},
  ): Promise<Response> {
    const apiKey = this.config.apiKey
    if (!apiKey) {
      throw new Error(
        'Set an API key (a read-write project key) to use the PingArk management API.',
      )
    }

    const url = new URL(`${this.config.apiBaseUrl}/api/v1${path}`)
    for (const [key, value] of Object.entries(options.query ?? {})) {
      url.searchParams.set(key, String(value))
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      'User-Agent': this.config.userAgent,
      Accept: 'application/json',
    }

    const init: { method: string; headers: Record<string, string>; body?: string } = {
      method,
      headers,
    }
    if (options.json !== undefined) {
      headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(options.json)
    }

    const response = await fetch(url, init)
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new PingArkApiError(
        response.status,
        body,
        `PingArk management API returned ${response.status} for ${method} ${path}`,
      )
    }

    return response
  }
}
