import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/',
  plugins: [react()],
  css: {
    transformer: 'postcss', // Fondamentale per elaborare correttamente le direttive @tailwind
  },
});