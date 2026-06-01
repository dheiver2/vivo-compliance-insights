// Cache DURÁVEL das análises de IA (LLM + ASR) — server-only.
//
// O pipeline de auditoria gasta IA generativa cara: transcrição (Whisper/ASR) e
// auditoria (LLM). Reprocessar a MESMA entrada é desperdício. Este cache evita
// isso, sobrevivendo a cold starts serverless (o cache em memória, sozinho, não):
//
//   L1 (por transcrição+ficha): mesma transcrição + mesma ficha → mesma análise,
//        sem novo LLM.
//   L2 (por gravação+ficha): mesma gravação da 3C Plus + mesma ficha → reusa a
//        análise inteira, sem ASR NEM LLM (usado na re-auditoria/dedup).
//
// Backend: KV REST (Vercel KV / Upstash), o mesmo do store. Sem KV, cai para um
// cache em memória (vale só enquanto a instância está quente). Falhas de KV são
// engolidas — o cache nunca quebra uma análise.

import process from "node:process";

import type { CallAnalysis } from "../compliance";

const PREFIX = "ai:an:";
// Análises são estáveis para uma dada (entrada, ficha); 30 dias é folgado.
const TTL_SEC = 60 * 60 * 24 * 30;

// Cliente KV REST mínimo (comando estilo Upstash: ["GET", k] / ["SET", k, v, "EX", ttl]).
function kvCmd(): ((command: (string | number)[]) => Promise<unknown>) | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const base = url.replace(/\/+$/, "");
  return async (command) => {
    const res = await fetch(base, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(command),
    });
    if (!res.ok) throw new Error(`KV ${res.status}`);
    const data = (await res.json()) as { result?: unknown; error?: string };
    if (data.error) throw new Error(data.error);
    return data.result ?? null;
  };
}

// Fallback em memória (LRU/FIFO simples) quando não há KV.
const mem = new Map<string, CallAnalysis>();
const MEM_MAX = 200;
function memSet(key: string, value: CallAnalysis): void {
  if (mem.size >= MEM_MAX) {
    const oldest = mem.keys().next().value;
    if (oldest !== undefined) mem.delete(oldest);
  }
  mem.set(key, value);
}

export async function getCachedAnalysis(key: string): Promise<CallAnalysis | null> {
  const k = PREFIX + key;
  const inMem = mem.get(k);
  if (inMem) return inMem;
  const cmd = kvCmd();
  if (!cmd) return null;
  try {
    const result = await cmd(["GET", k]);
    if (typeof result === "string") {
      const value = JSON.parse(result) as CallAnalysis;
      memSet(k, value);
      return value;
    }
  } catch {
    /* KV indisponível — segue sem cache */
  }
  return null;
}

export async function setCachedAnalysis(key: string, value: CallAnalysis): Promise<void> {
  const k = PREFIX + key;
  memSet(k, value);
  const cmd = kvCmd();
  if (!cmd) return;
  try {
    await cmd(["SET", k, JSON.stringify(value), "EX", TTL_SEC]);
  } catch {
    /* best-effort */
  }
}
