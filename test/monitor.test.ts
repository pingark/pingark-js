import { beforeAll, describe, expect, it } from 'vitest'
import { createPingArk } from '../src/index'
import { mockFetch } from './helpers'

const base = { baseUrl: 'https://ping.test', pingKey: 'k' }

describe('monitor()', () => {
  it('pings start then success and returns the result on resolve', async () => {
    const { calls } = mockFetch()
    const result = await createPingArk(base).monitor(async () => 42, 'job')

    expect(result).toBe(42)
    expect(calls.map((c) => c.url)).toEqual([
      'https://ping.test/ping/k/job/start',
      'https://ping.test/ping/k/job',
    ])
  })

  it('pings start then fail(error) and rethrows on throw', async () => {
    const { calls } = mockFetch()
    const err = new Error('kaboom')

    await expect(
      createPingArk(base).monitor(() => {
        throw err
      }, 'job'),
    ).rejects.toBe(err)

    expect(calls[0].url).toBe('https://ping.test/ping/k/job/start')
    expect(calls[1].url).toBe('https://ping.test/ping/k/job/fail')
    expect(calls[1].body).toContain('kaboom')
  })

  it('works with a synchronous function', async () => {
    const { calls } = mockFetch()
    const out = await createPingArk(base).monitor(() => 'done', 'job')

    expect(out).toBe('done')
    expect(calls).toHaveLength(2)
  })
})

describe('top-level monitor export (env-configured default client)', () => {
  beforeAll(() => {
    process.env.PINGARK_BASE_URL = 'https://env.test'
    process.env.PINGARK_PING_KEY = 'envkey'
  })

  it('uses the environment-configured default client', async () => {
    const { calls } = mockFetch()
    const { monitor } = await import('../src/index')

    const r = await monitor(async () => 'ok', 'job')

    expect(r).toBe('ok')
    expect(calls[0].url).toBe('https://env.test/ping/envkey/job/start')
  })
})
