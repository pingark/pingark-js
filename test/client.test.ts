import { describe, expect, it } from 'vitest'
import { createPingArk } from '../src/index'
import { mockFetch } from './helpers'

const base = { baseUrl: 'https://ping.test', pingKey: 'projkey123' }

describe('PingArkClient signals', () => {
  it('sends a success ping to the bare slug URL as GET', async () => {
    const { calls } = mockFetch()
    await createPingArk(base).success('backup')

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://ping.test/ping/projkey123/backup')
    expect(calls[0].method).toBe('GET')
  })

  it('sends start / fail / log with the right suffix', async () => {
    const { calls } = mockFetch()
    const pa = createPingArk(base)

    await pa.start('job')
    await pa.fail('job')
    await pa.log('job')

    expect(calls.map((c) => c.url)).toEqual([
      'https://ping.test/ping/projkey123/job/start',
      'https://ping.test/ping/projkey123/job/fail',
      'https://ping.test/ping/projkey123/job/log',
    ])
  })

  it('maps exitCode to the numeric suffix', async () => {
    const { calls } = mockFetch()
    await createPingArk(base).exitCode('job', 137)

    expect(calls[0].url).toBe('https://ping.test/ping/projkey123/job/137')
  })

  it('POSTs a body as text/plain and truncates it to 100 KiB', async () => {
    const { calls } = mockFetch()
    const big = 'x'.repeat(200 * 1024)
    await createPingArk(base).success('job', big)

    expect(calls[0].method).toBe('POST')
    expect(calls[0].headers['Content-Type']).toBe('text/plain')
    expect(calls[0].body).toHaveLength(100 * 1024)
  })

  it('renders an Error passed to fail() into the body', async () => {
    const { calls } = mockFetch()
    await createPingArk(base).fail('job', new Error('boom'))

    expect(calls[0].method).toBe('POST')
    expect(calls[0].body).toContain('boom')
    expect(calls[0].body).toContain('Error')
  })

  it('sends a plain fail (no body) as GET', async () => {
    const { calls } = mockFetch()
    await createPingArk(base).fail('job')

    expect(calls[0].url).toBe('https://ping.test/ping/projkey123/job/fail')
    expect(calls[0].method).toBe('GET')
  })

  it('sends the configured user agent on every ping', async () => {
    const { calls } = mockFetch()
    await createPingArk({ ...base, userAgent: 'PingArk-JS' }).start('job')

    expect(calls[0].headers['User-Agent']).toBe('PingArk-JS')
  })

  it('accepts a full ping URL with no ping key (the UUID scheme)', async () => {
    const { calls } = mockFetch()
    await createPingArk({ baseUrl: 'https://ping.test' }).start(
      'https://ping.test/ping/1111-2222-3333',
    )

    expect(calls[0].url).toBe('https://ping.test/ping/1111-2222-3333/start')
  })
})

describe('PingArkClient fail-open guard', () => {
  it('is a silent no-op when disabled', async () => {
    const { calls } = mockFetch()
    await createPingArk({ ...base, enabled: false }).success('job')

    expect(calls).toHaveLength(0)
  })

  it('is a silent no-op when no ping key is set (slug scheme)', async () => {
    const { calls } = mockFetch()
    await createPingArk({ baseUrl: 'https://ping.test' }).success('job')

    expect(calls).toHaveLength(0)
  })

  it('is a no-op when no check resolves', async () => {
    const { calls } = mockFetch()
    await createPingArk(base).success()

    expect(calls).toHaveLength(0)
  })

  it('falls back to the default check', async () => {
    const { calls } = mockFetch()
    await createPingArk({ ...base, defaultCheck: 'only-job' }).success()

    expect(calls[0].url).toBe('https://ping.test/ping/projkey123/only-job')
  })

  it('SENTINEL: swallows a transport error so monitoring never breaks the job', async () => {
    mockFetch(() => {
      throw new Error('network down')
    })

    // Reaching the end of this test without an unhandled throw IS the assertion.
    await createPingArk(base).success('job')
    expect(true).toBe(true)
  })

  it('passes an abort signal so a slow network cannot hang a job', async () => {
    const { calls } = mockFetch()
    await createPingArk(base).start('job')

    expect(calls[0].signal).toBeInstanceOf(AbortSignal)
  })
})
