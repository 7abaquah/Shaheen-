import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const at = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// FROZEN: owned by the lead (graph.md → N1).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@kernel$/, replacement: at('./kernel/src/index.ts') },
      { find: /^@shared\//, replacement: at('./shared/') },
      { find: /^@\//, replacement: at('./src/') },
    ],
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: false,
    // No data: URIs — the Content-Security-Policy only allows same-origin assets.
    assetsInlineLimit: 0,
  },
  server: {
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
  test: {
    testTimeout: 60_000,
    hookTimeout: 60_000,
    projects: [
      {
        extends: true,
        test: {
          name: 'core',
          environment: 'node',
          include: ['kernel/tests/**/*.test.ts', 'server/tests/**/*.test.ts', 'shared/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'app',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
          setupFiles: ['src/tests/setup.ts'],
        },
      },
    ],
  },
});
