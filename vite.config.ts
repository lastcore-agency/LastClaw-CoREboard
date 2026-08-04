import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Keep authored TypeScript as the browser source of truth even when a
  // developer has stale, untracked JavaScript emit files beside it.
  resolve: {
    extensions: ['.mjs', '.mts', '.ts', '.tsx', '.js', '.jsx', '.json'],
  },
  test: {
    environment: 'node',
    include: ['server/test/**/*.test.ts'],
    exclude: ['dist-server/**']
  },
  server: {
    host: '0.0.0.0',
    port: 4173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true
      }
    }
  },
});
