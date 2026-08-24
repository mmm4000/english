import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api/dict': {
        target: 'https://api.dictionaryapi.dev/api/v2/entries/en',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/dict/, ''),
      },
      '/api/translate': {
        target: 'https://translate.googleapis.com/translate_a/single',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/translate/, ''),
      },
      '/api/tatoeba': {
        target: 'https://tatoeba.org/en/api_v0/search',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/tatoeba/, ''),
      },
    },
  },
  build: {
    target: 'esnext',
  },
});
