import { defineConfig } from "@lovable.dev/vite-tanstack-config";

/**
 * Android/Capacitor build configuration.
 *
 * The Vercel build keeps the normal TanStack Start server output from
 * vite.config.ts. Capacitor, however, needs a static HTML entry point that
 * can be loaded from the Android WebView without a Node/Nitro server.
 */
export default defineConfig({
  base: "./",
  ssr: false,
  tanstackStart: {
    server: { entry: "server" },
    spa: {
      enabled: true,
      prerender: {
        enabled: true,
        outputPath: "/index.html",
        crawlLinks: false,
      },
    },
  },
});
