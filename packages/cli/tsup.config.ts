import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'bin/envmanager': 'src/bin/envmanager.ts'
  },
  format: ['esm'],
  target: 'node18',
  clean: true,
  dts: true,
  splitting: false,
  sourcemap: true,
  shims: true,
  banner: {
    js: '#!/usr/bin/env node'
  }
})
