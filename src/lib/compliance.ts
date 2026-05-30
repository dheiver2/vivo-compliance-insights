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

// Itens regulatórios auditados em ligações da operadora (base da Ficha de Monitoria).
export const COMPLIANCE_CHECKLIST = [
  "Identificação do atendente",
  "Gravação informada ao cliente",
  "Confirmação de dados cadastrais",
  "Consentimento LGPD para uso de dados",
  "Oferta clara de produto/serviço",
  "Comunicação de prazos e custos",
  "Resumo final e número de protocolo",
  "Encerramento cordial",
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

// Transcrição de exemplo para demonstração rápida do MVP.
export const SAMPLE_TRANSCRIPT = `Atendente: Vivo, bom dia! Aqui é a Mariana. Em que posso ajudar?
Cliente: Oi, eu quero cancelar minha linha, tô pagando caro demais.
Atendente: Entendo. Antes de seguir, o senhor confirma seu CPF, por favor?
Cliente: 123.456.789-00.
Atendente: Obrigada. O senhor tem um plano de R$ 89,90 por mês. Se cancelar agora, há uma multa de fidelidade de R$ 150,00.
Cliente: Multa? Ninguém me falou de multa quando contratei!
Atendente: Sinto muito pelo transtorno. Posso oferecer um plano de R$ 59,90 que mantém a franquia de dados.
Cliente: (irritado) Eu só quero cancelar, isso é um absurdo!
Atendente: Compreendo sua frustração. Vou registrar o cancelamento. O protocolo é VV-882194 e o prazo de efetivação é de até 48 horas.
Cliente: Tá bom então.
Atendente: O cancelamento foi registrado. Mais alguma coisa? Tenha um bom dia.`;
