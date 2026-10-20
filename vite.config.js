import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Caminhos relativos: funciona na raiz do domínio ou numa subpasta da Hostinger
  base: './',
  build: { chunkSizeWarningLimit: 1500 },
});
