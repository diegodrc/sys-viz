import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { defineConfig } from 'vitest/config';

// Two build targets (SPEC §2.1):
// - default mode -> dist/ as a PWA (service worker + manifest)
// - "single" mode -> dist-single/index.html with everything inlined and no service worker
export default defineConfig(({ mode }) => {
  const single = mode === 'single';

  return {
    base: './',
    publicDir: single ? false : 'public',
    plugins: [
      react(),
      tailwindcss(),
      single
        ? viteSingleFile()
        : VitePWA({
            registerType: 'autoUpdate',
            injectRegister: false,
            includeAssets: ['icon-192.png', 'icon-512.png'],
            manifest: {
              name: 'sys-viz',
              short_name: 'sys-viz',
              description: 'Visualizador de arquiteturas de sistemas',
              lang: 'pt-BR',
              start_url: './',
              scope: './',
              display: 'standalone',
              background_color: '#f8fafc',
              theme_color: '#2563eb',
              icons: [
                { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
                { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
              ],
            },
            workbox: {
              globPatterns: ['**/*.{js,css,html,png,svg,json}'],
              navigateFallback: 'index.html',
              // the app bundle (~2.1 MB, ELK worker inlined) must be precached to work offline
              maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
            },
          }),
    ],
    build: {
      outDir: single ? 'dist-single' : 'dist',
      emptyOutDir: true,
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      css: false,
      // component tests lay out the expanded example, then the macro view (two ELK runs; the first
      // also loads the ELK bundle) — 5 s was flaky when test files run in parallel
      testTimeout: 15_000,
    },
  };
});
