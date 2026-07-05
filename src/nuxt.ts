/**
 * Nuxt / Nitro adapter. Wrap a Nitro event handler or scheduled-task `run`
 * function so PingArk is pinged around every invocation. This covers the Vue
 * ecosystem's server side (cron/scheduled work is always server-side, so there
 * is no browser-Vue adapter).
 */

import { PingArkClient } from './client'
import type { AdapterOptions } from './next'

export type { AdapterOptions } from './next'

/**
 * Wrap a Nitro event handler or task `run` so it pings `start` before it runs,
 * `success` after it resolves, and `fail` (with the thrown error) if it throws.
 * The original result is returned and the original error is rethrown.
 *
 * @example
 * ```ts
 * // server/tasks/nightly.ts
 * import { withPingArk } from 'pingark/nuxt'
 *
 * export default defineTask({
 *   meta: { name: 'nightly' },
 *   run: withPingArk(async () => {
 *     await runNightlyJob()
 *     return { result: 'ok' }
 *   }, { check: 'nightly-job' }),
 * })
 * ```
 *
 * @param handler the event handler or task run function to monitor
 * @param options the check to report to and how to build the client
 */
export function withPingArk<A extends unknown[], R>(
  handler: (...args: A) => R | Promise<R>,
  options: AdapterOptions = {},
): (...args: A) => Promise<R> {
  const client = options.client ?? new PingArkClient(options.config)

  return (...args: A) => client.monitor(() => handler(...args), options.check)
}
