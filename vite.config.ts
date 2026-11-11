import { defineConfig } from 'vite';

// Relative paths work at / and at /BrejoAlegre-WebLab/ (GitHub Pages).
export default defineConfig({
  base: './',
  server: { host: '0.0.0.0', port: 5173 },
  preview: { host: '0.0.0.0', port: 4173 },
  build: { target: 'es2022', outDir: 'dist' },
});
