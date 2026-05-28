export type CallStatus = "approved" | "warning" | "critical" | "processing";

export interface CallRecord {
  id: string;
  agent: string;
  customer: string;
  duration: string;
  date: string;
  protocol: string;
  scoreCompliance: number;
  scoreQuality: number;
  status: CallStatus;
  topic: string;
  aiAgent: string;
}

export const calls: CallRecord[] = [
  { id: "C-10293", agent: "Mariana Souza", customer: "João P. Lima", duration: "08:42", date: "2026-05-28 09:14", protocol: "VV-882193", scoreCompliance: 96, scoreQuality: 92, status: "approved", topic: "Portabilidade", aiAgent: "Compliance-Bot v3" },
  { id: "C-10294", agent: "Carlos Mendes", customer: "Ana Beatriz R.", duration: "12:05", date: "2026-05-28 09:22", protocol: "VV-882194", scoreCompliance: 71, scoreQuality: 68, status: "warning", topic: "Reclamação cobrança", aiAgent: "Quality-Bot v2" },
  { id: "C-10295", agent: "Patrícia Alves", customer: "Roberto F. Castro", duration: "05:31", date: "2026-05-28 09:35", protocol: "VV-882195", scoreCompliance: 45, scoreQuality: 52, status: "critical", topic: "Cancelamento", aiAgent: "Compliance-Bot v3" },
  { id: "C-10296", agent: "Bruno Tavares", customer: "Letícia M. Sá", duration: "14:18", date: "2026-05-28 09:48", protocol: "VV-882196", scoreCompliance: 88, scoreQuality: 91, status: "approved", topic: "Upgrade plano", aiAgent: "Sales-Bot v1" },
  { id: "C-10297", agent: "Fernanda Lopes", customer: "Diego Almeida", duration: "06:54", date: "2026-05-28 10:02", protocol: "VV-882197", scoreCompliance: 0, scoreQuality: 0, status: "processing", topic: "Suporte técnico", aiAgent: "—" },
  { id: "C-10298", agent: "Rodrigo Pinheiro", customer: "Camila Duarte", duration: "09:27", date: "2026-05-28 10:15", protocol: "VV-882198", scoreCompliance: 82, scoreQuality: 79, status: "approved", topic: "Fatura digital", aiAgent: "Quality-Bot v2" },
  { id: "C-10299", agent: "Juliana Reis", customer: "Marcos V. Brito", duration: "11:43", date: "2026-05-28 10:31", protocol: "VV-882199", scoreCompliance: 64, scoreQuality: 58, status: "warning", topic: "Roaming internacional", aiAgent: "Compliance-Bot v3" },
  { id: "C-10300", agent: "Thiago Barbosa", customer: "Renata Cardoso", duration: "07:09", date: "2026-05-28 10:47", protocol: "VV-882200", scoreCompliance: 94, scoreQuality: 96, status: "approved", topic: "Renovação fidelidade", aiAgent: "Sales-Bot v1" },
];

export const kpis = {
  totalCalls: { value: 12847, delta: 8.2 },
  avgCompliance: { value: 84.6, delta: 2.4 },
  avgQuality: { value: 81.3, delta: -1.1 },
  criticalAlerts: { value: 37, delta: 12.5 },
};

export const dailyTrend = [
  { day: "Seg", compliance: 81, quality: 78 },
  { day: "Ter", compliance: 84, quality: 80 },
  { day: "Qua", compliance: 79, quality: 76 },
  { day: "Qui", compliance: 86, quality: 83 },
  { day: "Sex", compliance: 88, quality: 85 },
  { day: "Sáb", compliance: 83, quality: 81 },
  { day: "Dom", compliance: 85, quality: 82 },
];

export const topicDistribution = [
  { name: "Suporte técnico", value: 32 },
  { name: "Cobrança", value: 24 },
  { name: "Vendas", value: 18 },
  { name: "Cancelamento", value: 14 },
  { name: "Portabilidade", value: 12 },
];

export const complianceItems = [
  { label: "Identificação do atendente", score: 98 },
  { label: "Gravação informada ao cliente", score: 95 },
  { label: "Confirmação de dados cadastrais", score: 87 },
  { label: "Oferta clara de produto/serviço", score: 79 },
  { label: "Comunicação de prazos e custos", score: 72 },
  { label: "Resumo final e número de protocolo", score: 68 },
  { label: "Encerramento cordial", score: 91 },
];

export const aiAgents = [
  { name: "Compliance-Bot v3", role: "Auditoria regulatória", calls: 4821, accuracy: 96.4, status: "active" as const },
  { name: "Quality-Bot v2", role: "Score de qualidade", calls: 4233, accuracy: 92.1, status: "active" as const },
  { name: "Sales-Bot v1", role: "Análise de conversão", calls: 2104, accuracy: 88.7, status: "active" as const },
  { name: "Sentiment-Bot β", role: "Análise emocional", calls: 1689, accuracy: 84.2, status: "beta" as const },
];
