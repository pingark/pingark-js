/**
 * Next.js / Vercel Cron adapter. Wrap a route handler (App Router, Pages API,
 * or a Vercel Cron function) so PingArk is pinged around every invocation, with
 * no change to the handler's own behaviour.
 */

import { PingArkClient } from './client'
import type { PingArkConfig } from './types'

/** Options shared by the framework adapters. */
export interface AdapterOptions {
  /** The check to report to. Falls back to the client's default check. */
  check?: string

  /** A pre-built client to reuse. Defaults to a new environment-configured one. */
  client?: PingArkClient

  /** Config for the client, when one is not supplied via `client`. */
  config?: PingArkConfig
}

/**
 * Wrap a handler so it pings `start` before it runs, `success` after it
 * resolves, and `fail` (with the thrown error) if it throws. The original
 * result is returned and the original error is rethrown, so the route behaves
 * exactly as before, just monitored.
 *
 * @example
 * ```ts
 * // app/api/cron/route.ts
 * import { withPingArk } from 'pingark/next'
 *
 * export const GET = withPingArk(async () => {
 *   await runNightlyJob()
 *   return Response.json({ ok: true })
 * }, { check: 'nightly-job' })
 * ```
 *
 * @param handler the route/cron handler to monitor
 * @param options the check to report to and how to build the client
 */
export function withPingArk<A extends unknown[], R>(
  handler: (...args: A) => R | Promise<R>,
  options: AdapterOptions = {},
): (...args: A) => Promise<R> {
  const client = options.client ?? new PingArkClient(options.config)

  return (...args: A) => client.monitor(() => handler(...args), options.check)
}
