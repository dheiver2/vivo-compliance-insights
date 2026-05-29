import { createServerFn } from "@tanstack/react-start";
import process from "node:process";
import { z } from "zod";

import {
  clearCalls as clearStoredCalls,
  reseedCalls as reseedStoredCalls,
  getAgentProfile,
  getAgentsPerformance,
  getCallById,
  getDashboardData,
  listCalls as listStoredCalls,
} from "../server/calls-store.server";

// Server fns de leitura. O store é server-only (.server.ts) e fica de fora do
// bundle do cliente — aqui só expomos os dados agregados/serializáveis.

export const getDashboard = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({ granularity: z.enum(["hour", "day", "week", "month"]).optional() }).optional(),
  )
  .handler(async ({ data }) => getDashboardData(data?.granularity ?? "day"));

export const listCalls = createServerFn({ method: "GET" }).handler(async () => listStoredCalls());

// Detalhe de uma ligação específica pelo id (ex.: "C-10001").
export const getCall = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => (await getCallById(data.id)) ?? null);

// Ranking de desempenho de todos os atendentes.
export const listAgents = createServerFn({ method: "GET" }).handler(async () =>
  getAgentsPerformance(),
);

// Perfil detalhado de um atendente pelo nome.
export const getAgent = createServerFn({ method: "GET" })
  .inputValidator(z.object({ name: z.string().min(1) }))
  .handler(async ({ data }) => (await getAgentProfile(data.name)) ?? null);

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
    await clearStoredCalls();
    return { ok: true };
  },
);

// Restaura o seed de demonstração (10 ligações reais da 3C Plus), sobrescrevendo
// o conteúdo atual do store.
export const reseedCalls = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: true; total: number }> => {
    const total = await reseedStoredCalls();
    return { ok: true, total };
  },
);
