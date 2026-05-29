// Redação de dados pessoais (LGPD) — custo zero, sem dependências externas.
//
// Mascara PII em transcrições ANTES de: (a) enviar à IA (não vazar dado real a
// um provedor externo), (b) persistir no store e (c) exibir na ficha. Trabalha
// só com expressões regulares, então roda em qualquer runtime (Node/Workers).
//
// Filosofia: para uma ferramenta de compliance, é melhor "mascarar a mais" do
// que deixar passar. Quando um número é ambíguo (ex.: 11 dígitos pode ser CPF
// ou celular), mascaramos mesmo assim — o rótulo pode não ser perfeito, mas o
// dado fica protegido. Números curtos (protocolos como VV-880099, valores como
// R$ 79,90) não são tocados.

export type PiiKind = "cartao" | "cnpj" | "cpf" | "email" | "telefone";

export interface RedactionResult {
  text: string;
  counts: Record<PiiKind, number>;
  total: number;
}

// Conta apenas dígitos de um trecho (ignora pontuação/separadores).
function digitCount(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 48 && c <= 57) n++;
  }
  return n;
}

// A ORDEM importa: padrões mais específicos/longos primeiro, para não fatiar um
// dado maior em pedaços (ex.: cartão antes de CPF).
const RULES: { kind: PiiKind; re: RegExp; replace: (m: string) => string }[] = [
  // Cartão de crédito: 13–19 dígitos, possivelmente agrupados por espaço/hífen.
  // Preserva os 4 últimos para rastreabilidade (padrão PCI).
  {
    kind: "cartao",
    re: /\b(?:\d[ -]?){12,18}\d\b/g,
    replace: (m) => {
      const d = m.replace(/\D/g, "");
      if (d.length < 13 || d.length > 19) return m; // fora da faixa de cartão
      return `[CARTÃO ••${d.slice(-4)}]`;
    },
  },
  // CNPJ formatado: 00.000.000/0000-00
  { kind: "cnpj", re: /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, replace: () => "[CNPJ]" },
  // CPF formatado: 000.000.000-00
  { kind: "cpf", re: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, replace: () => "[CPF]" },
  // E-mail
  { kind: "email", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, replace: () => "[E-MAIL]" },
  // Telefone BR: opcional +55, DDD entre parênteses, fixo (8) ou celular (9).
  {
    kind: "telefone",
    re: /(?:\+?55[\s.-]?)?(?:\(?\d{2}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}\b/g,
    replace: (m) => (digitCount(m) >= 8 ? "[TELEFONE]" : m),
  },
  // CNPJ sem formatação: 14 dígitos.
  { kind: "cnpj", re: /\b\d{14}\b/g, replace: () => "[CNPJ]" },
  // CPF sem formatação: 11 dígitos.
  { kind: "cpf", re: /\b\d{11}\b/g, replace: () => "[CPF]" },
];

// Redige (mascara) todo PII reconhecido, devolvendo o texto limpo + contagem.
export function redactPII(input: string): RedactionResult {
  const counts: Record<PiiKind, number> = { cartao: 0, cnpj: 0, cpf: 0, email: 0, telefone: 0 };
  let text = input ?? "";
  for (const rule of RULES) {
    text = text.replace(rule.re, (m) => {
      const out = rule.replace(m);
      if (out !== m) counts[rule.kind] += 1;
      return out;
    });
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { text, counts, total };
}

// Atalho quando só interessa o texto redigido.
export function redactText(input: string): string {
  return redactPII(input).text;
}
