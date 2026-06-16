import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const extensionPkg = JSON.parse(
  readFileSync(resolve(__dirname, '../extension/package.json'), 'utf-8')
);

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(extensionPkg.version),
  },
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
