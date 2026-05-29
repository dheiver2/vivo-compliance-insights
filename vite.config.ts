// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Deploy na Vercel: a Vercel define a env `VERCEL=1` durante o build (e nós
// também aceitamos NITRO_PRESET=vercel para builds manuais). Nesse caso trocamos
// o preset do Nitro de Cloudflare (padrão da config Lovable) para `vercel` e
// apontamos a saída para o layout do Build Output API v3 (.vercel/output), que a
// config Lovable, por padrão, força para `dist/` — o que a Vercel não reconhece.
// Fora da Vercel, nada muda: o build continua usando o preset Cloudflare padrão.
const isVercel = process.env.NITRO_PRESET === "vercel" || !!process.env.VERCEL;

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  ...(isVercel
    ? {
        nitro: {
          preset: "vercel",
          output: {
            dir: ".vercel/output",
            serverDir: ".vercel/output/functions/__server.func",
            publicDir: ".vercel/output/static",
          },
        },
      }
    : {}),
});
