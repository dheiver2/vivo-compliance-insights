// Utilidades de CPF (sem PII: só valida e mascara; o hash é server-only).

export function onlyDigits(s: string): string {
  return (s ?? "").replace(/\D/g, "");
}

// Valida os dígitos verificadores do CPF (11 dígitos, não todos iguais).
export function isValidCpf(input: string): boolean {
  const cpf = onlyDigits(input);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // todos iguais
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

// Máscara que preserva só os 2 últimos dígitos: •••.•••.•••-12 (exibição LGPD).
export function maskCpf(input: string): string {
  const cpf = onlyDigits(input);
  if (cpf.length !== 11) return "•••.•••.•••-••";
  return `•••.•••.•••-${cpf.slice(9)}`;
}
