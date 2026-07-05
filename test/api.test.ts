import { describe, expect, it } from 'vitest'
import { createPingArk, PingArkApiError } from '../src/index'
import { jsonResponse, mockFetch } from './helpers'

const cfg = { baseUrl: 'https://api.test', apiKey: 'pa_secret' }

describe('PingArkApi', () => {
  it('throws when no API key is configured', async () => {
    const api = createPingArk({ baseUrl: 'https://api.test' }).api()

    await expect(api.checks()).rejects.toThrow(/API key/i)
  })

  it('lists checks with bearer auth and the JSON accept header', async () => {
    const { calls } = mockFetch(() => jsonResponse({ checks: [{ id: 'a', name: 'A' }] }))
    const checks = await createPingArk(cfg).api().checks()

    expect(checks).toEqual([{ id: 'a', name: 'A' }])
    expect(calls[0].url).toBe('https://api.test/api/v1/checks')
    expect(calls[0].headers['Authorization']).toBe('Bearer pa_secret')
    expect(calls[0].headers['Accept']).toBe('application/json')
  })

  it('fetches a single check', async () => {
    const { calls } = mockFetch(() => jsonResponse({ check: { id: 'x' } }))
    const check = await createPingArk(cfg).api().check('x')

    expect(check).toEqual({ id: 'x' })
    expect(calls[0].url).toBe('https://api.test/api/v1/checks/x')
  })

  it('creates a check with a JSON body', async () => {
    const { calls } = mockFetch(() => jsonResponse({ check: { id: 'new' } }))
    const check = await createPingArk(cfg).api().createCheck({
      name: 'X',
      slug: 'x',
      schedule_type: 'simple',
      period: 60,
      grace: 60,
      timezone: 'UTC',
    })

    expect(check).toEqual({ id: 'new' })
    expect(calls[0].method).toBe('POST')
    expect(calls[0].headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(calls[0].body ?? '{}')).toMatchObject({ slug: 'x', period: 60 })
  })

  it('updates, pauses, resumes and deletes a check', async () => {
    const { calls } = mockFetch(() => jsonResponse({ check: {} }))
    const api = createPingArk(cfg).api()

    await api.updateCheck('id1', { grace: 120 })
    await api.pause('id1')
    await api.resume('id1')
    await api.deleteCheck('id1')

    expect(calls[0].method).toBe('PUT')
    expect(calls[0].url).toBe('https://api.test/api/v1/checks/id1')
    expect(calls[1].url).toBe('https://api.test/api/v1/checks/id1/pause')
    expect(calls[2].url).toBe('https://api.test/api/v1/checks/id1/resume')
    expect(calls[3].method).toBe('DELETE')
  })

  it('lists pings with a limit and fetches a ping body as text', async () => {
    const { calls } = mockFetch((c) =>
      c.url.includes('/body') ? new Response('the body') : jsonResponse({ pings: [{ id: 1 }] }),
    )
    const api = createPingArk(cfg).api()

    const pings = await api.pings('id1', 5)
    const body = await api.pingBody('id1', 1)

    expect(pings).toEqual([{ id: 1 }])
    expect(calls[0].url).toBe('https://api.test/api/v1/checks/id1/pings?limit=5')
    expect(body).toBe('the body')
  })

  it('lists flips and channels', async () => {
    const { calls } = mockFetch((c) =>
      c.url.includes('flips')
        ? jsonResponse({ flips: [] })
        : jsonResponse({ channels: [{ id: 2 }] }),
    )
    const api = createPingArk(cfg).api()

    await api.flips('id1')
    const channels = await api.channels()

    expect(channels).toEqual([{ id: 2 }])
    expect(calls[0].url).toBe('https://api.test/api/v1/checks/id1/flips?limit=100')
    expect(calls[1].url).toBe('https://api.test/api/v1/channels')
  })

  it('throws a PingArkApiError carrying the status on a non-2xx response', async () => {
    mockFetch(() => jsonResponse({ error: 'Invalid API key.' }, 401))
    const api = createPingArk(cfg).api()

    await expect(api.checks()).rejects.toBeInstanceOf(PingArkApiError)
    await expect(api.checks()).rejects.toMatchObject({ status: 401 })
  })
})
