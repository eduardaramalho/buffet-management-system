import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // VITE_PROXY_TARGET permite que os testes E2E apontem o proxy para um backend isolado (apps/e2e).
  server: { proxy: { '/api': process.env.VITE_PROXY_TARGET ?? 'http://localhost:3000' } },
})
