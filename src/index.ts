/**
 * PingArk SDK for JavaScript and TypeScript, framework-agnostic core.
 *
 * Create a client with {@link createPingArk} for full control, or use the
 * top-level {@link monitor} and signal helpers for a zero-config setup driven by
 * `PINGARK_*` environment variables. Framework adapters live in the subpath
 * entries `pingark/next`, `pingark/express`, and `pingark/nuxt`.
 */

import { PingArkClient } from './client'
import type { PingArkConfig } from './types'

export { PingArkClient } from './client'
export { PingArkApi, PingArkApiError } from './api'
export type {
  PingArkConfig,
  ResolvedConfig,
  ScheduleType,
  Check,
  CheckAttributes,
  Ping,
  Flip,
  Channel,
} from './types'

/**
 * Create a PingArk client. Options are merged over `PINGARK_*` environment
 * variables and defaults, so `createPingArk()` with no arguments is fully
 * configured from the environment.
 *
 * @param config optional overrides
 */
export function createPingArk(config?: PingArkConfig): PingArkClient {
  return new PingArkClient(config)
}

/**
 * A lazily created client backed entirely by the environment, shared by the
 * top-level helpers below. Created on first use so importing the package has no
 * side effects.
 */
let defaultClient: PingArkClient | undefined

/** The shared environment-configured client behind the top-level helpers. */
function client(): PingArkClient {
  return (defaultClient ??= new PingArkClient())
}

/**
 * Run a function as a monitored job using the environment-configured client:
 * ping start, then success on resolve or fail on throw, rethrowing the error.
 * See {@link PingArkClient.monitor}.
 */
export function monitor<T>(fn: () => T | Promise<T>, check?: string): Promise<T> {
  return client().monitor(fn, check)
}

/** Ping start on the environment-configured client. */
export function start(check?: string): Promise<void> {
  return client().start(check)
}

/** Ping success on the environment-configured client. */
export function success(check?: string, body?: string): Promise<void> {
  return client().success(check, body)
}

/** Ping fail on the environment-configured client. */
export function fail(check?: string, context?: unknown): Promise<void> {
  return client().fail(check, context)
}

/** Report an exit code on the environment-configured client. */
export function exitCode(
  check: string | undefined,
  code: number,
  context?: unknown,
): Promise<void> {
  return client().exitCode(check, code, context)
}

/** Record a log event on the environment-configured client. */
export function log(check?: string, body?: string): Promise<void> {
  return client().log(check, body)
}
