import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth, identityKeyHash } from "../server/auth.server";
import { isValidCpf, onlyDigits, maskCpf } from "../cpf";
import {
  setSignature,
  setContestation,
  resolveContestation as resolveStoredContestation,
  type StoredCall,
} from "../server/calls-store.server";

// Server fns de REVISÃO da auditoria: assinatura (aceite) do atendente e
// contestação. Todas exigem sessão (requireAuth) — são mutações sensíveis.

// Assinatura do atendente com chave única = HMAC(CPF). O CPF é validado e
// hasheado no servidor; NUNCA é persistido em claro.
export const signAudit = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      callId: z.string().min(1),
      cpf: z.string().min(1),
      name: z.string().min(1, "Informe o nome do atendente."),
      by: z.enum(["atendente", "supervisor"]).optional().default("atendente"),
    }),
  )
  .handler(async ({ data }): Promise<StoredCall> => {
    requireAuth();
    const digits = onlyDigits(data.cpf);
    if (!isValidCpf(digits)) throw new Error("CPF inválido.");
    const updated = await setSignature(data.callId, {
      agentKeyHash: identityKeyHash(digits),
      agentKeyMasked: maskCpf(digits),
      agentName: data.name.trim(),
      signedAt: new Date().toISOString(),
      by: data.by,
    });
    if (!updated) throw new Error("Ligação não encontrada.");
    return updated;
  });

// Abre uma contestação. Se o autor é o atendente, exige o CPF (identidade).
export const openContestation = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      callId: z.string().min(1),
      by: z.enum(["atendente", "supervisor"]),
      reason: z.string().min(3, "Descreva o motivo da contestação."),
      criterion: z.string().optional(),
      cpf: z.string().optional(),
    }),
  )
  .handler(async ({ data }): Promise<StoredCall> => {
    requireAuth();
    let openedByMasked: string | undefined;
    if (data.by === "atendente") {
      const digits = onlyDigits(data.cpf ?? "");
      if (!isValidCpf(digits)) throw new Error("CPF do atendente inválido.");
      openedByMasked = maskCpf(digits);
    }
    const updated = await setContestation(data.callId, {
      status: "aberta",
      openedBy: data.by,
      openedByMasked,
      reason: data.reason.trim().slice(0, 1000),
      criterion: data.criterion?.trim() || undefined,
      openedAt: new Date().toISOString(),
    });
    if (!updated) throw new Error("Ligação não encontrada.");
    return updated;
  });

// Resolve a contestação aberta (aceita/rejeitada) com parecer. Quem resolve é o
// supervisor logado.
export const resolveContestation = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      callId: z.string().min(1),
      decision: z.enum(["aceita", "rejeitada"]),
      parecer: z.string().min(3, "Escreva o parecer."),
    }),
  )
  .handler(async ({ data }): Promise<StoredCall> => {
    requireAuth();
    const updated = await resolveStoredContestation(data.callId, {
      status: data.decision,
      resolvedBy: "Supervisor",
      parecer: data.parecer.trim().slice(0, 1000),
    });
    if (!updated) throw new Error("Contestação não encontrada.");
    return updated;
  });
