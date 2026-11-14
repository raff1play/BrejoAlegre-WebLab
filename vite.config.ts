import { defineConfig } from 'vite';
import packageJson from './package.json';

// Relative paths work at / and at /BrejoAlegre-WebLab/ (GitHub Pages).
export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(packageJson.version) },
  server: { host: '0.0.0.0', port: 5173 },
  preview: { host: '0.0.0.0', port: 4173 },
  build: { target: 'es2022', outDir: 'dist', chunkSizeWarningLimit: 1500 },
});
