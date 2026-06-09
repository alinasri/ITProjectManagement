import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  optimizeDeps: {
    include: [
      'react-date-object',
      'react-date-object/calendars/persian',
      'react-date-object/locales/persian_en',
    ],
  },
})
