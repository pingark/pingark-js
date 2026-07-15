# Changelog

All notable changes to `pingark` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- A one-time console notice when a ping is skipped because no ping key is
  configured, pointing at setup. It prints at most once per process, never
  when `NODE_ENV` is `production`, and never when the SDK is explicitly
  disabled. The fail-open contract is unchanged.

## [1.0.0] - 2026-07-15

Initial public release.

### Added

- `createPingArk(config)`, a framework-agnostic client that reads `PINGARK_*`
  environment variables and works in any runtime with a global `fetch`.
- `monitor(fn, check)`, which pings start before a job, success after it
  resolves, and a failure ping (with the thrown error) when it throws, then
  returns the result or re-throws the original error.
- Signal helpers `start`, `success`, `fail` (accepts an Error for context),
  `exitCode`, and `log`, available as top-level functions and on a client.
- A `defaultCheck` option, so the signal helpers can be called with no check
  argument in a single-job application.
- Framework adapters: `pingark/next` (`withPingArk` for Next.js and Vercel
  Cron), `pingark/express` (`pingarkExpress` middleware), and `pingark/nuxt`
  (`withPingArk` for Nitro tasks and event handlers).
- A management API client via `createPingArk().api()` for creating, reading,
  updating, pausing, resuming, and deleting checks, and for listing pings,
  flips, and channels.
- Dual ESM and CommonJS builds with TypeScript types.
- The fail-open contract: a short timeout, swallowed errors, and no retries, so
  monitoring can never break or slow the job being monitored.
