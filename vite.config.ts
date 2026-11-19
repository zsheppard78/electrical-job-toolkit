/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command }) => ({
  // GitHub Pages serves the app from /electrical-job-toolkit/, so built files need that prefix.
  // While developing (npm run dev) it's just /.
  base: command === 'build' ? '/electrical-job-toolkit/' : '/',
  plugins: [react(), tailwindcss()],
  test: {
    include: ['src/**/*.test.ts'],
  },
}))
