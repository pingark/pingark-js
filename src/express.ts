/**
 * Express / Node middleware adapter. Attach it to the route your external
 * scheduler hits (for example a cron endpoint) so PingArk is pinged around the
 * request: `start` when it arrives, `success` when it finishes 2xx-4xx, and
 * `fail` when it finishes 5xx.
 */

import { PingArkClient } from './client'
import type { PingArkConfig } from './types'

/** The minimal Express request shape the adapter needs (kept dependency-free). */
export interface ExpressRequestLike {
  [key: string]: unknown
}

/** The minimal Express response shape the adapter needs (kept dependency-free). */
export interface ExpressResponseLike {
  statusCode: number
  on(event: string, listener: () => void): unknown
}

/** The Express `next` callback shape. */
export type ExpressNextLike = (error?: unknown) => void

/** Options for {@link pingarkExpress}. */
export interface ExpressAdapterOptions {
  /** A pre-built client to reuse. Defaults to a new environment-configured one. */
  client?: PingArkClient

  /** Config for the client, when one is not supplied via `client`. */
  config?: PingArkConfig
}

/**
 * Build an Express middleware that monitors the request lifecycle for a check.
 * It pings `start` as the request arrives and, when the response finishes,
 * pings `fail` on a 5xx status or `success` otherwise. The pings are
 * fire-and-forget, so the middleware never delays the response.
 *
 * @example
 * ```ts
 * import express from 'express'
 * import { pingarkExpress } from 'pingark/express'
 *
 * const app = express()
 * app.get('/cron/nightly', pingarkExpress('nightly-job'), (req, res) => {
 *   runNightlyJob()
 *   res.send('ok')
 * })
 * ```
 *
 * @param check the check to report to (falls back to the client's default)
 * @param options how to build or supply the client
 */
export function pingarkExpress(
  check?: string,
  options: ExpressAdapterOptions = {},
): (req: ExpressRequestLike, res: ExpressResponseLike, next: ExpressNextLike) => void {
  const client = options.client ?? new PingArkClient(options.config)

  return (_req, res, next) => {
    void client.start(check)

    let reported = false
    const report = (): void => {
      if (reported) {
        return
      }
      reported = true

      if (res.statusCode >= 500) {
        void client.fail(check, `HTTP ${res.statusCode}`)
      } else {
        void client.success(check)
      }
    }

    res.on('finish', report)
    res.on('close', report)

    next()
  }
}
