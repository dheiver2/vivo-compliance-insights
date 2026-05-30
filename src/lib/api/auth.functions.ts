import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  endSession,
  isAuthenticated,
  isGateEnabled,
  passwordMatches,
  startSession,
} from "../server/auth.server";

export interface AuthStatus {
  // Há senha configurada (APP_PASSWORD)? Se false, o app é aberto.
  gateEnabled: boolean;
  // A request atual está autenticada (ou o gate está desligado)?
  authed: boolean;
}

// Estado de auth — usado pelo guard de rota e pela tela de login.
export const getAuthStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<AuthStatus> => ({
    gateEnabled: isGateEnabled(),
    authed: isAuthenticated(),
  }),
);

// Valida a senha e, se bater, inicia a sessão (cookie httpOnly).
export const login = createServerFn({ method: "POST" })
  .inputValidator(z.object({ password: z.string().min(1) }))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    if (!isGateEnabled()) return { ok: true }; // gate off: nada a validar
    if (!passwordMatches(data.password)) return { ok: false };
    startSession();
    return { ok: true };
  });

// Encerra a sessão.
export const logout = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: true }> => {
    endSession();
    return { ok: true };
  },
);
