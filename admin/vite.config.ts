import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/admin/',
  plugins: [react(), tailwindcss()],
  build: { outDir: '../store/public/admin', emptyOutDir: true, sourcemap: false },
  server: { port: 5173, proxy: { '/admin/api': 'http://localhost:8787' } },
});
