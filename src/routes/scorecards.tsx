import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCheck } from "lucide-react";
import { ScorecardManager } from "@/components/ScorecardManager";

export const Route = createFileRoute("/scorecards")({
  head: () => ({
    meta: [
      { title: "Scorecards · VoiceAudit" },
      {
        name: "description",
        content:
          "Defina os critérios de avaliação (scorecard) que os agentes Mangaba usam em cada ligação.",
      },
    ],
  }),
  component: ScorecardsPage,
});

function ScorecardsPage() {
  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <header>
        <h1 className="text-3xl font-display font-bold flex items-center gap-3">
          <ClipboardCheck className="h-7 w-7 text-primary" />
          Scorecards
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie os critérios de avaliação que os agentes Mangaba usam para pontuar cada ligação.
          Cada item alimenta o prompt da IA e as médias do dashboard.
        </p>
      </header>

      <ScorecardManager />
    </div>
  );
}
