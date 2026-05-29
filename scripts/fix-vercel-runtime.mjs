// Pós-build (apenas para o preset Vercel): força o runtime da função serverless
// para Node em vez de `bun1.x`.
//
// Por quê: quando o build roda sob o Bun, o Nitro força o runtime das funções
// para `bun1.x` (ver nitro/dist/_presets.mjs: `if (... || "Bun" in globalThis)
// runtime = "bun1.x"`), ignorando qualquer config. O runtime `bun1.x` da Vercel
// quebra a serialização "framed" do seroval usada pelas server functions do
// TanStack Start — a resposta volta vazia (HTTP 200, body 0) e o app fica preso
// em "carregando…". Sob o runtime Node a serialização funciona normalmente.
//
// Como o deploy é `vercel deploy --prebuilt`, basta corrigir o .vc-config.json
// gerado antes de subir. Fora da Vercel (preset Cloudflare) o arquivo não existe
// e o script simplesmente não faz nada.

import { readFile, writeFile, access } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

const TARGET_RUNTIME = "nodejs20.x";
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

  if (config.runtime === TARGET_RUNTIME) {
    console.log(`[fix-vercel-runtime] runtime já é ${TARGET_RUNTIME} — ok.`);
    return;
  }

  const previous = config.runtime;
  config.runtime = TARGET_RUNTIME;
  await writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
  console.log(
    `[fix-vercel-runtime] runtime alterado de "${previous}" para "${TARGET_RUNTIME}".`,
  );
}

main().catch((err) => {
  console.error("[fix-vercel-runtime] falhou:", err);
  process.exit(1);
});
