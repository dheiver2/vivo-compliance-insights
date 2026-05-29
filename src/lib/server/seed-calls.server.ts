// Seed inicial — 10 ligações REAIS extraídas da API 3C Plus.
//
// Usado APENAS quando o store nunca foi inicializado (não existe
// .data/calls.json). Os registros abaixo foram gerados a partir de chamadas
// reais da operadora: áudio baixado da 3C Plus → transcrição (Mangaba Voz) →
// redação de PII → auditoria de compliance (Mangaba Compliance). A transcrição
// completa NÃO é persistida: guarda-se apenas o resumo de auditoria que
// responde ao script de monitoria (LGPD by design).
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

interface RealCase {
  callDate: string;
  origin: CallOrigin;
  agentName: string;
  label: string;
  topic: string;
  scoreCompliance: number;
  scoreQuality: number;
  sentiment: Sentiment;
  summary: string;
  checks: ComplianceCheck[];
  observations: CallObservation[];
  transcript: string;
}

const REAL_CASES: RealCase[] = [
  {
    "callDate": "2026-05-29T17:32:37-03:00",
    "origin": "audio",
    "agentName": "Mirelly Julia",
    "label": "3C Plus · p-20260529173248224534",
    "topic": "Outros",
    "scoreCompliance": 0,
    "scoreQuality": 40,
    "sentiment": "negativo",
    "summary": "Atendente não cumpriu critérios básicos de identificação e gravação informada.",
    "checks": [
      {
        "label": "Identificação do atendente",
        "passed": false,
        "score": 0,
        "evidence": "Atendente não se identificou corretamente."
      },
      {
        "label": "Gravação informada ao cliente",
        "passed": false,
        "score": 0,
        "evidence": "Não informou ao cliente que a ligação está sendo gravada."
      },
      {
        "label": "Confirmação de dados cadastrais",
        "passed": false,
        "score": 0,
        "evidence": "Não confirmou dados cadastrais do cliente."
      },
      {
        "label": "Consentimento LGPD para uso de dados",
        "passed": false,
        "score": 0,
        "evidence": "Não obteve consentimento LGPD."
      },
      {
        "label": "Oferta clara de produto/serviço",
        "passed": false,
        "score": 0,
        "evidence": "Não apresentou oferta clara de produto/serviço."
      },
      {
        "label": "Comunicação de prazos e custos",
        "passed": false,
        "score": 0,
        "evidence": "Não comunicou prazos e custos."
      },
      {
        "label": "Resumo final e número de protocolo",
        "passed": false,
        "score": 0,
        "evidence": "Não forneceu resumo final e número de protocolo."
      },
      {
        "label": "Encerramento cordial",
        "passed": false,
        "score": 0,
        "evidence": "Não encerrou de forma cordial."
      }
    ],
    "observations": [
      {
        "agent": "Mangaba Compliance",
        "time": "00:00",
        "note": "Atendente não se apresentou corretamente e não informou a empresa.",
        "severity": "critical"
      },
      {
        "agent": "Mangaba Compliance",
        "time": "00:00",
        "note": "Falta de informação sobre gravação da ligação.",
        "severity": "critical"
      },
      {
        "agent": "Mangaba Compliance",
        "time": "00:00",
        "note": "Atendente não confirmou dados cadastrais do cliente.",
        "severity": "warning"
      },
      {
        "agent": "Mangaba Compliance",
        "time": "00:00",
        "note": "Não houve consentimento LGPD.",
        "severity": "critical"
      },
      {
        "agent": "Mangaba Compliance",
        "time": "00:00",
        "note": "Atendente não apresentou oferta clara de produto/serviço.",
        "severity": "warning"
      }
    ],
    "transcript": "Atendente não cumpriu critérios básicos de identificação e gravação informada.\n\nScript de monitoria:\n✗ Identificação do atendente (0%) — Atendente não se identificou corretamente.\n✗ Gravação informada ao cliente (0%) — Não informou ao cliente que a ligação está sendo gravada.\n✗ Confirmação de dados cadastrais (0%) — Não confirmou dados cadastrais do cliente.\n✗ Consentimento LGPD para uso de dados (0%) — Não obteve consentimento LGPD.\n✗ Oferta clara de produto/serviço (0%) — Não apresentou oferta clara de produto/serviço.\n✗ Comunicação de prazos e custos (0%) — Não comunicou prazos e custos.\n✗ Resumo final e número de protocolo (0%) — Não forneceu resumo final e número de protocolo.\n✗ Encerramento cordial (0%) — Não encerrou de forma cordial.\n\nObservações:\n• [critical] 00:00 Atendente não se apresentou corretamente e não informou a empresa.\n• [critical] 00:00 Falta de informação sobre gravação da ligação.\n• [warning] 00:00 Atendente não confirmou dados cadastrais do cliente.\n• [critical] 00:00 Não houve consentimento LGPD.\n• [warning] 00:00 Atendente não apresentou oferta clara de produto/serviço."
  },
  {
    "callDate": "2026-05-29T17:31:46-03:00",
    "origin": "audio",
    "agentName": "Fernanda Duarte",
    "label": "3C Plus · p-20260529173210212121",
    "topic": "Outros",
    "scoreCompliance": 8,
    "scoreQuality": 60,
    "sentiment": "negativo",
    "summary": "Atendente não informou gravação e consentimento LGPD, além de não confirmar dados cadastrais.",
    "checks": [
      {
        "label": "Identificação do atendente",
        "passed": false,
        "score": 0,
        "evidence": "Atendente não informou gravação"
      },
      {
        "label": "Gravação informada ao cliente",
        "passed": false,
        "score": 0,
        "evidence": "Atendente não informou gravação"
      },
      {
        "label": "Confirmação de dados cadastrais",
        "passed": false,
        "score": 0,
        "evidence": "Atendente não confirmou dados cadastrais"
      },
      {
        "label": "Consentimento LGPD para uso de dados",
        "passed": false,
        "score": 0,
        "evidence": "Atendente não solicitou consentimento LGPD"
      },
      {
        "label": "Oferta clara de produto/serviço",
        "passed": true,
        "score": 80,
        "evidence": ""
      },
      {
        "label": "Comunicação de prazos e custos",
        "passed": false,
        "score": 0,
        "evidence": "Atendente não informou prazos e custos"
      },
      {
        "label": "Resumo final e número de protocolo",
        "passed": false,
        "score": 0,
        "evidence": "Atendente não forneceu resumo e protocolo"
      },
      {
        "label": "Encerramento cordial",
        "passed": true,
        "score": 50,
        "evidence": ""
      }
    ],
    "observations": [
      {
        "agent": "Mangaba Compliance",
        "time": "00:00",
        "note": "Atendente não informou gravação e consentimento LGPD [CRÍTICO]",
        "severity": "critical"
      },
      {
        "agent": "Mangaba Compliance",
        "time": "00:00",
        "note": "Atendente não confirmou dados cadastrais",
        "severity": "warning"
      },
      {
        "agent": "Mangaba Compliance",
        "time": "00:00",
        "note": "Atendente não informou prazos e custos [CRÍTICO]",
        "severity": "critical"
      },
      {
        "agent": "Mangaba Compliance",
        "time": "00:00",
        "note": "Atendente não forneceu resumo e protocolo",
        "severity": "warning"
      },
      {
        "agent": "Mangaba Compliance",
        "time": "00:00",
        "note": "Atendente não ofereceu ajuda adicional antes de encerrar",
        "severity": "warning"
      }
    ],
    "transcript": "Atendente não informou gravação e consentimento LGPD, além de não confirmar dados cadastrais.\n\nScript de monitoria:\n✗ Identificação do atendente (0%) — Atendente não informou gravação\n✗ Gravação informada ao cliente (0%) — Atendente não informou gravação\n✗ Confirmação de dados cadastrais (0%) — Atendente não confirmou dados cadastrais\n✗ Consentimento LGPD para uso de dados (0%) — Atendente não solicitou consentimento LGPD\n✓ Oferta clara de produto/serviço (80%)\n✗ Comunicação de prazos e custos (0%) — Atendente não informou prazos e custos\n✗ Resumo final e número de protocolo (0%) — Atendente não forneceu resumo e protocolo\n✓ Encerramento cordial (50%)\n\nObservações:\n• [critical] 00:00 Atendente não informou gravação e consentimento LGPD [CRÍTICO]\n• [warning] 00:00 Atendente não confirmou dados cadastrais\n• [critical] 00:00 Atendente não informou prazos e custos [CRÍTICO]\n• [warning] 00:00 Atendente não forneceu resumo e protocolo\n• [warning] 00:00 Atendente não ofereceu ajuda adicional antes de encerrar"
  },
  {
    "callDate": "2026-05-22T18:00:27-03:00",
    "origin": "audio",
    "agentName": "Thays Vivianne",
    "label": "3C Plus · p-20260522180047198118",
    "topic": "Vendas/Upgrade",
    "scoreCompliance": 8,
    "scoreQuality": 60,
    "sentiment": "negativo",
    "summary": "Atendente não cumpriu critérios críticos de gravação e LGPD.",
    "checks": [
      {
        "label": "Identificação do atendente",
        "passed": false,
        "score": 0,
        "evidence": "Não informou gravação da ligação."
      },
      {
        "label": "Gravação informada ao cliente",
        "passed": false,
        "score": 0,
        "evidence": "Não obteve consentimento LGPD."
      },
      {
        "label": "Confirmação de dados cadastrais",
        "passed": false,
        "score": 0,
        "evidence": "Não confirmou dados cadastrais."
      },
      {
        "label": "Consentimento LGPD para uso de dados",
        "passed": false,
        "score": 0,
        "evidence": "Não mencionou consentimento LGPD."
      },
      {
        "label": "Oferta clara de produto/serviço",
        "passed": true,
        "score": 80,
        "evidence": ""
      },
      {
        "label": "Comunicação de prazos e custos",
        "passed": false,
        "score": 0,
        "evidence": "Não comunicou prazos, custos ou fidelidade."
      },
      {
        "label": "Resumo final e número de protocolo",
        "passed": false,
        "score": 0,
        "evidence": "Não forneceu resumo ou protocolo."
      },
      {
        "label": "Encerramento cordial",
        "passed": true,
        "score": 60,
        "evidence": ""
      }
    ],
    "observations": [
      {
        "agent": "Mangaba Compliance",
        "time": "00:00",
        "note": "Falta de cumprimento de critérios críticos.",
        "severity": "critical"
      },
      {
        "agent": "Mangaba Compliance",
        "time": "00:15",
        "note": "Oferta apresentada sem transparência.",
        "severity": "warning"
      }
    ],
    "transcript": "Atendente não cumpriu critérios críticos de gravação e LGPD.\n\nScript de monitoria:\n✗ Identificação do atendente (0%) — Não informou gravação da ligação.\n✗ Gravação informada ao cliente (0%) — Não obteve consentimento LGPD.\n✗ Confirmação de dados cadastrais (0%) — Não confirmou dados cadastrais.\n✗ Consentimento LGPD para uso de dados (0%) — Não mencionou consentimento LGPD.\n✓ Oferta clara de produto/serviço (80%)\n✗ Comunicação de prazos e custos (0%) — Não comunicou prazos, custos ou fidelidade.\n✗ Resumo final e número de protocolo (0%) — Não forneceu resumo ou protocolo.\n✓ Encerramento cordial (60%)\n\nObservações:\n• [critical] 00:00 Falta de cumprimento de critérios críticos.\n• [warning] 00:15 Oferta apresentada sem transparência."
  },
  {
    "callDate": "2026-05-22T17:59:15-03:00",
    "origin": "audio",
    "agentName": "Mariana Gabrielly",
    "label": "3C Plus · p-20260522175932181764",
    "topic": "Outros",
    "scoreCompliance": 2,
    "scoreQuality": 30,
    "sentiment": "negativo",
    "summary": "Atendente não informou gravação e consentimento LGPD.",
    "checks": [
      {
        "label": "Identificação do atendente",
        "passed": false,
        "score": 0,
        "evidence": "Atendente não informou gravação"
      },
      {
        "label": "Gravação informada ao cliente",
        "passed": false,
        "score": 0,
        "evidence": "Atendente não informou gravação"
      },
      {
        "label": "Confirmação de dados cadastrais",
        "passed": false,
        "score": 0,
        "evidence": "Atendente não confirmou dados"
      },
      {
        "label": "Consentimento LGPD para uso de dados",
        "passed": false,
        "score": 0,
        "evidence": "Atendente não solicitou consentimento LGPD"
      },
      {
        "label": "Oferta clara de produto/serviço",
        "passed": false,
        "score": 0,
        "evidence": "Atendente não ofereceu produto/serviço"
      },
      {
        "label": "Comunicação de prazos e custos",
        "passed": false,
        "score": 0,
        "evidence": "Atendente não comunicou prazos/custos"
      },
      {
        "label": "Resumo final e número de protocolo",
        "passed": false,
        "score": 0,
        "evidence": "Atendente não forneceu resumo/protocolo"
      },
      {
        "label": "Encerramento cordial",
        "passed": true,
        "score": 50,
        "evidence": ""
      }
    ],
    "observations": [
      {
        "agent": "Mangaba Compliance",
        "time": "00:00",
        "note": "Atendente não informou gravação e consentimento LGPD.",
        "severity": "critical"
      },
      {
        "agent": "Mangaba Compliance",
        "time": "00:00",
        "note": "Atendente não ofereceu produto/serviço.",
        "severity": "critical"
      },
      {
        "agent": "Mangaba Compliance",
        "time": "00:00",
        "note": "Atendente não comunicou prazos/custos.",
        "severity": "critical"
      }
    ],
    "transcript": "Atendente não informou gravação e consentimento LGPD.\n\nScript de monitoria:\n✗ Identificação do atendente (0%) — Atendente não informou gravação\n✗ Gravação informada ao cliente (0%) — Atendente não informou gravação\n✗ Confirmação de dados cadastrais (0%) — Atendente não confirmou dados\n✗ Consentimento LGPD para uso de dados (0%) — Atendente não solicitou consentimento LGPD\n✗ Oferta clara de produto/serviço (0%) — Atendente não ofereceu produto/serviço\n✗ Comunicação de prazos e custos (0%) — Atendente não comunicou prazos/custos\n✗ Resumo final e número de protocolo (0%) — Atendente não forneceu resumo/protocolo\n✓ Encerramento cordial (50%)\n\nObservações:\n• [critical] 00:00 Atendente não informou gravação e consentimento LGPD.\n• [critical] 00:00 Atendente não ofereceu produto/serviço.\n• [critical] 00:00 Atendente não comunicou prazos/custos."
  },
  {
    "callDate": "2026-05-22T17:59:12-03:00",
    "origin": "audio",
    "agentName": "Fabiola Sena",
    "label": "3C Plus · p-20260522175932190836",
    "topic": "Outros",
    "scoreCompliance": 14,
    "scoreQuality": 40,
    "sentiment": "negativo",
    "summary": "Atendimento rápido e sem cumprimento de critérios essenciais.",
    "checks": [
      {
        "label": "Identificação do atendente",
        "passed": true,
        "score": 100,
        "evidence": ""
      },
      {
        "label": "Gravação informada ao cliente",
        "passed": false,
        "score": 0,
        "evidence": "Não informado ao cliente que a ligação está sendo gravada."
      },
      {
        "label": "Confirmação de dados cadastrais",
        "passed": false,
        "score": 0,
        "evidence": "Não confirmados dados cadastrais do cliente."
      },
      {
        "label": "Consentimento LGPD para uso de dados",
        "passed": false,
        "score": 0,
        "evidence": "Não solicitado consentimento LGPD para uso de dados."
      },
      {
        "label": "Oferta clara de produto/serviço",
        "passed": true,
        "score": 50,
        "evidence": ""
      },
      {
        "label": "Comunicação de prazos e custos",
        "passed": false,
        "score": 0,
        "evidence": "Não comunicados prazos, valores, multas ou fidelidade."
      },
      {
        "label": "Resumo final e número de protocolo",
        "passed": false,
        "score": 0,
        "evidence": "Não fornecido resumo do atendimento ou número de protocolo."
      },
      {
        "label": "Encerramento cordial",
        "passed": true,
        "score": 50,
        "evidence": ""
      }
    ],
    "observations": [
      {
        "agent": "Mangaba Compliance",
        "time": "00:00:30",
        "note": "Atendimento encerrado sem cumprir critérios essenciais.",
        "severity": "critical"
      }
    ],
    "transcript": "Atendimento rápido e sem cumprimento de critérios essenciais.\n\nScript de monitoria:\n✓ Identificação do atendente (100%)\n✗ Gravação informada ao cliente (0%) — Não informado ao cliente que a ligação está sendo gravada.\n✗ Confirmação de dados cadastrais (0%) — Não confirmados dados cadastrais do cliente.\n✗ Consentimento LGPD para uso de dados (0%) — Não solicitado consentimento LGPD para uso de dados.\n✓ Oferta clara de produto/serviço (50%)\n✗ Comunicação de prazos e custos (0%) — Não comunicados prazos, valores, multas ou fidelidade.\n✗ Resumo final e número de protocolo (0%) — Não fornecido resumo do atendimento ou número de protocolo.\n✓ Encerramento cordial (50%)\n\nObservações:\n• [critical] 00:00:30 Atendimento encerrado sem cumprir critérios essenciais."
  },
  {
    "callDate": "2026-05-22T17:59:02-03:00",
    "origin": "audio",
    "agentName": "Inglis Gregorio",
    "label": "3C Plus · p-20260522175919198128",
    "topic": "Outros",
    "scoreCompliance": 6,
    "scoreQuality": 30,
    "sentiment": "negativo",
    "summary": "Atendente não cumpriu critérios básicos de identificação e gravação informada.",
    "checks": [
      {
        "label": "Identificação do atendente",
        "passed": false,
        "score": 0,
        "evidence": "Atendente não se identificou corretamente."
      },
      {
        "label": "Gravação informada ao cliente",
        "passed": false,
        "score": 0,
        "evidence": "Não informou ao cliente que a ligação está sendo gravada."
      },
      {
        "label": "Confirmação de dados cadastrais",
        "passed": false,
        "score": 0,
        "evidence": "Não confirmou dados cadastrais do cliente."
      },
      {
        "label": "Consentimento LGPD para uso de dados",
        "passed": false,
        "score": 0,
        "evidence": "Não obteve consentimento LGPD."
      },
      {
        "label": "Oferta clara de produto/serviço",
        "passed": true,
        "score": 50,
        "evidence": ""
      },
      {
        "label": "Comunicação de prazos e custos",
        "passed": false,
        "score": 0,
        "evidence": "Não comunicou prazos, valores ou multas."
      },
      {
        "label": "Resumo final e número de protocolo",
        "passed": false,
        "score": 0,
        "evidence": "Não forneceu resumo final ou número de protocolo."
      },
      {
        "label": "Encerramento cordial",
        "passed": true,
        "score": 50,
        "evidence": ""
      }
    ],
    "observations": [
      {
        "agent": "Mangaba Compliance",
        "time": "00:00",
        "note": "Atendente não se identificou corretamente e não informou sobre a gravação.",
        "severity": "critical"
      },
      {
        "agent": "Mangaba Compliance",
        "time": "00:05",
        "note": "Cliente demonstrou desinteresse sem receber informações completas.",
        "severity": "warning"
      },
      {
        "agent": "Mangaba Compliance",
        "time": "00:10",
        "note": "Não houve confirmação de dados cadastrais ou consentimento LGPD.",
        "severity": "critical"
      },
      {
        "agent": "Mangaba Compliance",
        "time": "00:15",
        "note": "Não foram comunicados prazos, valores ou multas.",
        "severity": "critical"
      },
      {
        "agent": "Mangaba Compliance",
        "time": "00:20",
        "note": "Não foi fornecido resumo final ou número de protocolo.",
        "severity": "critical"
      }
    ],
    "transcript": "Atendente não cumpriu critérios básicos de identificação e gravação informada.\n\nScript de monitoria:\n✗ Identificação do atendente (0%) — Atendente não se identificou corretamente.\n✗ Gravação informada ao cliente (0%) — Não informou ao cliente que a ligação está sendo gravada.\n✗ Confirmação de dados cadastrais (0%) — Não confirmou dados cadastrais do cliente.\n✗ Consentimento LGPD para uso de dados (0%) — Não obteve consentimento LGPD.\n✓ Oferta clara de produto/serviço (50%)\n✗ Comunicação de prazos e custos (0%) — Não comunicou prazos, valores ou multas.\n✗ Resumo final e número de protocolo (0%) — Não forneceu resumo final ou número de protocolo.\n✓ Encerramento cordial (50%)\n\nObservações:\n• [critical] 00:00 Atendente não se identificou corretamente e não informou sobre a gravação.\n• [warning] 00:05 Cliente demonstrou desinteresse sem receber informações completas.\n• [critical] 00:10 Não houve confirmação de dados cadastrais ou consentimento LGPD.\n• [critical] 00:15 Não foram comunicados prazos, valores ou multas.\n• [critical] 00:20 Não foi fornecido resumo final ou número de protocolo."
  },
  {
    "callDate": "2026-05-22T17:59:02-03:00",
    "origin": "audio",
    "agentName": "Raabe Silva",
    "label": "3C Plus · p-20260522175922182499",
    "topic": "Outros",
    "scoreCompliance": 18,
    "scoreQuality": 65,
    "sentiment": "negativo",
    "summary": "Atendimento com falhas em critérios críticos e comunicação de prazos e custos.",
    "checks": [
      {
        "label": "Identificação do atendente",
        "passed": true,
        "score": 100,
        "evidence": ""
      },
      {
        "label": "Gravação informada ao cliente",
        "passed": false,
        "score": 0,
        "evidence": "Não informado que a ligação está sendo gravada."
      },
      {
        "label": "Confirmação de dados cadastrais",
        "passed": false,
        "score": 0,
        "evidence": "Não confirmou dados cadastrais do cliente."
      },
      {
        "label": "Consentimento LGPD para uso de dados",
        "passed": false,
        "score": 0,
        "evidence": "Não solicitou consentimento LGPD para uso de dados."
      },
      {
        "label": "Oferta clara de produto/serviço",
        "passed": true,
        "score": 80,
        "evidence": ""
      },
      {
        "label": "Comunicação de prazos e custos",
        "passed": false,
        "score": 0,
        "evidence": "Não comunicou prazos, valores, multas e fidelidade."
      },
      {
        "label": "Resumo final e número de protocolo",
        "passed": false,
        "score": 0,
        "evidence": "Não forneceu resumo final nem número de protocolo."
      },
      {
        "label": "Encerramento cordial",
        "passed": true,
        "score": 80,
        "evidence": ""
      }
    ],
    "observations": [
      {
        "agent": "Mangaba Compliance",
        "time": "00:00",
        "note": "Não informado que a ligação está sendo gravada.",
        "severity": "critical"
      },
      {
        "agent": "Mangaba Compliance",
        "time": "00:00",
        "note": "Não confirmou dados cadastrais do cliente.",
        "severity": "warning"
      },
      {
        "agent": "Mangaba Compliance",
        "time": "00:00",
        "note": "Não solicitou consentimento LGPD para uso de dados.",
        "severity": "critical"
      },
      {
        "agent": "Mangaba Compliance",
        "time": "00:00",
        "note": "Não comunicou prazos, valores, multas e fidelidade.",
        "severity": "critical"
      },
      {
        "agent": "Mangaba Compliance",
        "time": "00:00",
        "note": "Não forneceu resumo final nem número de protocolo.",
        "severity": "warning"
      }
    ],
    "transcript": "Atendimento com falhas em critérios críticos e comunicação de prazos e custos.\n\nScript de monitoria:\n✓ Identificação do atendente (100%)\n✗ Gravação informada ao cliente (0%) — Não informado que a ligação está sendo gravada.\n✗ Confirmação de dados cadastrais (0%) — Não confirmou dados cadastrais do cliente.\n✗ Consentimento LGPD para uso de dados (0%) — Não solicitou consentimento LGPD para uso de dados.\n✓ Oferta clara de produto/serviço (80%)\n✗ Comunicação de prazos e custos (0%) — Não comunicou prazos, valores, multas e fidelidade.\n✗ Resumo final e número de protocolo (0%) — Não forneceu resumo final nem número de protocolo.\n✓ Encerramento cordial (80%)\n\nObservações:\n• [critical] 00:00 Não informado que a ligação está sendo gravada.\n• [warning] 00:00 Não confirmou dados cadastrais do cliente.\n• [critical] 00:00 Não solicitou consentimento LGPD para uso de dados.\n• [critical] 00:00 Não comunicou prazos, valores, multas e fidelidade.\n• [warning] 00:00 Não forneceu resumo final nem número de protocolo."
  },
  {
    "callDate": "2026-05-29T17:30:10-03:00",
    "origin": "audio",
    "agentName": "Mirelly Julia",
    "label": "3C Plus · p-20260529173025224534",
    "topic": "Vendas/Upgrade",
    "scoreCompliance": 19,
    "scoreQuality": 45,
    "sentiment": "negativo",
    "summary": "Atendimento com falhas graves em critérios críticos.",
    "checks": [
      {
        "label": "Identificação do atendente",
        "passed": true,
        "score": 100,
        "evidence": ""
      },
      {
        "label": "Gravação informada ao cliente",
        "passed": false,
        "score": 0,
        "evidence": "Não informou gravação da ligação."
      },
      {
        "label": "Confirmação de dados cadastrais",
        "passed": false,
        "score": 0,
        "evidence": "Não confirmou dados cadastrais."
      },
      {
        "label": "Consentimento LGPD para uso de dados",
        "passed": false,
        "score": 0,
        "evidence": "Não obteve consentimento LGPD."
      },
      {
        "label": "Oferta clara de produto/serviço",
        "passed": true,
        "score": 80,
        "evidence": ""
      },
      {
        "label": "Comunicação de prazos e custos",
        "passed": false,
        "score": 0,
        "evidence": "Não comunicou prazos, custos ou fidelidade."
      },
      {
        "label": "Resumo final e número de protocolo",
        "passed": false,
        "score": 0,
        "evidence": "Não forneceu resumo ou protocolo."
      },
      {
        "label": "Encerramento cordial",
        "passed": true,
        "score": 100,
        "evidence": ""
      }
    ],
    "observations": [
      {
        "agent": "Mangaba Compliance",
        "time": "00:00",
        "note": "Atendente não se apresentou corretamente.",
        "severity": "warning"
      },
      {
        "agent": "Mangaba Compliance",
        "time": "00:00",
        "note": "Não informou gravação da ligação.",
        "severity": "critical"
      },
      {
        "agent": "Mangaba Compliance",
        "time": "00:00",
        "note": "Não confirmou dados cadastrais.",
        "severity": "critical"
      },
      {
        "agent": "Mangaba Compliance",
        "time": "00:00",
        "note": "Não obteve consentimento LGPD.",
        "severity": "critical"
      },
      {
        "agent": "Mangaba Compliance",
        "time": "00:00",
        "note": "Não comunicou prazos, custos ou fidelidade.",
        "severity": "critical"
      }
    ],
    "transcript": "Atendimento com falhas graves em critérios críticos.\n\nScript de monitoria:\n✓ Identificação do atendente (100%)\n✗ Gravação informada ao cliente (0%) — Não informou gravação da ligação.\n✗ Confirmação de dados cadastrais (0%) — Não confirmou dados cadastrais.\n✗ Consentimento LGPD para uso de dados (0%) — Não obteve consentimento LGPD.\n✓ Oferta clara de produto/serviço (80%)\n✗ Comunicação de prazos e custos (0%) — Não comunicou prazos, custos ou fidelidade.\n✗ Resumo final e número de protocolo (0%) — Não forneceu resumo ou protocolo.\n✓ Encerramento cordial (100%)\n\nObservações:\n• [warning] 00:00 Atendente não se apresentou corretamente.\n• [critical] 00:00 Não informou gravação da ligação.\n• [critical] 00:00 Não confirmou dados cadastrais.\n• [critical] 00:00 Não obteve consentimento LGPD.\n• [critical] 00:00 Não comunicou prazos, custos ou fidelidade."
  },
  {
    "callDate": "2026-04-29T17:59:56-03:00",
    "origin": "audio",
    "agentName": "Aline Herculano",
    "label": "3C Plus · p-20260429180003198122",
    "topic": "Outros",
    "scoreCompliance": 0,
    "scoreQuality": 30,
    "sentiment": "negativo",
    "summary": "Atendente não cumpriu critérios básicos de identificação e gravação.",
    "checks": [
      {
        "label": "Identificação do atendente",
        "passed": false,
        "score": 0,
        "evidence": "Atendente não se identificou corretamente."
      },
      {
        "label": "Gravação informada ao cliente",
        "passed": false,
        "score": 0,
        "evidence": "Não informou ao cliente que a ligação está sendo gravada."
      },
      {
        "label": "Confirmação de dados cadastrais",
        "passed": false,
        "score": 0,
        "evidence": "Não confirmou dados cadastrais do cliente."
      },
      {
        "label": "Consentimento LGPD para uso de dados",
        "passed": false,
        "score": 0,
        "evidence": "Não obteve consentimento LGPD."
      },
      {
        "label": "Oferta clara de produto/serviço",
        "passed": false,
        "score": 0,
        "evidence": "Não apresentou oferta clara."
      },
      {
        "label": "Comunicação de prazos e custos",
        "passed": false,
        "score": 0,
        "evidence": "Não comunicou prazos e custos."
      },
      {
        "label": "Resumo final e número de protocolo",
        "passed": false,
        "score": 0,
        "evidence": "Não forneceu resumo final ou número de protocolo."
      },
      {
        "label": "Encerramento cordial",
        "passed": false,
        "score": 0,
        "evidence": "Não encerrou de forma cordial."
      }
    ],
    "observations": [
      {
        "agent": "Mangaba Compliance",
        "time": "00:00",
        "note": "Atendente não seguiu os procedimentos básicos de atendimento.",
        "severity": "critical"
      }
    ],
    "transcript": "Atendente não cumpriu critérios básicos de identificação e gravação.\n\nScript de monitoria:\n✗ Identificação do atendente (0%) — Atendente não se identificou corretamente.\n✗ Gravação informada ao cliente (0%) — Não informou ao cliente que a ligação está sendo gravada.\n✗ Confirmação de dados cadastrais (0%) — Não confirmou dados cadastrais do cliente.\n✗ Consentimento LGPD para uso de dados (0%) — Não obteve consentimento LGPD.\n✗ Oferta clara de produto/serviço (0%) — Não apresentou oferta clara.\n✗ Comunicação de prazos e custos (0%) — Não comunicou prazos e custos.\n✗ Resumo final e número de protocolo (0%) — Não forneceu resumo final ou número de protocolo.\n✗ Encerramento cordial (0%) — Não encerrou de forma cordial.\n\nObservações:\n• [critical] 00:00 Atendente não seguiu os procedimentos básicos de atendimento."
  },
  {
    "callDate": "2026-04-29T17:59:56-03:00",
    "origin": "audio",
    "agentName": "Fernanda Duarte",
    "label": "3C Plus · p-20260429180012212121",
    "topic": "Vendas/Upgrade",
    "scoreCompliance": 16,
    "scoreQuality": 70,
    "sentiment": "neutro",
    "summary": "Atendente se apresentou, mas faltou informar gravação e consentimento LGPD.",
    "checks": [
      {
        "label": "Identificação do atendente",
        "passed": false,
        "score": 0,
        "evidence": "Não informou gravação da ligação."
      },
      {
        "label": "Gravação informada ao cliente",
        "passed": false,
        "score": 0,
        "evidence": "Não obteve consentimento LGPD."
      },
      {
        "label": "Confirmação de dados cadastrais",
        "passed": true,
        "score": 80,
        "evidence": ""
      },
      {
        "label": "Consentimento LGPD para uso de dados",
        "passed": false,
        "score": 0,
        "evidence": "Não solicitou consentimento LGPD."
      },
      {
        "label": "Oferta clara de produto/serviço",
        "passed": true,
        "score": 80,
        "evidence": ""
      },
      {
        "label": "Comunicação de prazos e custos",
        "passed": false,
        "score": 0,
        "evidence": "Não informou prazos, custos ou fidelidade."
      },
      {
        "label": "Resumo final e número de protocolo",
        "passed": false,
        "score": 0,
        "evidence": "Não forneceu resumo ou protocolo."
      },
      {
        "label": "Encerramento cordial",
        "passed": true,
        "score": 80,
        "evidence": ""
      }
    ],
    "observations": [
      {
        "agent": "Mangaba Compliance",
        "time": "00:00",
        "note": "Atendente não informou gravação da ligação.",
        "severity": "critical"
      },
      {
        "agent": "Mangaba Compliance",
        "time": "00:00",
        "note": "Atendente não solicitou consentimento LGPD.",
        "severity": "critical"
      },
      {
        "agent": "Mangaba Compliance",
        "time": "00:00",
        "note": "Atendente não informou prazos, custos ou fidelidade.",
        "severity": "critical"
      },
      {
        "agent": "Mangaba Compliance",
        "time": "00:00",
        "note": "Atendente não forneceu resumo ou protocolo.",
        "severity": "warning"
      }
    ],
    "transcript": "Atendente se apresentou, mas faltou informar gravação e consentimento LGPD.\n\nScript de monitoria:\n✗ Identificação do atendente (0%) — Não informou gravação da ligação.\n✗ Gravação informada ao cliente (0%) — Não obteve consentimento LGPD.\n✓ Confirmação de dados cadastrais (80%)\n✗ Consentimento LGPD para uso de dados (0%) — Não solicitou consentimento LGPD.\n✓ Oferta clara de produto/serviço (80%)\n✗ Comunicação de prazos e custos (0%) — Não informou prazos, custos ou fidelidade.\n✗ Resumo final e número de protocolo (0%) — Não forneceu resumo ou protocolo.\n✓ Encerramento cordial (80%)\n\nObservações:\n• [critical] 00:00 Atendente não informou gravação da ligação.\n• [critical] 00:00 Atendente não solicitou consentimento LGPD.\n• [critical] 00:00 Atendente não informou prazos, custos ou fidelidade.\n• [warning] 00:00 Atendente não forneceu resumo ou protocolo."
  }
];

// Constrói os 10 registros reais com ids/protocolos sequenciais. As datas vêm
// direto da 3C Plus (call_date). Retorna as ligações da mais recente para a
// mais antiga (convenção do store).
export function buildSeedCalls(): { calls: StoredCall[]; nextSeq: number } {
  // Ordena da mais antiga para a mais recente para atribuir ids crescentes
  // (C-10001 = ligação mais antiga).
  const ordered = [...REAL_CASES].sort(
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
      transcript: spec.transcript,
    };
    return record;
  });

  // Store mantém o mais recente primeiro.
  calls.reverse();
  return { calls, nextSeq: calls.length + 1 };
}
