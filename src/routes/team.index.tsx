import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { listAgents } from "@/lib/api/calls.functions";
import type { AgentPerformance } from "@/lib/server/calls-store.server";
import {
  Users,
  Loader2,
  Sparkles,
  TrendingDown,
  Smile,
  Meh,
  Frown,
  ChevronRight,
  Trophy,
} from "lucide-react";

export const Route = createFileRoute("/team/")({
  head: () => ({
    meta: [
      { title: "Equipe · VoiceAudit" },
      { name: "description", content: "Desempenho de compliance e qualidade por atendente." },
    ],
  }),
  component: TeamPage,
});

function scoreCls(s: number) {
  return s >= 75 ? "text-success" : s >= 50 ? "text-warning-foreground" : "text-destructive";
}

function rankMedal(i: number) {
  if (i === 0) return "bg-[image:var(--gradient-primary)] text-primary-foreground";
  if (i === 1) return "bg-secondary text-foreground";
  if (i === 2) return "bg-warning/30 text-warning-foreground";
  return "bg-muted text-muted-foreground";
}

function SentimentBar({ s }: { s: AgentPerformance["sentiment"] }) {
  const total = s.positivo + s.neutro + s.negativo || 1;
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="flex items-center gap-1 text-success">
        <Smile className="h-3.5 w-3.5" />
        {s.positivo}
      </span>
      <span className="flex items-center gap-1 text-warning-foreground">
        <Meh className="h-3.5 w-3.5" />
        {s.neutro}
      </span>
      <span className="flex items-center gap-1 text-destructive">
        <Frown className="h-3.5 w-3.5" />
        {s.negativo}
      </span>
      <div className="ml-auto flex h-1.5 w-24 overflow-hidden rounded-full bg-muted">
        <div className="bg-success" style={{ width: `${(s.positivo / total) * 100}%` }} />
        <div className="bg-warning" style={{ width: `${(s.neutro / total) * 100}%` }} />
        <div className="bg-destructive" style={{ width: `${(s.negativo / total) * 100}%` }} />
      </div>
    </div>
  );
}

function TeamPage() {
  const { data, isLoading } = useQuery<AgentPerformance[]>({
    queryKey: ["agents-performance"],
    queryFn: () => listAgents(),
    refetchOnWindowFocus: true,
  });

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <header>
        <h1 className="text-3xl font-display font-bold flex items-center gap-3">
          <Users className="h-7 w-7 text-primary" />
          Desempenho da Equipe
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ranking de atendentes por score de compliance — derivado das ligações auditadas
        </p>
      </header>

      {isLoading && (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {data && data.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center text-center py-24 text-muted-foreground">
            <Users className="h-12 w-12 mb-4 opacity-40" />
            <p className="text-base font-medium text-foreground">Nenhum atendente avaliado ainda</p>
            <p className="text-sm mt-1">
              Informe o atendente ao analisar uma ligação para alimentar o ranking.
            </p>
            <Link
              to="/analyze"
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Sparkles className="h-4 w-4" /> Ir para Análise IA
            </Link>
          </CardContent>
        </Card>
      )}

      {data && data.length > 0 && (
        <div className="space-y-3">
          {data.map((a, i) => (
            <Link
              key={a.name}
              to="/team/$agentName"
              params={{ agentName: a.name }}
              className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
            >
              <Card className="hover:shadow-[var(--shadow-elegant)] hover:border-primary/40 transition-all cursor-pointer">
                <CardContent className="flex flex-wrap items-center gap-4 py-4">
                  <div
                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${rankMedal(i)}`}
                  >
                    {i < 3 ? <Trophy className="h-4 w-4" /> : i + 1}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{a.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.calls} ligação(ões) · {a.criticalCount} crítica(s) · {a.approvedCount}{" "}
                      aprovada(s)
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className="text-[10px] uppercase text-muted-foreground">Compliance</div>
                      <div
                        className={`text-xl font-display font-bold ${scoreCls(a.avgCompliance)}`}
                      >
                        {a.avgCompliance}%
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] uppercase text-muted-foreground">Qualidade</div>
                      <div className={`text-xl font-display font-bold ${scoreCls(a.avgQuality)}`}>
                        {a.avgQuality}%
                      </div>
                    </div>
                    <StatusBadge
                      status={
                        a.avgCompliance >= 85
                          ? "approved"
                          : a.avgCompliance >= 70
                            ? "warning"
                            : "critical"
                      }
                    />
                  </div>

                  <div className="w-full lg:w-auto lg:min-w-[240px] space-y-2">
                    <SentimentBar s={a.sentiment} />
                    {a.weakestItem && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <TrendingDown className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                        <span className="truncate">
                          Foco: {a.weakestItem.label} ({a.weakestItem.score}%)
                        </span>
                      </div>
                    )}
                  </div>

                  <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
