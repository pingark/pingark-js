import { vi } from 'vitest'

/**
 * A single recorded outbound request, captured so a test can assert the exact
 * URL, method, headers, body, and abort signal the SDK produced.
 */
export interface RecordedCall {
  url: string
  method: string
  headers: Record<string, string>
  body?: string
  signal?: AbortSignal | null
}

/**
 * Replace global `fetch` with a recording mock. The optional handler decides
 * the response per call (defaults to a 200 "OK"); the returned `calls` array
 * accumulates every request the SDK made, in order.
 */
export function mockFetch(handler?: (call: RecordedCall) => Response | Promise<Response>): {
  fn: ReturnType<typeof vi.fn>
  calls: RecordedCall[]
} {
  const calls: RecordedCall[] = []

  const fn = vi.fn(async (input: unknown, init: Record<string, unknown> = {}) => {
    const headers: Record<string, string> = {}
    for (const [key, value] of Object.entries((init.headers as object) ?? {})) {
      headers[key] = String(value)
    }

    const call: RecordedCall = {
      url: String(input),
      method: (init.method as string) ?? 'GET',
      headers,
      body: init.body as string | undefined,
      signal: (init.signal as AbortSignal | undefined) ?? null,
    }
    calls.push(call)

    return handler ? handler(call) : new Response('OK', { status: 200 })
  })

  vi.stubGlobal('fetch', fn)

  return { fn, calls }
}

/** Build a JSON `Response`, the shape the management API always returns. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Yield to the microtask/macrotask queue so fire-and-forget pings can run. */
export function tick(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}
