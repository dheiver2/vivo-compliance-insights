// Gate de autenticação por senha única (server-only).
//
// - A senha do app vem de `APP_PASSWORD` (env). Você define na Vercel — nada
//   fica hardcoded no código (sem mock).
// - Sessão = cookie httpOnly assinado: HMAC-SHA256(chave=APP_PASSWORD, payload fixo).
//   Stateless (não precisa de KV) e se autoinvalida se a senha mudar.
// - Se `APP_PASSWORD` não estiver definida, o gate fica DESLIGADO (app aberto) —
//   assim a aplicação não trava antes de você configurar a senha.
import process from "node:process";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";

export const SESSION_COOKIE = "va_session";
const SESSION_PAYLOAD = "voiceaudit:auth:v1";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 dias

export function getAppPassword(): string | undefined {
  const raw = process.env.APP_PASSWORD;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

export function isGateEnabled(): boolean {
  return Boolean(getAppPassword());
}

// Token de sessão derivado da senha. Quem conhece a senha consegue gerar; o
// servidor revalida a cada request. Trocar a senha invalida sessões antigas.
function sessionToken(password: string): string {
  return createHmac("sha256", password).update(SESSION_PAYLOAD).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

// Confere se a senha informada bate com APP_PASSWORD (comparação constante).
export function passwordMatches(candidate: string): boolean {
  const password = getAppPassword();
  if (!password) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(password);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Request autenticada? Gate desligado => sempre true.
export function isAuthenticated(): boolean {
  const password = getAppPassword();
  if (!password) return true; // gate off
  const cookie = getCookie(SESSION_COOKIE);
  if (!cookie) return false;
  return safeEqualHex(cookie, sessionToken(password));
}

export function startSession(): void {
  const password = getAppPassword();
  if (!password) return;
  setCookie(SESSION_COOKIE, sessionToken(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export function endSession(): void {
  deleteCookie(SESSION_COOKIE, { path: "/" });
}
