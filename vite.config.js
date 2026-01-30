import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // อนุญาตให้เข้าผ่าน IP (Network)
    allowedHosts: true,
    proxy: {
      // 1. ส่งต่อ API
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      },
      // 2. ส่งต่อการเรียกดูรูปภาพ (แก้ปัญหารูปไม่ขึ้นบนมือถือ)
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    }
  }
})