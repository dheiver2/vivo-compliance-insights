// Pós-build (apenas para o preset Vercel): desabilita o response streaming da
// função serverless gerada pelo Nitro.
//
// Por quê: o build roda sob o Bun, então o Nitro empacota o build "bun" do
// react-dom (que usa `new ReadableStream({ type: "direct" })`, API exclusiva do
// Bun) e marca o runtime como `bun1.x`. Precisamos MANTER o runtime `bun1.x`
// (sob Node o SSR quebra com ERR_INVALID_ARG_VALUE: source.type 'direct').
//
// O problema: com `supportsResponseStreaming: true`, o runtime `bun1.x` da
// Vercel não faz flush do corpo streamed das server functions do TanStack Start
// (content-type application/x-tss-framed) — a resposta volta vazia (HTTP 200,
// body 0) e as telas ficam presas em "carregando…".
//
// Solução: setar `supportsResponseStreaming: false`. A Vercel passa a bufferizar
// a resposta inteira antes de devolver — tanto o HTML do SSR quanto o corpo das
// server fns são entregues corretamente, mantendo o runtime Bun.
//
// Como o deploy é `vercel deploy --prebuilt`, basta corrigir o .vc-config.json
// gerado antes de subir. Fora da Vercel (preset Cloudflare) o arquivo não existe
// e o script simplesmente não faz nada.

import { readFile, writeFile, access } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

const configPath = resolve(
  process.cwd(),
  ".vercel/output/functions/__server.func/.vc-config.json",
);

async function main() {
  try {
    await access(configPath);
  } catch {
    // Build não-Vercel (ou saída ausente): nada a fazer.
    console.log("[fix-vercel-runtime] .vc-config.json não encontrado — ignorando.");
    return;
  }

  const raw = await readFile(configPath, "utf8");
  const config = JSON.parse(raw);

  // Timeout da função serverless. A ingestão da 3C Plus roda EM SÉRIE (download +
  // Whisper ASR com cold-start + LLM por ligação), então o timeout padrão da
  // Vercel (10-15s) estoura e a importação "não funciona". Elevamos o TETO para
  // 300s (máximo do plano Pro). Requests rápidos (SSR, dashboard) não mudam.
  const MAX_DURATION = 300;

  if (config.supportsResponseStreaming === false && config.maxDuration === MAX_DURATION) {
    console.log("[fix-vercel-runtime] config já aplicada (streaming + maxDuration) — ok.");
    return;
  }

  config.supportsResponseStreaming = false;
  config.maxDuration = MAX_DURATION;
  await writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
  console.log(
    `[fix-vercel-runtime] supportsResponseStreaming=false, maxDuration=${MAX_DURATION}s (runtime: ${config.runtime}).`,
  );
}

main().catch((err) => {
  console.error("[fix-vercel-runtime] falhou:", err);
  process.exit(1);
});
