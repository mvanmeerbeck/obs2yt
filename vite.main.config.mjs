// https://vitejs.dev/config
import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      external: [
        'dotenv',
        'ffmpeg-static',
        'ws',
        'googleapis',
        'bufferutil',
        'utf-8-validate'
      ]
    }
  }
});
