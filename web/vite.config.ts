import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// В режиме разработки фронтенд живёт на 5173 и проксирует /api на backend (3000).
// После сборки (npm run build) файлы из web/dist раздаёт сам Fastify — прокси не нужен.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:3000',
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1200,
  },
});
