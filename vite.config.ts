import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import dts from 'vite-plugin-dts';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  build: {
    outDir: 'dist',
    lib: {
      entry: resolve(__dirname, 'src/sortum.ts'),
      name: 'Sortum',
      formats: ['es', 'umd'],
      fileName: (format) => {
        if (format === 'es') return 'sortum.mjs';
        if (format === 'umd') return 'sortum.umd.js';
        return `sortum.${format}.js`;
      },
    },
  },
  plugins: [
    dts({
      insertTypesEntry: true,
      include: ['src'],
      staticImport: true,
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3231,
    cors: true,
    host: true,
    open: '/app/index.html',
  },
});
