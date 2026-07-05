/**
 * Public option and data types for the PingArk SDK. The wire protocol and
 * field names mirror the PingArk product exactly (Architecture.md §5, §10), so
 * this SDK stays in lock-step with the Laravel plugin and the dashboard.
 */

/**
 * Options for {@link createPingArk}. Every field is optional; anything omitted
 * falls back to the matching `PINGARK_*` environment variable, then to a sane
 * default. Passing an option always wins over the environment.
 */
export interface PingArkConfig {
  /**
   * Master switch. When `false`, every ping is a silent no-op (handy on a
   * laptop or a staging box). Env: `PINGARK_ENABLED`. Default: `true`.
   */
  enabled?: boolean

  /**
   * The PingArk instance base URL, with no trailing slash needed. Env:
   * `PINGARK_BASE_URL`. Default: `https://pingark.com`.
   */
  baseUrl?: string

  /**
   * The project ping key (Project settings, Ping key). It drives slug-scheme
   * ping URLs. Not needed when you ping a full check URL directly. Env:
   * `PINGARK_PING_KEY`.
   */
  pingKey?: string

  /**
   * A read-write project API key (`pa_...`), used only by the management API
   * client from {@link PingArkClient.api}. Never sent on a ping. Env:
   * `PINGARK_API_KEY`.
   */
  apiKey?: string

  /**
   * Outbound ping timeout in milliseconds. Kept short so a slow network never
   * hangs the job being monitored. The `PINGARK_TIMEOUT` env var is read in
   * whole seconds for parity with the other SDKs. Default: `5000` (5 seconds).
   */
  timeoutMs?: number

  /**
   * The User-Agent sent with every request, so plugin traffic is easy to spot
   * in ping history. Env: `PINGARK_USER_AGENT`. Default: `PingArk-JS`.
   */
  userAgent?: string

  /**
   * An optional fallback check, so the signal helpers may be called with no
   * argument in a single-job application. Env: `PINGARK_DEFAULT_CHECK`.
   */
  defaultCheck?: string
}

/**
 * A fully resolved configuration: the caller's options merged over the
 * environment and defaults. This is what the client and API client hold.
 */
export interface ResolvedConfig {
  enabled: boolean
  baseUrl: string
  pingKey?: string
  apiKey?: string
  timeoutMs: number
  userAgent: string
  defaultCheck?: string
}

/** A check's scheduling model (Architecture.md §5.1). */
export type ScheduleType = 'simple' | 'cron' | 'oncalendar'

/**
 * A check as returned by the management API serializer (§10). Unknown or newer
 * fields are still accessible via the index signature, so the SDK never drops
 * data the server adds.
 */
export interface Check {
  id: string
  name: string
  description?: string | null
  slug: string
  tags?: string[]
  channels?: number[]
  schedule_type?: ScheduleType
  period?: number | null
  schedule_expr?: string | null
  timezone?: string
  grace?: number
  status?: string
  last_ping_at?: string | null
  last_duration?: number | null
  next_expected_at?: string | null
  n_pings?: number
  ping_url?: string
  slug_url?: string
  badge_url?: string
  badge_json_url?: string
  created_at?: string
  updated_at?: string
  [key: string]: unknown
}

/**
 * The attributes accepted when creating or updating a check. Mirrors the
 * server's `CheckRequest` validation; only the keys you pass are changed on an
 * update (omitting `channels` or `tags` leaves those attachments untouched).
 */
export interface CheckAttributes {
  name?: string
  description?: string | null
  slug?: string
  tags?: string[]
  schedule_type?: ScheduleType
  period?: number | null
  schedule_expr?: string | null
  timezone?: string
  grace?: number
  channels?: number[]
  filter_methods?: 'any' | 'post'
  filter_body?: boolean
  start_kw?: string | null
  success_kw?: string | null
  fail_kw?: string | null
  filter_unmatched?: 'ignore' | 'fail'
  paused_ping?: 'resume' | 'ignore'
  [key: string]: unknown
}

/** One ping in a check's history (§10). */
export interface Ping {
  id: number
  kind: string
  exit_status?: number | null
  duration?: number | null
  source_ip?: string | null
  has_body: boolean
  at: string
  [key: string]: unknown
}

/** One status change (flip) in a check's history (§10). */
export interface Flip {
  from: string
  to: string
  reason?: string | null
  at: string
  [key: string]: unknown
}

/** A project notification channel, for discovering ids to attach to a check. */
export interface Channel {
  id: number
  kind: string
  label?: string | null
  enabled: boolean
  verified: boolean
  [key: string]: unknown
}
