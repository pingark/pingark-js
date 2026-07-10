import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch } from './helpers'

/**
 * The one-time onboarding notice: when a ping is skipped because no ping key
 * is configured, the SDK warns once (and never in production) with a pointer
 * to free registration. It must stay clear of the fail-open hot path: one
 * console.warn per process at most, zero network calls, and total silence
 * when the SDK is explicitly disabled or properly configured.
 *
 * Each test re-imports a fresh module registry so the module-level
 * warned-once flag resets between cases.
 */

/** Import a fresh copy of the SDK entry point (fresh warned-once flag). */
async function freshSdk() {
  vi.resetModules()

  return import('../src/index')
}

describe('unconfigured onboarding notice', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('warns once, with the registration link, when pings are skipped for a missing key', async () => {
    const { calls } = mockFetch()
    const { createPingArk } = await freshSdk()
    const pa = createPingArk({ baseUrl: 'https://ping.test' })

    await pa.success('job')
    await pa.success('job')

    expect(calls).toHaveLength(0)
    expect(console.warn).toHaveBeenCalledTimes(1)
    expect(vi.mocked(console.warn).mock.calls[0][0]).toContain('https://pingark.com/register')
  })

  it('stays silent when the SDK is explicitly disabled', async () => {
    mockFetch()
    const { createPingArk } = await freshSdk()
    const pa = createPingArk({ baseUrl: 'https://ping.test', pingKey: 'k', enabled: false })

    await pa.success('job')

    expect(console.warn).not.toHaveBeenCalled()
  })

  it('stays silent in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    mockFetch()
    const { createPingArk } = await freshSdk()
    const pa = createPingArk({ baseUrl: 'https://ping.test' })

    await pa.success('job')

    expect(console.warn).not.toHaveBeenCalled()
  })

  it('never warns when a ping key is configured', async () => {
    mockFetch()
    const { createPingArk } = await freshSdk()
    const pa = createPingArk({ baseUrl: 'https://ping.test', pingKey: 'projkey123' })

    await pa.success('job')

    expect(console.warn).not.toHaveBeenCalled()
  })
})
