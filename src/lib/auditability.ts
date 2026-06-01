// Critérios de QUALIDADE / ELEGIBILIDADE para uma ligação entrar na plataforma
// como AUDITÁVEL. Uma ligação só deve ser auditada se tiver matéria-prima
// suficiente para uma avaliação JUSTA de compliance e qualidade — do contrário,
// a nota seria enviesada (ex.: caixa postal, queda, chamada sem atendente).
//
// Os critérios são aplicados em camadas:
//   - listagem/seleção (este módulo): gravação + atendente, a partir dos
//     metadados que a 3C Plus devolve na lista;
//   - API 3C Plus: duração mínima (filtro `minimum_duration` na busca);
//   - servidor (análise): transcrição com conteúdo mínimo após o ASR.

export interface AuditabilityCriterion {
  key: string;
  label: string;
  detail: string;
  // Onde o critério é verificado.
  stage: "lista" | "api" | "servidor";
}

export const AUDITABILITY_CRITERIA: AuditabilityCriterion[] = [
  {
    key: "recording",
    label: "Possui gravação",
    detail: "Há áudio disponível para transcrever e auditar.",
    stage: "lista",
  },
  {
    key: "agent",
    label: "Atendente identificado",
    detail: "Existe um responsável para atribuir a avaliação (não é abandonada).",
    stage: "lista",
  },
  {
    key: "duration",
    label: "Duração mínima",
    detail: "Conversa longa o suficiente — exclui caixa postal e quedas.",
    stage: "api",
  },
  {
    key: "transcript",
    label: "Transcrição com conteúdo",
    detail: "Texto suficiente após a transcrição para uma avaliação confiável.",
    stage: "servidor",
  },
];

// Duração mínima padrão (segundos) para uma ligação ser considerada auditável.
// Abaixo disso costuma ser caixa postal, engano ou queda — sem conversa a avaliar.
export const DEFAULT_MIN_AUDITABLE_SEC = 30;

export interface AuditabilityInput {
  recorded: boolean;
  agent?: string | null;
}

export interface AuditabilityResult {
  auditable: boolean;
  // Motivo curto quando NÃO é auditável (para exibir na linha).
  reason: string;
}

// Avalia os critérios que dependem dos metadados da listagem (gravação +
// atendente). Duração é garantida pelo filtro da API e a transcrição, no
// servidor — por isso não entram aqui.
export function assessAuditability(c: AuditabilityInput): AuditabilityResult {
  if (!c.recorded) return { auditable: false, reason: "sem gravação" };
  if (!c.agent || c.agent.trim() === "") return { auditable: false, reason: "sem atendente" };
  return { auditable: true, reason: "" };
}
