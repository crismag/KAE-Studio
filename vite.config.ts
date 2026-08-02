/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  // Relative base so the static build can be served from any subdirectory
  // on Hostinger shared hosting without a rewrite rule.
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    // KAE_NO_WATCH=1 disables the file watcher. Needed in constrained
    // environments where inotify instances are exhausted; normal `npm run dev`
    // is unaffected.
    watch: process.env.KAE_NO_WATCH ? null : undefined,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: true,
  },
})
