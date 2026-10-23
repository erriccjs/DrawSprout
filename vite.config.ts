import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { drawsproutOffline } from './src/offline/vite-plugin';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), drawsproutOffline()],
  // The pilot devices are tablets on the local network, so the dev server has to
  // be reachable from outside localhost for any hands-on iPad/Android check.
  server: { host: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    alias: {
      'cloudflare:workers': path.join(root, 'src/worker/durable-object-shim.ts'),
    },
  },
});
