import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // Ensure Vite can resolve dependencies from parent directories
      '@maia-id': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['ajv'],
  },
});
