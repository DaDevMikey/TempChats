import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2019',
    cssCodeSplit: false,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          firebase: ['firebase/compat/app', 'firebase/compat/firestore', 'firebase/compat/auth']
        }
      }
    }
  },
  server: {
    port: 3000,
    open: true
  }
});
