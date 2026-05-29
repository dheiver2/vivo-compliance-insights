import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  getMonitoringForm,
  resetMonitoringForm,
  saveMonitoringForm,
} from "../server/monitoring-form.server";

// Server fns de gestão da Ficha de Monitoria. O store é server-only; aqui
// expomos leitura e escrita da configuração de critérios usada pelos agentes.

export const getForm = createServerFn({ method: "GET" }).handler(async () =>
  getMonitoringForm(),
);

const CriterionSchema = z.object({
  id: z.string().optional().default(""),
  label: z.string().min(1, "Rótulo obrigatório."),
  description: z.string().optional().default(""),
  category: z.string().optional().default("Geral"),
  weight: z.number().int().min(1).max(5).optional().default(3),
  critical: z.boolean().optional().default(false),
  enabled: z.boolean().optional().default(true),
});

export const saveForm = createServerFn({ method: "POST" })
  .inputValidator(z.object({ criteria: z.array(CriterionSchema).min(1, "A ficha precisa de ao menos um critério.") }))
  .handler(async ({ data }) => saveMonitoringForm(data.criteria));

export const resetForm = createServerFn({ method: "POST" }).handler(async () =>
  resetMonitoringForm(),
);
