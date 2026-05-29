import { createServerFn } from "@tanstack/react-start";
import process from "node:process";
import { z } from "zod";

import {
  COMPLIANCE_CHECKLIST,
  type CallAnalysis,
  type CallObservation,
  type ComplianceCheck,
  type Sentiment,
} from "../compliance";
import { recordAnalysis } from "../server/calls-store.server";

// HuggingFace Inference Providers expose an OpenAI-compatible chat endpoint.
const HF_ROUTER_URL = "https://router.huggingface.co/v1/chat/completions";
const DEFAULT_MODEL = "meta-llama/Llama-3.1-8B-Instruct";

// Automatic Speech Recognition (transcrição) via HuggingFace Inference.
const HF_ASR_URL_BASE = "https://router.huggingface.co/hf-inference/models/";
const DEFAULT_ASR_MODEL = "openai/whisper-large-v3";
// Limite defensivo de tamanho do áudio enviado (25 MB).
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

const SYSTEM_PROMPT = `Você é um auditor de compliance e qualidade de ligações de call center da operadora Vivo.
Analise a transcrição fornecida e responda APENAS com um objeto JSON válido (sem markdown, sem texto extra) no formato:
{
  "scoreCompliance": <0-100>,
  "scoreQuality": <0-100>,
  "sentiment": "positivo" | "neutro" | "negativo",
  "summary": "<resumo de 1-2 frases em português>",
  "checks": [{ "label": "<item da checklist>", "passed": <bool>, "score": <0-100>, "evidence": "<trecho ou justificativa>" }],
  "observations": [{ "time": "mm:ss", "note": "<observação>", "severity": "ok" | "warning" | "critical" }]
}
A lista "checks" deve conter exatamente um item para cada um destes rótulos, na mesma ordem:
${COMPLIANCE_CHECKLIST.map((c) => `- ${c}`).join("\n")}
Seja rigoroso: penalize ausência de identificação, falta de aviso de gravação, ausência de consentimento LGPD, e omissão de custos/multas.`;

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

function normalizeChecks(checks: ComplianceCheck[]): ComplianceCheck[] {
  // Garante um item por rótulo da checklist, na ordem canônica. O modelo pode
  // parafrasear ou reordenar rótulos, então casa por rótulo e, se falhar,
  // recorre à posição (instruímos a mesma ordem da checklist).
  const byLabel = new Map(checks.map((c) => [c.label.trim().toLowerCase(), c]));
  return COMPLIANCE_CHECKLIST.map((label, i) => {
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
): Promise<CallAnalysis> {
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
        { role: "system", content: SYSTEM_PROMPT },
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
  const checks = normalizeChecks(parsed.checks as ComplianceCheck[]);
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

// Fallback determinístico por palavras-chave: mantém o MVP funcional sem token.
function analyzeHeuristic(transcript: string): CallAnalysis {
  const t = transcript.toLowerCase();
  const has = (...terms: string[]) => terms.some((term) => t.includes(term));

  const rules: { label: string; passed: boolean; evidence: string }[] = [
    { label: COMPLIANCE_CHECKLIST[0], passed: has("aqui é", "meu nome", "falo com", "atendente"), evidence: "Procura por apresentação do atendente." },
    { label: COMPLIANCE_CHECKLIST[1], passed: has("gravada", "gravação", "está sendo gravad"), evidence: "Procura por aviso de gravação." },
    { label: COMPLIANCE_CHECKLIST[2], passed: has("cpf", "confirma seu", "data de nascimento", "dados cadastrais"), evidence: "Procura por confirmação cadastral." },
    { label: COMPLIANCE_CHECKLIST[3], passed: has("lgpd", "consentimento", "uso dos seus dados", "autoriza"), evidence: "Procura por consentimento LGPD." },
    { label: COMPLIANCE_CHECKLIST[4], passed: has("plano", "oferta", "produto", "serviço", "r$"), evidence: "Procura por oferta clara." },
    { label: COMPLIANCE_CHECKLIST[5], passed: has("prazo", "multa", "custo", "valor", "r$", "48 horas"), evidence: "Procura por prazos e custos." },
    { label: COMPLIANCE_CHECKLIST[6], passed: has("protocolo", "resumo", "vv-"), evidence: "Procura por protocolo/resumo final." },
    { label: COMPLIANCE_CHECKLIST[7], passed: has("bom dia", "boa tarde", "tenha um", "obrigad", "mais alguma coisa"), evidence: "Procura por encerramento cordial." },
  ];

  const checks: ComplianceCheck[] = rules.map((r) => ({
    label: r.label,
    passed: r.passed,
    score: r.passed ? 90 : 35,
    evidence: r.evidence,
  }));

  const scoreCompliance = clampScore(
    checks.reduce((acc, c) => acc + c.score, 0) / checks.length,
  );

  const negativeMarkers = ["absurd", "irritad", "reclam", "péssim", "horrível", "cancelar", "raiva"];
  const positiveMarkers = ["obrigado", "ótimo", "perfeito", "resolvido", "satisfeit"];
  const negHits = negativeMarkers.filter((m) => t.includes(m)).length;
  const posHits = positiveMarkers.filter((m) => t.includes(m)).length;
  const sentiment: Sentiment = negHits > posHits ? "negativo" : posHits > negHits ? "positivo" : "neutro";

  const scoreQuality = clampScore(scoreCompliance - negHits * 8 + posHits * 5);

  const observations: CallObservation[] = [];
  if (!checks[1].passed) {
    observations.push({ agent: "Mangaba Básico", time: "00:00", note: "Aviso de gravação da ligação não foi detectado.", severity: "warning" });
  }
  if (!checks[3].passed) {
    observations.push({ agent: "Mangaba Básico", time: "00:00", note: "Consentimento LGPD para uso de dados não foi detectado.", severity: "critical" });
  }
  if (sentiment === "negativo") {
    observations.push({ agent: "Mangaba Sentimento", time: "—", note: "Sinais de insatisfação do cliente detectados na transcrição.", severity: "warning" });
  }
  if (checks[6].passed) {
    observations.push({ agent: "Mangaba Básico", time: "—", note: "Número de protocolo informado corretamente.", severity: "ok" });
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

  if (!token) {
    return analyzeHeuristic(transcript);
  }

  try {
    return await analyzeWithHuggingFace(transcript, token, model);
  } catch (error) {
    console.error("Falha na análise HuggingFace, usando heurística:", error);
    const fallback = analyzeHeuristic(transcript);
    fallback.summary = `Falha ao acionar a Mangaba AI — exibindo análise do Mangaba Básico. (${
      error instanceof Error ? error.message : "erro desconhecido"
    })`;
    return fallback;
  }
}

// Transcrição (ASR) de áudio binário via Whisper na HuggingFace Inference.
async function transcribeAudio(
  bytes: Uint8Array,
  contentType: string,
  token: string,
  model: string,
): Promise<string> {
  const res = await fetch(`${HF_ASR_URL_BASE}${model}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": contentType || "application/octet-stream",
    },
    // Uint8Array é um BodyInit válido em runtime (Node/Workers); o cast satisfaz
    // a tipagem estrita do lib.dom de fetch.
    body: bytes as unknown as BodyInit,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Mangaba Voz ${res.status}: ${detail.slice(0, 300)}`);
  }

  const payload = (await res.json()) as { text?: string };
  const text = payload.text?.trim();
  if (!text) throw new Error("Transcrição vazia retornada pelo modelo ASR.");
  return text;
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
    const analysis = await analyzeTranscript(data.transcript);
    const stored = await recordAnalysis({ analysis, origin: "texto", label: "Transcrição manual", transcript: data.transcript, agentName: data.agentName });
    return { ...analysis, id: stored.id, protocol: stored.protocol };
  });

const AnalyzeAudioInput = z.object({
  filename: z.string().min(1),
  mimeType: z.string().optional().default(""),
  base64: z.string().min(1, "Áudio vazio."),
  agentName: z.string().optional(),
});

export type AudioAnalysis = CallAnalysis & { transcript: string; filename: string; id: string; protocol: string };

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
    const transcript = await transcribeAudio(
      bytes,
      data.mimeType,
      token,
      asrModel,
    );
    const analysis = await analyzeTranscript(transcript);
    const stored = await recordAnalysis({ analysis, origin: "audio", label: data.filename, transcript, agentName: data.agentName });

    return { ...analysis, transcript, filename: data.filename, id: stored.id, protocol: stored.protocol };
  });
