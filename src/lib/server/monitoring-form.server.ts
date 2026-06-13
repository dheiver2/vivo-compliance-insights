// Configuração da Ficha de Monitoria — server-only.
//
// A "ficha" é o conjunto de critérios que os agentes Mangaba usam para avaliar
// cada ligação. O analista gerencia esses critérios (rótulo, descrição,
// categoria, peso, criticidade e ativação) e o sistema usa a ficha vigente
// tanto no prompt da análise por IA quanto nas agregações do dashboard.
//
// Persistência best-effort em .data/monitoring-form.json (mesmo padrão do store
// de ligações): array em memória + arquivo quando há fs; no-op em Workers.

import { COMPLIANCE_CHECKLIST } from "../compliance";

export interface MonitoringCriterion {
  id: string;
  label: string; // rótulo curto do item (aparece na checklist)
  description: string; // o que o avaliador/IA deve verificar
  category: string; // agrupamento (ex.: "Conformidade legal", "Negociação")
  weight: number; // 1-5, importância relativa do item
  critical: boolean; // falha aqui representa risco regulatório
  enabled: boolean; // se entra na avaliação atual
}

// Ficha padrão derivada da checklist regulatória base. É o ponto de partida e o
// alvo do "Restaurar padrão".
function defaultForm(): MonitoringCriterion[] {
  // Metadados da norma de vendas Vivo Empresas (scorecard "COM VENDA", 100 pts).
  // O peso em pontos oficial da ficha está na descrição; o `weight` 1-5 é a
  // importância relativa usada na média ponderada de compliance.
  const meta: Record<string, Omit<MonitoringCriterion, "id" | "label" | "enabled">> = {
    "Prontidão ao atender": {
      description: "Identifica-se em até 5s ao atender, sem deixar o cliente esperando. (5 pts)",
      category: "Abertura",
      weight: 2,
      critical: false,
    },
    "Saudação e identificação (nome + Vivo)": {
      description: "Deixa claro o nome do vendedor e o nome da empresa (VIVO). (5 pts)",
      category: "Abertura",
      weight: 2,
      critical: false,
    },
    "Personalização da ligação": {
      description: "Trata o cliente pelo nome ao longo do diálogo. (5 pts)",
      category: "Relacionamento",
      weight: 2,
      critical: false,
    },
    "Sondagem do cliente": {
      description:
        "Sonda o cenário: quanto paga no móvel, nº de linhas, benefícios de dados, interesse para familiares/funcionários e necessidade de banda larga (MEI/LTDA). (20 pts)",
      category: "Sondagem",
      weight: 5,
      critical: false,
    },
    "Escuta ativa (não interromper o cliente)": {
      description:
        "Não fala ao mesmo tempo, não corta o cliente e não demonstra impaciência. (10 pts)",
      category: "Postura",
      weight: 3,
      critical: true,
    },
    "Objetividade e abordagem do responsável": {
      description:
        "Encontra/aborda o responsável; argumenta; em recusa tenta agendamento ou WhatsApp; busca o contato. (15 pts)",
      category: "Condução",
      weight: 4,
      critical: false,
    },
    "Estratégia de venda e argumentação": {
      description:
        "Argumenta sobre oferta/plano/produto e, diante de recusa, contra-argumenta reforçando os benefícios. (25 pts)",
      category: "Argumentação",
      weight: 5,
      critical: false,
    },
    "Fechamento da venda (informações obrigatórias)": {
      description:
        "Aborda as informações obrigatórias: fidelização (24 meses), valor da oferta, valor do chip e plano/produto negociado. (10 pts)",
      category: "Fechamento",
      weight: 3,
      critical: true,
    },
    "Finalização padrão da ligação": {
      description: "Usa a finalização padrão do produto, agradecendo a atenção. (5 pts)",
      category: "Encerramento",
      weight: 2,
      critical: false,
    },
    "Tabulação administrativa correta": {
      description: "Tabula a ligação corretamente no sistema após o atendimento.",
      category: "Administrativo",
      weight: 2,
      critical: false,
    },
  };
  return COMPLIANCE_CHECKLIST.map((label, i) => ({
    id: `c${i + 1}`,
    label,
    enabled: true,
    ...(meta[label] ?? { description: "", category: "Geral", weight: 3, critical: false }),
  }));
}

const form: MonitoringCriterion[] = [];

// ---------------------------------------------------------------------------
// Persistência best-effort (mesmo contrato do calls-store).
// ---------------------------------------------------------------------------
interface FileApi {
  read: () => string | null;
  write: (contents: string) => void;
}
let fileApi: FileApi | null | undefined;

async function getFileApi(): Promise<FileApi | null> {
  if (fileApi !== undefined) return fileApi;
  try {
    const [fs, path, proc] = await Promise.all([
      import("node:fs"),
      import("node:path"),
      import("node:process"),
    ]);
    const dir = path.join(proc.cwd(), ".data");
    const file = path.join(dir, "monitoring-form.json");
    fileApi = {
      read: () => {
        try {
          return fs.readFileSync(file, "utf8");
        } catch {
          return null;
        }
      },
      write: (contents: string) => {
        try {
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(file, contents);
        } catch {
          /* no-op */
        }
      },
    };
  } catch {
    fileApi = null;
  }
  return fileApi;
}

let loadPromise: Promise<void> | null = null;

function setForm(items: MonitoringCriterion[]): void {
  form.length = 0;
  form.push(...items);
}

function ensureLoaded(): Promise<void> {
  if (!loadPromise) {
    loadPromise = (async () => {
      const api = await getFileApi();
      if (!api) {
        setForm(defaultForm());
        return;
      }
      const raw = api.read();
      if (raw === null) {
        // Primeiro acesso: grava a ficha padrão.
        setForm(defaultForm());
        api.write(JSON.stringify({ form }));
        return;
      }
      try {
        const data = JSON.parse(raw) as { form?: MonitoringCriterion[] };
        if (Array.isArray(data.form) && data.form.length) {
          setForm(data.form.map(normalizeCriterion));
        } else {
          setForm(defaultForm());
        }
      } catch {
        setForm(defaultForm());
      }
    })();
  }
  return loadPromise;
}

async function persist(): Promise<void> {
  const api = await getFileApi();
  if (!api) return;
  api.write(JSON.stringify({ form }));
}

function clampWeight(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : 3;
  return Math.max(1, Math.min(5, v));
}

let idSeq = 0;
function genId(): string {
  idSeq += 1;
  return `mc_${Date.now().toString(36)}_${idSeq}`;
}

// Normaliza um critério vindo do disco ou do cliente: garante id, limpa strings
// e aplica defaults seguros.
function normalizeCriterion(c: Partial<MonitoringCriterion>): MonitoringCriterion {
  const label = (c.label ?? "").trim();
  return {
    id: (c.id ?? "").trim() || genId(),
    label,
    description: (c.description ?? "").trim(),
    category: (c.category ?? "").trim() || "Geral",
    weight: clampWeight(c.weight),
    critical: Boolean(c.critical),
    enabled: c.enabled === undefined ? true : Boolean(c.enabled),
  };
}

// ---------------------------------------------------------------------------
// API pública (consumida pelos server fns e por análise/agregações).
// ---------------------------------------------------------------------------

export async function getMonitoringForm(): Promise<MonitoringCriterion[]> {
  await ensureLoaded();
  return form.slice();
}

// Substitui a ficha inteira (criação/edição/remoção/reordenação em um payload).
// Ignora critérios com rótulo vazio e garante ids únicos.
export async function saveMonitoringForm(
  criteria: Partial<MonitoringCriterion>[],
): Promise<MonitoringCriterion[]> {
  await ensureLoaded();
  const seen = new Set<string>();
  const cleaned = criteria
    .map(normalizeCriterion)
    .filter((c) => c.label.length > 0)
    .map((c) => {
      // Garante unicidade de id mesmo se o cliente repetir/omitir.
      if (seen.has(c.id)) c.id = genId();
      seen.add(c.id);
      return c;
    });
  if (!cleaned.length) {
    throw new Error("A ficha precisa ter ao menos um critério.");
  }
  setForm(cleaned);
  await persist();
  return form.slice();
}

export async function resetMonitoringForm(): Promise<MonitoringCriterion[]> {
  await ensureLoaded();
  setForm(defaultForm());
  await persist();
  return form.slice();
}

// Rótulos dos critérios ATIVOS, na ordem da ficha. Usado pela análise e pelas
// agregações para que tudo reflita a ficha vigente. Se a ficha estiver sem itens
// ativos, recorre à checklist base para nunca quebrar a avaliação.
export async function getActiveCriteria(): Promise<MonitoringCriterion[]> {
  await ensureLoaded();
  const active = form.filter((c) => c.enabled);
  if (active.length) return active;
  return defaultForm();
}

export async function getActiveChecklistLabels(): Promise<string[]> {
  return (await getActiveCriteria()).map((c) => c.label);
}
