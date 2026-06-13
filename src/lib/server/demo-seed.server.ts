// Semeadura de dados de DEMONSTRAÇÃO — server-only.
//
// Gera ligações auditadas realistas datadas de HOJE e ONTEM, no formato da norma
// de vendas Vivo Empresas vigente (10 critérios), com duração real para os
// indicadores de tempo. Usado pelo endpoint protegido (server fn seedDemoData)
// para popular a plataforma — em produção, persiste no KV.

import { replaceAllCalls, type StoredCall } from "./calls-store.server";
import { statusFromScore } from "../compliance";

// Critério: [label, peso, crítico, [scoreMin, scoreMax]]
const NORM: [string, number, boolean, [number, number]][] = [
  ["Prontidão ao atender", 2, false, [88, 100]],
  ["Saudação e identificação (nome + Vivo)", 2, false, [85, 100]],
  ["Personalização da ligação", 2, false, [55, 95]],
  ["Sondagem do cliente", 5, false, [35, 90]],
  ["Escuta ativa (não interromper o cliente)", 3, true, [55, 98]],
  ["Objetividade e abordagem do responsável", 4, false, [50, 90]],
  ["Estratégia de venda e argumentação", 5, false, [45, 92]],
  ["Fechamento da venda (informações obrigatórias)", 3, true, [30, 95]],
  ["Finalização padrão da ligação", 2, false, [78, 100]],
  ["Tabulação administrativa correta", 2, false, [80, 100]],
];
const AGENTS = [
  "Fernanda Duarte",
  "Carlos Eduardo Lima",
  "Mariana Souza",
  "Rafael Andrade",
  "Juliana Castro",
  "Bruno Almeida",
  "Patrícia Nunes",
];
const TOPICS = [
  "Vendas/Upgrade",
  "Vendas/Upgrade",
  "Vendas/Upgrade",
  "Cobrança/Fatura",
  "Suporte técnico",
  "Portabilidade",
  "Cancelamento",
  "Roaming internacional",
  "Outros",
];
const SENTIMENTS = ["positivo", "positivo", "neutro", "neutro", "negativo"] as const;
const EV_PASS = [
  "Atendido em <5s.",
  "Identificou-se como Vivo Empresas.",
  "Tratou o cliente pelo nome.",
  "Sondou móvel, linhas e dados.",
  "Não interrompeu o cliente.",
  "Abordou o responsável.",
  "Argumentou a oferta e contornou objeção.",
  "Informou fidelização 24m, valor, chip.",
  "Finalização padrão, agradeceu.",
  "Tabulou corretamente.",
];
const EV_FAIL = [
  "Demorou a atender.",
  "Não citou a empresa.",
  "Não personalizou.",
  "Sondagem incompleta.",
  "Interrompeu o cliente.",
  "Não buscou o responsável.",
  "Argumentação fraca.",
  "Omitiu informações obrigatórias.",
  "Encerramento abrupto.",
  "Tabulação incorreta.",
];

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

// Constrói a lista de ligações de demonstração (hoje + ontem). `now`/`rand`
// recebidos de fora porque Date.now()/Math.random() não podem ser chamados no
// runtime de workflows — mas aqui é uma server fn normal, então usamos os reais.
export function buildDemoCalls(now: number, rand: () => number): StoredCall[] {
  const H = 3600 * 1000;
  const rnd = (a: number, b: number) => Math.round(a + rand() * (b - a));
  const pick = <T,>(a: readonly T[]): T => a[Math.floor(rand() * a.length)];
  // 10 hoje, 9 ontem
  const plan = [...Array(10).fill("hoje"), ...Array(9).fill("ontem")];
  const calls: StoredCall[] = [];
  plan.forEach((dia, idx) => {
    const n = idx + 1;
    const checks = NORM.map((c, i) => {
      const score = rnd(c[3][0], c[3][1]);
      const passed = score >= 60;
      return {
        label: c[0],
        passed,
        score,
        evidence: passed ? EV_PASS[i] : EV_FAIL[i],
      };
    });
    let sum = 0;
    let ws = 0;
    checks.forEach((ck, i) => {
      const w = NORM[i][1] * (NORM[i][2] ? 1.5 : 1);
      sum += ck.score * w;
      ws += w;
    });
    const scoreCompliance = clamp(sum / ws);
    const sentiment = pick(SENTIMENTS);
    const scoreQuality = clamp(
      scoreCompliance +
        (sentiment === "positivo" ? rnd(0, 8) : sentiment === "negativo" ? -rnd(4, 14) : rnd(-4, 4)),
    );
    const topic = pick(TOPICS);
    const ageH = dia === "hoje" ? rnd(2, 21) : rnd(26, 46);
    const createdAt = new Date(now - ageH * H).toISOString();
    const durationSec = rnd(95, 430);
    const agentName = pick(AGENTS);
    const observations = checks
      .filter((c) => !c.passed)
      .slice(0, 2)
      .map((c) => ({
        agent: "Mangaba Compliance",
        time: "00:" + String(rnd(5, 55)).padStart(2, "0"),
        note: `${c.label}: ${c.evidence}`,
        severity: (c.label.includes("Fechamento") || c.label.includes("Escuta")
          ? "critical"
          : "warning") as "critical" | "warning",
      }));
    const call: StoredCall = {
      id: `C-${10000 + n}`,
      protocol: `VV-${880000 + n}`,
      createdAt,
      origin: "audio",
      label: `3C Plus · p-2026${100000 + n}`,
      agentName,
      topic,
      scoreCompliance,
      scoreQuality,
      sentiment,
      status: statusFromScore(scoreCompliance),
      summary: `Auditoria automática da ligação de ${topic.toLowerCase()} — aderência ${scoreCompliance}% à norma de vendas Vivo Empresas.`,
      source: idx % 7 === 0 ? "heuristic" : "huggingface",
      model: idx % 7 === 0 ? "heurística local" : "meta-llama/Llama-3.1-8B-Instruct",
      checks,
      observations,
      transcript:
        "Resumo da auditoria.\nScript de monitoria:\n" +
        checks.map((c) => `${c.passed ? "✓" : "✗"} ${c.label} (${c.score}%)`).join("\n"),
      sourceCallId: `p-2026${100000 + n}`,
      durationSec,
    };
    if (idx % 3 === 0) {
      call.signature = {
        agentKeyHash: `hash${n}`,
        agentKeyMasked: `•••.•••.•••-${rnd(10, 99)}`,
        agentName,
        signedAt: createdAt,
        by: "atendente",
      };
    }
    if (idx === 4) {
      call.contestation = {
        status: "aberta",
        openedBy: "atendente",
        openedByMasked: "•••.•••.•••-22",
        reason: "Discordo da nota de Sondagem.",
        criterion: "Sondagem do cliente",
        openedAt: createdAt,
      };
    }
    calls.push(call);
  });
  return calls;
}

// Substitui o acervo pelas ligações de demonstração de hoje/ontem.
export async function seedDemoCalls(): Promise<number> {
  const calls = buildDemoCalls(Date.now(), Math.random);
  return replaceAllCalls(calls);
}
