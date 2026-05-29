// Seed de demonstração — 10 ligações reais de uma operadora (contexto Vivo).
//
// Usado APENAS quando o store nunca foi inicializado (não existe
// .data/calls.json). Dá ao Dashboard, à Equipe e às Ligações um conjunto de
// dados realista logo no primeiro acesso, sem precisar rodar análises na mão.
// Se o usuário limpar os dados (Configurações), o arquivo persistido passa a
// existir vazio e o seed NÃO volta — respeitando a ação explícita de limpeza.

import {
  COMPLIANCE_CHECKLIST,
  statusFromScore,
  type CallObservation,
  type ComplianceCheck,
  type Sentiment,
} from "../compliance";
import type { CallOrigin, StoredCall } from "./calls-store.server";

const DAY_MS = 24 * 60 * 60 * 1000;
const HF_MODEL = "meta-llama/Llama-3.1-8B-Instruct";

function pad(n: number, len: number): string {
  return String(n).padStart(len, "0");
}

// Monta os 8 itens da checklist a partir das notas e evidências do caso.
function buildChecks(scores: number[], evidence: string[]): ComplianceCheck[] {
  return COMPLIANCE_CHECKLIST.map((label, i) => ({
    label,
    score: scores[i],
    passed: scores[i] >= 70,
    evidence: evidence[i],
  }));
}

interface CaseSpec {
  daysAgo: number;
  hours: number;
  origin: CallOrigin;
  agentName: string;
  label: string;
  topic: string;
  scoreCompliance: number;
  scoreQuality: number;
  sentiment: Sentiment;
  summary: string;
  source: StoredCall["source"];
  checkScores: number[];
  checkEvidence: string[];
  observations: CallObservation[];
  transcript: string;
}

const SPECS: CaseSpec[] = [
  {
    daysAgo: 1,
    hours: 2,
    origin: "audio",
    agentName: "Ana Beatriz Ferreira",
    label: "ligacao_fatura_2026-05-28.mp3",
    topic: "Cobrança/Fatura",
    scoreCompliance: 96,
    scoreQuality: 93,
    sentiment: "positivo",
    summary:
      "Cliente questionou cobrança duplicada na fatura. Atendente identificou-se, confirmou cadastro com LGPD, localizou o erro, gerou estorno e informou prazo e protocolo. Atendimento exemplar.",
    source: "huggingface",
    checkScores: [100, 100, 100, 95, 90, 95, 100, 100],
    checkEvidence: [
      "\"Aqui é a Ana, da Vivo\" logo na abertura.",
      "\"Esta ligação está sendo gravada.\"",
      "CPF e data de nascimento confirmados.",
      "Pediu consentimento para tratar dados da fatura.",
      "Explicou claramente o estorno do valor duplicado.",
      "Informou prazo de 2 ciclos para o crédito.",
      "Protocolo VV-880001 lido ao final.",
      "\"Obrigada por escolher a Vivo, tenha um ótimo dia.\"",
    ],
    observations: [
      { agent: "Mangaba Compliance", time: "00:12", note: "Identificação e aviso de gravação corretos.", severity: "ok" },
      { agent: "Mangaba Qualidade", time: "02:40", note: "Resolução clara e estorno confirmado.", severity: "ok" },
      { agent: "Mangaba Sentimento", time: "03:50", note: "Cliente encerrou satisfeito e agradeceu.", severity: "ok" },
    ],
    transcript:
      "Atendente: Vivo, boa tarde! Aqui é a Ana Beatriz. Esta ligação está sendo gravada. Em que posso ajudar?\nCliente: Oi, vi uma cobrança repetida na minha fatura desse mês.\nAtendente: Vou verificar. O senhor confirma seu CPF e data de nascimento, por favor? E autoriza eu consultar os dados da sua fatura?\nCliente: Claro. 111.222.333-44, 10/03/1985.\nAtendente: Obrigada. Realmente houve uma duplicidade de R$ 49,90. Vou gerar o estorno agora; o crédito aparece em até dois ciclos.\nCliente: Que ótimo, obrigado pela rapidez!\nAtendente: O protocolo é VV-880001. Mais alguma coisa? Obrigada por escolher a Vivo, tenha um ótimo dia!",
  },
  {
    daysAgo: 2,
    hours: 5,
    origin: "audio",
    agentName: "Carlos Eduardo Lima",
    label: "ligacao_suporte_2026-05-27.mp3",
    topic: "Suporte técnico",
    scoreCompliance: 88,
    scoreQuality: 90,
    sentiment: "neutro",
    summary:
      "Cliente sem sinal de internet fixa. Atendente identificou-se, confirmou cadastro, fez testes remotos e abriu chamado técnico com prazo. Faltou reforçar o consentimento LGPD de forma explícita.",
    source: "huggingface",
    checkScores: [100, 95, 90, 65, 90, 90, 95, 90],
    checkEvidence: [
      "Identificação no início da chamada.",
      "Aviso de gravação informado.",
      "Confirmou nome e número da linha.",
      "Consentimento LGPD não foi dito de forma explícita.",
      "Explicou o procedimento de reparo.",
      "Informou prazo de 24h para visita técnica.",
      "Protocolo informado ao final.",
      "Encerramento educado.",
    ],
    observations: [
      { agent: "Mangaba Compliance", time: "01:05", note: "Consentimento LGPD não verbalizado explicitamente.", severity: "warning" },
      { agent: "Mangaba Qualidade", time: "03:20", note: "Diagnóstico técnico conduzido com clareza.", severity: "ok" },
    ],
    transcript:
      "Atendente: Vivo, bom dia, aqui é o Carlos. A ligação é gravada. Como posso ajudar?\nCliente: Minha internet caiu desde ontem.\nAtendente: Me confirma seu nome e o número da linha? Vou fazer um teste remoto.\nCliente: Carlos Henrique, número 11 4002-8922.\nAtendente: Identifiquei instabilidade no sinal. Vou abrir um chamado técnico, a visita acontece em até 24 horas.\nCliente: Tá certo.\nAtendente: Protocolo VV-880002. Mais alguma coisa? Obrigado e bom dia.",
  },
  {
    daysAgo: 3,
    hours: 7,
    origin: "texto",
    agentName: "Mariana Souza",
    label: "Transcrição — cancelamento linha pós",
    topic: "Cancelamento",
    scoreCompliance: 74,
    scoreQuality: 67,
    sentiment: "negativo",
    summary:
      "Cliente pediu cancelamento alegando preço alto. Atendente informou multa de fidelidade não esclarecida na contratação. Cliente ficou irritado. Faltou empatia e oferta de retenção mais clara.",
    source: "huggingface",
    checkScores: [90, 85, 80, 70, 60, 75, 90, 45],
    checkEvidence: [
      "\"Aqui é a Mariana\" na abertura.",
      "Gravação informada.",
      "CPF confirmado.",
      "Tratamento de dados mencionado de forma breve.",
      "Oferta de retenção pouco detalhada.",
      "Multa e prazo informados, mas tardiamente.",
      "Protocolo VV-882194 informado.",
      "Encerramento seco, sem acolher a frustração do cliente.",
    ],
    observations: [
      { agent: "Mangaba Sentimento", time: "01:30", note: "Cliente demonstrou irritação ao saber da multa.", severity: "warning" },
      { agent: "Mangaba Qualidade", time: "02:10", note: "Faltou empatia no encerramento.", severity: "warning" },
      { agent: "Mangaba Compliance", time: "00:40", note: "Multa de fidelidade comunicada após pedido de cancelamento.", severity: "warning" },
    ],
    transcript:
      "Atendente: Vivo, bom dia! Aqui é a Mariana. Em que posso ajudar?\nCliente: Quero cancelar minha linha, tá caro demais.\nAtendente: Entendo. Confirma seu CPF, por favor?\nCliente: 123.456.789-00.\nAtendente: O senhor tem plano de R$ 89,90. Há multa de fidelidade de R$ 150,00 se cancelar agora.\nCliente: Multa? Ninguém me falou disso!\nAtendente: Posso oferecer um plano de R$ 59,90 mantendo a franquia.\nCliente: Eu só quero cancelar, isso é um absurdo!\nAtendente: Vou registrar. Protocolo VV-882194, efetivação em até 48 horas. Bom dia.",
  },
  {
    daysAgo: 4,
    hours: 3,
    origin: "audio",
    agentName: "Rafael Almeida",
    label: "ligacao_upgrade_2026-05-25.mp3",
    topic: "Vendas/Upgrade",
    scoreCompliance: 91,
    scoreQuality: 94,
    sentiment: "positivo",
    summary:
      "Cliente aceitou upgrade para plano com mais dados. Atendente apresentou oferta de forma transparente, detalhou custos e prazos, confirmou aceite e registrou protocolo. Boa experiência.",
    source: "huggingface",
    checkScores: [100, 95, 90, 85, 95, 95, 90, 90],
    checkEvidence: [
      "Identificação clara do atendente.",
      "Aviso de gravação.",
      "Cadastro confirmado.",
      "Consentimento para oferta registrado.",
      "Oferta de upgrade explicada em detalhe.",
      "Custos e cobrança proporcional informados.",
      "Protocolo de adesão fornecido.",
      "Encerramento cordial.",
    ],
    observations: [
      { agent: "Mangaba Qualidade", time: "02:15", note: "Oferta apresentada com transparência de custos.", severity: "ok" },
      { agent: "Mangaba Compliance", time: "03:05", note: "Aceite do cliente confirmado verbalmente.", severity: "ok" },
    ],
    transcript:
      "Atendente: Vivo, boa tarde, aqui é o Rafael, ligação gravada. Tudo bem?\nCliente: Tudo, queria saber de um plano com mais internet.\nAtendente: Posso confirmar seu CPF? Tenho uma oferta de upgrade.\nCliente: 987.654.321-00.\nAtendente: Temos o plano de 40GB por R$ 79,90, hoje você paga R$ 59,90 por 20GB. A diferença é cobrada proporcional neste ciclo.\nCliente: Pode mudar, gostei.\nAtendente: Confirmando: o senhor aceita migrar para 40GB por R$ 79,90? \nCliente: Sim.\nAtendente: Registrado, protocolo VV-880004. Obrigado e ótima tarde!",
  },
  {
    daysAgo: 5,
    hours: 6,
    origin: "audio",
    agentName: "Juliana Castro",
    label: "ligacao_portabilidade_2026-05-24.mp3",
    topic: "Portabilidade",
    scoreCompliance: 78,
    scoreQuality: 80,
    sentiment: "neutro",
    summary:
      "Cliente solicitou portabilidade de outra operadora. Atendente conduziu o processo, mas a confirmação dos dados cadastrais foi parcial e o prazo de portabilidade foi informado de forma vaga.",
    source: "huggingface",
    checkScores: [95, 90, 60, 80, 85, 65, 80, 85],
    checkEvidence: [
      "Atendente se identificou.",
      "Gravação informada.",
      "Confirmou apenas o número, não o CPF completo.",
      "Consentimento para portabilidade obtido.",
      "Explicou o plano de destino.",
      "Prazo de portabilidade informado de forma vaga.",
      "Protocolo informado.",
      "Encerramento adequado.",
    ],
    observations: [
      { agent: "Mangaba Compliance", time: "01:00", note: "Confirmação de dados cadastrais incompleta.", severity: "warning" },
      { agent: "Mangaba Qualidade", time: "02:30", note: "Prazo de portabilidade pouco específico.", severity: "warning" },
    ],
    transcript:
      "Atendente: Vivo, bom dia, aqui é a Juliana, chamada gravada. Como ajudo?\nCliente: Quero trazer meu número de outra operadora pra Vivo.\nAtendente: Ótimo! Me passa o número que deseja portar?\nCliente: 21 99888-7766.\nAtendente: A senhora autoriza o processo de portabilidade?\nCliente: Autorizo.\nAtendente: O plano de destino é o Controle de R$ 49,90. A portabilidade leva alguns dias úteis.\nCliente: Certo.\nAtendente: Protocolo VV-880005. Obrigada!",
  },
  {
    daysAgo: 6,
    hours: 4,
    origin: "texto",
    agentName: "Ana Beatriz Ferreira",
    label: "Transcrição — roaming internacional",
    topic: "Roaming internacional",
    scoreCompliance: 90,
    scoreQuality: 88,
    sentiment: "positivo",
    summary:
      "Cliente viajaria ao exterior e queria ativar roaming. Atendente explicou pacote, custos diários e cobertura com clareza, confirmou cadastro e LGPD, e registrou a ativação com protocolo.",
    source: "huggingface",
    checkScores: [95, 90, 90, 90, 95, 90, 85, 85],
    checkEvidence: [
      "Identificação no início.",
      "Aviso de gravação.",
      "Cadastro confirmado.",
      "Consentimento LGPD obtido.",
      "Pacote de roaming explicado com clareza.",
      "Custo diário e cobertura informados.",
      "Protocolo de ativação informado.",
      "Encerramento cordial.",
    ],
    observations: [
      { agent: "Mangaba Qualidade", time: "01:50", note: "Custos diários do roaming bem explicados.", severity: "ok" },
      { agent: "Mangaba Compliance", time: "02:40", note: "Consentimento e protocolo registrados.", severity: "ok" },
    ],
    transcript:
      "Atendente: Vivo, boa tarde, aqui é a Ana Beatriz, ligação gravada. Em que ajudo?\nCliente: Vou viajar pra Europa e quero usar o celular lá.\nAtendente: Posso confirmar seu CPF e autoriza consultar seu plano?\nCliente: Sim, 111.222.333-44.\nAtendente: Temos o pacote Vivo Travel por R$ 39,90 ao dia, com 1GB e ligações. Cobre toda a Europa.\nCliente: Perfeito, pode ativar para a semana que vem.\nAtendente: Ativado. Protocolo VV-880006. Boa viagem e obrigada!",
  },
  {
    daysAgo: 8,
    hours: 2,
    origin: "audio",
    agentName: "Carlos Eduardo Lima",
    label: "ligacao_cobranca_2026-05-21.mp3",
    topic: "Cobrança/Fatura",
    scoreCompliance: 52,
    scoreQuality: 60,
    sentiment: "negativo",
    summary:
      "Cliente contestou cobrança de serviço não contratado. Atendente não confirmou consentimento LGPD, não forneceu número de protocolo e encerrou sem resolver. Atendimento crítico — risco regulatório.",
    source: "huggingface",
    checkScores: [70, 60, 50, 30, 55, 50, 20, 60],
    checkEvidence: [
      "Identificação rápida, sem sobrenome.",
      "Aviso de gravação não verbalizado claramente.",
      "Confirmação de dados parcial.",
      "Sem consentimento LGPD explícito.",
      "Não esclareceu o serviço cobrado.",
      "Prazo de resposta não informado.",
      "Não forneceu número de protocolo.",
      "Encerramento abrupto, sem resolução.",
    ],
    observations: [
      { agent: "Mangaba Compliance", time: "00:30", note: "Ausência de consentimento LGPD — risco regulatório.", severity: "critical" },
      { agent: "Mangaba Compliance", time: "03:10", note: "Encerrou sem fornecer protocolo ao cliente.", severity: "critical" },
      { agent: "Mangaba Sentimento", time: "02:50", note: "Cliente encerrou bastante insatisfeito.", severity: "critical" },
    ],
    transcript:
      "Atendente: Vivo, aqui é o Carlos. Pois não?\nCliente: Tô sendo cobrado por um serviço que não pedi!\nAtendente: Qual serviço?\nCliente: Um tal de 'Vivo Música', R$ 9,90.\nAtendente: Ah, isso aí às vezes vem ativado. Vou ver aqui.\nCliente: E aí, vai cancelar?\nAtendente: Olha, depois o senhor liga de novo que a gente resolve, tá? Tenho outras chamadas.\nCliente: Mas e o protocolo?\nAtendente: Qualquer coisa liga de novo. Tchau.",
  },
  {
    daysAgo: 9,
    hours: 5,
    origin: "audio",
    agentName: "Mariana Souza",
    label: "ligacao_suporte_2026-05-20.mp3",
    topic: "Suporte técnico",
    scoreCompliance: 76,
    scoreQuality: 72,
    sentiment: "neutro",
    summary:
      "Cliente relatou lentidão na internet móvel. Atendente fez diagnóstico e orientou reconfiguração de APN. Confirmação de dados foi rápida e o resumo final do atendimento foi incompleto.",
    source: "huggingface",
    checkScores: [90, 85, 65, 70, 80, 75, 60, 80],
    checkEvidence: [
      "Atendente identificada.",
      "Gravação informada.",
      "Confirmação de cadastro apressada.",
      "Consentimento mencionado.",
      "Orientou reconfiguração de APN.",
      "Prazo de normalização informado.",
      "Resumo final incompleto.",
      "Encerramento educado.",
    ],
    observations: [
      { agent: "Mangaba Qualidade", time: "02:00", note: "Resumo final do atendimento ficou incompleto.", severity: "warning" },
      { agent: "Mangaba Compliance", time: "00:50", note: "Confirmação cadastral apressada.", severity: "warning" },
    ],
    transcript:
      "Atendente: Vivo, boa tarde, aqui é a Mariana, ligação gravada. Como ajudo?\nCliente: Minha internet tá muito lenta no celular.\nAtendente: Me confirma seu número rapidinho?\nCliente: 11 97777-1234.\nAtendente: Vou te orientar a reconfigurar o APN. Anota: nome 'vivo.com.br'.\nCliente: Fiz aqui.\nAtendente: Deve normalizar em alguns minutos. Mais alguma coisa? Boa tarde!",
  },
  {
    daysAgo: 11,
    hours: 8,
    origin: "texto",
    agentName: "Juliana Castro",
    label: "Transcrição — venda agressiva plano",
    topic: "Vendas/Upgrade",
    scoreCompliance: 48,
    scoreQuality: 55,
    sentiment: "negativo",
    summary:
      "Atendente insistiu em venda de plano superior sem detalhar custos reais nem confirmar aceite claro do cliente. Pressão excessiva e omissão de informações de fidelidade. Atendimento crítico.",
    source: "heuristic",
    checkScores: [80, 70, 55, 40, 50, 30, 40, 50],
    checkEvidence: [
      "Identificação presente.",
      "Aviso de gravação breve.",
      "Confirmação de dados parcial.",
      "Sem consentimento claro para oferta.",
      "Oferta apresentada de forma confusa.",
      "Custos e fidelidade omitidos.",
      "Sem protocolo claro de adesão.",
      "Encerramento pressionando o cliente.",
    ],
    observations: [
      { agent: "Mangaba Compliance", time: "01:20", note: "Custos e fidelidade não informados na oferta.", severity: "critical" },
      { agent: "Mangaba Qualidade", time: "02:00", note: "Pressão de venda excessiva, sem aceite claro.", severity: "critical" },
      { agent: "Mangaba Sentimento", time: "02:30", note: "Cliente demonstrou desconforto com a insistência.", severity: "warning" },
    ],
    transcript:
      "Atendente: Vivo, aqui é a Juliana. Gravado. Tenho uma oferta imperdível pro senhor!\nCliente: Olha, eu nem pedi nada...\nAtendente: Mas é só hoje! Plano premium de 100GB, o senhor vai adorar.\nCliente: E quanto custa?\nAtendente: Fica ótimo no seu bolso, pode confiar. Posso já ativar?\nCliente: Mas qual o valor exato? Tem fidelidade?\nAtendente: Detalhes a gente vê depois. Vou ativar pro senhor, tá?\nCliente: Não sei, não...\nAtendente: Já deixei encaminhado aqui. Qualquer coisa o senhor liga.",
  },
  {
    daysAgo: 12,
    hours: 3,
    origin: "audio",
    agentName: "Rafael Almeida",
    label: "ligacao_cancelamento_2026-05-17.mp3",
    topic: "Cancelamento",
    scoreCompliance: 87,
    scoreQuality: 83,
    sentiment: "neutro",
    summary:
      "Cliente pediu cancelamento por mudança de cidade. Atendente confirmou cadastro e LGPD, informou ausência de multa (fora da fidelidade), registrou o pedido e forneceu protocolo e prazo corretamente.",
    source: "huggingface",
    checkScores: [95, 90, 90, 85, 80, 90, 90, 85],
    checkEvidence: [
      "Identificação clara.",
      "Aviso de gravação.",
      "Cadastro confirmado.",
      "Consentimento LGPD obtido.",
      "Explicou as condições do cancelamento.",
      "Informou ausência de multa e prazo de efetivação.",
      "Protocolo fornecido.",
      "Encerramento cordial.",
    ],
    observations: [
      { agent: "Mangaba Compliance", time: "01:40", note: "Condições de cancelamento informadas corretamente.", severity: "ok" },
      { agent: "Mangaba Sentimento", time: "02:20", note: "Cliente neutro, atendimento sem atritos.", severity: "ok" },
    ],
    transcript:
      "Atendente: Vivo, bom dia, aqui é o Rafael, ligação gravada. Em que ajudo?\nCliente: Preciso cancelar, vou me mudar pra fora do país.\nAtendente: Entendo. Confirma seu CPF e autoriza a consulta dos dados?\nCliente: 555.666.777-88, autorizo.\nAtendente: O senhor já está fora do período de fidelidade, então não há multa. O cancelamento se efetiva em até 48 horas.\nCliente: Ótimo, obrigado.\nAtendente: Protocolo VV-880010. Mais alguma coisa? Bom dia!",
  },
];

// Constrói os 10 registros de demonstração com datas relativas ao momento atual
// (para que os KPIs de \"últimos 7 dias\" e a tendência façam sentido). Retorna
// as ligações em ordem do mais recente para o mais antigo (convenção do store).
export function buildSeedCalls(): { calls: StoredCall[]; nextSeq: number } {
  const now = Date.now();
  // Ordena do mais antigo para o mais recente para atribuir ids crescentes
  // (C-10001 = ligação mais antiga), espelhando a ordem de gravação real.
  const ordered = [...SPECS].sort(
    (a, b) => b.daysAgo - a.daysAgo || b.hours - a.hours,
  );

  const calls = ordered.map((spec, idx) => {
    const n = idx + 1;
    const createdAt = new Date(
      now - spec.daysAgo * DAY_MS - spec.hours * 60 * 60 * 1000,
    ).toISOString();
    const record: StoredCall = {
      id: `C-${pad(10000 + n, 5)}`,
      protocol: `VV-${pad(880000 + n, 6)}`,
      createdAt,
      origin: spec.origin,
      label: spec.label,
      agentName: spec.agentName,
      topic: spec.topic,
      scoreCompliance: spec.scoreCompliance,
      scoreQuality: spec.scoreQuality,
      sentiment: spec.sentiment,
      status: statusFromScore(spec.scoreCompliance),
      summary: spec.summary,
      source: spec.source,
      model: spec.source === "huggingface" ? HF_MODEL : "heurística local",
      checks: buildChecks(spec.checkScores, spec.checkEvidence),
      observations: spec.observations,
      transcript: spec.transcript,
    };
    return record;
  });

  // Store mantém o mais recente primeiro.
  calls.reverse();
  return { calls, nextSeq: calls.length + 1 };
}
