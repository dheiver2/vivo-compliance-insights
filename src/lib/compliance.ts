// Shared analysis contract — safe for both client and server (no secrets here).

export type Severity = "ok" | "warning" | "critical";
export type Sentiment = "positivo" | "neutro" | "negativo";
export type CallStatus = "approved" | "warning" | "critical" | "processing";

export interface ComplianceCheck {
  label: string;
  passed: boolean;
  score: number; // 0-100
  evidence: string;
  // Checklist contextual: quando `false`, o critério NÃO se aplica à natureza
  // desta ligação (ex.: "oferta de produto" numa ligação só de suporte) e por
  // isso é EXCLUÍDO da média de compliance — não conta como reprovação. Itens
  // regulatórios (gravação, identificação, LGPD, confirmação cadastral) são
  // sempre aplicáveis e nunca recebem N/A. `undefined` é tratado como aplicável.
  applicable?: boolean;
}

export interface CallObservation {
  agent: string;
  time: string; // mm:ss or "—"
  note: string;
  severity: Severity;
}

export interface CallAnalysis {
  scoreCompliance: number; // 0-100
  scoreQuality: number; // 0-100
  sentiment: Sentiment;
  summary: string;
  checks: ComplianceCheck[];
  observations: CallObservation[];
  source: "huggingface" | "heuristic";
  model?: string;
}

// Norma principal da plataforma: Formulário de Monitoria de Vendas Vivo Empresas
// (scorecard "COM VENDA", 100 pontos), aplicado às ligações ativas de venda para
// clientes MEI/LTDA. Cada item é a base da Ficha de Monitoria — o peso oficial em
// pontos da norma está indicado na descrição do critério (ver monitoring-form).
export const COMPLIANCE_CHECKLIST = [
  "Prontidão ao atender",
  "Saudação e identificação (nome + Vivo)",
  "Personalização da ligação",
  "Sondagem do cliente",
  "Escuta ativa (não interromper o cliente)",
  "Objetividade e abordagem do responsável",
  "Estratégia de venda e argumentação",
  "Fechamento da venda (informações obrigatórias)",
  "Finalização padrão da ligação",
  "Tabulação administrativa correta",
] as const;

// Faixas de classificação da ficha. Calibradas para refletir a monitoria real de
// call center (não um corte acadêmico): uma ligação substancialmente conforme
// (≥75) é APROVADA; a faixa intermediária (50–74) sinaliza pontos de atenção sem
// reprovar; só abaixo de 50 — lacunas graves/sistêmicas — vira CRÍTICA. Bandas
// menos rígidas evitam reprovar atendimentos bons por desvios menores de roteiro.
export function statusFromScore(score: number): "approved" | "warning" | "critical" {
  if (score >= 75) return "approved";
  if (score >= 50) return "warning";
  return "critical";
}

// Transcrição de exemplo (venda ativa Vivo Empresas para MEI/LTDA), alinhada à
// norma de monitoria de vendas — usada para demonstração rápida do MVP.
export const SAMPLE_TRANSCRIPT = `Atendente: Vivo Empresas, boa tarde! Aqui é o Rafael. Falo com o responsável pelas linhas da empresa?
Cliente: Sou eu mesmo, o João, da padaria.
Atendente: Que bom, senhor João! Me conta, hoje quanto o senhor paga no plano móvel da empresa?
Cliente: Uns R$ 120 por mês.
Atendente: Entendi. E quantas linhas o senhor usa hoje?
Cliente: Três linhas.
Atendente: Perfeito. O senhor usa bastante internet, dados móveis no dia a dia? E já pensou em colocar esse benefício também para os funcionários?
Cliente: Olha, internet a gente usa muito, mas não sei se vale a pena trocar.
Atendente: Compreendo, senhor João. Tenho uma oferta Vivo Empresas com mais dados pelo mesmo valor que o senhor já paga. Posso te explicar o plano?
Cliente: Pode, mas tô meio sem tempo.
Atendente: Bem rápido: são 3 linhas com franquia maior, fidelização de 24 meses, o valor da oferta fica em R$ 99,90, o chip sai sem custo e o plano inclui ligações ilimitadas.
Cliente: Ah, assim ficou interessante. Pode fazer.
Atendente: Fechado então! Vou registrar a contratação. Agradeço a atenção, senhor João, e tenha uma ótima tarde.`;
