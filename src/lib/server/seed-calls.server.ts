// Seed inicial — 10 ligações de DEMONSTRAÇÃO representativas de uma operação de
// call center da operadora.
//
// Usado APENAS quando o store nunca foi inicializado (não existe
// .data/calls.json). Os registros abaixo são casos representativos (não
// auditorias verbatim de clientes reais): refletem uma distribuição realista de
// monitoria — a maioria das ligações é conforme, algumas excelentes, poucas em
// atenção e raras críticas. As ligações têm ~3 min em média (duração típica de
// um atendimento). A transcrição completa NÃO é persistida: guarda-se apenas o
// resumo de auditoria que responde ao script de monitoria (LGPD by design).
//
// Se o usuário limpar os dados (Configurações), o arquivo persistido passa a
// existir vazio e o seed NÃO volta — respeitando a ação explícita de limpeza.

import {
  statusFromScore,
  type CallObservation,
  type ComplianceCheck,
  type Sentiment,
} from "../compliance";
import type { CallOrigin, StoredCall } from "./calls-store.server";

const HF_MODEL = "meta-llama/Llama-3.1-8B-Instruct";

function pad(n: number, len: number): string {
  return String(n).padStart(len, "0");
}

interface DemoCase {
  callDate: string;
  origin: CallOrigin;
  agentName: string;
  label: string;
  topic: string;
  scoreCompliance: number;
  scoreQuality: number;
  sentiment: Sentiment;
  durationLabel: string; // duração aproximada da ligação (mm:ss)
  summary: string;
  checks: ComplianceCheck[];
  observations: CallObservation[];
}

// Distribuição calibrada para uma operação saudável: 7 aprovadas, 2 em atenção,
// 1 crítica. Compliance médio ~78% e qualidade ~81% — refletindo um time que
// segue o roteiro na maioria das ligações, com desvios pontuais. Duração média
// ~3 min.
const DEMO_CASES: DemoCase[] = [
  {
    callDate: "2026-05-29T17:32:37-03:00",
    origin: "audio",
    agentName: "Mirelly Julia",
    label: "3C Plus · p-20260529173248224534",
    topic: "Suporte técnico",
    scoreCompliance: 92,
    scoreQuality: 95,
    sentiment: "positivo",
    durationLabel: "03:10",
    summary:
      "Atendimento de suporte conduzido dentro do roteiro: identificação, gravação informada e consentimento LGPD cumpridos, com resolução clara.",
    checks: [
      {
        label: "Identificação do atendente",
        passed: true,
        score: 100,
        evidence: "Apresentou-se como Mirelly, da Vivo, no início da ligação.",
      },
      {
        label: "Gravação informada ao cliente",
        passed: true,
        score: 100,
        evidence: "Informou que a ligação seria gravada para fins de qualidade.",
      },
      {
        label: "Confirmação de dados cadastrais",
        passed: true,
        score: 90,
        evidence: "Confirmou nome e telefone do titular antes de prosseguir.",
      },
      {
        label: "Consentimento LGPD para uso de dados",
        passed: true,
        score: 90,
        evidence: "Solicitou consentimento para uso dos dados no atendimento.",
      },
      {
        label: "Oferta clara de produto/serviço",
        passed: true,
        score: 0,
        evidence: "Ligação exclusivamente de suporte técnico, sem oferta.",
        applicable: false,
      },
      {
        label: "Comunicação de prazos e custos",
        passed: true,
        score: 85,
        evidence: "Informou prazo de resolução de até 24h, sem custo adicional.",
      },
      {
        label: "Resumo final e número de protocolo",
        passed: true,
        score: 95,
        evidence: "Forneceu o número de protocolo e resumiu o que foi feito.",
      },
      {
        label: "Encerramento cordial",
        passed: true,
        score: 100,
        evidence: "Ofereceu ajuda adicional e se despediu cordialmente.",
      },
    ],
    observations: [
      {
        agent: "Mangaba Compliance",
        time: "00:12",
        note: "Abertura completa: identificação, empresa e aviso de gravação.",
        severity: "ok",
      },
      {
        agent: "Mangaba Qualidade",
        time: "01:34",
        note: "Diagnóstico do problema conduzido com clareza e empatia.",
        severity: "ok",
      },
      {
        agent: "Mangaba Compliance",
        time: "02:58",
        note: "Encerramento com protocolo e resumo do atendimento.",
        severity: "ok",
      },
    ],
  },
  {
    callDate: "2026-05-29T17:31:46-03:00",
    origin: "audio",
    agentName: "Fernanda Duarte",
    label: "3C Plus · p-20260529173210212121",
    topic: "Cobrança/Fatura",
    scoreCompliance: 88,
    scoreQuality: 90,
    sentiment: "positivo",
    durationLabel: "02:55",
    summary:
      "Cliente questionou cobrança na fatura; atendente cumpriu o roteiro regulatório e resolveu com desconto aplicado de forma transparente.",
    checks: [
      {
        label: "Identificação do atendente",
        passed: true,
        score: 100,
        evidence: "Apresentou-se com nome e identificou a Vivo.",
      },
      {
        label: "Gravação informada ao cliente",
        passed: true,
        score: 100,
        evidence: "Avisou sobre a gravação logo na abertura.",
      },
      {
        label: "Confirmação de dados cadastrais",
        passed: true,
        score: 85,
        evidence: "Confirmou titularidade antes de tratar da fatura.",
      },
      {
        label: "Consentimento LGPD para uso de dados",
        passed: true,
        score: 90,
        evidence: "Pediu consentimento para consultar os dados de cobrança.",
      },
      {
        label: "Oferta clara de produto/serviço",
        passed: true,
        score: 70,
        evidence: "Apresentou desconto na fatura de forma clara.",
      },
      {
        label: "Comunicação de prazos e custos",
        passed: true,
        score: 80,
        evidence: "Informou o novo valor e a data de vencimento.",
      },
      {
        label: "Resumo final e número de protocolo",
        passed: true,
        score: 90,
        evidence: "Resumiu o acordo e forneceu o protocolo.",
      },
      {
        label: "Encerramento cordial",
        passed: true,
        score: 95,
        evidence: "Encerramento cordial, agradecendo o contato.",
      },
    ],
    observations: [
      {
        agent: "Mangaba Compliance",
        time: "00:10",
        note: "Identificação e aviso de gravação corretos.",
        severity: "ok",
      },
      {
        agent: "Mangaba Qualidade",
        time: "01:20",
        note: "Explicou a origem da cobrança com transparência.",
        severity: "ok",
      },
      {
        agent: "Mangaba Compliance",
        time: "02:40",
        note: "Confirmou o desconto e forneceu protocolo.",
        severity: "ok",
      },
    ],
  },
  {
    callDate: "2026-05-22T18:00:27-03:00",
    origin: "audio",
    agentName: "Thays Vivianne",
    label: "3C Plus · p-20260522180047198118",
    topic: "Vendas/Upgrade",
    scoreCompliance: 84,
    scoreQuality: 86,
    sentiment: "positivo",
    durationLabel: "03:20",
    summary:
      "Venda de upgrade conduzida com boa apresentação da oferta; faltou detalhar a multa de fidelidade no fechamento.",
    checks: [
      {
        label: "Identificação do atendente",
        passed: true,
        score: 100,
        evidence: "Apresentou-se e identificou a empresa.",
      },
      {
        label: "Gravação informada ao cliente",
        passed: true,
        score: 90,
        evidence: "Informou a gravação na abertura.",
      },
      {
        label: "Confirmação de dados cadastrais",
        passed: true,
        score: 80,
        evidence: "Confirmou dados básicos do titular.",
      },
      {
        label: "Consentimento LGPD para uso de dados",
        passed: true,
        score: 80,
        evidence: "Solicitou consentimento para uso dos dados.",
      },
      {
        label: "Oferta clara de produto/serviço",
        passed: true,
        score: 90,
        evidence: "Apresentou o upgrade com franquia e benefícios de forma clara.",
      },
      {
        label: "Comunicação de prazos e custos",
        passed: true,
        score: 70,
        evidence: "Informou valor e vigência; detalhou pouco a multa de fidelidade.",
      },
      {
        label: "Resumo final e número de protocolo",
        passed: true,
        score: 75,
        evidence: "Resumiu a contratação e forneceu protocolo.",
      },
      {
        label: "Encerramento cordial",
        passed: true,
        score: 90,
        evidence: "Despedida cordial, confirmando a ativação.",
      },
    ],
    observations: [
      {
        agent: "Mangaba Compliance",
        time: "00:14",
        note: "Abertura regulatória completa.",
        severity: "ok",
      },
      {
        agent: "Mangaba Qualidade",
        time: "01:48",
        note: "Oferta apresentada com benefícios bem destacados.",
        severity: "ok",
      },
      {
        agent: "Mangaba Compliance",
        time: "02:50",
        note: "Multa de fidelidade mencionada sem detalhar valor.",
        severity: "warning",
      },
    ],
  },
  {
    callDate: "2026-05-22T17:59:15-03:00",
    origin: "audio",
    agentName: "Mariana Gabrielly",
    label: "3C Plus · p-20260522175932181764",
    topic: "Portabilidade",
    scoreCompliance: 78,
    scoreQuality: 82,
    sentiment: "neutro",
    durationLabel: "02:40",
    summary:
      "Solicitação de portabilidade atendida; roteiro cumprido com pequenos desvios na comunicação de custos.",
    checks: [
      {
        label: "Identificação do atendente",
        passed: true,
        score: 100,
        evidence: "Apresentou-se e identificou a Vivo.",
      },
      {
        label: "Gravação informada ao cliente",
        passed: true,
        score: 85,
        evidence: "Informou a gravação da ligação.",
      },
      {
        label: "Confirmação de dados cadastrais",
        passed: true,
        score: 75,
        evidence: "Confirmou dados do titular para a portabilidade.",
      },
      {
        label: "Consentimento LGPD para uso de dados",
        passed: true,
        score: 70,
        evidence: "Mencionou o uso dos dados e obteve concordância.",
      },
      {
        label: "Oferta clara de produto/serviço",
        passed: true,
        score: 70,
        evidence: "Explicou o plano de destino da portabilidade.",
      },
      {
        label: "Comunicação de prazos e custos",
        passed: true,
        score: 65,
        evidence: "Informou o prazo de portabilidade; custo comunicado parcialmente.",
      },
      {
        label: "Resumo final e número de protocolo",
        passed: true,
        score: 70,
        evidence: "Forneceu o protocolo do pedido.",
      },
      {
        label: "Encerramento cordial",
        passed: true,
        score: 85,
        evidence: "Encerrou de forma cordial.",
      },
    ],
    observations: [
      {
        agent: "Mangaba Compliance",
        time: "00:11",
        note: "Identificação e gravação informadas.",
        severity: "ok",
      },
      {
        agent: "Mangaba Compliance",
        time: "01:30",
        note: "Custos da portabilidade comunicados de forma incompleta.",
        severity: "warning",
      },
      {
        agent: "Mangaba Qualidade",
        time: "02:25",
        note: "Cliente seguiu neutro; dúvida sobre prazo esclarecida.",
        severity: "ok",
      },
    ],
  },
  {
    callDate: "2026-05-22T17:59:12-03:00",
    origin: "audio",
    agentName: "Fabiola Sena",
    label: "3C Plus · p-20260522175932190836",
    topic: "Cobrança/Fatura",
    scoreCompliance: 90,
    scoreQuality: 88,
    sentiment: "positivo",
    durationLabel: "03:05",
    summary:
      "Emissão de 2ª via de fatura conduzida com excelência regulatória; sem oferta por ser atendimento de serviço.",
    checks: [
      {
        label: "Identificação do atendente",
        passed: true,
        score: 100,
        evidence: "Apresentou-se com nome e empresa.",
      },
      {
        label: "Gravação informada ao cliente",
        passed: true,
        score: 100,
        evidence: "Avisou sobre a gravação na abertura.",
      },
      {
        label: "Confirmação de dados cadastrais",
        passed: true,
        score: 90,
        evidence: "Confirmou titularidade antes de enviar a 2ª via.",
      },
      {
        label: "Consentimento LGPD para uso de dados",
        passed: true,
        score: 95,
        evidence: "Obteve consentimento para envio por e-mail.",
      },
      {
        label: "Oferta clara de produto/serviço",
        passed: true,
        score: 0,
        evidence: "Atendimento de 2ª via de fatura, sem oferta de produto.",
        applicable: false,
      },
      {
        label: "Comunicação de prazos e custos",
        passed: true,
        score: 85,
        evidence: "Informou que a 2ª via não tem custo e o prazo de envio.",
      },
      {
        label: "Resumo final e número de protocolo",
        passed: true,
        score: 90,
        evidence: "Resumiu o atendimento e forneceu protocolo.",
      },
      {
        label: "Encerramento cordial",
        passed: true,
        score: 95,
        evidence: "Despedida cordial e oferta de ajuda adicional.",
      },
    ],
    observations: [
      {
        agent: "Mangaba Compliance",
        time: "00:09",
        note: "Abertura regulatória impecável.",
        severity: "ok",
      },
      {
        agent: "Mangaba Compliance",
        time: "01:40",
        note: "Consentimento LGPD para envio dos dados registrado.",
        severity: "ok",
      },
      {
        agent: "Mangaba Qualidade",
        time: "02:52",
        note: "Cliente satisfeito; protocolo informado.",
        severity: "ok",
      },
    ],
  },
  {
    callDate: "2026-05-22T17:59:02-03:00",
    origin: "audio",
    agentName: "Inglis Gregorio",
    label: "3C Plus · p-20260522175919198128",
    topic: "Suporte técnico",
    scoreCompliance: 72,
    scoreQuality: 75,
    sentiment: "neutro",
    durationLabel: "02:50",
    summary:
      "Suporte técnico resolvido, mas com consentimento LGPD pouco explícito e resumo final incompleto.",
    checks: [
      {
        label: "Identificação do atendente",
        passed: true,
        score: 90,
        evidence: "Apresentou-se, mas não reforçou a empresa.",
      },
      {
        label: "Gravação informada ao cliente",
        passed: true,
        score: 80,
        evidence: "Informou a gravação da ligação.",
      },
      {
        label: "Confirmação de dados cadastrais",
        passed: true,
        score: 70,
        evidence: "Confirmou parte dos dados do titular.",
      },
      {
        label: "Consentimento LGPD para uso de dados",
        passed: true,
        score: 65,
        evidence: "Mencionou o uso de dados sem consentimento explícito.",
      },
      {
        label: "Oferta clara de produto/serviço",
        passed: true,
        score: 0,
        evidence: "Ligação de suporte, sem oferta de produto.",
        applicable: false,
      },
      {
        label: "Comunicação de prazos e custos",
        passed: true,
        score: 70,
        evidence: "Informou prazo de solução do chamado, sem custo.",
      },
      {
        label: "Resumo final e número de protocolo",
        passed: true,
        score: 60,
        evidence: "Forneceu protocolo, mas o resumo ficou incompleto.",
      },
      {
        label: "Encerramento cordial",
        passed: true,
        score: 80,
        evidence: "Encerramento cordial.",
      },
    ],
    observations: [
      {
        agent: "Mangaba Compliance",
        time: "00:13",
        note: "Identificação ok; aviso de gravação presente.",
        severity: "ok",
      },
      {
        agent: "Mangaba Compliance",
        time: "01:25",
        note: "Consentimento LGPD não foi solicitado de forma explícita.",
        severity: "warning",
      },
      {
        agent: "Mangaba Qualidade",
        time: "02:35",
        note: "Resumo final do atendimento ficou incompleto.",
        severity: "warning",
      },
    ],
  },
  {
    callDate: "2026-05-22T17:59:02-03:00",
    origin: "audio",
    agentName: "Raabe Silva",
    label: "3C Plus · p-20260522175922182499",
    topic: "Vendas/Upgrade",
    scoreCompliance: 81,
    scoreQuality: 84,
    sentiment: "positivo",
    durationLabel: "03:15",
    summary:
      "Upgrade contratado com boa condução; prazos e resumo final poderiam ter sido mais detalhados.",
    checks: [
      {
        label: "Identificação do atendente",
        passed: true,
        score: 100,
        evidence: "Apresentou-se e identificou a Vivo.",
      },
      {
        label: "Gravação informada ao cliente",
        passed: true,
        score: 90,
        evidence: "Informou a gravação na abertura.",
      },
      {
        label: "Confirmação de dados cadastrais",
        passed: true,
        score: 80,
        evidence: "Confirmou dados do titular.",
      },
      {
        label: "Consentimento LGPD para uso de dados",
        passed: true,
        score: 80,
        evidence: "Solicitou consentimento para uso dos dados.",
      },
      {
        label: "Oferta clara de produto/serviço",
        passed: true,
        score: 85,
        evidence: "Apresentou o upgrade com benefícios de forma clara.",
      },
      {
        label: "Comunicação de prazos e custos",
        passed: true,
        score: 70,
        evidence: "Informou valor e vigência; faltou detalhar a multa.",
      },
      {
        label: "Resumo final e número de protocolo",
        passed: true,
        score: 70,
        evidence: "Forneceu protocolo; resumo objetivo.",
      },
      {
        label: "Encerramento cordial",
        passed: true,
        score: 85,
        evidence: "Despedida cordial.",
      },
    ],
    observations: [
      {
        agent: "Mangaba Compliance",
        time: "00:12",
        note: "Abertura regulatória completa.",
        severity: "ok",
      },
      {
        agent: "Mangaba Qualidade",
        time: "01:50",
        note: "Boa argumentação de venda; cliente receptivo.",
        severity: "ok",
      },
      {
        agent: "Mangaba Compliance",
        time: "03:00",
        note: "Multa de fidelidade comunicada de forma resumida.",
        severity: "warning",
      },
    ],
  },
  {
    callDate: "2026-05-29T17:30:10-03:00",
    origin: "audio",
    agentName: "Mirelly Julia",
    label: "3C Plus · p-20260529173025224534",
    topic: "Roaming internacional",
    scoreCompliance: 64,
    scoreQuality: 70,
    sentiment: "neutro",
    durationLabel: "03:30",
    summary:
      "Ativação de roaming com falhas pontuais: consentimento LGPD e custos comunicados de forma incompleta.",
    checks: [
      {
        label: "Identificação do atendente",
        passed: true,
        score: 90,
        evidence: "Apresentou-se no início da ligação.",
      },
      {
        label: "Gravação informada ao cliente",
        passed: true,
        score: 70,
        evidence: "Informou a gravação, porém tardiamente.",
      },
      {
        label: "Confirmação de dados cadastrais",
        passed: true,
        score: 65,
        evidence: "Confirmou parte dos dados do titular.",
      },
      {
        label: "Consentimento LGPD para uso de dados",
        passed: true,
        score: 60,
        evidence: "Consentimento LGPD mencionado de forma vaga.",
      },
      {
        label: "Oferta clara de produto/serviço",
        passed: true,
        score: 65,
        evidence: "Apresentou o pacote de roaming; faltou clareza no preço.",
      },
      {
        label: "Comunicação de prazos e custos",
        passed: true,
        score: 55,
        evidence: "Explicou a ativação; custos por país comunicados parcialmente.",
      },
      {
        label: "Resumo final e número de protocolo",
        passed: true,
        score: 55,
        evidence: "Forneceu protocolo; resumo enxuto.",
      },
      {
        label: "Encerramento cordial",
        passed: true,
        score: 75,
        evidence: "Encerramento cordial.",
      },
    ],
    observations: [
      {
        agent: "Mangaba Compliance",
        time: "00:18",
        note: "Aviso de gravação ocorreu após o início do atendimento.",
        severity: "warning",
      },
      {
        agent: "Mangaba Compliance",
        time: "01:40",
        note: "Consentimento LGPD não ficou explícito.",
        severity: "warning",
      },
      {
        agent: "Mangaba Qualidade",
        time: "03:05",
        note: "Custos de roaming comunicados de forma incompleta.",
        severity: "warning",
      },
    ],
  },
  {
    callDate: "2026-04-29T17:59:56-03:00",
    origin: "audio",
    agentName: "Aline Herculano",
    label: "3C Plus · p-20260429180003198122",
    topic: "Cancelamento",
    scoreCompliance: 48,
    scoreQuality: 55,
    sentiment: "negativo",
    durationLabel: "02:35",
    summary:
      "Pedido de cancelamento com falhas críticas: aviso de gravação tardio, consentimento LGPD ausente e multa de fidelidade não detalhada.",
    checks: [
      {
        label: "Identificação do atendente",
        passed: true,
        score: 80,
        evidence: "Apresentou-se, mas sem reforçar a empresa.",
      },
      {
        label: "Gravação informada ao cliente",
        passed: false,
        score: 40,
        evidence: "Aviso de gravação ocorreu tardiamente.",
      },
      {
        label: "Confirmação de dados cadastrais",
        passed: true,
        score: 50,
        evidence: "Confirmou apenas o nome do titular.",
      },
      {
        label: "Consentimento LGPD para uso de dados",
        passed: false,
        score: 35,
        evidence: "Não obteve consentimento claro para uso dos dados.",
      },
      {
        label: "Oferta clara de produto/serviço",
        passed: false,
        score: 40,
        evidence: "Tentativa de retenção sem apresentar a oferta com clareza.",
      },
      {
        label: "Comunicação de prazos e custos",
        passed: false,
        score: 35,
        evidence: "Não detalhou a multa de fidelidade ao registrar o cancelamento.",
      },
      {
        label: "Resumo final e número de protocolo",
        passed: true,
        score: 60,
        evidence: "Forneceu o protocolo do cancelamento.",
      },
      {
        label: "Encerramento cordial",
        passed: true,
        score: 55,
        evidence: "Encerramento educado, ainda que com cliente insatisfeito.",
      },
    ],
    observations: [
      {
        agent: "Mangaba Compliance",
        time: "00:22",
        note: "Aviso de gravação só ocorreu após o cliente iniciar a demanda.",
        severity: "critical",
      },
      {
        agent: "Mangaba Compliance",
        time: "01:15",
        note: "Consentimento LGPD não foi obtido.",
        severity: "critical",
      },
      {
        agent: "Mangaba Compliance",
        time: "02:05",
        note: "Multa de fidelidade não foi detalhada antes do cancelamento.",
        severity: "critical",
      },
    ],
  },
  {
    callDate: "2026-04-29T17:59:56-03:00",
    origin: "audio",
    agentName: "Fernanda Duarte",
    label: "3C Plus · p-20260429180012212121",
    topic: "Vendas/Upgrade",
    scoreCompliance: 86,
    scoreQuality: 89,
    sentiment: "positivo",
    durationLabel: "03:00",
    summary:
      "Venda de upgrade conduzida com transparência e roteiro regulatório completo; pequeno desvio no detalhamento de prazos.",
    checks: [
      {
        label: "Identificação do atendente",
        passed: true,
        score: 100,
        evidence: "Apresentou-se e identificou a Vivo.",
      },
      {
        label: "Gravação informada ao cliente",
        passed: true,
        score: 95,
        evidence: "Informou a gravação na abertura.",
      },
      {
        label: "Confirmação de dados cadastrais",
        passed: true,
        score: 85,
        evidence: "Confirmou dados do titular.",
      },
      {
        label: "Consentimento LGPD para uso de dados",
        passed: true,
        score: 90,
        evidence: "Solicitou consentimento para uso dos dados.",
      },
      {
        label: "Oferta clara de produto/serviço",
        passed: true,
        score: 90,
        evidence: "Apresentou o upgrade de forma transparente.",
      },
      {
        label: "Comunicação de prazos e custos",
        passed: true,
        score: 75,
        evidence: "Informou valor e vigência; prazo de ativação resumido.",
      },
      {
        label: "Resumo final e número de protocolo",
        passed: true,
        score: 80,
        evidence: "Resumiu a contratação e forneceu protocolo.",
      },
      {
        label: "Encerramento cordial",
        passed: true,
        score: 90,
        evidence: "Despedida cordial confirmando a ativação.",
      },
    ],
    observations: [
      {
        agent: "Mangaba Compliance",
        time: "00:10",
        note: "Abertura regulatória completa.",
        severity: "ok",
      },
      {
        agent: "Mangaba Qualidade",
        time: "01:30",
        note: "Oferta apresentada com transparência sobre benefícios e valor.",
        severity: "ok",
      },
      {
        agent: "Mangaba Compliance",
        time: "02:48",
        note: "Prazo de ativação comunicado de forma resumida.",
        severity: "warning",
      },
    ],
  },
];

// Monta a transcrição de auditoria (resumo do caso + script de monitoria +
// observações) a partir do caso. A transcrição verbatim do cliente NÃO é
// armazenada (LGPD by design): persiste-se apenas este resumo auditável.
function buildAuditTranscript(spec: DemoCase): string {
  const scriptLines = spec.checks.map((c) => {
    if (c.applicable === false) {
      return `— ${c.label} (N/A) — ${c.evidence || "Não se aplica a esta ligação."}`;
    }
    const mark = c.score >= 75 ? "✓" : c.score >= 50 ? "≈" : "✗";
    return `${mark} ${c.label} (${c.score}%)${c.evidence ? ` — ${c.evidence}` : ""}`;
  });
  const obsLines = spec.observations.map((o) => `• [${o.severity}] ${o.time} ${o.note}`);
  return [
    spec.summary,
    "",
    `Duração da ligação: ~${spec.durationLabel}`,
    "",
    "Script de monitoria:",
    scriptLines.join("\n"),
    "",
    "Observações:",
    obsLines.join("\n"),
  ].join("\n");
}

// Constrói os 10 registros de demonstração com ids/protocolos sequenciais. As
// datas vêm de `callDate`. Retorna as ligações da mais recente para a mais
// antiga (convenção do store).
export function buildSeedCalls(): { calls: StoredCall[]; nextSeq: number } {
  // Ordena da mais antiga para a mais recente para atribuir ids crescentes
  // (C-10001 = ligação mais antiga).
  const ordered = [...DEMO_CASES].sort(
    (a, b) => new Date(a.callDate).getTime() - new Date(b.callDate).getTime(),
  );

  const calls = ordered.map((spec, idx) => {
    const n = idx + 1;
    const record: StoredCall = {
      id: `C-${pad(10000 + n, 5)}`,
      protocol: `VV-${pad(880000 + n, 6)}`,
      createdAt: new Date(spec.callDate).toISOString(),
      origin: spec.origin,
      label: spec.label,
      agentName: spec.agentName,
      topic: spec.topic,
      scoreCompliance: spec.scoreCompliance,
      scoreQuality: spec.scoreQuality,
      sentiment: spec.sentiment,
      status: statusFromScore(spec.scoreCompliance),
      summary: spec.summary,
      source: "huggingface",
      model: HF_MODEL,
      checks: spec.checks,
      observations: spec.observations,
      transcript: buildAuditTranscript(spec),
    };
    return record;
  });

  // Store mantém o mais recente primeiro.
  calls.reverse();
  return { calls, nextSeq: calls.length + 1 };
}
