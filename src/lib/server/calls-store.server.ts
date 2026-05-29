// Repositório server-only das análises realizadas. O sufixo .server.ts garante
// que este módulo NUNCA é embarcado no bundle do cliente.
//
// PERSISTÊNCIA (backend escolhido automaticamente, nesta ordem de prioridade):
//   1. KV REST (Vercel KV / Upstash Redis) — DURÁVEL em serverless. Ativado
//      quando KV_REST_API_URL + KV_REST_API_TOKEN (ou os equivalentes
//      UPSTASH_REDIS_REST_URL/_TOKEN) estão definidos no ambiente. É o backend
//      RECOMENDADO em produção (Vercel/Workers), pois sobrevive a cold starts.
//   2. Arquivo local (.data/calls.json) via node:fs — durável em dev local
//      (Node/Bun). Sobrevive a reinícios do servidor de desenvolvimento.
//   3. Apenas memória — quando nenhum dos acima existe; semeia a demo por
//      isolate. Sem durabilidade entre cold starts.
//
// O store inteiro é carregado em memória e serializado como UM blob JSON
// ({ seq, calls }). Todos os backends expõem a MESMA interface assíncrona
// read()/write(), então o resto do módulo (seed, dashboard, agentes) não muda.

import process from "node:process";

import {
  statusFromScore,
  type CallAnalysis,
  type CallObservation,
  type CallStatus,
  type ComplianceCheck,
  type Sentiment,
} from "../compliance";
import { buildSeedCalls } from "./seed-calls.server";
import { getActiveChecklistLabels } from "./monitoring-form.server";

export type CallOrigin = "audio" | "texto";

export const UNASSIGNED_AGENT = "Não atribuído";

// Normaliza o nome do atendente informado (trim + colapsa espaços). Vazio vira
// o rótulo padrão de "não atribuído", para que toda ligação caia num grupo.
export function normalizeAgentName(name?: string | null): string {
  const clean = (name ?? "").trim().replace(/\s+/g, " ");
  return clean.length ? clean : UNASSIGNED_AGENT;
}

export interface StoredCall {
  id: string;
  protocol: string;
  createdAt: string; // ISO 8601
  origin: CallOrigin;
  label: string; // nome do arquivo (áudio) ou rótulo da transcrição
  agentName: string; // atendente responsável pela ligação
  topic: string;
  scoreCompliance: number;
  scoreQuality: number;
  sentiment: Sentiment;
  status: CallStatus;
  summary: string;
  source: CallAnalysis["source"];
  model: string;
  checks: ComplianceCheck[];
  observations: CallObservation[];
  transcript: string;
}

const store: StoredCall[] = [];
let seq = 1;

// ----------------------------------------------------------------------------
// Camada de persistência plugável. Toda a I/O é assíncrona e envolvida em
// try/catch a montante: se o backend falhar, o store segue em memória sem
// quebrar nenhuma requisição.
//
// NOTA de concorrência: a escrita grava o blob inteiro ({ seq, calls }). Em
// serverless, isolates concorrentes podem sobrescrever a gravação um do outro
// (janela curta). Para volume alto, migrar para uma LISTA Redis (LPUSH atômico
// por ligação) — a interface read()/write() aqui é o ÚNICO ponto a trocar.
// ----------------------------------------------------------------------------

interface StorageBackend {
  read: () => Promise<string | null>;
  write: (contents: string) => Promise<void>;
}

// Chave única onde o blob do store é guardado no KV.
const KV_KEY = "vivo:calls-store";

// Backend KV REST (Vercel KV / Upstash Redis) via fetch puro — sem dependências
// e compatível com qualquer runtime (Node/Workers/Vercel). Usa a API de comando
// do Upstash: POST no endpoint REST com corpo `["GET", key]` / `["SET", k, v]`.
function resolveKvBackend(): StorageBackend | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const base = url.replace(/\/+$/, "");
  const cmd = async (command: (string | number)[]): Promise<unknown> => {
    const res = await fetch(base, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`KV ${res.status}: ${detail.slice(0, 200)}`);
    }
    const data = (await res.json()) as { result?: unknown; error?: string };
    if (data.error) throw new Error(`KV error: ${data.error}`);
    return data.result ?? null;
  };
  return {
    read: async () => {
      const result = await cmd(["GET", KV_KEY]);
      return typeof result === "string" ? result : null;
    },
    write: async (contents: string) => {
      await cmd(["SET", KV_KEY, contents]);
    },
  };
}

// Backend de arquivo local (.data/calls.json) via node:fs — durável em dev.
async function resolveFileBackend(): Promise<StorageBackend | null> {
  try {
    const [fs, path, proc] = await Promise.all([
      import("node:fs"),
      import("node:path"),
      import("node:process"),
    ]);
    const dir = path.join(proc.cwd(), ".data");
    const file = path.join(dir, "calls.json");
    return {
      read: async () => {
        try {
          return fs.readFileSync(file, "utf8");
        } catch {
          return null;
        }
      },
      write: async (contents: string) => {
        try {
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(file, contents);
        } catch {
          /* no-op: ambiente sem escrita em disco */
        }
      },
    };
  } catch {
    return null; // ambiente sem node:fs (ex.: Cloudflare Workers sem KV)
  }
}

// `undefined` = ainda não resolvido; `null` = nenhum backend (memória apenas).
let backend: StorageBackend | null | undefined;

async function getBackend(): Promise<StorageBackend | null> {
  if (backend !== undefined) return backend;
  // KV tem prioridade (produção durável); senão, arquivo local (dev).
  backend = resolveKvBackend() ?? (await resolveFileBackend());
  return backend;
}

// Promise memoizada: garante que o carregamento do disco aconteça UMA vez e que
// todos os chamadores concorrentes aguardem a MESMA conclusão (evita corrida em
// que uma leitura veria o store ainda vazio enquanto outra ainda carrega).
let loadPromise: Promise<void> | null = null;

// Semeia o store com as 10 ligações de demonstração e persiste (best-effort).
function seedStore(): void {
  const { calls, nextSeq } = buildSeedCalls();
  store.length = 0;
  store.push(...calls);
  seq = nextSeq;
}

function ensureLoaded(): Promise<void> {
  if (!loadPromise) {
    loadPromise = (async () => {
      const api = await getBackend();
      // Sem backend (ex.: Workers sem KV): isolate começa vazio. Semeia em
      // memória para que a demo tenha dados desde o primeiro acesso.
      if (!api) {
        seedStore();
        return;
      }
      const raw = await api.read();
      // Primeiro acesso (arquivo ainda não existe): semeia e persiste. Se o
      // arquivo já existir — mesmo vazio, após uma limpeza explícita — respeita
      // o conteúdo e NÃO semeia de novo.
      if (raw === null) {
        seedStore();
        await persist();
        return;
      }
      try {
        const data = JSON.parse(raw) as { seq?: number; calls?: StoredCall[] };
        if (Array.isArray(data.calls)) {
          store.length = 0;
          // Backfill de campos novos para registros gravados antes da entidade
          // de agente existir — garante que toda ligação tenha um atendente.
          store.push(...data.calls.map((c) => ({ ...c, agentName: normalizeAgentName(c.agentName) })));
        }
        if (typeof data.seq === "number" && data.seq > seq) seq = data.seq;
      } catch {
        /* arquivo corrompido — ignora e começa do zero */
      }
    })();
  }
  return loadPromise;
}

async function persist(): Promise<void> {
  const api = await getBackend();
  if (!api) return;
  await api.write(JSON.stringify({ seq, calls: store }));
}

// Classificador de tema por palavras-chave (heurística leve, em PT-BR).
// Honesto: é uma aproximação — não um modelo treinado de classificação.
function classifyTopic(text: string): string {
  const t = text.toLowerCase();
  const has = (...terms: string[]) => terms.some((term) => t.includes(term));
  if (has("cancel")) return "Cancelamento";
  if (has("portabil", "portar o número", "trazer meu número")) return "Portabilidade";
  if (has("roaming", "internacional", "no exterior", "viagem")) return "Roaming internacional";
  if (has("fatura", "cobran", "boleto", "pagamento", "valor cobrado", "cobrar")) return "Cobrança/Fatura";
  if (has("sinal", "sem internet", "lentidão", "lento", "não funciona", "técnic", "reparo", "caiu")) return "Suporte técnico";
  if (has("upgrade", "oferta", "promo", "contratar", "plano novo", "migrar de plano")) return "Vendas/Upgrade";
  return "Outros";
}

function pad(n: number, len: number): string {
  return String(n).padStart(len, "0");
}

export async function recordAnalysis(input: {
  analysis: CallAnalysis;
  origin: CallOrigin;
  label: string;
  // Texto que será ARMAZENADO/EXIBIDO na ficha. Por política de privacidade
  // (LGPD), aqui entra o RESUMO da auditoria — nunca a transcrição completa.
  transcript: string;
  // Texto usado APENAS para classificar o tema da ligação. Recebe a transcrição
  // bruta de forma transitória; NÃO é persistido em lugar nenhum.
  topicSource?: string;
  agentName?: string;
}): Promise<StoredCall> {
  await ensureLoaded();
  const { analysis, origin, label, transcript } = input;
  const n = seq++;
  const record: StoredCall = {
    id: `C-${pad(10000 + n, 5)}`,
    protocol: `VV-${pad(880000 + n, 6)}`,
    createdAt: new Date().toISOString(),
    origin,
    label,
    agentName: normalizeAgentName(input.agentName),
    topic: classifyTopic(input.topicSource ?? transcript),
    scoreCompliance: analysis.scoreCompliance,
    scoreQuality: analysis.scoreQuality,
    sentiment: analysis.sentiment,
    status: statusFromScore(analysis.scoreCompliance),
    summary: analysis.summary,
    source: analysis.source,
    model: analysis.model ?? (analysis.source === "huggingface" ? "huggingface" : "heurística local"),
    checks: analysis.checks,
    observations: analysis.observations,
    transcript,
  };
  store.unshift(record); // mais recente primeiro
  await persist();
  return record;
}

export async function listCalls(limit?: number): Promise<StoredCall[]> {
  await ensureLoaded();
  return limit ? store.slice(0, limit) : store.slice();
}

export async function getCallById(id: string): Promise<StoredCall | undefined> {
  await ensureLoaded();
  return store.find((c) => c.id === id);
}

// Remove todas as análises (usado pela tela de Configurações).
export async function clearCalls(): Promise<void> {
  await ensureLoaded();
  store.length = 0;
  seq = 1;
  await persist();
}

// Restaura o store para o seed de demonstração (10 ligações reais da 3C Plus),
// sobrescrevendo o conteúdo atual. Útil em produção, onde o KV durável já tem
// dados e o seed automático (só no primeiro acesso) não roda mais.
export async function reseedCalls(): Promise<number> {
  await ensureLoaded();
  seedStore();
  await persist();
  return store.length;
}

// ----------------------------------------------------------------------------
// Agregações do Dashboard — todas derivadas das análises reais armazenadas.
// ----------------------------------------------------------------------------

export interface KpiValue {
  value: number;
  delta: number | null; // % vs janela de 7 dias anterior; null = sem base
}

export interface DashboardData {
  totalCalls: number;
  kpis: {
    totalCalls: KpiValue;
    avgCompliance: KpiValue;
    avgQuality: KpiValue;
    criticalAlerts: KpiValue;
    approvalRate: KpiValue; // % de ligações aprovadas
    positiveRate: KpiValue; // % com sentimento positivo
    activeAgents: KpiValue; // atendentes distintos monitorados
    aiCoverage: KpiValue; // % analisado pela Mangaba AI (vs. fallback local)
  };
  dailyTrend: TrendPoint[];
  granularity: TrendGranularity;
  topicDistribution: { name: string; value: number }[];
  complianceItems: { label: string; score: number }[];
  modelUsage: { name: string; role: string; calls: number; status: "active" | "idle" }[];
  recentCalls: StoredCall[];
}

const avg = (nums: number[]) =>
  nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0;

const DAY_MS = 24 * 60 * 60 * 1000;

function delta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

// Granularidade do gráfico de evolução — escolhida pelo usuário no Dashboard.
export type TrendGranularity = "hour" | "day" | "week" | "month";

export interface TrendPoint {
  day: string; // rótulo do eixo X (mantém a chave "day" para o gráfico existente)
  compliance: number;
  quality: number;
}

// Quantos pontos exibir por granularidade (janela mais recente).
const TREND_LIMIT: Record<TrendGranularity, number> = { hour: 24, day: 14, week: 12, month: 12 };

// Mapeia uma data para o "balde" da granularidade: chave de agrupamento estável,
// timestamp para ordenação e rótulo legível em pt-BR.
function trendBucket(date: Date, g: TrendGranularity): { key: string; ts: number; label: string } {
  switch (g) {
    case "hour": {
      const key = date.toISOString().slice(0, 13); // YYYY-MM-DDTHH (UTC)
      const d = new Date(key + ":00:00Z");
      return { key, ts: d.getTime(), label: d.toLocaleString("pt-BR", { day: "2-digit", hour: "2-digit", hour12: false }) + "h" };
    }
    case "week": {
      // Segunda-feira da semana ISO da data.
      const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
      const weekday = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() - weekday + 1);
      const key = d.toISOString().slice(0, 10);
      return { key, ts: d.getTime(), label: "sem " + d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) };
    }
    case "month": {
      const key = date.toISOString().slice(0, 7); // YYYY-MM
      const d = new Date(key + "-01T00:00:00Z");
      return { key, ts: d.getTime(), label: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }) };
    }
    case "day":
    default: {
      const key = date.toISOString().slice(0, 10);
      const d = new Date(key + "T12:00:00");
      return { key, ts: d.getTime(), label: d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" }) };
    }
  }
}

// Série temporal de compliance/qualidade agregada pela granularidade pedida.
function computeTrend(calls: StoredCall[], g: TrendGranularity): TrendPoint[] {
  const buckets = new Map<string, { comp: number[]; qual: number[]; ts: number; label: string }>();
  for (const c of calls) {
    const { key, ts, label } = trendBucket(new Date(c.createdAt), g);
    const e = buckets.get(key) ?? { comp: [], qual: [], ts, label };
    e.comp.push(c.scoreCompliance);
    e.qual.push(c.scoreQuality);
    buckets.set(key, e);
  }
  return [...buckets.values()]
    .sort((a, b) => a.ts - b.ts)
    .slice(-TREND_LIMIT[g])
    .map((e) => ({ day: e.label, compliance: avg(e.comp), quality: avg(e.qual) }));
}

export async function getDashboardData(granularity: TrendGranularity = "day"): Promise<DashboardData> {
  await ensureLoaded();
  const all = store;
  const now = Date.now();
  const last7 = all.filter((c) => now - new Date(c.createdAt).getTime() <= 7 * DAY_MS);
  const prev7 = all.filter((c) => {
    const age = now - new Date(c.createdAt).getTime();
    return age > 7 * DAY_MS && age <= 14 * DAY_MS;
  });

  const compCur = avg(last7.map((c) => c.scoreCompliance));
  const compPrev = avg(prev7.map((c) => c.scoreCompliance));
  const qualCur = avg(last7.map((c) => c.scoreQuality));
  const qualPrev = avg(prev7.map((c) => c.scoreQuality));
  const critCur = last7.filter((c) => c.status === "critical").length;
  const critPrev = prev7.filter((c) => c.status === "critical").length;

  // Percentual de uma lista que satisfaz um predicado (0-100, arredondado).
  const rate = (list: StoredCall[], pred: (c: StoredCall) => boolean) =>
    list.length ? Math.round((list.filter(pred).length / list.length) * 100) : 0;
  const isApproved = (c: StoredCall) => c.status === "approved";
  const isPositive = (c: StoredCall) => c.sentiment === "positivo";
  const isAi = (c: StoredCall) => c.source === "huggingface";
  const distinctAgents = (list: StoredCall[]) => new Set(list.map((c) => c.agentName)).size;

  const approvalCur = rate(last7, isApproved);
  const approvalPrev = rate(prev7, isApproved);
  const positiveCur = rate(last7, isPositive);
  const positivePrev = rate(prev7, isPositive);
  const aiCur = rate(last7, isAi);
  const aiPrev = rate(prev7, isAi);
  const agentsCur = distinctAgents(last7);
  const agentsPrev = distinctAgents(prev7);

  // Rótulos da Ficha de Monitoria vigente (definida pelo analista).
  const checklistLabels = await getActiveChecklistLabels();

  // Tendência na granularidade escolhida (hora, dia, semana ou mês).
  const dailyTrend = computeTrend(all, granularity);

  // Distribuição por tema.
  const topicMap = new Map<string, number>();
  for (const c of all) topicMap.set(c.topic, (topicMap.get(c.topic) ?? 0) + 1);
  const topicDistribution = [...topicMap.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Média por item da Ficha de Monitoria vigente (dado real dos checks).
  const complianceItems = checklistLabels.map((label) => {
    const scores: number[] = [];
    for (const c of all) {
      const found = c.checks.find((k) => k.label === label);
      if (found) scores.push(found.score);
    }
    return { label, score: avg(scores) };
  });

  // Componentes reais do pipeline de IA em uso.
  const llmModels = new Map<string, number>();
  let heuristicCount = 0;
  let audioCount = 0;
  for (const c of all) {
    if (c.origin === "audio") audioCount++;
    if (c.source === "huggingface") llmModels.set(c.model, (llmModels.get(c.model) ?? 0) + 1);
    else heuristicCount++;
  }
  const modelUsage: DashboardData["modelUsage"] = [];
  for (const [name, calls] of llmModels) {
    modelUsage.push({ name, role: "Auditoria de compliance e qualidade (LLM)", calls, status: "active" });
  }
  if (audioCount > 0) {
    modelUsage.push({ name: "Whisper large-v3", role: "Transcrição de áudio (ASR)", calls: audioCount, status: "active" });
  }
  if (heuristicCount > 0) {
    modelUsage.push({ name: "Heurística local", role: "Fallback por palavras-chave (sem IA)", calls: heuristicCount, status: "idle" });
  }

  return {
    totalCalls: all.length,
    kpis: {
      totalCalls: { value: all.length, delta: delta(last7.length, prev7.length) },
      avgCompliance: { value: avg(all.map((c) => c.scoreCompliance)), delta: delta(compCur, compPrev) },
      avgQuality: { value: avg(all.map((c) => c.scoreQuality)), delta: delta(qualCur, qualPrev) },
      criticalAlerts: { value: all.filter((c) => c.status === "critical").length, delta: delta(critCur, critPrev) },
      approvalRate: { value: rate(all, isApproved), delta: delta(approvalCur, approvalPrev) },
      positiveRate: { value: rate(all, isPositive), delta: delta(positiveCur, positivePrev) },
      activeAgents: { value: distinctAgents(all), delta: delta(agentsCur, agentsPrev) },
      aiCoverage: { value: rate(all, isAi), delta: delta(aiCur, aiPrev) },
    },
    dailyTrend,
    granularity,
    topicDistribution,
    complianceItems,
    modelUsage,
    recentCalls: all.slice(0, 8),
  };
}

// ----------------------------------------------------------------------------
// Desempenho por agente — base do módulo de Equipe/QA. Cada ligação é atribuída
// a um atendente (campo agentName); aqui agregamos as métricas por pessoa.
// ----------------------------------------------------------------------------

export interface AgentPerformance {
  name: string;
  calls: number;
  avgCompliance: number;
  avgQuality: number;
  criticalCount: number;
  approvedCount: number;
  sentiment: { positivo: number; neutro: number; negativo: number };
  lastCallAt: string; // ISO da ligação mais recente
  // Item da checklist com a menor média — foco de coaching do atendente.
  weakestItem: { label: string; score: number } | null;
}

function summarizeAgent(name: string, calls: StoredCall[], labels: string[]): AgentPerformance {
  const sentiment = { positivo: 0, neutro: 0, negativo: 0 };
  for (const c of calls) sentiment[c.sentiment]++;

  // Média por item da ficha para identificar o ponto mais fraco.
  let weakestItem: { label: string; score: number } | null = null;
  for (const label of labels) {
    const scores: number[] = [];
    for (const c of calls) {
      const found = c.checks.find((k) => k.label === label);
      if (found) scores.push(found.score);
    }
    if (!scores.length) continue;
    const score = avg(scores);
    if (!weakestItem || score < weakestItem.score) weakestItem = { label, score };
  }

  const lastCallAt = calls.reduce(
    (max, c) => (c.createdAt > max ? c.createdAt : max),
    calls[0]?.createdAt ?? "",
  );

  return {
    name,
    calls: calls.length,
    avgCompliance: avg(calls.map((c) => c.scoreCompliance)),
    avgQuality: avg(calls.map((c) => c.scoreQuality)),
    criticalCount: calls.filter((c) => c.status === "critical").length,
    approvedCount: calls.filter((c) => c.status === "approved").length,
    sentiment,
    lastCallAt,
    weakestItem,
  };
}

// Ranking de todos os agentes, do maior para o menor score de compliance.
export async function getAgentsPerformance(): Promise<AgentPerformance[]> {
  await ensureLoaded();
  const labels = await getActiveChecklistLabels();
  const byAgent = new Map<string, StoredCall[]>();
  for (const c of store) {
    const list = byAgent.get(c.agentName) ?? [];
    list.push(c);
    byAgent.set(c.agentName, list);
  }
  return [...byAgent.entries()]
    .map(([name, calls]) => summarizeAgent(name, calls, labels))
    .sort((a, b) => b.avgCompliance - a.avgCompliance || b.calls - a.calls);
}

export interface AgentProfile {
  performance: AgentPerformance;
  checklistAverages: { label: string; score: number }[];
  trend: { day: string; compliance: number; quality: number }[];
  calls: StoredCall[];
}

// Perfil detalhado de um agente: métricas + média por item + tendência + ligações.
export async function getAgentProfile(name: string): Promise<AgentProfile | null> {
  await ensureLoaded();
  const target = normalizeAgentName(name);
  const calls = store.filter((c) => c.agentName === target);
  if (!calls.length) return null;

  const labels = await getActiveChecklistLabels();
  const checklistAverages = labels.map((label) => {
    const scores: number[] = [];
    for (const c of calls) {
      const found = c.checks.find((k) => k.label === label);
      if (found) scores.push(found.score);
    }
    return { label, score: avg(scores) };
  });

  return {
    performance: summarizeAgent(target, calls, labels),
    checklistAverages,
    trend: computeTrend(calls, "day"),
    calls: calls.slice(), // já vem mais recente primeiro (store usa unshift)
  };
}
