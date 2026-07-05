import { defineConfig } from 'vitest/config'

/**
 * The test suite runs in Node (the SDK's real target) with global `fetch`
 * mocked per test, so no PingArk server is needed. Each file is isolated, so a
 * module-level default client never leaks state between files.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
  },
})
