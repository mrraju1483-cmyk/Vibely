import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Pages are split per route (see App.jsx). Libraries get their own long-lived chunks so they stay cached between deploys.
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          realtime: ['socket.io-client'],
          http: ['axios'],
        },
      },
    },
  },
})
