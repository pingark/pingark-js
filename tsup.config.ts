import { defineConfig } from 'tsup'

/**
 * Build the framework-agnostic core plus each thin adapter as its own entry,
 * emitting dual ESM (.mjs) + CommonJS (.cjs) bundles and TypeScript
 * declarations. The subpath adapters (pingark/next, pingark/express,
 * pingark/nuxt) map to the next/express/nuxt entries via the package exports.
 */
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    next: 'src/next.ts',
    express: 'src/express.ts',
    nuxt: 'src/nuxt.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  target: 'node18',
  outExtension({ format }) {
    return { js: format === 'esm' ? '.mjs' : '.cjs' }
  },
})
