import { createFileRoute, redirect } from "@tanstack/react-router";

// A "Ficha de Monitoria" foi reorganizada: a gestão dos critérios virou a aba
// "Scorecards" e a ficha de cada ligação já vive no detalhe em /calls/$callId.
// Mantemos a rota como um redirecionamento para não quebrar links salvos.
export const Route = createFileRoute("/monitoring")({
  beforeLoad: () => {
    throw redirect({ to: "/scorecards" });
  },
});
