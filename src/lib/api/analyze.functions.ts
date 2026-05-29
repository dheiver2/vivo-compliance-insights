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

// HuggingFace Inference Providers expose an OpenAI-compatible chat endpoint.
const HF_ROUTER_URL = "https://router.huggingface.co/v1/chat/completions";
const DEFAULT_MODEL = "meta-llama/Llama-3.1-8B-Instruct";

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
    throw new Error(`HuggingFace ${res.status}: ${detail.slice(0, 300)}`);
  }

  const payload = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("Resposta vazia do modelo.");

  const parsed = ModelResponseSchema.parse(extractJson(content));
  const checks = normalizeChecks(parsed.checks as ComplianceCheck[]);
  const observations: CallObservation[] = parsed.observations.map((o) => ({
    agent: "Compliance-Bot (HF)",
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
    observations.push({ agent: "Compliance-Bot (heurística)", time: "00:00", note: "Aviso de gravação da ligação não foi detectado.", severity: "warning" });
  }
  if (!checks[3].passed) {
    observations.push({ agent: "Compliance-Bot (heurística)", time: "00:00", note: "Consentimento LGPD para uso de dados não foi detectado.", severity: "critical" });
  }
  if (sentiment === "negativo") {
    observations.push({ agent: "Sentiment-Bot (heurística)", time: "—", note: "Sinais de insatisfação do cliente detectados na transcrição.", severity: "warning" });
  }
  if (checks[6].passed) {
    observations.push({ agent: "Compliance-Bot (heurística)", time: "—", note: "Número de protocolo informado corretamente.", severity: "ok" });
  }

  return {
    scoreCompliance,
    scoreQuality,
    sentiment,
    summary: "Análise heurística local (sem chamada ao modelo). Configure HF_TOKEN para análise por IA.",
    checks,
    observations,
    source: "heuristic",
  };
}

export const analyzeCall = createServerFn({ method: "POST" })
  .inputValidator(z.object({ transcript: z.string().min(20, "Transcrição muito curta.") }))
  .handler(async ({ data }): Promise<CallAnalysis> => {
    const token = process.env.HF_TOKEN;
    const model = process.env.HF_MODEL || DEFAULT_MODEL;

    if (!token) {
      return analyzeHeuristic(data.transcript);
    }

    try {
      return await analyzeWithHuggingFace(data.transcript, token, model);
    } catch (error) {
      console.error("Falha na análise HuggingFace, usando heurística:", error);
      const fallback = analyzeHeuristic(data.transcript);
      fallback.summary = `Falha ao chamar o modelo HuggingFace — exibindo análise heurística. (${
        error instanceof Error ? error.message : "erro desconhecido"
      })`;
      return fallback;
    }
  });
