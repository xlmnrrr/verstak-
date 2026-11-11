import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base './' — чтобы собранное приложение открывалось из Electron по file://
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    host: '127.0.0.1',
    port: 5273,
    strictPort: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    reporters: ['default'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
  },
});
