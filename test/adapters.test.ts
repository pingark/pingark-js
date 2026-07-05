import { describe, expect, it } from 'vitest'
import { createPingArk } from '../src/index'
import { withPingArk as withNext } from '../src/next'
import { withPingArk as withNuxt } from '../src/nuxt'
import { pingarkExpress } from '../src/express'
import { mockFetch, tick } from './helpers'

const base = { baseUrl: 'https://ping.test', pingKey: 'k' }

describe('next adapter', () => {
  it('pings start + success around the handler and returns its result', async () => {
    const { calls } = mockFetch()
    const handler = withNext(async (n: number) => n * 2, {
      check: 'cron',
      client: createPingArk(base),
    })

    const out = await handler(21)

    expect(out).toBe(42)
    expect(calls.map((c) => c.url)).toEqual([
      'https://ping.test/ping/k/cron/start',
      'https://ping.test/ping/k/cron',
    ])
  })

  it('pings fail and rethrows when the handler throws', async () => {
    const { calls } = mockFetch()
    const err = new Error('handler broke')
    const handler = withNext(
      () => {
        throw err
      },
      { check: 'cron', client: createPingArk(base) },
    )

    await expect(handler()).rejects.toBe(err)
    expect(calls[1].url).toBe('https://ping.test/ping/k/cron/fail')
  })
})

describe('nuxt adapter', () => {
  it('wraps an event handler with monitoring', async () => {
    const { calls } = mockFetch()
    const handler = withNuxt(async (_event: unknown) => 'ok', {
      check: 'nitro',
      client: createPingArk(base),
    })

    expect(await handler({})).toBe('ok')
    expect(calls).toHaveLength(2)
  })
})

describe('express adapter', () => {
  it('pings start on request and success on a 2xx finish', async () => {
    const { calls } = mockFetch()
    const mw = pingarkExpress('cron', { client: createPingArk(base) })

    const listeners: Record<string, () => void> = {}
    const res = { statusCode: 200, on: (e: string, cb: () => void) => (listeners[e] = cb) }
    let nextCalled = false
    mw({}, res, () => (nextCalled = true))

    expect(nextCalled).toBe(true)
    await tick()
    listeners['finish']?.()
    await tick()

    expect(calls.map((c) => c.url)).toEqual([
      'https://ping.test/ping/k/cron/start',
      'https://ping.test/ping/k/cron',
    ])
  })

  it('pings fail on a 5xx finish', async () => {
    const { calls } = mockFetch()
    const mw = pingarkExpress('cron', { client: createPingArk(base) })

    const listeners: Record<string, () => void> = {}
    const res = { statusCode: 500, on: (e: string, cb: () => void) => (listeners[e] = cb) }
    mw({}, res, () => {})

    await tick()
    listeners['finish']?.()
    await tick()

    expect(calls.some((c) => c.url.endsWith('/cron/fail'))).toBe(true)
  })
})
