import type { PingArkConfig, ResolvedConfig } from './types'

const DEFAULT_BASE_URL = 'https://ping.pingark.com'
const DEFAULT_API_BASE_URL = 'https://api.pingark.com'
const DEFAULT_TIMEOUT_MS = 5000
const DEFAULT_USER_AGENT = 'PingArk-JS'

/**
 * Read an environment variable, treating an empty string as unset. Guarded so
 * the SDK works in runtimes without `process` (some edge and browser targets).
 */
function env(key: string): string | undefined {
  if (typeof process === 'undefined' || !process.env) {
    return undefined
  }
  const value = process.env[key]

  return value === undefined || value === '' ? undefined : value
}

/**
 * Parse an env flag. Anything but the common falsy words counts as `true`, so
 * `PINGARK_ENABLED=0|false|no|off` disables and everything else enables.
 */
function envBool(key: string): boolean | undefined {
  const value = env(key)
  if (value === undefined) {
    return undefined
  }

  return !['0', 'false', 'no', 'off'].includes(value.toLowerCase())
}

/**
 * Merge caller options over `PINGARK_*` environment variables and defaults into
 * a fully resolved config. Options always win; the environment is the fallback.
 * `PINGARK_TIMEOUT` is read in whole seconds (cross-SDK parity) and converted to
 * the millisecond `timeoutMs` the client uses.
 */
export function resolveConfig(config: PingArkConfig = {}): ResolvedConfig {
  const envTimeoutSeconds = env('PINGARK_TIMEOUT')
  const envTimeoutMs =
    envTimeoutSeconds !== undefined && Number.isFinite(Number(envTimeoutSeconds))
      ? Number(envTimeoutSeconds) * 1000
      : undefined

  const baseUrl = (config.baseUrl ?? env('PINGARK_BASE_URL') ?? DEFAULT_BASE_URL).replace(
    /\/+$/,
    '',
  )

  const apiBaseUrl = (
    config.apiBaseUrl ??
    env('PINGARK_API_BASE_URL') ??
    DEFAULT_API_BASE_URL
  ).replace(/\/+$/, '')

  return {
    enabled: config.enabled ?? envBool('PINGARK_ENABLED') ?? true,
    baseUrl,
    apiBaseUrl,
    pingKey: config.pingKey ?? env('PINGARK_PING_KEY'),
    apiKey: config.apiKey ?? env('PINGARK_API_KEY'),
    timeoutMs: config.timeoutMs ?? envTimeoutMs ?? DEFAULT_TIMEOUT_MS,
    userAgent: config.userAgent ?? env('PINGARK_USER_AGENT') ?? DEFAULT_USER_AGENT,
    defaultCheck: config.defaultCheck ?? env('PINGARK_DEFAULT_CHECK'),
  }
}
