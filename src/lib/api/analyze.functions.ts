import { createServerFn } from "@tanstack/react-start";
import process from "node:process";
import { z } from "zod";

import {
  type CallAnalysis,
  type CallObservation,
  type ComplianceCheck,
  type Sentiment,
} from "../compliance";
import { redactText } from "../pii";
import { listCalls, recordAnalysis, updateCallAnalysis } from "../server/calls-store.server";
import { getActiveCriteria, type MonitoringCriterion } from "../server/monitoring-form.server";
import { isAuthenticated, isGateEnabled, requireAuth } from "../server/auth.server";
import { getCachedAnalysis, setCachedAnalysis } from "../server/ai-cache.server";

// HuggingFace Inference Providers expose an OpenAI-compatible chat endpoint.
const HF_ROUTER_URL = "https://router.huggingface.co/v1/chat/completions";
const DEFAULT_MODEL = "meta-llama/Llama-3.1-8B-Instruct";

// Automatic Speech Recognition (transcrição) via HuggingFace Inference.
const HF_ASR_URL_BASE = "https://router.huggingface.co/hf-inference/models/";
// whisper-large-v3-turbo é ~2x mais rápido (≈3,4s vs 7,7s warm) com transcrição
// equivalente — reduz o risco de cold-start/gateway timeout (504) no provedor.
const DEFAULT_ASR_MODEL = "openai/whisper-large-v3-turbo";
// Limite defensivo de tamanho do áudio enviado (25 MB).
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

// Limites do LLM auditor. A transcrição COMPLETA precisa ser avaliada (muitos
// critérios exigem evidência ao longo de toda a ligação), então a janela é
// generosa — o Llama 3.1 8B tem contexto de 128k, então até ligações longas
// (~20 min) entram inteiras; só outliers extremos são janelados.
const MAX_PROMPT_CHARS = 20000; // ~5k tokens: cobre a transcrição da maioria das ligações com folga
const MAX_EVIDENCE_CHARS = 200; // justificativa por item — mais detalhe na avaliação
const MAX_OBSERVATIONS = 8; // teto de observações retornadas
const LLM_MAX_TOKENS = 1200; // saída suficiente p/ checklist + evidências (schema compacto)

// O prompt é montado a partir da Ficha de Monitoria vigente (gerida pelo
// analista). Cada critério ativo vira um item da checklist, com sua descrição
// e marcação de criticidade — assim a IA avalia exatamente o que o analista
// configurou.
const _promptCache = new Map<string, string>();
function buildSystemPrompt(criteria: MonitoringCriterion[]): string {
  // A assinatura inclui o ÍNDICE: a numeração dos itens no prompt depende da
  // ORDEM, então reordenar a ficha precisa invalidar o cache (senão o LLM
  // receberia números trocados).
  const sig = criteria
    .map((c, i) => `${i}:${c.label}:${c.critical ? 1 : 0}:${c.description}`)
    .join("|");
  const cached = _promptCache.get(sig);
  if (cached) return cached;
  const items = criteria
    .map(
      (c, i) =>
        `${i + 1}. ${c.label}${c.critical ? " [CRÍTICO]" : ""}${c.description ? ` — ${c.description}` : ""}`,
    )
    .join("\n");
  // Prompt enxuto + schema de chaves curtas reduzem tokens de entrada e saída.
  // "e" (evidência) só é pedido para itens reprovados.
  const prompt = `Você é auditor de compliance e qualidade de call center da Vivo. Avalie a transcrição e responda APENAS um JSON compacto (sem markdown, sem texto extra):
{"sq":<0-100 qualidade>,"st":"positivo|neutro|negativo","rs":"<resumo 1 frase>","ck":[{"i":<nº do critério>,"p":<0 ou 1: cumprido?>,"s":<0-100>,"na":<0 ou 1: critério NÃO se aplica a esta ligação?>,"e":"<justificativa em ≤35 palavras quando p=0 ou na=1, citando o trecho/evidência>"}],"ob":[{"t":"mm:ss","n":"<observação>","sv":"ok|warning|critical"}]}
Regras: "ck" deve ter um item para CADA critério abaixo, usando o número "i" indicado. Inclua "e" SOMENTE quando p=0 ou na=1; quando p=1 (aprovado) NÃO inclua "e" (deixe vazio). No máximo ${MAX_OBSERVATIONS} observações, apenas as relevantes.
Avalie com justiça e bom senso: dê crédito parcial (s mais alto) quando o item foi cumprido de forma substancial, ainda que imperfeita, e marque p=0 apenas quando o item esteve claramente ausente ou gravemente deficiente — não reprove por desvios menores ou variações de roteiro.
Checklist contextual: marque na=1 quando o critério for IRRELEVANTE para a natureza da ligação (ex.: "oferta de produto" ou "prazos/custos de adesão" numa ligação só de suporte/dúvida/reclamação, sem venda). Itens com na=1 são desconsiderados, não penalizam. NUNCA use na=1 em itens [CRÍTICO] nem em deveres que valem para toda ligação (identificação, aviso de gravação, consentimento LGPD, confirmação cadastral) — esses sempre se aplicam; se ausentes, é p=0.
Itens [CRÍTICO] (regulatórios) merecem atenção redobrada, mas julgue pelo que de fato ocorreu na ligação, considerando o contexto.
Critérios:
${items}`;
  _promptCache.set(sig, prompt);
  return prompt;
}

const SentimentSchema = z.enum(["positivo", "neutro", "negativo"]);
// Schema compacto (chaves curtas) → menos tokens de saída. ck: i=nº do critério,
// p=cumprido (0/1 ou bool), s=score, e=evidência (só quando reprovado). ob=obs.
const boolish = z.preprocess((v) => (typeof v === "number" ? v !== 0 : v), z.boolean());
const ModelCheckSchema = z.object({
  i: z.coerce.number(),
  p: boolish,
  s: z.coerce.number(),
  na: boolish.optional().default(false), // critério não se aplica a esta ligação
  e: z.string().optional().default(""),
});
const ModelObsSchema = z.object({
  t: z.string().optional().default("—"),
  n: z.string(),
  sv: z.enum(["ok", "warning", "critical"]).optional().default("warning"),
});
const ModelResponseSchema = z.object({
  sq: z.coerce.number(),
  st: SentimentSchema,
  rs: z.string(),
  ck: z.array(ModelCheckSchema).optional().default([]),
  ob: z.array(ModelObsSchema).optional().default([]),
});

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Resposta do modelo não contém JSON.");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

// Resultado parcial do LLM: avalia o subconjunto de critérios enviados +
// metadados globais (qualidade, sentimento, resumo, observações).
interface LlmResult {
  scoreQuality: number;
  sentiment: Sentiment;
  summary: string;
  checks: ComplianceCheck[]; // um por critério enviado, já rotulado
  observations: CallObservation[];
}

// Chama o LLM SÓ para os critérios informados (os que a heurística não resolveu).
// Usa transcrição comprimida/janelada + schema compacto para minimizar tokens.
async function analyzeWithHuggingFace(
  transcript: string,
  token: string,
  model: string,
  criteria: MonitoringCriterion[],
): Promise<LlmResult> {
  const promptTranscript = windowTranscript(compressTranscript(transcript));
  const res = await fetch(HF_ROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: LLM_MAX_TOKENS,
      messages: [
        { role: "system", content: buildSystemPrompt(criteria) },
        { role: "user", content: `Transcrição:\n${promptTranscript}` },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Mangaba AI ${res.status}: ${detail.slice(0, 300)}`);
  }

  const payload = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("Resposta vazia do modelo.");

  const parsed = ModelResponseSchema.parse(extractJson(content));

  // Casa cada critério enviado com o item de nº "i" (ou pela posição como
  // fallback). Evidência é mantida apenas para itens reprovados.
  const checks: ComplianceCheck[] = criteria.map((c, idx) => {
    const found = parsed.ck.find((k) => k.i === idx + 1) ?? parsed.ck[idx];
    if (!found) {
      return { label: c.label, passed: false, score: 0, evidence: "Não avaliado pelo modelo." };
    }
    // N/A só é permitido em itens NÃO críticos: critérios regulatórios (críticos)
    // sempre se aplicam — se o modelo tentar marcá-los N/A, ignoramos.
    const applicable = c.critical ? true : !found.na;
    if (!applicable) {
      return {
        label: c.label,
        passed: true, // não reprova; é desconsiderado da média
        score: 0,
        evidence: found.e?.trim().slice(0, MAX_EVIDENCE_CHARS) || "Não se aplica a esta ligação.",
        applicable: false,
      };
    }
    const passed = found.p;
    return {
      label: c.label,
      passed,
      score: clampScore(found.s),
      evidence: passed ? "" : found.e?.trim().slice(0, MAX_EVIDENCE_CHARS) || "Item não cumprido.",
      applicable: true,
    };
  });

  const observations: CallObservation[] = parsed.ob.slice(0, MAX_OBSERVATIONS).map((o) => ({
    agent: "Mangaba Compliance",
    time: o.t || "—",
    note: o.n,
    severity: o.sv,
  }));

  return {
    scoreQuality: clampScore(parsed.sq),
    sentiment: parsed.st,
    summary: parsed.rs,
    checks,
    observations,
  };
}

// Regras de palavra-chave por rótulo CANÔNICO da ficha padrão. Critérios
// personalizados (sem regra) recebem uma verificação neutra no modo local.
const HEURISTIC_RULES: Record<string, { terms: string[]; evidence: string }> = {
  "Prontidão ao atender": {
    terms: ["vivo", "bom dia", "boa tarde", "boa noite", "aqui é", "em que posso", "falo com"],
    evidence: "Procura por abertura imediata com identificação.",
  },
  "Saudação e identificação (nome + Vivo)": {
    terms: ["aqui é", "meu nome", "vivo", "vivo empresas", "quem fala"],
    evidence: "Procura por nome do vendedor + empresa (Vivo).",
  },
  "Personalização da ligação": {
    terms: ["senhor", "senhora", "sr.", "sra.", "você"],
    evidence: "Procura por tratamento do cliente pelo nome.",
  },
  "Sondagem do cliente": {
    terms: ["quanto paga", "quantas linhas", "linhas", "banda larga", "internet", "dados", "móvel"],
    evidence: "Procura por sondagem do cenário do cliente.",
  },
  "Escuta ativa (não interromper o cliente)": {
    terms: ["compreendo", "entendi", "entendo", "claro", "perfeito"],
    evidence: "Procura por sinais de escuta sem interrupção.",
  },
  "Objetividade e abordagem do responsável": {
    terms: ["responsável", "agendar", "agendamento", "whatsapp", "retorno", "contato"],
    evidence: "Procura por abordagem do responsável/agendamento.",
  },
  "Estratégia de venda e argumentação": {
    terms: ["oferta", "plano", "produto", "benefício", "promo", "argument", "desconto", "vantagem"],
    evidence: "Procura por argumentação de venda.",
  },
  "Fechamento da venda (informações obrigatórias)": {
    terms: ["fidelização", "fidelidade", "24 meses", "valor", "chip", "mensalidade", "r$"],
    evidence: "Procura por informações obrigatórias do fechamento.",
  },
  "Finalização padrão da ligação": {
    terms: ["obrigad", "agradeço", "tenha um", "bom dia", "boa tarde", "ótima"],
    evidence: "Procura por finalização padrão agradecendo.",
  },
  "Tabulação administrativa correta": {
    terms: ["tabul", "registr", "sistema"],
    evidence: "Procura por registro/tabulação da ligação.",
  },
};

// Fallback determinístico por palavras-chave: mantém o MVP funcional sem token.
// Avalia exatamente os critérios ATIVOS da ficha vigente.
function analyzeHeuristic(transcript: string, criteria: MonitoringCriterion[]): CallAnalysis {
  const t = transcript.toLowerCase();
  const has = (...terms: string[]) => terms.some((term) => t.includes(term));

  const checks: ComplianceCheck[] = criteria.map((c) => {
    const rule = HEURISTIC_RULES[c.label];
    if (!rule) {
      // Critério personalizado: sem regra automática local.
      return {
        label: c.label,
        passed: true,
        score: 60,
        evidence: "Critério personalizado — avaliação detalhada requer a Mangaba AI.",
      };
    }
    const passed = has(...rule.terms);
    // Crédito parcial quando o sinal não aparece: ausência de palavra-chave não é
    // prova de falha grave (o modo Básico não "entende" o diálogo). Mantém a ficha
    // menos rígida — itens não detectados ficam em atenção, não em reprovação seca.
    return { label: c.label, passed, score: passed ? 90 : 50, evidence: rule.evidence };
  });

  const scoreCompliance = clampScore(
    checks.length ? checks.reduce((acc, c) => acc + c.score, 0) / checks.length : 0,
  );

  // "cancelar" foi removido: pedir cancelamento é um motivo de contato legítimo,
  // não um indício de mau atendimento — incluí-lo enviesava o sentimento.
  const negativeMarkers = ["absurd", "irritad", "reclam", "péssim", "horrível", "raiva"];
  const positiveMarkers = ["obrigado", "ótimo", "perfeito", "resolvido", "satisfeit"];
  const negHits = negativeMarkers.filter((m) => t.includes(m)).length;
  const posHits = positiveMarkers.filter((m) => t.includes(m)).length;
  const sentiment: Sentiment =
    negHits > posHits ? "negativo" : posHits > negHits ? "positivo" : "neutro";

  // Penalidade de sentimento mais branda (6 em vez de 8): a insatisfação do
  // cliente nem sempre reflete falha do atendente.
  const scoreQuality = clampScore(scoreCompliance - negHits * 6 + posHits * 5);

  // Observações geradas a partir dos critérios que falharam (priorizando os
  // marcados como críticos pelo analista).
  const observations: CallObservation[] = [];
  const checkByLabel = new Map(checks.map((c) => [c.label, c]));
  for (const c of criteria) {
    const chk = checkByLabel.get(c.label);
    if (chk && !chk.passed) {
      observations.push({
        agent: "Mangaba Básico",
        time: "00:00",
        note: `${c.label} não foi detectado na transcrição.`,
        severity: c.critical ? "critical" : "warning",
      });
    }
  }
  if (sentiment === "negativo") {
    observations.push({
      agent: "Mangaba Sentimento",
      time: "—",
      note: "Sinais de insatisfação do cliente detectados na transcrição.",
      severity: "warning",
    });
  }

  return {
    scoreCompliance,
    scoreQuality,
    sentiment,
    summary: "Análise gerada pelo Mangaba Básico (modo local, sem conexão com a Mangaba AI).",
    checks,
    observations,
    source: "heuristic",
  };
}

// ---------------------------------------------------------------------------
// Otimização de tokens: comprime + janela a transcrição antes do LLM, resolve
// itens determinísticos localmente (heurística-primeiro) e cacheia por hash.
// ---------------------------------------------------------------------------

// Remove ruído barato (espaços, quebras, repetições de ASR) sem perder conteúdo.
function compressTranscript(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/(.)\1{3,}/g, "$1$1")
    .trim();
}

// Se a transcrição passar do teto, envia início (abertura: identificação,
// gravação, LGPD) + fim (encerramento, protocolo) + amostra do meio. Os itens do
// script concentram-se nas pontas, então a evidência é preservada.
function windowTranscript(text: string, max = MAX_PROMPT_CHARS): string {
  if (text.length <= max) return text;
  // Início (abertura/identificação/sondagem) + fim (fechamento/protocolo) onde os
  // critérios mais se evidenciam, MAS preserva 25% do meio: em ligação de vendas
  // a argumentação/contorno de objeção acontece no miolo.
  const head = Math.floor(max * 0.4);
  const tail = Math.floor(max * 0.35);
  const midLen = max - head - tail;
  const midStart = Math.max(head, Math.floor((text.length - midLen) / 2));
  const a = text.slice(0, head);
  const b = text.slice(midStart, midStart + midLen);
  const c = text.slice(text.length - tail);
  return `${a}\n[...trecho omitido...]\n${b}\n[...trecho omitido...]\n${c}`;
}

// Hash FNV-1a barato para chavear o cache (transcrição + assinatura da ficha).
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

// Versão do pipeline de análise (prompt/limites/parsing). Bumpar invalida todo o
// cache — garante que mudanças como "transcrição completa" valham na re-análise.
const ANALYSIS_VERSION = 2;

// Assinatura da ficha vigente (versão + id + criticidade + peso de cada critério).
// Muda quando o scorecard OU o pipeline muda → invalida o cache automaticamente.
function criteriaSig(criteria: MonitoringCriterion[]): string {
  return fnv1a(
    `v${ANALYSIS_VERSION}|` +
      criteria.map((c) => `${c.id}:${c.critical ? 1 : 0}:${c.weight}`).join("|"),
  );
}

// Chave do cache L1 (análise do LLM): transcrição + assinatura da ficha.
function cacheKey(transcript: string, criteria: MonitoringCriterion[]): string {
  return `${fnv1a(transcript)}:${criteriaSig(criteria)}`;
}

// Compliance final derivado da checklist: média ponderada pelo peso do critério,
// com itens críticos contando em dobro. Determinístico e rastreável.
function weightedCompliance(checks: ComplianceCheck[], criteria: MonitoringCriterion[]): number {
  const byLabel = new Map(criteria.map((c) => [c.label, c]));
  let sum = 0;
  let weightSum = 0;
  for (const ck of checks) {
    // Checklist contextual: itens marcados como não aplicáveis (N/A) ficam de
    // fora da média — não contam como 0% nem inflam a nota.
    if (ck.applicable === false) continue;
    const c = byLabel.get(ck.label);
    const w = (c?.weight ?? 3) * (c?.critical ? 1.5 : 1);
    sum += ck.score * w;
    weightSum += w;
  }
  return clampScore(weightSum ? sum / weightSum : 0);
}

// Heurística-primeiro: resolve localmente (custo zero) itens NÃO críticos com
// sinal positivo claro e manda ao LLM só o subconjunto ambíguo + TODOS os
// críticos (nunca auto-aprovados). Junta tudo e deriva o compliance ponderado.
async function analyzeHybrid(
  transcript: string,
  token: string,
  model: string,
  criteria: MonitoringCriterion[],
): Promise<CallAnalysis> {
  const t = transcript.toLowerCase();
  const preResolved = new Map<string, ComplianceCheck>();
  const remaining: MonitoringCriterion[] = [];
  for (const c of criteria) {
    const rule = HEURISTIC_RULES[c.label];
    if (rule && !c.critical && rule.terms.some((term) => t.includes(term))) {
      preResolved.set(c.label, { label: c.label, passed: true, score: 90, evidence: "" });
    } else {
      remaining.push(c);
    }
  }

  // Só aciona o LLM se sobrou algo para julgar.
  const llm = remaining.length
    ? await analyzeWithHuggingFace(transcript, token, model, remaining)
    : null;

  const llmByLabel = new Map((llm?.checks ?? []).map((c) => [c.label, c]));
  const checks: ComplianceCheck[] = criteria.map(
    (c) =>
      preResolved.get(c.label) ??
      llmByLabel.get(c.label) ?? {
        label: c.label,
        passed: false,
        score: 0,
        evidence: "Não avaliado.",
      },
  );

  const scoreCompliance = weightedCompliance(checks, criteria);

  // Qualidade/sentimento/resumo vêm do LLM; se nada foi enviado (tudo resolvido
  // localmente), recorre à heurística para esses campos.
  if (llm) {
    return {
      scoreCompliance,
      scoreQuality: llm.scoreQuality,
      sentiment: llm.sentiment,
      summary: llm.summary,
      checks,
      observations: llm.observations,
      source: "huggingface",
      model,
    };
  }

  const h = analyzeHeuristic(transcript, criteria);
  return {
    scoreCompliance,
    scoreQuality: h.scoreQuality,
    sentiment: h.sentiment,
    summary: "Todos os itens do script foram confirmados automaticamente (Mangaba Básico).",
    checks,
    observations: h.observations,
    source: "heuristic",
  };
}

// Núcleo reutilizável: cache durável → heurística-primeiro + LLM → fallback.
async function analyzeTranscript(transcript: string): Promise<CallAnalysis> {
  const token = process.env.HF_TOKEN;
  const model = process.env.HF_MODEL || DEFAULT_MODEL;
  // Ficha de Monitoria vigente (critérios ativos definidos pelo analista).
  const criteria = await getActiveCriteria();

  // L1: cache durável por transcrição + ficha — a MESMA entrada não re-gasta LLM.
  const key = cacheKey(transcript, criteria);
  const cached = await getCachedAnalysis(key);
  if (cached) return cached;

  // Sem token: heurística local (custo zero, determinística) — nada a cachear.
  if (!token) return analyzeHeuristic(transcript, criteria);

  try {
    const result = await analyzeHybrid(transcript, token, model, criteria);
    // Só cacheia análise REAL (Mangaba AI) — nunca o fallback degradado.
    if (result.source === "huggingface") await setCachedAnalysis(key, result);
    return result;
  } catch (error) {
    console.error("Falha na análise HuggingFace, usando heurística:", error);
    const fallback = analyzeHeuristic(transcript, criteria);
    fallback.summary = `Falha ao acionar a Mangaba AI — exibindo análise do Mangaba Básico. (${
      error instanceof Error ? error.message : "erro desconhecido"
    })`;
    return fallback;
  }
}

// Transcrição (ASR) de áudio binário via Whisper na HuggingFace Inference.
//
// A Inference da HuggingFace faz "cold start" do modelo sob demanda: a primeira
// chamada com o modelo frio costuma devolver 503 (model loading) ou 504 (gateway
// timeout) enquanto ele carrega. Tratamos isso com algumas retentativas e
// backoff — sem retry, áudios falham de forma intermitente só porque o modelo
// estava esfriando. Erros não transitórios (4xx) falham de imediato.
async function transcribeAudio(
  bytes: Uint8Array,
  contentType: string,
  token: string,
  model: string,
): Promise<string> {
  const maxAttempts = 4;
  let lastDetail = "";
  let lastStatus = 0;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${HF_ASR_URL_BASE}${model}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": contentType || "application/octet-stream",
        },
        // Uint8Array é um BodyInit válido em runtime (Node/Workers); o cast
        // satisfaz a tipagem estrita do lib.dom de fetch.
        body: bytes as unknown as BodyInit,
      });
    } catch (error) {
      // Erro de rede/timeout do fetch — trata como transitório e tenta de novo.
      lastDetail = error instanceof Error ? error.message : "erro de rede";
      lastStatus = 0;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, attempt * 4000));
        continue;
      }
      throw new Error(`Mangaba Voz: falha de rede ao transcrever (${lastDetail}).`);
    }

    if (res.ok) {
      const payload = (await res.json()) as { text?: string };
      const text = payload.text?.trim();
      if (!text) throw new Error("Transcrição vazia retornada pelo modelo ASR.");
      return text;
    }

    lastStatus = res.status;
    lastDetail = (await res.text().catch(() => "")).slice(0, 300);
    // 503 (model loading) e 504 (gateway timeout) são transitórios: o modelo
    // está esquentando. Demais erros (ex.: 401, 413) são definitivos.
    const transient = res.status === 503 || res.status === 504 || res.status === 429;
    if (transient && attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, attempt * 4000));
      continue;
    }
    break;
  }

  const friendly =
    lastStatus === 503 || lastStatus === 504
      ? "O modelo de transcrição (Mangaba Voz) está iniciando no provedor. Aguarde alguns segundos e tente novamente."
      : `Mangaba Voz ${lastStatus}: ${lastDetail}`;
  throw new Error(friendly);
}

// Baixa uma gravação por HTTP (server-side) e devolve os bytes + content-type,
// aplicando os mesmos limites defensivos de tamanho do upload manual. Usado tanto
// pela ingestão genérica (API de mercado) quanto pela integração 3C Plus.
async function downloadRecording(
  url: string,
  headers: Record<string, string> = {},
): Promise<{ bytes: Uint8Array; contentType: string }> {
  let res: Response;
  try {
    res = await fetch(url, { headers });
  } catch (error) {
    throw new Error(
      `Não foi possível acessar a gravação: ${
        error instanceof Error ? error.message : "erro de rede"
      }`,
    );
  }
  if (!res.ok) {
    throw new Error(
      `O provedor retornou ${res.status} ao baixar a gravação. Verifique a URL e a autorização.`,
    );
  }
  const contentType = res.headers.get("content-type") || "application/octet-stream";
  const buffer = await res.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes.byteLength === 0) {
    throw new Error("A gravação baixada está vazia.");
  }
  if (bytes.byteLength > MAX_AUDIO_BYTES) {
    throw new Error(
      `Gravação muito grande (${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB). Limite: ${
        MAX_AUDIO_BYTES / 1024 / 1024
      } MB.`,
    );
  }
  return { bytes, contentType };
}

// Decodifica base64 para bytes de forma cross-runtime (Node/Workers).
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Resumo da auditoria que SUBSTITUI a transcrição completa no armazenamento e
// na resposta ao cliente. A transcrição bruta nunca é persistida nem devolvida
// (privacidade/LGPD): guardamos apenas o necessário para auditar e justificar o
// script de monitoria — o resumo do caso + a resposta de cada critério (com a
// evidência da IA) + as observações. Assim a ficha "responde o script" sem reter
// o diálogo na íntegra.
function buildAuditSummary(analysis: CallAnalysis): string {
  const lines: string[] = [];
  if (analysis.summary.trim()) lines.push(analysis.summary.trim());

  if (analysis.checks.length) {
    lines.push("");
    lines.push("Script de monitoria:");
    for (const c of analysis.checks) {
      const na = c.applicable === false;
      const mark = na ? "—" : c.passed ? "✓" : "✗";
      const score = na ? "N/A" : `${c.score}%`;
      const evidence = c.evidence?.trim() ? ` — ${c.evidence.trim()}` : "";
      lines.push(`${mark} ${c.label} (${score})${evidence}`);
    }
  }

  if (analysis.observations.length) {
    lines.push("");
    lines.push("Observações:");
    for (const o of analysis.observations) {
      const time = o.time && o.time !== "—" ? `${o.time} ` : "";
      lines.push(`• [${o.severity}] ${time}${o.note}`);
    }
  }

  return lines.join("\n").trim();
}

// Toda análise persistida devolve também o id/protocolo do registro criado,
// para que o cliente possa navegar direto à ficha de detalhe.
export type StoredAnalysis = CallAnalysis & { id: string; protocol: string };

export const analyzeCall = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      transcript: z.string().min(20, "Transcrição muito curta."),
      agentName: z.string().optional(),
    }),
  )
  .handler(async ({ data }): Promise<StoredAnalysis> => {
    requireAuth();
    // LGPD: mascara PII (CPF, CNPJ, cartão, telefone, e-mail) ANTES de enviar à
    // IA externa, persistir e exibir. O mesmo texto redigido flui por tudo.
    const transcript = redactText(data.transcript);
    const analysis = await analyzeTranscript(transcript);
    // Armazena somente o resumo da auditoria; a transcrição bruta não é retida.
    const stored = await recordAnalysis({
      analysis,
      origin: "texto",
      label: "Transcrição manual",
      transcript: buildAuditSummary(analysis),
      topicSource: transcript,
      agentName: data.agentName,
      durationSec: estimateDurationSec(transcript),
    });
    return { ...analysis, id: stored.id, protocol: stored.protocol };
  });

// Reprocessa TODAS as ligações armazenadas sob a Ficha de Monitoria vigente.
// Necessário quando a norma muda: ligações auditadas pela ficha anterior têm
// critérios (labels) diferentes e por isso aparecem com 0% de aderência nos
// novos itens. Re-audita o texto retido de cada ligação e regrava os checks.
// Observação: por política de LGPD, o texto retido pode ser o RESUMO da
// auditoria (não a transcrição bruta) — nesses casos a re-auditoria é aproximada.
export const reprocessCalls = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ updated: number; total: number; skipped: number }> => {
    requireAuth();
    const calls = await listCalls();
    let updated = 0;
    let skipped = 0;
    for (const c of calls) {
      const text = (c.transcript ?? "").trim();
      if (text.length < 20) {
        skipped++;
        continue;
      }
      const analysis = await analyzeTranscript(text);
      const result = await updateCallAnalysis(c.id, analysis);
      if (result) updated++;
      else skipped++;
    }
    return { updated, total: calls.length, skipped };
  },
);

const AnalyzeAudioInput = z.object({
  filename: z.string().min(1),
  mimeType: z.string().optional().default(""),
  base64: z.string().min(1, "Áudio vazio."),
  agentName: z.string().optional(),
});

export type AudioAnalysis = CallAnalysis & {
  transcript: string;
  filename: string;
  id: string;
  protocol: string;
};

// ---------------------------------------------------------------------------
// Ingestão via API de mercado (telefonia/contact center).
//
// Provedores como Twilio, Genesys Cloud, NICE CXone, Five9, Amazon Connect,
// Vonage e Zenvia expõem a gravação de cada ligação como uma URL acessível por
// HTTP (normalmente com um token/credencial). Esta server fn recebe essa URL,
// baixa o áudio do servidor (fetch real, server-side), transcreve via Mangaba
// Voz e roda a auditoria — exatamente como o upload manual, mas alimentado
// diretamente pelo provedor.
//
// Para integrações onde o provedor já entrega a transcrição (speech-to-text do
// próprio provedor) ou onde se quer pular a ASR, basta enviar `transcript`.
// ---------------------------------------------------------------------------

// Catálogo de provedores suportados. Usado apenas para rotular a origem da
// ligação de forma legível; o download é genérico (qualquer URL HTTP[S]).
export const MARKET_PROVIDERS = [
  { id: "twilio", label: "Twilio" },
  { id: "genesys", label: "Genesys Cloud" },
  { id: "nice", label: "NICE CXone" },
  { id: "five9", label: "Five9" },
  { id: "amazon-connect", label: "Amazon Connect" },
  { id: "vonage", label: "Vonage" },
  { id: "zenvia", label: "Zenvia" },
  { id: "generic", label: "Webhook genérico" },
] as const;

const PROVIDER_LABELS: Record<string, string> = Object.fromEntries(
  MARKET_PROVIDERS.map((p) => [p.id, p.label]),
);

const IngestUrlInput = z
  .object({
    // URL da gravação no provedor. Opcional quando o provedor já envia a
    // transcrição pronta (campo `transcript`).
    recordingUrl: z.string().optional().default(""),
    provider: z.string().optional().default("generic"),
    externalId: z.string().optional().default(""),
    agentName: z.string().optional(),
    // Cabeçalho de autorização opcional para acessar a gravação no provedor
    // (ex.: "Bearer xxx" ou "Basic base64(sid:token)" no padrão Twilio).
    authHeader: z.string().optional().default(""),
    // Transcrição pré-existente: se enviada, pula a etapa de ASR (Mangaba Voz).
    transcript: z.string().optional().default(""),
  })
  .superRefine((data, ctx) => {
    const url = (data.recordingUrl ?? "").trim();
    const transcript = (data.transcript ?? "").trim();
    // Precisa de pelo menos uma fonte: a URL da gravação OU a transcrição.
    if (!url && !transcript) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recordingUrl"],
        message: "Informe a URL da gravação ou cole a transcrição do provedor.",
      });
      return;
    }
    // Se uma URL foi informada, ela precisa ser http/https válida.
    if (url && !/^https?:\/\/.+/i.test(url)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recordingUrl"],
        message: "A URL da gravação deve usar http ou https.",
      });
    }
  });

export type IngestAnalysis = CallAnalysis & {
  transcript: string;
  label: string;
  id: string;
  protocol: string;
};

// Deriva um nome de arquivo legível a partir da URL (último segmento do path).
function filenameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop();
    return last ? decodeURIComponent(last) : u.hostname;
  } catch {
    return "gravacao";
  }
}

export const analyzeCallFromUrl = createServerFn({ method: "POST" })
  .inputValidator(IngestUrlInput)
  .handler(async ({ data }): Promise<IngestAnalysis> => {
    requireAuth();
    const providerLabel = PROVIDER_LABELS[data.provider] ?? "Provedor externo";
    const fileLabel = filenameFromUrl(data.recordingUrl);
    // Rótulo legível da ligação: provedor + id externo (ou nome do arquivo).
    const label = `${providerLabel} · ${data.externalId.trim() || fileLabel}`;

    let transcript = data.transcript.trim();

    // Caminho 1: provedor entregou a transcrição → pula a ASR.
    if (!transcript) {
      // Caminho 2: baixa a gravação do provedor e transcreve com a Mangaba Voz.
      const token = process.env.HF_TOKEN;
      if (!token) {
        throw new Error(
          "Transcrição de áudio do provedor requer a Mangaba AI ativa no servidor (ou envie a transcrição pronta).",
        );
      }

      const headers: Record<string, string> = {};
      if (data.authHeader.trim()) headers.Authorization = data.authHeader.trim();

      const { bytes, contentType } = await downloadRecording(data.recordingUrl, headers);
      const asrModel = process.env.HF_ASR_MODEL || DEFAULT_ASR_MODEL;
      transcript = await transcribeAudio(bytes, contentType, token, asrModel);
    }

    if (transcript.trim().length < 20) {
      throw new Error("Transcrição muito curta para auditar.");
    }

    // LGPD: mascara PII antes de auditar, persistir e devolver ao cliente.
    transcript = redactText(transcript);

    const analysis = await analyzeTranscript(transcript);
    // Origem "audio" quando veio de gravação; "texto" quando o provedor enviou
    // a transcrição pronta.
    const origin = data.transcript.trim() ? "texto" : "audio";
    // Resumo da auditoria substitui a transcrição completa (não persistimos nem
    // devolvemos o diálogo bruto).
    const auditSummary = buildAuditSummary(analysis);
    const stored = await recordAnalysis({
      analysis,
      origin,
      label,
      transcript: auditSummary,
      topicSource: transcript,
      agentName: data.agentName,
      durationSec: estimateDurationSec(transcript),
    });

    return {
      ...analysis,
      transcript: auditSummary,
      label,
      id: stored.id,
      protocol: stored.protocol,
    };
  });

export const analyzeAudio = createServerFn({ method: "POST" })
  .inputValidator(AnalyzeAudioInput)
  .handler(async ({ data }): Promise<AudioAnalysis> => {
    requireAuth();
    const token = process.env.HF_TOKEN;
    if (!token) {
      throw new Error("Transcrição de áudio requer a Mangaba AI ativa no servidor.");
    }

    const bytes = base64ToBytes(data.base64);
    if (bytes.byteLength === 0) {
      throw new Error("Áudio vazio.");
    }
    if (bytes.byteLength > MAX_AUDIO_BYTES) {
      throw new Error(
        `Áudio muito grande (${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB). Limite: ${
          MAX_AUDIO_BYTES / 1024 / 1024
        } MB.`,
      );
    }

    const asrModel = process.env.HF_ASR_MODEL || DEFAULT_ASR_MODEL;
    const rawTranscript = await transcribeAudio(bytes, data.mimeType, token, asrModel);
    // LGPD: mascara PII pós-ASR antes de auditar, persistir e devolver.
    const transcript = redactText(rawTranscript);
    const analysis = await analyzeTranscript(transcript);
    // Persiste/retorna apenas o resumo da auditoria, nunca a transcrição bruta.
    const auditSummary = buildAuditSummary(analysis);
    const stored = await recordAnalysis({
      analysis,
      origin: "audio",
      label: data.filename,
      transcript: auditSummary,
      topicSource: transcript,
      agentName: data.agentName,
      durationSec: estimateDurationSec(transcript),
    });

    return {
      ...analysis,
      transcript: auditSummary,
      filename: data.filename,
      id: stored.id,
      protocol: stored.protocol,
    };
  });

// ===========================================================================
// Integração nativa com a 3C Plus (discador 3C+ V2 / FluxoTI).
//
// É de lá que vêm as gravações de atendentes e clientes. A API V2 expõe:
//   - GET /calls                         → relatório de ligações (filtrável)
//   - GET /calls/{id}                    → relatório de uma ligação
//   - GET /calls/{id}/recording          → baixa o áudio da gravação
// Autenticação: parâmetro de querystring `api_token` (apiKey). Ref.:
// https://app.3c.plus/api/v1/swagger.json
//
// O token é um SEGREDO: fica em THREECPLUS_API_TOKEN no servidor (env), nunca no
// bundle do cliente. Para testes pontuais, aceita-se um override por requisição.
// ===========================================================================

const THREECPLUS_BASE = "https://3c.fluxoti.com/api/v1";

// Resolve o token 3C Plus: prioriza o override da requisição (testes) e cai no
// segredo do servidor. Lança erro claro quando nenhum está disponível.
function resolveThreeCplusToken(override?: string): string {
  const token = (override ?? "").trim() || process.env.THREECPLUS_API_TOKEN || "";
  if (!token) {
    throw new Error(
      "Token da 3C Plus ausente. Defina THREECPLUS_API_TOKEN no servidor ou informe o token na requisição.",
    );
  }
  return token;
}

// Acrescenta o api_token à URL sem duplicar query existente.
function withApiToken(url: string, token: string): string {
  return url + (url.includes("?") ? "&" : "?") + "api_token=" + encodeURIComponent(token);
}

// Mascara o telefone preservando os 4 últimos dígitos (metadado LGPD-friendly).
function maskPhone(num: string): string {
  const digits = (num ?? "").replace(/\D/g, "");
  if (digits.length < 4) return num ? "••••" : "";
  return "••••" + digits.slice(-4);
}

// Faz GET autenticado na API 3C Plus e devolve o JSON já desembrulhado quando a
// resposta vem no padrão Laravel `{ data: ... }`.
//
// Resiliência: a 3C Plus às vezes demora e o Cloudflare devolve 5xx/524 (timeout
// na origem) de forma TRANSITÓRIA. Por isso, com timeout próprio (AbortController)
// e retry com backoff em 5xx/timeout/rede — só erros definitivos (4xx) sobem na hora.
async function threeCplusGet<T>(path: string, token: string, maxAttempts = 3): Promise<T> {
  const url = withApiToken(`${THREECPLUS_BASE}${path}`, token);
  let lastErr = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25_000);
    let res: Response;
    try {
      res = await fetch(url, { headers: { Accept: "application/json" }, signal: ctrl.signal });
    } catch (error) {
      // Abort/rede: transitório — tenta de novo com backoff.
      lastErr = error instanceof Error ? error.message : "erro de rede";
      clearTimeout(timer);
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
        continue;
      }
      throw new Error(`Falha ao acessar a 3C Plus (após ${maxAttempts} tentativas): ${lastErr}`);
    }
    clearTimeout(timer);
    if (res.ok) {
      const payload = (await res.json()) as { data?: T } & T;
      return (payload?.data ?? payload) as T;
    }
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    // 5xx (incl. 524 do Cloudflare): origem instável/lenta — retry. 4xx: definitivo.
    if (res.status >= 500 && attempt < maxAttempts) {
      lastErr = `${res.status}: ${detail}`;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
      continue;
    }
    throw new Error(`3C Plus ${res.status}: ${detail}`);
  }
  throw new Error(`3C Plus: falha após ${maxAttempts} tentativas. ${lastErr}`);
}

// Baixa a gravação de uma ligação na 3C Plus.
//
// Particularidades descobertas testando a API real (mesma URL, requisições
// seguidas → 200, 200, 404, ...):
//  - O host correto é o de THREECPLUS_BASE (3c.fluxoti.com). O campo `recording`
//    do relatório aponta para `app.3c.plus`, que responde 404 — por isso NÃO o
//    usamos; construímos a URL no host que funciona.
//  - O endpoint é balanceado entre nós e ALGUNS devolvem 404 (nginx) de forma
//    intermitente, mesmo para ligações que TÊM gravação. Portanto 404 é tratado
//    como TRANSITÓRIO: só concluímos "sem áudio" se persistir por todas as
//    tentativas.
//  - Há rate limit (~1 download / 5 s): estourado, devolve HTTP 422 com
//    `error: "Muitas requisições, aguarde 5 segundos..."`. Aguardamos e tentamos
//    de novo.
async function downloadThreeCplusRecording(
  callId: string,
  token: string,
  maxAttempts = 6,
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const url = withApiToken(
    `${THREECPLUS_BASE}/calls/${encodeURIComponent(callId)}/recording`,
    token,
  );
  let sawRateLimit = false;
  let saw404 = false;
  let lastStatus = 0;
  let lastDetail = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { headers: { Accept: "*/*" } });
    } catch (error) {
      // Falha de rede — transitória; tenta de novo com pequeno backoff.
      lastStatus = 0;
      lastDetail = error instanceof Error ? error.message : "erro de rede";
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      break;
    }
    if (res.ok) {
      const contentType = res.headers.get("content-type") || "application/octet-stream";
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.byteLength === 0) {
        throw new Error(
          "Esta ligação não tem áudio disponível na 3C Plus (provável caixa postal ou chamada sem atendimento).",
        );
      }
      if (bytes.byteLength > MAX_AUDIO_BYTES) {
        throw new Error(
          `Gravação muito grande (${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB). Limite: ${
            MAX_AUDIO_BYTES / 1024 / 1024
          } MB.`,
        );
      }
      return { bytes, contentType };
    }
    lastStatus = res.status;
    lastDetail = (await res.text().catch(() => "")).slice(0, 300);
    const isRateLimit = res.status === 422 && /muitas requisi/i.test(lastDetail);
    if (isRateLimit) {
      sawRateLimit = true;
      if (attempt < maxAttempts) {
        // A própria API pede ~5 s; aguardamos antes de tentar de novo.
        await new Promise((r) => setTimeout(r, 5200));
        continue;
      }
      break;
    }
    // 404 intermitente do balanceador: tenta outro nó. Só vira "sem áudio" se
    // NUNCA conseguirmos um 200 ao longo das tentativas.
    if (res.status === 404) {
      saw404 = true;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1800));
        continue;
      }
      break;
    }
    // Outros erros (401, 413, 5xx...) — definitivos.
    throw new Error(`3C Plus retornou ${res.status} ao baixar a gravação: ${lastDetail}`);
  }

  // Esgotou as tentativas. Mensagem conforme o que mais apareceu.
  if (sawRateLimit) {
    throw new Error(
      "A 3C Plus está limitando os downloads de gravação (muitas requisições). Aguarde alguns segundos e tente novamente.",
    );
  }
  if (saw404) {
    throw new Error(
      "Não foi possível baixar a gravação desta ligação na 3C Plus (o provedor respondeu 404 repetidamente). Pode ser uma ligação sem áudio (caixa postal) ou instabilidade momentânea — tente novamente em instantes.",
    );
  }
  throw new Error(
    `Falha ao baixar a gravação da 3C Plus${lastStatus ? ` (${lastStatus})` : ""}: ${lastDetail || "erro de rede"}.`,
  );
}

// Item enxuto de ligação 3C Plus exposto à UI (telefone já mascarado).
export interface ThreeCplusCall {
  id: string;
  sid: string;
  agent: string;
  number: string; // mascarado (••••1234)
  callDate: string;
  campaign: string;
  queueName: string;
  recorded: boolean;
}

// Formato bruto (parcial) do CallHistoryReport da 3C Plus.
interface ThreeCplusReport {
  id?: string | number;
  sid?: string;
  agent?: string;
  has_agent?: boolean;
  number?: string;
  call_date?: string;
  call_date_rfc3339?: string;
  campaign?: string;
  queue_name?: string;
  recorded?: boolean;
  recording?: string;
  // Identificadores alternativos que algumas instalações da 3C Plus usam para a
  // gravação (tentados como candidatos no download).
  telephony_id?: string | number;
  call_id?: string | number;
  call_history_id?: string | number;
  uniqueid?: string;
  // Duração da ligação (segundos) — nomes variam entre instalações da 3C Plus.
  speaking_time?: number | string;
  talk_time?: number | string;
  call_duration?: number | string;
  duration?: number | string;
  billed_time?: number | string;
  total_duration?: number | string;
  hangup_duration?: number | string;
}

// Extrai a duração (em segundos) do report, testando os campos conhecidos em
// ordem de preferência (tempo de fala → duração total → faturado).
function reportDurationSec(r: ThreeCplusReport): number | undefined {
  const candidates = [
    r.speaking_time,
    r.talk_time,
    r.call_duration,
    r.duration,
    r.total_duration,
    r.hangup_duration,
    r.billed_time,
  ];
  for (const v of candidates) {
    const n = typeof v === "string" ? Number(v) : v;
    if (typeof n === "number" && Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return undefined;
}

// Estima a duração da ligação (segundos) pela contagem de palavras da transcrição
// COMPLETA, disponível no momento da análise (antes de virar resumo). Garante que
// TODA ligação tenha um tempo não-zero quando a origem não informa a duração real.
// ~130 wpm (ritmo conversacional). É a base dos indicadores operacionais quando
// não há duração da 3C Plus.
function estimateDurationSec(transcript: string): number {
  const words = transcript.trim().split(/\s+/).filter(Boolean).length;
  return words > 0 ? Math.round((words / 130) * 60) : 0;
}

function toThreeCplusCall(r: ThreeCplusReport): ThreeCplusCall {
  return {
    id: String(r.id ?? r.sid ?? ""),
    sid: r.sid ?? "",
    agent: r.agent || "",
    number: maskPhone(r.number ?? ""),
    callDate: r.call_date_rfc3339 || r.call_date || "",
    campaign: r.campaign || "",
    queueName: r.queue_name || "",
    recorded: Boolean(r.recorded),
  };
}

// Filtro de duração da própria API 3C Plus: `minimum_duration`/`maximum_duration`
// (inteiros, em segundos) no GET /calls. Acrescenta os parâmetros quando > 0.
function appendDurationParams(params: URLSearchParams, minSec?: number, maxSec?: number): void {
  if (typeof minSec === "number" && minSec > 0) {
    params.set("minimum_duration", String(Math.round(minSec)));
  }
  if (typeof maxSec === "number" && maxSec > 0) {
    params.set("maximum_duration", String(Math.round(maxSec)));
  }
}

const ListThreeCplusInput = z.object({
  // Janela de datas no formato exigido pela 3C Plus (Y-m-d H:i:s). A API V2
  // EXIGE ambas as datas (start_date e end_date) — sem end_date retorna 422.
  startDate: z.string().min(1, "Informe a data inicial (AAAA-MM-DD)."),
  endDate: z.string().min(1, "Informe a data final (AAAA-MM-DD)."),
  perPage: z.number().int().positive().max(200).optional().default(50),
  // Filtro opcional de duração (segundos) repassado à API 3C Plus.
  minDurationSec: z.number().int().nonnegative().optional(),
  maxDurationSec: z.number().int().nonnegative().optional(),
  apiToken: z.string().optional().default(""),
});

// Lista as ligações da 3C Plus numa janela de datas (somente leitura), para que
// o analista escolha quais gravações auditar.
export const listThreeCplusCalls = createServerFn({ method: "GET" })
  .inputValidator(ListThreeCplusInput)
  .handler(async ({ data }): Promise<ThreeCplusCall[]> => {
    requireAuth();
    const token = resolveThreeCplusToken(data.apiToken);
    const params = new URLSearchParams({
      start_date: data.startDate,
      end_date: data.endDate,
      per_page: String(data.perPage),
      with_mailing: "false",
    });
    appendDurationParams(params, data.minDurationSec, data.maxDurationSec);
    const reports = await threeCplusGet<ThreeCplusReport[]>(`/calls?${params.toString()}`, token);
    const list = Array.isArray(reports) ? reports : [];
    return list.map(toThreeCplusCall);
  });

// Teste leve de conexão com a 3C Plus: valida o token e a conectividade SEM rodar
// uma ingestão inteira (busca no máximo 1 ligação numa janela recente). Também
// reporta se o Mangaba Voz (HF_TOKEN) está ativo, pois a ASR é obrigatória na
// ingestão real. Usado pelo botão "Testar conexão" em Configurações.
export const testThreeCplusConnection = createServerFn({ method: "POST" })
  .inputValidator(z.object({ apiToken: z.string().optional().default("") }).optional())
  .handler(
    async ({
      data,
    }): Promise<{ ok: boolean; sampleCount: number; voiceReady: boolean; message: string }> => {
      requireAuth();
      const token = resolveThreeCplusToken(data?.apiToken); // lança erro claro se ausente
      // Janela recente (7 dias) só para validar credencial + conectividade.
      const end = new Date();
      const start = new Date(end.getTime() - 7 * 24 * 3600 * 1000);
      const fmt = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
      const params = new URLSearchParams({
        start_date: fmt(start),
        end_date: fmt(end),
        per_page: "1",
        with_mailing: "false",
      });
      const reports = await threeCplusGet<ThreeCplusReport[]>(`/calls?${params.toString()}`, token);
      const sampleCount = Array.isArray(reports) ? reports.length : 0;
      const voiceReady = Boolean(process.env.HF_TOKEN);
      const parts = ["Conexão com a 3C Plus OK (token válido)."];
      parts.push(
        sampleCount > 0
          ? "Há ligações disponíveis na janela recente."
          : "Sem ligações nos últimos 7 dias — credencial válida mesmo assim.",
      );
      parts.push(
        voiceReady
          ? "Mangaba Voz (transcrição) ativo."
          : "ATENÇÃO: Mangaba Voz indisponível (HF_TOKEN ausente) — a ingestão real precisa dele.",
      );
      return { ok: true, sampleCount, voiceReady, message: parts.join(" ") };
    },
  );

const AnalyzeThreeCplusInput = z.object({
  callId: z.string().min(1, "Informe o ID (ou SID) da ligação na 3C Plus."),
  agentName: z.string().optional(),
  apiToken: z.string().optional().default(""),
});

// Busca uma ligação na 3C Plus, baixa a gravação, transcreve (Mangaba Voz),
// mascara PII (LGPD) e roda a auditoria — persistindo no store como as demais.
export const analyzeThreeCplusCall = createServerFn({ method: "POST" })
  .inputValidator(AnalyzeThreeCplusInput)
  .handler(async ({ data }): Promise<IngestAnalysis> => {
    requireAuth();
    const token = resolveThreeCplusToken(data.apiToken);

    // Relatório da ligação (best-effort): enriquece atendente/sid e confirma
    // que há gravação. Se falhar, seguimos só com o callId.
    let report: ThreeCplusReport | null = null;
    try {
      report = await threeCplusGet<ThreeCplusReport>(
        `/calls/${encodeURIComponent(data.callId)}`,
        token,
      );
    } catch {
      report = null;
    }
    if (report && report.recorded === false) {
      throw new Error("Esta ligação não possui gravação na 3C Plus.");
    }

    // Id canônico do report (o callId informado pode ser o SID, que não serve
    // para /recording → 404).
    const downloadId = report?.id != null ? String(report.id) : data.callId;
    const sid = report?.sid || data.callId;
    const label = `3C Plus · ${sid}`;
    const agentName = data.agentName?.trim() || report?.agent || undefined;

    // L2: mesma gravação + mesma ficha → reusa a análise inteira, SEM ASR nem
    // LLM (caso típico de re-auditoria). Só baixa/transcreve no cache miss.
    const criteria = await getActiveCriteria();
    const srcKey = `src:${downloadId}:${criteriaSig(criteria)}`;
    let analysis = await getCachedAnalysis(srcKey);
    let topicSource: string;
    // Duração: SEMPRE a real da 3C Plus quando o report a traz. Só estimamos pelo
    // DIÁLOGO COMPLETO no cache miss (onde a transcrição bruta existe). No cache
    // hit não há diálogo — não estimar pelo resumo (subestimaria ~10x); deixa
    // undefined e o dedup preserva o durationSec já gravado na 1ª análise.
    const realDuration = report ? reportDurationSec(report) : undefined;
    let durationSec: number | undefined = realDuration;
    if (analysis) {
      // Sem transcrição nova: classifica o tema pelo resumo da auditoria.
      topicSource = analysis.summary;
    } else {
      const hfToken = process.env.HF_TOKEN;
      if (!hfToken) {
        throw new Error("Transcrição de áudio requer a Mangaba AI ativa no servidor (HF_TOKEN).");
      }
      const { bytes, contentType } = await downloadThreeCplusRecording(downloadId, token);
      const asrModel = process.env.HF_ASR_MODEL || DEFAULT_ASR_MODEL;
      const rawTranscript = await transcribeAudio(bytes, contentType, hfToken, asrModel);
      // LGPD: mascara PII antes de auditar, persistir e exibir.
      const transcript = redactText(rawTranscript);
      if (transcript.trim().length < 20) {
        throw new Error("Transcrição muito curta para auditar.");
      }
      analysis = await analyzeTranscript(transcript);
      topicSource = transcript;
      durationSec = realDuration ?? estimateDurationSec(transcript);
      // Só cacheia análise REAL (Mangaba AI) — nunca o fallback degradado.
      if (analysis.source === "huggingface") await setCachedAnalysis(srcKey, analysis);
    }

    // Resumo da auditoria substitui a transcrição completa (não retemos o áudio).
    const auditSummary = buildAuditSummary(analysis);
    const stored = await recordAnalysis({
      analysis,
      origin: "audio",
      label,
      transcript: auditSummary,
      topicSource,
      agentName,
      sourceCallId: downloadId,
      callDate: report?.call_date_rfc3339 || report?.call_date,
      durationSec,
    });

    return {
      ...analysis,
      transcript: auditSummary,
      label,
      id: stored.id,
      protocol: stored.protocol,
    };
  });

const RecordingInput = z.object({
  callId: z.string().min(1, "Informe o ID (ou SID) da ligação na 3C Plus."),
  apiToken: z.string().optional().default(""),
});

// Baixa a gravação a partir do handle salvo (id OU sid). Registros antigos
// guardaram o SID — que pode não servir para /recording (404). Consultamos o
// report e tentamos os identificadores candidatos (id canônico, sid e o id
// extraído da URL `recording`) até um funcionar. O erro final lista o que foi
// tentado, para diagnóstico.
// Hosts conhecidos da API 3C Plus (base oficial do SDK + variações observadas).
const THREECPLUS_API_HOSTS = [
  "https://3c.fluxoti.com/api/v1",
  "https://app.3c.fluxoti.com/api/v1",
  "https://app.3c.plus/api/v1",
];

type AudioResult = { bytes: Uint8Array; contentType: string };

// Tenta UMA requisição de áudio. Retorna o áudio (ok) ou uma string de status
// curta (falha). Trata: 200 vazio, JSON com URL embutida (segue 1 nível), e
// content-type não-áudio. NÃO relança — devolve o status para a matriz seguir.
async function tryAudioRequest(
  url: string,
  headers: Record<string, string>,
  token: string,
  followJson = true,
): Promise<AudioResult | { fail: string }> {
  let res: Response;
  try {
    res = await fetch(url, { headers, redirect: "follow" });
  } catch (e) {
    return { fail: `neterr:${e instanceof Error ? e.message.slice(0, 40) : "?"}` };
  }
  if (!res.ok) {
    const body = (await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 90);
    return { fail: `${res.status}:${body}` };
  }
  const contentType = res.headers.get("content-type") || "application/octet-stream";
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength === 0) return { fail: "200-vazio" };
  // 200 com JSON: provável wrapper com a URL de download — segue 1 nível.
  if (/json/i.test(contentType)) {
    if (!followJson) return { fail: "200-json" };
    try {
      const obj = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
      const inner =
        (obj.url as string) ||
        (obj.recording as string) ||
        (obj.link as string) ||
        ((obj.data as Record<string, unknown>)?.url as string) ||
        "";
      if (inner && /^https?:\/\//i.test(inner)) {
        return tryAudioRequest(maybeAppendToken(inner, token), headers, token, false);
      }
    } catch {
      /* não era JSON utilizável */
    }
    return { fail: "200-json-sem-url" };
  }
  if (bytes.byteLength > MAX_AUDIO_BYTES) return { fail: "acima-do-limite" };
  return { bytes, contentType };
}

function maybeAppendToken(url: string, token: string): string {
  const is3c = /(3c\.plus|fluxoti\.com)/i.test(url);
  if (is3c && !/[?&]api_token=/.test(url)) return withApiToken(url, token);
  return url;
}

// Estratégia ROBUSTA de download: monta uma matriz de tentativas (campo
// `recording` do report + hosts × ids × `original` × auth), ordenada por
// probabilidade, e para no primeiro sucesso. Backoff em rate limit (422 "muitas
// requisições"). No fim, erro com o status de cada tentativa (diagnóstico).
async function downloadRecordingByHandle(handle: string, token: string): Promise<AudioResult> {
  let report: ThreeCplusReport | null = null;
  try {
    report = await threeCplusGet<ThreeCplusReport>(`/calls/${encodeURIComponent(handle)}`, token);
  } catch {
    report = null;
  }

  const ids = [...new Set(
    [report?.id, report?.telephony_id, report?.sid, handle]
      .map((v) => (v == null ? "" : String(v).trim()))
      .filter(Boolean),
  )];
  const recUrl = report?.recording?.trim();
  const bearer = { Accept: "*/*", Authorization: `Bearer ${token}` };
  const plain = { Accept: "*/*" };

  type Attempt = { label: string; url: string; headers: Record<string, string> };
  const attempts: Attempt[] = [];

  // 1) Campo `recording` do report (com token, como está, e com Bearer).
  if (recUrl && /^https?:\/\//i.test(recUrl)) {
    attempts.push({ label: "rec-field+token", url: maybeAppendToken(recUrl, token), headers: plain });
    attempts.push({ label: "rec-field-asis", url: recUrl, headers: plain });
    attempts.push({ label: "rec-field+bearer", url: recUrl, headers: bearer });
  }

  // 2) Matriz endpoint: original=true primeiro (sem ele a API tenta conversão
  //    inexistente → 404), depois sem; query api_token e depois Bearer.
  for (const id of ids) {
    for (const host of THREECPLUS_API_HOSTS) {
      const path = `${host}/calls/${encodeURIComponent(id)}/recording`;
      attempts.push({ label: `${host.replace(/^https:\/\//, "")}|${id}|orig|q`, url: `${path}?original=true&api_token=${encodeURIComponent(token)}`, headers: plain });
      attempts.push({ label: `${host.replace(/^https:\/\//, "")}|${id}|q`, url: withApiToken(path, token), headers: plain });
      attempts.push({ label: `${host.replace(/^https:\/\//, "")}|${id}|orig|bearer`, url: `${path}?original=true`, headers: bearer });
    }
  }

  // Dedupe por (url + auth) e limita a 16 tentativas.
  const seen = new Set<string>();
  const unique = attempts
    .filter((a) => {
      const k = a.url + (a.headers.Authorization || "");
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 16);

  const log: string[] = [];
  for (const a of unique) {
    let r = await tryAudioRequest(a.url, a.headers, token);
    // Rate limit: aguarda ~5 s e tenta a MESMA uma vez.
    if ("fail" in r && /^422:.*muitas requi/i.test(r.fail)) {
      await new Promise((res) => setTimeout(res, 5200));
      r = await tryAudioRequest(a.url, a.headers, token);
    }
    if (!("fail" in r)) return r;
    log.push(`${a.label}→${r.fail}`);
  }

  const reportInfo = report
    ? `report{id=${report.id ?? "-"}, telephony_id=${report.telephony_id ?? "-"}, recorded=${report.recorded ?? "-"}, recording=${recUrl ? "presente" : "(vazio)"}}`
    : "report=null";
  throw new Error(
    `Não foi possível baixar a gravação na 3C Plus após ${unique.length} estratégias. ${reportInfo}. ${log.join(" | ")}`,
  );
}

// Baixa a gravação de uma ligação 3C Plus e devolve o áudio em base64 para o
// player da aba Áudios. ATENÇÃO: expõe o áudio cru (voz do cliente = PII), então
// exige sessão autenticada como defesa-em-profundidade. O download é feito no
// servidor (token nunca vai ao cliente) e o áudio é tocado on-demand.
export const getThreeCplusRecording = createServerFn({ method: "POST" })
  .inputValidator(RecordingInput)
  .handler(async ({ data }): Promise<{ base64: string; contentType: string }> => {
    if (isGateEnabled() && !isAuthenticated()) {
      throw new Error("Sessão necessária para ouvir a gravação.");
    }
    const token = resolveThreeCplusToken(data.apiToken);
    const { bytes, contentType } = await downloadRecordingByHandle(data.callId, token);
    const base64 = Buffer.from(bytes).toString("base64");
    return { base64, contentType: contentType || "audio/mpeg" };
  });

// Metadados de uma ligação na 3C Plus (atendente, número mascarado, data,
// campanha, fila) — usados para exibir os áudios do acervo "como no 3C Plus".
// Só leitura; telefone já vem mascarado por toThreeCplusCall.
export const getThreeCplusCallMeta = createServerFn({ method: "POST" })
  .inputValidator(RecordingInput)
  .handler(async ({ data }): Promise<ThreeCplusCall | null> => {
    if (isGateEnabled() && !isAuthenticated()) {
      throw new Error("Sessão necessária para consultar a ligação.");
    }
    const token = resolveThreeCplusToken(data.apiToken);
    try {
      const report = await threeCplusGet<ThreeCplusReport>(
        `/calls/${encodeURIComponent(data.callId)}`,
        token,
      );
      return toThreeCplusCall(report);
    } catch {
      return null;
    }
  });

// ---------------------------------------------------------------------------
// Ingestão em LOTE da 3C Plus: alimenta o store com ligações REAIS.
//
// Lista as ligações de uma janela de datas (somente as que têm gravação), baixa
// o áudio, transcreve (Mangaba Voz), mascara PII (LGPD), audita e persiste cada
// uma — exatamente o mesmo pipeline da análise avulsa, só que em série. É o
// caminho para que a fonte de dados do dashboard seja a própria API da 3C Plus,
// sem nenhum dado fabricado.
//
// A 3C Plus limita downloads de gravação (~1 a cada 5 s) e alguns nós devolvem
// 404 intermitente: por isso processamos SEQUENCIALMENTE e isolamos falhas por
// ligação (uma que falhe não derruba o lote). O teto de `limit` segura o tempo
// total da requisição serverless.
// ---------------------------------------------------------------------------

// Banda de duração padrão (segundos) para "ligações de ~3 min": 2:30 a 4:00,
// centrada em 3:00. A própria API 3C Plus filtra por minimum/maximum_duration.
const DEFAULT_MIN_DURATION_SEC = 150;
const DEFAULT_MAX_DURATION_SEC = 240;

const IngestThreeCplusBatchInput = z.object({
  startDate: z.string().min(1, "Informe a data inicial (AAAA-MM-DD HH:mm:ss)."),
  endDate: z.string().min(1, "Informe a data final (AAAA-MM-DD HH:mm:ss)."),
  // Teto de ligações auditadas por lote. Baixo por padrão: cada item gasta
  // ~5 s de rate limit + transcrição + auditoria.
  limit: z.number().int().positive().max(25).optional().default(8),
  // Filtro de duração (segundos). Padrão: faixa de ~3 min (150–240s).
  minDurationSec: z.number().int().nonnegative().optional().default(DEFAULT_MIN_DURATION_SEC),
  maxDurationSec: z.number().int().nonnegative().optional().default(DEFAULT_MAX_DURATION_SEC),
  apiToken: z.string().optional().default(""),
});

export interface ThreeCplusBatchResult {
  // Ligações COM gravação encontradas na janela (antes do corte por `limit`).
  recordedFound: number;
  // Quantas foram efetivamente processadas (recordedFound limitado por `limit`).
  attempted: number;
  ingested: number;
  skipped: number;
  errors: { callId: string; message: string }[];
  // Total de análises no store após a ingestão.
  total: number;
}

export const ingestThreeCplusBatch = createServerFn({ method: "POST" })
  .inputValidator(IngestThreeCplusBatchInput)
  .handler(async ({ data }): Promise<ThreeCplusBatchResult> => {
    requireAuth();
    const token = resolveThreeCplusToken(data.apiToken);
    const hfToken = process.env.HF_TOKEN;
    if (!hfToken) {
      throw new Error(
        "Ingestão da 3C Plus requer a Mangaba AI ativa no servidor (HF_TOKEN) para transcrever as gravações.",
      );
    }

    const params = new URLSearchParams({
      start_date: data.startDate,
      end_date: data.endDate,
      per_page: "200",
      with_mailing: "false",
    });
    appendDurationParams(params, data.minDurationSec, data.maxDurationSec);
    const reports = await threeCplusGet<ThreeCplusReport[]>(`/calls?${params.toString()}`, token);
    const list = Array.isArray(reports) ? reports : [];
    const recorded = list.filter((r) => r.recorded);
    const targets = recorded.slice(0, data.limit);

    const asrModel = process.env.HF_ASR_MODEL || DEFAULT_ASR_MODEL;
    let ingested = 0;
    const errors: { callId: string; message: string }[] = [];

    // Sequencial de propósito: respeita o rate limit de download da 3C Plus.
    for (const r of targets) {
      const callId = String(r.id ?? r.sid ?? "");
      if (!callId) continue;
      try {
        const { bytes, contentType } = await downloadThreeCplusRecording(callId, token);
        const rawTranscript = await transcribeAudio(bytes, contentType, hfToken, asrModel);
        const transcript = redactText(rawTranscript);
        if (transcript.trim().length < 20) {
          throw new Error("Transcrição muito curta para auditar.");
        }
        const analysis = await analyzeTranscript(transcript);
        const auditSummary = buildAuditSummary(analysis);
        const sid = r.sid || callId;
        await recordAnalysis({
          analysis,
          origin: "audio",
          label: `3C Plus · ${sid}`,
          transcript: auditSummary,
          topicSource: transcript,
          agentName: r.agent || undefined,
          sourceCallId: callId,
          callDate: r.call_date_rfc3339 || r.call_date,
          durationSec: reportDurationSec(r) || estimateDurationSec(transcript),
        });
        ingested++;
      } catch (error) {
        errors.push({
          callId,
          message: error instanceof Error ? error.message : "erro desconhecido",
        });
      }
    }

    const total = (await listCalls()).length;
    return {
      recordedFound: recorded.length,
      attempted: targets.length,
      ingested,
      skipped: targets.length - ingested,
      errors,
      total,
    };
  });
