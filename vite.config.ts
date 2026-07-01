import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Named deterministically so workbox can exclude it from precache below —
        // @mlc-ai/web-llm's runtime is multi-MB and must only be fetched on-demand
        // (when a model actually loads), never force-downloaded at PWA install time.
        manualChunks(id) {
          if (id.includes('@mlc-ai/web-llm')) return 'vendor-webllm';
          return undefined;
        },
      },
    },
  },
  plugins: [
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      manifest: {
        id: '/',
        name: 'Perception-Assist',
        short_name: 'Perception-Assist',
        description:
          "Turns a caregiver's daily observations into a personalized early-warning signal.",
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        icons: [
          // TRL3 POC placeholder art — a single scalable SVG stands in for all
          // manifest icon sizes/purposes. Replace with generated PNG raster set
          // (see @vite-pwa/assets-generator) during M12 hardening / real design pass.
          { src: 'icons/icon.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: 'icons/icon.svg', sizes: '512x512', type: 'image/svg+xml' },
          {
            src: 'icons/icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Model weights are large and cached separately via the Cache API by the
        // LLM adapter itself (see src/parse, src/reason) — the service worker only
        // precaches app shell assets, not model shards. The web-llm runtime chunk
        // itself is also excluded from precache (see manualChunks above) and
        // instead cached on first real use via runtimeCaching below.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        globIgnores: ['**/vendor-webllm-*.js'],
        runtimeCaching: [
          {
            urlPattern: /vendor-webllm-.*\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'webllm-runtime',
              expiration: { maxEntries: 4 },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
});
