import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
    svelte(),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Single file outputs — no hashing, easy to reference from extension
        entryFileNames: 'index.js',
        assetFileNames: 'index[extname]',
      },
    },
  },
});
