import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { ENGINE_PACKAGE, engineEntry, engineVersion } from './scripts/engine';

// Served from the org Pages root (https://jsonassert.github.io/). PAGES_BASE
// overrides it, e.g. PAGES_BASE=/some-project/ for a project Pages path.
const base = process.env.PAGES_BASE || '/';

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: [{ find: new RegExp(`^${ENGINE_PACKAGE.replace('/', '\\/')}$`), replacement: engineEntry() }]
  },
  define: {
    __ENGINE_VERSION__: JSON.stringify(engineVersion())
  },
  server: { fs: { allow: ['..', '../..'] } },
  build: { outDir: 'dist', sourcemap: true, chunkSizeWarningLimit: 800 }
});
