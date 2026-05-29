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
import { recordAnalysis } from "../server/calls-store.server";
import {
  getActiveCriteria,
  type MonitoringCriterion,
} from "../server/monitoring-form.server";

// HuggingFace Inference Providers expose an OpenAI-compatible chat endpoint.
const HF_ROUTER_URL = "https://router.huggingface.co/v1/chat/completions";
const DEFAULT_MODEL = "meta-llama/Llama-3.1-8B-Instruct";

// Automatic Speech Recognition (transcrição) via HuggingFace Inference.
const HF_ASR_URL_BASE = "https://router.huggingface.co/hf-inference/models/";
const DEFAULT_ASR_MODEL = "openai/whisper-large-v3";
// Limite defensivo de tamanho do áudio enviado (25 MB).
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

// O prompt é montado a partir da Ficha de Monitoria vigente (gerida pelo
// analista). Cada critério ativo vira um item da checklist, com sua descrição
// e marcação de criticidade — assim a IA avalia exatamente o que o analista
// configurou.
function buildSystemPrompt(criteria: MonitoringCriterion[]): string {
  const items = criteria
    .map((c) => `- ${c.label}${c.critical ? " [CRÍTICO]" : ""}${c.description ? `: ${c.description}` : ""}`)
    .join("\n");
  return `Você é um auditor de compliance e qualidade de ligações de call center da operadora Vivo.
Analise a transcrição fornecida e responda APENAS com um objeto JSON válido (sem markdown, sem texto extra) no formato:
{
  "scoreCompliance": <0-100>,
  "scoreQuality": <0-100>,
  "sentiment": "positivo" | "neutro" | "negativo",
  "summary": "<resumo de 1-2 frases em português>",
  "checks": [{ "label": "<item da checklist>", "passed": <bool>, "score": <0-100>, "evidence": "<trecho ou justificativa>" }],
  "observations": [{ "time": "mm:ss", "note": "<observação>", "severity": "ok" | "warning" | "critical" }]
}
A lista "checks" deve conter exatamente um item para cada um destes critérios da Ficha de Monitoria, na mesma ordem:
${items}
Seja rigoroso: itens marcados como [CRÍTICO] representam risco regulatório e devem reduzir bastante o scoreCompliance quando não cumpridos.`;
}

const SentimentSchema = z.enum(["positivo", "neutro", "negativo"]);
const ModelCheckSchema = z.object({
  label: z.string(),
  passed: z.boolean(),
  score: z.number(),
  evidence: z.string().optional().default(""),
});
const ModelObsSchema = z.object({
  time: z.string().optional().default("—"),
  note: z.string(),
  severity: z.enum(["ok", "warning", "critical"]).optional().default("warning"),
});
const ModelResponseSchema = z.object({
  scoreCompliance: z.number(),
  scoreQuality: z.number(),
  sentiment: SentimentSchema,
  summary: z.string(),
  checks: z.array(ModelCheckSchema).optional().default([]),
  observations: z.array(ModelObsSchema).optional().default([]),
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

function normalizeChecks(checks: ComplianceCheck[], labels: string[]): ComplianceCheck[] {
  // Garante um item por rótulo da ficha, na ordem configurada. O modelo pode
  // parafrasear ou reordenar rótulos, então casa por rótulo e, se falhar,
  // recorre à posição (instruímos a mesma ordem da ficha).
  const byLabel = new Map(checks.map((c) => [c.label.trim().toLowerCase(), c]));
  return labels.map((label, i) => {
    const found = byLabel.get(label.toLowerCase()) ?? checks[i];
    if (found) {
      return {
        label,
        passed: Boolean(found.passed),
        score: clampScore(found.score),
        evidence: found.evidence ?? "",
      };
    }
    return { label, passed: false, score: 0, evidence: "Não avaliado pelo modelo." };
  });
}

async function analyzeWithHuggingFace(
  transcript: string,
  token: string,
  model: string,
  criteria: MonitoringCriterion[],
): Promise<CallAnalysis> {
  const labels = criteria.map((c) => c.label);
  const res = await fetch(HF_ROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 1500,
      messages: [
        { role: "system", content: buildSystemPrompt(criteria) },
        { role: "user", content: `Transcrição da ligação:\n\n${transcript}` },
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
  const checks = normalizeChecks(parsed.checks as ComplianceCheck[], labels);
  const observations: CallObservation[] = parsed.observations.map((o) => ({
    agent: "Mangaba Compliance",
    time: o.time || "—",
    note: o.note,
    severity: o.severity,
  }));

  return {
    scoreCompliance: clampScore(parsed.scoreCompliance),
    scoreQuality: clampScore(parsed.scoreQuality),
    sentiment: parsed.sentiment,
    summary: parsed.summary,
    checks,
    observations,
    source: "huggingface",
    model,
  };
}

// Regras de palavra-chave por rótulo CANÔNICO da ficha padrão. Critérios
// personalizados (sem regra) recebem uma verificação neutra no modo local.
const HEURISTIC_RULES: Record<string, { terms: string[]; evidence: string }> = {
  "Identificação do atendente": { terms: ["aqui é", "meu nome", "falo com", "atendente"], evidence: "Procura por apresentação do atendente." },
  "Gravação informada ao cliente": { terms: ["gravada", "gravação", "está sendo gravad"], evidence: "Procura por aviso de gravação." },
  "Confirmação de dados cadastrais": { terms: ["cpf", "confirma seu", "data de nascimento", "dados cadastrais"], evidence: "Procura por confirmação cadastral." },
  "Consentimento LGPD para uso de dados": { terms: ["lgpd", "consentimento", "uso dos seus dados", "autoriza"], evidence: "Procura por consentimento LGPD." },
  "Oferta clara de produto/serviço": { terms: ["plano", "oferta", "produto", "serviço", "r$"], evidence: "Procura por oferta clara." },
  "Comunicação de prazos e custos": { terms: ["prazo", "multa", "custo", "valor", "r$", "48 horas"], evidence: "Procura por prazos e custos." },
  "Resumo final e número de protocolo": { terms: ["protocolo", "resumo", "vv-"], evidence: "Procura por protocolo/resumo final." },
  "Encerramento cordial": { terms: ["bom dia", "boa tarde", "tenha um", "obrigad", "mais alguma coisa"], evidence: "Procura por encerramento cordial." },
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
      return { label: c.label, passed: true, score: 60, evidence: "Critério personalizado — avaliação detalhada requer a Mangaba AI." };
    }
    const passed = has(...rule.terms);
    return { label: c.label, passed, score: passed ? 90 : 35, evidence: rule.evidence };
  });

  const scoreCompliance = clampScore(
    checks.length ? checks.reduce((acc, c) => acc + c.score, 0) / checks.length : 0,
  );

  const negativeMarkers = ["absurd", "irritad", "reclam", "péssim", "horrível", "cancelar", "raiva"];
  const positiveMarkers = ["obrigado", "ótimo", "perfeito", "resolvido", "satisfeit"];
  const negHits = negativeMarkers.filter((m) => t.includes(m)).length;
  const posHits = positiveMarkers.filter((m) => t.includes(m)).length;
  const sentiment: Sentiment = negHits > posHits ? "negativo" : posHits > negHits ? "positivo" : "neutro";

  const scoreQuality = clampScore(scoreCompliance - negHits * 8 + posHits * 5);

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
    observations.push({ agent: "Mangaba Sentimento", time: "—", note: "Sinais de insatisfação do cliente detectados na transcrição.", severity: "warning" });
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

// Núcleo reutilizável: decide entre IA (HuggingFace) e heurística local.
async function analyzeTranscript(transcript: string): Promise<CallAnalysis> {
  const token = process.env.HF_TOKEN;
  const model = process.env.HF_MODEL || DEFAULT_MODEL;
  // Ficha de Monitoria vigente (critérios ativos definidos pelo analista).
  const criteria = await getActiveCriteria();

  if (!token) {
    return analyzeHeuristic(transcript, criteria);
  }

  try {
    return await analyzeWithHuggingFace(transcript, token, model, criteria);
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
    // LGPD: mascara PII (CPF, CNPJ, cartão, telefone, e-mail) ANTES de enviar à
    // IA externa, persistir e exibir. O mesmo texto redigido flui por tudo.
    const transcript = redactText(data.transcript);
    const analysis = await analyzeTranscript(transcript);
    const stored = await recordAnalysis({ analysis, origin: "texto", label: "Transcrição manual", transcript, agentName: data.agentName });
    return { ...analysis, id: stored.id, protocol: stored.protocol };
  });

const AnalyzeAudioInput = z.object({
  filename: z.string().min(1),
  mimeType: z.string().optional().default(""),
  base64: z.string().min(1, "Áudio vazio."),
  agentName: z.string().optional(),
});

export type AudioAnalysis = CallAnalysis & { transcript: string; filename: string; id: string; protocol: string };

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
    const stored = await recordAnalysis({
      analysis,
      origin,
      label,
      transcript,
      agentName: data.agentName,
    });

    return { ...analysis, transcript, label, id: stored.id, protocol: stored.protocol };
  });

export const analyzeAudio = createServerFn({ method: "POST" })
  .inputValidator(AnalyzeAudioInput)
  .handler(async ({ data }): Promise<AudioAnalysis> => {
    const token = process.env.HF_TOKEN;
    if (!token) {
      throw new Error(
        "Transcrição de áudio requer a Mangaba AI ativa no servidor.",
      );
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
    const rawTranscript = await transcribeAudio(
      bytes,
      data.mimeType,
      token,
      asrModel,
    );
    // LGPD: mascara PII pós-ASR antes de auditar, persistir e devolver.
    const transcript = redactText(rawTranscript);
    const analysis = await analyzeTranscript(transcript);
    const stored = await recordAnalysis({ analysis, origin: "audio", label: data.filename, transcript, agentName: data.agentName });

    return { ...analysis, transcript, filename: data.filename, id: stored.id, protocol: stored.protocol };
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
async function threeCplusGet<T>(path: string, token: string): Promise<T> {
  const url = withApiToken(`${THREECPLUS_BASE}${path}`, token);
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: "application/json" } });
  } catch (error) {
    throw new Error(
      `Falha ao acessar a 3C Plus: ${error instanceof Error ? error.message : "erro de rede"}`,
    );
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`3C Plus ${res.status}: ${detail.slice(0, 200)}`);
  }
  const payload = (await res.json()) as { data?: T } & T;
  return (payload?.data ?? payload) as T;
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
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const url = withApiToken(
    `${THREECPLUS_BASE}/calls/${encodeURIComponent(callId)}/recording`,
    token,
  );
  const maxAttempts = 6;
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
    lastDetail = (await res.text().catch(() => "")).slice(0, 160);
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

const ListThreeCplusInput = z.object({
  // Janela de datas no formato exigido pela 3C Plus (Y-m-d H:i:s). A API V2
  // EXIGE ambas as datas (start_date e end_date) — sem end_date retorna 422.
  startDate: z.string().min(1, "Informe a data inicial (AAAA-MM-DD)."),
  endDate: z.string().min(1, "Informe a data final (AAAA-MM-DD)."),
  perPage: z.number().int().positive().max(200).optional().default(50),
  apiToken: z.string().optional().default(""),
});

// Lista as ligações da 3C Plus numa janela de datas (somente leitura), para que
// o analista escolha quais gravações auditar.
export const listThreeCplusCalls = createServerFn({ method: "GET" })
  .inputValidator(ListThreeCplusInput)
  .handler(async ({ data }): Promise<ThreeCplusCall[]> => {
    const token = resolveThreeCplusToken(data.apiToken);
    const params = new URLSearchParams({
      start_date: data.startDate,
      end_date: data.endDate,
      per_page: String(data.perPage),
      with_mailing: "false",
    });
    const reports = await threeCplusGet<ThreeCplusReport[]>(`/calls?${params.toString()}`, token);
    const list = Array.isArray(reports) ? reports : [];
    return list.map(toThreeCplusCall);
  });

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
    const token = resolveThreeCplusToken(data.apiToken);

    // Relatório da ligação (best-effort): enriquece atendente/sid e confirma
    // que há gravação. Se falhar, seguimos só com o callId.
    let report: ThreeCplusReport | null = null;
    try {
      report = await threeCplusGet<ThreeCplusReport>(`/calls/${encodeURIComponent(data.callId)}`, token);
    } catch {
      report = null;
    }
    if (report && report.recorded === false) {
      throw new Error("Esta ligação não possui gravação na 3C Plus.");
    }

    const hfToken = process.env.HF_TOKEN;
    if (!hfToken) {
      throw new Error("Transcrição de áudio requer a Mangaba AI ativa no servidor (HF_TOKEN).");
    }

    // Baixa o áudio pelo endpoint de gravação (host de THREECPLUS_BASE; trata
    // rate limit e ligações sem áudio internamente).
    const { bytes, contentType } = await downloadThreeCplusRecording(data.callId, token);
    const asrModel = process.env.HF_ASR_MODEL || DEFAULT_ASR_MODEL;
    const rawTranscript = await transcribeAudio(bytes, contentType, hfToken, asrModel);

    // LGPD: mascara PII antes de auditar, persistir e exibir.
    const transcript = redactText(rawTranscript);
    if (transcript.trim().length < 20) {
      throw new Error("Transcrição muito curta para auditar.");
    }

    const sid = report?.sid || data.callId;
    const label = `3C Plus · ${sid}`;
    const agentName = data.agentName?.trim() || report?.agent || undefined;

    const analysis = await analyzeTranscript(transcript);
    const stored = await recordAnalysis({ analysis, origin: "audio", label, transcript, agentName });

    return { ...analysis, transcript, label, id: stored.id, protocol: stored.protocol };
  });
