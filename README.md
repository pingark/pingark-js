# PingArk for JavaScript and TypeScript

[![npm version](https://img.shields.io/npm/v/pingark)](https://www.npmjs.com/package/pingark)
[![Tests](https://github.com/pingark/pingark-js/actions/workflows/tests.yml/badge.svg)](https://github.com/pingark/pingark-js/actions/workflows/tests.yml)
[![License](https://img.shields.io/npm/l/pingark)](LICENSE)

Monitor Node.js cron jobs and scheduled tasks: wrap a job in one function and [PingArk](https://pingark.com) knows when it starts, when it finishes, how long it took, and what went wrong if it failed. The official framework-agnostic SDK for JavaScript and TypeScript, published on npm as [`pingark`](https://www.npmjs.com/package/pingark). You never touch a ping URL by hand.

It works in any modern runtime with a global `fetch` (Node 18 and newer, Bun, Deno, and edge functions), so it fits Next.js, Nuxt, Express, Remix, SvelteKit, or plain Node, Bun, and Deno. Thin adapters for Next.js, Express, and Nuxt are included for the common cases. A [free account](https://pingark.com/register) covers 20 checks with no card required.

- [Full guide](https://pingark.com/docs/javascript-sdk)
- [Ping API reference](https://pingark.com/docs/ping-api)
- [Management API reference](https://pingark.com/docs/api)

## Contents

- [Install](#install)
- [Quickstart](#quickstart)
- [Configure](#configure)
- [The one-liner: `monitor`](#the-one-liner-monitor)
- [Sending signals by hand](#sending-signals-by-hand)
- [Framework adapters](#framework-adapters)
  - [Next.js and Vercel Cron](#nextjs-and-vercel-cron)
  - [Express](#express)
  - [Nuxt and Nitro](#nuxt-and-nitro)
- [Capture an exception](#capture-an-exception)
- [Report an exit code](#report-an-exit-code)
- [Log a progress event](#log-a-progress-event)
- [Zero-setup checks](#zero-setup-checks)
- [The management API client](#the-management-api-client)
- [How it stays out of your way](#how-it-stays-out-of-your-way)
- [Config reference](#config-reference)

## Install

```bash
npm install pingark
```

The package ships both ESM and CommonJS builds with TypeScript types, so `import` and `require` both work with no extra setup.

## Quickstart

Set your project ping key (from your PingArk project settings) in the environment:

```bash
PINGARK_PING_KEY=your-project-ping-key
```

Then wrap a job in `monitor`:

```ts
import { monitor } from 'pingark'

await monitor(() => runNightlyJob(), 'nightly-job')
```

That is the whole integration. `monitor` sends a start ping before your function, a success ping after it resolves, and a failure ping (with the error) if it throws. Your function's return value is passed straight through, and any error it throws is re-thrown after the failure ping is sent, so wrapping a job never changes its outcome.

## Configure

The top-level helpers read `PINGARK_*` environment variables automatically. To pass options in code, or to run more than one project from a single process, create a client:

```ts
import { createPingArk } from 'pingark'

const pingark = createPingArk({
  pingKey: 'your-project-ping-key',
})
```

Options always win over the environment. See the [config reference](#config-reference) for the full list. The ping key is a capability secret, so keep it in your environment and out of version control.

## The one-liner: `monitor`

```ts
import { monitor } from 'pingark'

const result = await monitor(() => runNightlyJob(), 'nightly-job')
```

The second argument is the check slug, which must match a check in PingArk. Create it in the dashboard, or let [the first ping create it](#zero-setup-checks).

## Sending signals by hand

When you would rather signal PingArk directly than wrap a whole function, each ping signal has its own helper:

```ts
import { start, success, fail } from 'pingark'

await start('nightly-job') // records a start time so duration can be measured
await success('nightly-job') // job finished, re-arms the check
await fail('nightly-job') // job failed, sends the check down
```

The same methods exist on a client made with `createPingArk`:

```ts
import { createPingArk } from 'pingark'

const pingark = createPingArk()
await pingark.start('nightly-job')
await pingark.success('nightly-job')
```

Set `PINGARK_DEFAULT_CHECK` (or pass `defaultCheck`) to call these with no check argument, which is handy in an app built around a single job.

## Framework adapters

### Next.js and Vercel Cron

Wrap your route handler with `withPingArk` from `pingark/next`:

```ts
// app/api/cron/nightly/route.ts
import { withPingArk } from 'pingark/next'

export const GET = withPingArk(
  async () => {
    await runNightlyJob()
    return Response.json({ ok: true })
  },
  { check: 'nightly-job' },
)
```

Then point a cron at that route in `vercel.json`:

```json
{
  "crons": [{ "path": "/api/cron/nightly", "schedule": "0 2 * * *" }]
}
```

### Express

Add the middleware from `pingark/express` to the route your scheduler hits. It pings start when the request arrives, then success on a normal finish, or failure on a 5xx response:

```ts
import express from 'express'
import { pingarkExpress } from 'pingark/express'

const app = express()

app.get('/cron/nightly', pingarkExpress('nightly-job'), (req, res) => {
  runNightlyJob()
  res.send('ok')
})
```

### Nuxt and Nitro

Wrap a Nitro task's `run` function with `withPingArk` from `pingark/nuxt`. Scheduled-task monitoring is server-side, so this is how the Vue ecosystem uses PingArk:

```ts
// server/tasks/nightly.ts
import { withPingArk } from 'pingark/nuxt'

export default defineTask({
  meta: { name: 'nightly', description: 'Nightly job' },
  run: withPingArk(
    async () => {
      await runNightlyJob()
      return { result: 'ok' }
    },
    { check: 'nightly-job' },
  ),
})
```

## Capture an exception

When you signal a failure by hand, pass the caught error to `fail`. Its name, message, and stack trace are attached to the failure, so you can see what went wrong on the PingArk timeline. (The `monitor` wrapper does this for you already.)

```ts
import { success, fail } from 'pingark'

try {
  await runNightlyJob()
  await success('nightly-job')
} catch (error) {
  await fail('nightly-job', error)
  throw error
}
```

## Report an exit code

Zero counts as success and any non-zero value counts as a failure. The raw code is recorded either way.

```ts
import { exitCode } from 'pingark'

await exitCode('nightly-job', 137) // 137 is an out-of-memory kill
```

## Log a progress event

A log event records a note on the timeline without changing the check's state. It never arms, recovers, or alerts. Use it for progress inside a long job.

```ts
import { log } from 'pingark'

await log('nightly-job', 'processed 5,000 of 20,000 rows')
```

## Zero-setup checks

To skip creating a check first, PingArk can make one on the very first ping. Add `?create=1` to a ping URL for a slug that does not exist yet and the check is created and armed on the spot:

```bash
curl -fsS "https://ping.pingark.com/ping/your-project-ping-key/nightly-job?create=1"
```

Auto-provisioned checks get a generic schedule you can refine later. To set the schedule, timezone, and grace from the start, use the [management API](#the-management-api-client).

## The management API client

For setup scripts and internal tooling, `createPingArk().api()` gives you a client for the management API. It needs a read-write `PINGARK_API_KEY`. Unlike the ping signals, it throws on an error, because a failed setup call is something you want to know about.

```ts
import { createPingArk } from 'pingark'

const pingark = createPingArk() // reads PINGARK_API_KEY from the environment

const check = await pingark.api().createCheck({
  name: 'Nightly job',
  slug: 'nightly-job',
  schedule_type: 'simple',
  period: 86400, // expected every 24 hours
  grace: 3600, // allow an hour late before alerting
  timezone: 'UTC',
})

await pingark.api().pause(check.id)
await pingark.api().resume(check.id)

const pings = await pingark.api().pings(check.id)
const flips = await pingark.api().flips(check.id)
const channels = await pingark.api().channels()
```

The client covers the whole API: create, read, update, and delete checks, pause and resume them, and read back pings, status changes, and the project's channels. See the [Management API reference](https://pingark.com/docs/api) for the full field set.

## How it stays out of your way

Monitoring should never be the reason a job fails. Every ping has a short timeout and swallows its own errors, and it never retries. If PingArk is unreachable, your job runs exactly as it would without the SDK, and the next scheduled run pings again. When the SDK is disabled or the ping key is missing, the signals are a silent no-op.

One courtesy outside that silence: if a ping is skipped because no ping key is configured, the SDK prints a single console notice pointing you at setup, once per process and never when `NODE_ENV` is `production`. Setting `enabled: false` (or `PINGARK_ENABLED=false`) keeps everything fully silent.

The `monitor` wrapper reports a thrown error and then re-throws the original, so your own error handling still runs. The one deliberate exception is the `api()` management client. It is a setup tool, not part of a running job, so it surfaces errors rather than hiding them.

## Config reference

Every option can be passed to `createPingArk`, or set through the matching environment variable. Options always win over the environment.

| Option         | Env                     | Default                    | What it does                                                                      |
| -------------- | ----------------------- | -------------------------- | --------------------------------------------------------------------------------- |
| `enabled`      | `PINGARK_ENABLED`       | `true`                     | Master switch. Set to false to silence every ping.                                |
| `baseUrl`      | `PINGARK_BASE_URL`      | `https://ping.pingark.com` | The ingestion base URL your pings are sent to.                                    |
| `apiBaseUrl`   | `PINGARK_API_BASE_URL`  | `https://api.pingark.com`  | The management API base URL, used by the `api()` client.                          |
| `pingKey`      | `PINGARK_PING_KEY`      | `undefined`                | The project ping key your task pings hit.                                         |
| `apiKey`       | `PINGARK_API_KEY`       | `undefined`                | A read-write key, used only by the management API client.                         |
| `timeoutMs`    | `PINGARK_TIMEOUT`       | `5000`                     | Outbound ping timeout in milliseconds. The env var is read in whole seconds.      |
| `userAgent`    | `PINGARK_USER_AGENT`    | `PingArk-JS`               | The user agent sent with every ping, so you can spot the SDK in ping history.     |
| `defaultCheck` | `PINGARK_DEFAULT_CHECK` | `undefined`                | An optional fallback check, so the signal helpers can be called with no argument. |

## License

MIT. Copyright (c) 2026 Virtueplanet Services LLP.
