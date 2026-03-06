import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// base: '/EsoPipe/' is needed for GitHub Pages deployment at t3dy.github.io/EsoPipe
// When running locally (npm run dev), set to '/' or leave as default
export default defineConfig({
  plugins: [react()],
  base: '/EsoPipe/',
  test: {
    environment: 'node',
    globals: true,
  },
})
