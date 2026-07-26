// Camada de abstração de marca — Mangaba AI.
//
// Por baixo, a plataforma usa a HuggingFace Inference para LLM e ASR. Porém a
// EXPERIÊNCIA do usuário é apresentada como "Mangaba AI", com modelos de marca
// própria. Este módulo é a ÚNICA fonte da verdade para traduzir identificadores
// técnicos (ids de modelos, fonte da análise) na marca Mangaba exibida na UI.
//
// Regra de ouro: nenhum componente de tela deve exibir "HuggingFace" ou um id
// técnico de modelo diretamente — sempre passe pelos helpers abaixo. O backend
// (endpoints, variáveis de ambiente, discriminador `source`) permanece técnico.

import type { CallAnalysis } from "./compliance";

export const MANGABA_BRAND = "Mangaba AI";

// Catálogo de modelos Mangaba: identificador técnico → nome de produto Mangaba.
const MODEL_CATALOG: Record<string, string> = {
  "meta-llama/llama-3.1-8b-instruct": "Mangaba Compliance 8B",
  "openai/whisper-large-v3": "Mangaba Voz",
  // rótulos "amigáveis" que o backend pode emitir
  "whisper large-v3": "Mangaba Voz",
  "heurística local": "Mangaba Básico",
  huggingface: "Mangaba Compliance",
  heurística: "Mangaba Básico",
  heuristic: "Mangaba Básico",
  // análise resolvida pelo Mangaba Gateway (self-hosted) — provedor principal
  "mangaba-gateway": "Mangaba Compliance",
};

// Nome de produto Mangaba para qualquer modelo/identificador técnico.
export function mangabaModelName(model?: string | null): string {
  if (!model) return "Mangaba";
  const key = model.trim().toLowerCase();
  if (MODEL_CATALOG[key]) return MODEL_CATALOG[key];
  if (/whisper/.test(key)) return "Mangaba Voz"; // qualquer modelo ASR
  if (/heur/.test(key)) return "Mangaba Básico"; // fallback local
  // Qualquer outro modelo (ex.: "org/Algum-Modelo-7B") vira "Mangaba <nome>".
  const last = model.split("/").pop() ?? model;
  return `Mangaba ${last}`;
}

// Rótulo completo da fonte de uma análise (marca + modelo) para cabeçalhos.
export function mangabaSourceLabel(source: CallAnalysis["source"], model?: string | null): string {
  if (source === "huggingface") return `${MANGABA_BRAND} · ${mangabaModelName(model)}`;
  return "Mangaba Básico · análise local";
}

// Nome curto da fonte para tabelas/cards compactos.
export function mangabaSourceShort(source: CallAnalysis["source"], model?: string | null): string {
  return source === "huggingface" ? mangabaModelName(model) : "Mangaba Básico";
}
