import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Isto garante que os caminhos funcionem no GitHub Pages ou Vercel
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
})