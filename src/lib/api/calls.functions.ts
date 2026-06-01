import { createServerFn } from "@tanstack/react-start";
import process from "node:process";
import { z } from "zod";

import {
  clearCalls as clearStoredCalls,
  getAgentProfile,
  getAgentsPerformance,
  getCallById,
  getDashboardData,
  listCalls as listStoredCalls,
} from "../server/calls-store.server";
import { requireAuth } from "../server/auth.server";

// Server fns de leitura. O store é server-only (.server.ts) e fica de fora do
// bundle do cliente — aqui só expomos os dados agregados/serializáveis. Todas
// exigem sessão (requireAuth): o gate protege as páginas, e estas chamadas também.

export const getDashboard = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({ granularity: z.enum(["hour", "day", "week", "month"]).optional() }).optional(),
  )
  .handler(async ({ data }) => {
    requireAuth();
    return getDashboardData(data?.granularity ?? "day");
  });

export const listCalls = createServerFn({ method: "GET" }).handler(async () => {
  requireAuth();
  return listStoredCalls();
});

// Detalhe de uma ligação específica pelo id (ex.: "C-10001").
export const getCall = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    requireAuth();
    return (await getCallById(data.id)) ?? null;
  });

// Ranking de desempenho de todos os atendentes.
export const listAgents = createServerFn({ method: "GET" }).handler(async () => {
  requireAuth();
  return getAgentsPerformance();
});

// Perfil detalhado de um atendente pelo nome.
export const getAgent = createServerFn({ method: "GET" })
  .inputValidator(z.object({ name: z.string().min(1) }))
  .handler(async ({ data }) => {
    requireAuth();
    return (await getAgentProfile(data.name)) ?? null;
  });

// Status do sistema para a tela de Configurações. NÃO expõe o token — apenas se
// está configurado e quais modelos estão em uso.
export interface SystemStatus {
  hfConfigured: boolean;
  llmModel: string;
  asrModel: string;
  totalCalls: number;
}

export const getSystemStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<SystemStatus> => {
    requireAuth();
    const calls = await listStoredCalls();
    return {
      hfConfigured: Boolean(process.env.HF_TOKEN),
      llmModel: process.env.HF_MODEL || "meta-llama/Llama-3.1-8B-Instruct",
      asrModel: process.env.HF_ASR_MODEL || "openai/whisper-large-v3-turbo",
      totalCalls: calls.length,
    };
  },
);

// Apaga todas as análises armazenadas.
export const clearCalls = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: true }> => {
    requireAuth();
    await clearStoredCalls();
    return { ok: true };
  },
);
