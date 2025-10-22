import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/confidential-ledger/',
  server: {
    port: 1560
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext'
    }
  }
})
