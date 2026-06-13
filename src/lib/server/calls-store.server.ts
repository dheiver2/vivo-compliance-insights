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
import { getActiveChecklistLabels } from "./monitoring-form.server";

export type CallOrigin = "audio" | "texto";

// Assinatura (aceite) do atendente na hora da auditoria. Chave única =
// HMAC(CPF) (irreversível); guardamos só o hash + máscara, nunca o CPF em claro.
export interface AuditSignature {
  agentKeyHash: string; // chave única do atendente (HMAC do CPF)
  agentKeyMasked: string; // •••.•••.•••-12 (exibição)
  agentName: string;
  signedAt: string; // ISO
  by: "atendente" | "supervisor";
}

// Contestação da auditoria (atendente ou supervisor) e sua resolução.
export type ContestationStatus = "aberta" | "aceita" | "rejeitada";
export interface AuditContestation {
  status: ContestationStatus;
  openedBy: "atendente" | "supervisor";
  openedByMasked?: string; // CPF mascarado de quem abriu (se atendente)
  reason: string;
  criterion?: string; // critério específico contestado, ou geral
  openedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: string; // parecer de quem resolveu
}

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
  // ID da ligação na 3C Plus usado para BAIXAR a gravação (quando a origem é a
  // 3C Plus). Permite reproduzir o áudio bruto na aba Áudios. Ausente em
  // registros antigos e em áudios que não vieram da 3C Plus.
  sourceCallId?: string;
  // Duração REAL da ligação em segundos, quando disponível na origem (ex.: 3C
  // Plus). Base dos indicadores operacionais de tempo. Ausente em registros
  // antigos e em uploads sem metadado de duração.
  durationSec?: number;
  // Assinatura (aceite) do atendente e contestação da auditoria, quando houver.
  signature?: AuditSignature;
  contestation?: AuditContestation;
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

// Single-flight da carga: garante que leituras concorrentes aguardem a MESMA
// operação (evita corrida em que duas requisições leem o backend ao mesmo tempo).
// NÃO é memoizada para sempre — ver `lastLoadAt` abaixo.
let loadPromise: Promise<void> | null = null;
// Quando o store foi sincronizado com o backend durável pela última vez.
let lastLoadAt = 0;
// Janela de frescor da releitura do backend durável. Em serverless há vários
// isolates: se cada um memoizasse o store eternamente, um isolate que carregou
// um estado ANTIGO continuaria servindo (e, pior, regravando) dados obsoletos —
// foi o que fez o dashboard oscilar entre 13 e 12 após uma limpeza/ingestão.
// Re-lendo o KV quando passou esta janela, todos os isolates convergem para a
// verdade do backend em poucos segundos. Curto o bastante para consistência,
// longo o bastante para não pesar dentro de um lote de gravações sequenciais.
const STORE_FRESH_MS = 1500;

// Esvazia o store em memória. A plataforma NÃO usa dados de demonstração: o
// acervo só é preenchido por ingestões REAIS da 3C Plus.
function emptyStore(): void {
  store.length = 0;
  seq = 1;
}

// Sincroniza o store em memória com o conteúdo do backend durável.
async function loadFromBackend(api: StorageBackend): Promise<void> {
  const raw = await api.read();
  // Backend vazio: inicia VAZIO (sem seed) e persiste o blob inicial. O acervo
  // só recebe dados de ingestões reais da 3C Plus.
  if (raw === null) {
    emptyStore();
    await persist();
    return;
  }
  try {
    const data = JSON.parse(raw) as { seq?: number; calls?: StoredCall[] };
    if (Array.isArray(data.calls)) {
      store.length = 0;
      // Backfill de campos novos para registros gravados antes da entidade de
      // agente existir — garante que toda ligação tenha um atendente.
      store.push(
        ...data.calls.map((c) => ({ ...c, agentName: normalizeAgentName(c.agentName) })),
      );
    }
    // seq segue o backend (fonte da verdade), inclusive quando DIMINUI após uma
    // limpeza — do contrário um isolate manteria um seq alto e obsoleto.
    if (typeof data.seq === "number") seq = data.seq;
  } catch {
    /* blob corrompido — mantém o que houver em memória */
  }
}

function ensureLoaded(): Promise<void> {
  // Carga em andamento: todos aguardam a mesma (single-flight).
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const api = await getBackend();
      // Sem backend durável (ex.: Workers sem KV): inicia VAZIO em memória (sem
      // seed). Sem fonte externa para reler, o estado em memória é estável.
      if (!api) {
        if (lastLoadAt === 0) emptyStore();
        lastLoadAt = Date.now();
        return;
      }
      // Backend durável: re-lê quando passou a janela de frescor, fazendo os
      // isolates convergirem para a verdade do KV (corrige staleness).
      if (Date.now() - lastLoadAt >= STORE_FRESH_MS) {
        await loadFromBackend(api);
        lastLoadAt = Date.now();
      }
    } finally {
      loadPromise = null;
    }
  })();
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
  if (has("fatura", "cobran", "boleto", "pagamento", "valor cobrado", "cobrar"))
    return "Cobrança/Fatura";
  if (has("sinal", "sem internet", "lentidão", "lento", "não funciona", "técnic", "reparo", "caiu"))
    return "Suporte técnico";
  if (has("upgrade", "oferta", "promo", "contratar", "plano novo", "migrar de plano"))
    return "Vendas/Upgrade";
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
  // ID da 3C Plus usado para baixar a gravação (habilita o player de áudio bruto).
  sourceCallId?: string;
  // Duração real da ligação (segundos), quando a origem informa. Base dos tempos.
  durationSec?: number;
  // Data/hora REAL da ligação (ISO/RFC3339). Usada como timestamp do registro
  // para que o dashboard reflita QUANDO a chamada aconteceu — não a hora da
  // auditoria. Se ausente/ inválida, usa o instante da auditoria.
  callDate?: string;
}): Promise<StoredCall> {
  await ensureLoaded();
  const { analysis, origin, label, transcript } = input;
  const n = seq++;
  const parsedCallDate = input.callDate ? Date.parse(input.callDate) : NaN;
  const createdAt = Number.isNaN(parsedCallDate)
    ? new Date().toISOString()
    : new Date(parsedCallDate).toISOString();
  const record: StoredCall = {
    id: `C-${pad(10000 + n, 5)}`,
    protocol: `VV-${pad(880000 + n, 6)}`,
    createdAt,
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
    model:
      analysis.model ?? (analysis.source === "huggingface" ? "huggingface" : "heurística local"),
    checks: analysis.checks,
    observations: analysis.observations,
    transcript,
    ...(input.sourceCallId ? { sourceCallId: input.sourceCallId } : {}),
    ...(input.durationSec != null && input.durationSec > 0
      ? { durationSec: Math.round(input.durationSec) }
      : {}),
  };
  // Dedup por gravação da 3C Plus: se a mesma gravação já foi auditada, substitui
  // em vez de duplicar. Casa pelo rótulo "3C Plus · {sid}" (estável entre re-
  // análises, mesmo quando o sourceCallId só passou a ser gravado depois) ou pelo
  // sourceCallId. Vale para a re-análise pela aba Áudios e para o lote repetido.
  if (input.sourceCallId || label.startsWith("3C Plus · ")) {
    const dupIdx = store.findIndex(
      (c) =>
        c.label === label || (input.sourceCallId != null && c.sourceCallId === input.sourceCallId),
    );
    if (dupIdx >= 0) store.splice(dupIdx, 1);
  }
  store.unshift(record); // mais recente primeiro
  await persist();
  return record;
}

// Atualiza a análise de uma ligação JÁ armazenada (re-auditoria sob a norma
// vigente), preservando metadados imutáveis (id, protocolo, data, atendente,
// origem, transcrição, assinatura/contestação). Usado pelo reprocessamento em
// lote quando a Ficha de Monitoria muda.
export async function updateCallAnalysis(
  id: string,
  analysis: CallAnalysis,
): Promise<StoredCall | null> {
  await ensureLoaded();
  const c = store.find((x) => x.id === id);
  if (!c) return null;
  c.scoreCompliance = analysis.scoreCompliance;
  c.scoreQuality = analysis.scoreQuality;
  c.sentiment = analysis.sentiment;
  c.status = statusFromScore(analysis.scoreCompliance);
  c.summary = analysis.summary;
  c.source = analysis.source;
  c.model =
    analysis.model ?? (analysis.source === "huggingface" ? "huggingface" : "heurística local");
  c.checks = analysis.checks;
  c.observations = analysis.observations;
  await persist();
  return c;
}

export async function listCalls(limit?: number): Promise<StoredCall[]> {
  await ensureLoaded();
  return limit ? store.slice(0, limit) : store.slice();
}

export async function getCallById(id: string): Promise<StoredCall | undefined> {
  await ensureLoaded();
  return store.find((c) => c.id === id);
}

// ----------------------------------------------------------------------------
// Assinatura e contestação da auditoria (trilha de revisão por ligação).
// ----------------------------------------------------------------------------

// Registra a assinatura (aceite) do atendente. Imutável: não sobrescreve uma
// assinatura existente.
export async function setSignature(
  id: string,
  signature: AuditSignature,
): Promise<StoredCall | null> {
  await ensureLoaded();
  const call = store.find((c) => c.id === id);
  if (!call) return null;
  if (call.signature) return call; // já assinada — mantém o registro original
  call.signature = signature;
  await persist();
  return call;
}

// Abre uma contestação (status "aberta"). Se já houver uma ABERTA, mantém.
export async function setContestation(
  id: string,
  contestation: AuditContestation,
): Promise<StoredCall | null> {
  await ensureLoaded();
  const call = store.find((c) => c.id === id);
  if (!call) return null;
  if (call.contestation && call.contestation.status === "aberta") return call;
  call.contestation = contestation;
  await persist();
  return call;
}

// Resolve a contestação aberta (aceita/rejeitada) com parecer.
export async function resolveContestation(
  id: string,
  resolution: { status: "aceita" | "rejeitada"; resolvedBy: string; parecer: string },
): Promise<StoredCall | null> {
  await ensureLoaded();
  const call = store.find((c) => c.id === id);
  if (!call || !call.contestation) return null;
  call.contestation = {
    ...call.contestation,
    status: resolution.status,
    resolvedAt: new Date().toISOString(),
    resolvedBy: resolution.resolvedBy,
    resolution: resolution.parecer,
  };
  await persist();
  return call;
}

// Remove todas as análises (usado pela tela de Configurações).
export async function clearCalls(): Promise<void> {
  await ensureLoaded();
  store.length = 0;
  seq = 1;
  await persist();
}

// ----------------------------------------------------------------------------
// Agregações do Dashboard — todas derivadas das análises reais armazenadas.
// ----------------------------------------------------------------------------

export interface KpiValue {
  value: number;
  delta: number | null; // % vs dia anterior (24-48h); null = sem base
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
    fcrRate: KpiValue; // % de resolução no primeiro contato (proxy)
  };
  dailyTrend: TrendPoint[];
  granularity: TrendGranularity;
  topicDistribution: { name: string; value: number }[];
  complianceItems: { label: string; score: number }[];
  modelUsage: { name: string; role: string; calls: number; status: "active" | "idle" }[];
  recentCalls: StoredCall[];
  // Revisão: aceite (assinatura) do atendente e contestações.
  review: {
    signedRate: number; // % de auditorias assinadas pelo atendente
    openContestations: number; // contestações ainda abertas
    contestedRate: number; // % de auditorias contestadas (qualquer status)
  };
  // Indicadores operacionais típicos de call center de operadora, derivados da
  // conversa entre atendente e cliente na transcrição (sem timestamps reais).
  // Indicadores operacionais de TEMPO (estimados a partir do diálogo, sem
  // timestamps reais nas gravações importadas).
  callCenter: {
    ahtSeconds: KpiValue; // TMA — tempo médio de atendimento (duração média)
    medianSeconds: KpiValue; // duração mediana (central, robusta a outliers)
    maxSeconds: KpiValue; // maior ligação
    minSeconds: KpiValue; // menor ligação
    totalAuditedSeconds: KpiValue; // tempo total de áudio auditado (volume)
  };
  // Indicadores comerciais (vendas), derivados dos critérios da norma de
  // monitoria de vendas Vivo Empresas aplicada a cada ligação.
  sales: {
    conversionRate: KpiValue; // % de ligações com fechamento de venda (proxy)
    sondagemScore: KpiValue; // aderência média ao bloco de sondagem
    argumentationScore: KpiValue; // aderência média à estratégia/argumentação
    activeListeningRate: KpiValue; // % com escuta ativa (não interrompeu o cliente)
    taggingRate: KpiValue; // % com tabulação administrativa correta
    cancelRate: KpiValue; // % de ligações com tema Cancelamento (churn)
  };
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
      return {
        key,
        ts: d.getTime(),
        label: d.toLocaleString("pt-BR", { day: "2-digit", hour: "2-digit", hour12: false }) + "h",
      };
    }
    case "week": {
      // Segunda-feira da semana ISO da data.
      const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
      const weekday = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() - weekday + 1);
      const key = d.toISOString().slice(0, 10);
      return {
        key,
        ts: d.getTime(),
        label: "sem " + d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      };
    }
    case "month": {
      const key = date.toISOString().slice(0, 7); // YYYY-MM
      const d = new Date(key + "-01T00:00:00Z");
      return {
        key,
        ts: d.getTime(),
        label: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      };
    }
    case "day":
    default: {
      const key = date.toISOString().slice(0, 10);
      const d = new Date(key + "T12:00:00");
      return {
        key,
        ts: d.getTime(),
        label: d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" }),
      };
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

// --- Indicadores operacionais de call center -------------------------------
// Ritmo de fala típico em atendimento telefônico (palavras por minuto), usado
// só para ESTIMAR a duração da ligação a partir da transcrição (não há
// timestamps reais nas gravações importadas).
const SPEECH_WPM = 130;

// Quebra a transcrição em turnos "Atendente:"/"Cliente:" e conta as palavras de
// cada locutor (ignorando rubricas entre parênteses, ex.: "(irritado)").
function speakerStats(transcript: string): {
  agentWords: number;
  clientWords: number;
  turns: number;
} {
  let agentWords = 0;
  let clientWords = 0;
  let turns = 0;
  for (const raw of transcript.split(/\r?\n/)) {
    const m = raw.match(/^\s*(atendente|cliente)\s*:\s*(.*)$/i);
    if (!m) continue;
    const text = m[2].replace(/\([^)]*\)/g, " ");
    const words = text.split(/\s+/).filter(Boolean).length;
    if (words === 0) continue;
    turns++;
    if (m[1].toLowerCase() === "atendente") agentWords += words;
    else clientWords += words;
  }
  return { agentWords, clientWords, turns };
}

// Converte palavras em segundos de fala estimados (ritmo conversacional médio).
const wordsToSec = (words: number) => Math.round((words / SPEECH_WPM) * 60);

// Duração (segundos) de uma ligação: usa a duração REAL da origem (3C Plus) e,
// na ausência, ESTIMA pela contagem de palavras do diálogo (seed/demo com
// transcrição completa). Retorna 0 quando não há nenhum sinal de tempo.
function callDurationSec(c: StoredCall): number {
  if (c.durationSec && c.durationSec > 0) return c.durationSec;
  const { agentWords, clientWords } = speakerStats(c.transcript);
  const total = agentWords + clientWords;
  return total > 0 ? wordsToSec(total) : 0;
}

// Mediana de uma lista numérica (0 se vazia).
function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

// Agrega os indicadores operacionais de TEMPO a partir da duração das ligações.
function computeCallCenter(list: StoredCall[]) {
  const durs = list.map(callDurationSec).filter((d) => d > 0);
  // FCR (proxy): a ligação fechou com resumo + protocolo OU foi aprovada.
  const resolved = (c: StoredCall) =>
    c.status === "approved" ||
    c.checks.some((k) => /resumo final|protocolo|fechamento/i.test(k.label) && k.passed);
  const fcr = list.length
    ? Math.round((list.filter(resolved).length / list.length) * 100)
    : 0;
  const cancel = list.length
    ? Math.round((list.filter((c) => c.topic === "Cancelamento").length / list.length) * 100)
    : 0;
  return {
    aht: avg(durs),
    median: median(durs),
    max: durs.length ? Math.max(...durs) : 0,
    min: durs.length ? Math.min(...durs) : 0,
    totalAudited: durs.reduce((a, b) => a + b, 0),
    fcr,
    cancel,
  };
}

// --- Indicadores comerciais (norma de vendas) -------------------------------
// Localiza um check da norma por trecho do rótulo (resiliente a edição da ficha).
function findCheck(c: StoredCall, needle: string) {
  const n = needle.toLowerCase();
  return c.checks.find((k) => k.label.toLowerCase().includes(n));
}
// Média dos scores de um critério (ignora ligações onde o item não foi avaliado).
function avgCheckScore(list: StoredCall[], needle: string): number {
  const scores: number[] = [];
  for (const c of list) {
    const k = findCheck(c, needle);
    if (k) scores.push(k.score);
  }
  return avg(scores);
}
// % de ligações em que o critério foi cumprido (passed).
function passRate(list: StoredCall[], needle: string): number {
  const withItem = list.filter((c) => findCheck(c, needle));
  if (!withItem.length) return 0;
  return Math.round((withItem.filter((c) => findCheck(c, needle)!.passed).length / withItem.length) * 100);
}
function computeSales(list: StoredCall[]) {
  return {
    conversion: passRate(list, "fechamento"),
    sondagem: avgCheckScore(list, "sondagem"),
    argumentation: avgCheckScore(list, "argumenta"),
    listening: passRate(list, "escuta ativa"),
    tagging: passRate(list, "tabula"),
  };
}

export async function getDashboardData(
  granularity: TrendGranularity = "day",
): Promise<DashboardData> {
  await ensureLoaded();
  const all = store;
  const now = Date.now();
  // Comparativo dos indicadores: HOJE (últimas 24h) vs DIA ANTERIOR (24-48h).
  const today = all.filter((c) => now - new Date(c.createdAt).getTime() <= DAY_MS);
  const yesterday = all.filter((c) => {
    const age = now - new Date(c.createdAt).getTime();
    return age > DAY_MS && age <= 2 * DAY_MS;
  });

  const compCur = avg(today.map((c) => c.scoreCompliance));
  const compPrev = avg(yesterday.map((c) => c.scoreCompliance));
  const qualCur = avg(today.map((c) => c.scoreQuality));
  const qualPrev = avg(yesterday.map((c) => c.scoreQuality));
  const critCur = today.filter((c) => c.status === "critical").length;
  const critPrev = yesterday.filter((c) => c.status === "critical").length;

  // Percentual de uma lista que satisfaz um predicado (0-100, arredondado).
  const rate = (list: StoredCall[], pred: (c: StoredCall) => boolean) =>
    list.length ? Math.round((list.filter(pred).length / list.length) * 100) : 0;
  const isApproved = (c: StoredCall) => c.status === "approved";
  const isPositive = (c: StoredCall) => c.sentiment === "positivo";
  const isAi = (c: StoredCall) => c.source === "huggingface";
  const distinctAgents = (list: StoredCall[]) => new Set(list.map((c) => c.agentName)).size;

  const approvalCur = rate(today, isApproved);
  const approvalPrev = rate(yesterday, isApproved);
  const positiveCur = rate(today, isPositive);
  const positivePrev = rate(yesterday, isPositive);
  const aiCur = rate(today, isAi);
  const aiPrev = rate(yesterday, isAi);
  const agentsCur = distinctAgents(today);
  const agentsPrev = distinctAgents(yesterday);

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
    modelUsage.push({
      name,
      role: "Auditoria de compliance e qualidade (LLM)",
      calls,
      status: "active",
    });
  }
  if (audioCount > 0) {
    modelUsage.push({
      name: "Whisper large-v3",
      role: "Transcrição de áudio (ASR)",
      calls: audioCount,
      status: "active",
    });
  }
  if (heuristicCount > 0) {
    modelUsage.push({
      name: "Heurística local",
      role: "Fallback por palavras-chave (sem IA)",
      calls: heuristicCount,
      status: "idle",
    });
  }

  // Indicadores de tempo (call center) e comerciais — calculados uma vez por
  // janela e reaproveitados (FCR vai para a Visão geral; cancelamento, para o
  // Comercial).
  const ccAll = computeCallCenter(all);
  const ccCur = computeCallCenter(today);
  const ccPrev = computeCallCenter(yesterday);
  const sAll = computeSales(all);
  const sCur = computeSales(today);
  const sPrev = computeSales(yesterday);

  return {
    totalCalls: all.length,
    kpis: {
      totalCalls: { value: all.length, delta: delta(today.length, yesterday.length) },
      avgCompliance: {
        value: avg(all.map((c) => c.scoreCompliance)),
        delta: delta(compCur, compPrev),
      },
      avgQuality: { value: avg(all.map((c) => c.scoreQuality)), delta: delta(qualCur, qualPrev) },
      criticalAlerts: {
        value: all.filter((c) => c.status === "critical").length,
        delta: delta(critCur, critPrev),
      },
      approvalRate: { value: rate(all, isApproved), delta: delta(approvalCur, approvalPrev) },
      positiveRate: { value: rate(all, isPositive), delta: delta(positiveCur, positivePrev) },
      activeAgents: { value: distinctAgents(all), delta: delta(agentsCur, agentsPrev) },
      aiCoverage: { value: rate(all, isAi), delta: delta(aiCur, aiPrev) },
      fcrRate: { value: ccAll.fcr, delta: delta(ccCur.fcr, ccPrev.fcr) },
    },
    dailyTrend,
    granularity,
    topicDistribution,
    complianceItems,
    modelUsage,
    recentCalls: all.slice(0, 8),
    review: {
      signedRate: rate(all, (c) => Boolean(c.signature)),
      openContestations: all.filter((c) => c.contestation?.status === "aberta").length,
      contestedRate: rate(all, (c) => Boolean(c.contestation)),
    },
    callCenter: {
      ahtSeconds: { value: ccAll.aht, delta: delta(ccCur.aht, ccPrev.aht) },
      medianSeconds: { value: ccAll.median, delta: delta(ccCur.median, ccPrev.median) },
      maxSeconds: { value: ccAll.max, delta: delta(ccCur.max, ccPrev.max) },
      minSeconds: { value: ccAll.min, delta: delta(ccCur.min, ccPrev.min) },
      totalAuditedSeconds: {
        value: ccAll.totalAudited,
        delta: delta(ccCur.totalAudited, ccPrev.totalAudited),
      },
    },
    sales: {
      conversionRate: { value: sAll.conversion, delta: delta(sCur.conversion, sPrev.conversion) },
      sondagemScore: { value: sAll.sondagem, delta: delta(sCur.sondagem, sPrev.sondagem) },
      argumentationScore: {
        value: sAll.argumentation,
        delta: delta(sCur.argumentation, sPrev.argumentation),
      },
      activeListeningRate: { value: sAll.listening, delta: delta(sCur.listening, sPrev.listening) },
      taggingRate: { value: sAll.tagging, delta: delta(sCur.tagging, sPrev.tagging) },
      cancelRate: { value: ccAll.cancel, delta: delta(ccCur.cancel, ccPrev.cancel) },
    },
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
