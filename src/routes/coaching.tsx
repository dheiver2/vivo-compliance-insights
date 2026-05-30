import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RefreshButton } from "@/components/RefreshButton";
import { listAgents, getDashboard } from "@/lib/api/calls.functions";
import type { AgentPerformance, DashboardData } from "@/lib/server/calls-store.server";
import {
  GraduationCap,
  Loader2,
  TrendingDown,
  AlertTriangle,
  ChevronRight,
  Target,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/coaching")({
  head: () => ({
    meta: [
      { title: "Coaching · VoiceAudit" },
      {
        name: "description",
        content:
          "Prioridades de coaching por atendente e focos de melhoria do time, derivados das auditorias.",
      },
    ],
  }),
  component: CoachingPage,
});

function scoreCls(s: number) {
  return s >= 75 ? "text-success" : s >= 50 ? "text-warning-foreground" : "text-destructive";
}

// Pontuação de "necessidade de coaching" (maior = mais urgente). Combina a
// distância até a meta de compliance com o peso das ligações críticas. 100%
// derivada das auditorias reais — sem números inventados.
function coachingNeed(a: AgentPerformance): number {
  const gap = Math.max(0, 85 - a.avgCompliance); // distância até a meta de 85%
  const criticalWeight = a.calls > 0 ? (a.criticalCount / a.calls) * 40 : 0;
  return gap + criticalWeight;
}

function CoachingPage() {
  const agentsQ = useQuery<AgentPerformance[]>({
    queryKey: ["agents-performance"],
    queryFn: () => listAgents(),
    refetchOnWindowFocus: true,
  });
  const dashQ = useQuery<DashboardData>({
    queryKey: ["dashboard", "day"],
    queryFn: () => getDashboard({ data: { granularity: "day" } }),
    refetchOnWindowFocus: true,
  });

  const isLoading = agentsQ.isLoading || dashQ.isLoading;
  const agents = agentsQ.data ?? [];

  // Fila de coaching: quem mais precisa primeiro. Mantém só quem está abaixo da
  // meta ou tem ligações críticas — os demais já estão no verde.
  const queue = agents
    .filter((a) => a.avgCompliance < 85 || a.criticalCount > 0)
    .map((a) => ({ a, need: coachingNeed(a) }))
    .sort((x, y) => y.need - x.need);

  // Focos do time: critérios do scorecard com a menor média (dado real dos checks).
  const teamFocus = (dashQ.data?.complianceItems ?? [])
    .filter((c) => c.score > 0)
    .slice()
    .sort((x, y) => x.score - y.score)
    .slice(0, 4);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-3">
            <GraduationCap className="h-7 w-7 text-primary" />
            Coaching
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Prioridades de desenvolvimento por atendente e focos do time — derivados das ligações
            auditadas.
          </p>
        </div>
        <RefreshButton
          onClick={() => {
            agentsQ.refetch();
            dashQ.refetch();
          }}
          busy={agentsQ.isFetching || dashQ.isFetching}
          updatedAt={agentsQ.dataUpdatedAt}
        />
      </header>

      {isLoading && (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {!isLoading && agents.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center text-center py-24 text-muted-foreground">
            <GraduationCap className="h-12 w-12 mb-4 opacity-40" />
            <p className="text-base font-medium text-foreground">Sem dados para coaching ainda</p>
            <p className="text-sm mt-1">
              Importe as ligações reais da 3C Plus em Configurações — as prioridades de coaching
              aparecem automaticamente a partir das auditorias.
            </p>
            <Link
              to="/settings"
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <GraduationCap className="h-4 w-4" /> Importar ligações da 3C Plus
            </Link>
          </CardContent>
        </Card>
      )}

      {!isLoading && agents.length > 0 && (
        <>
          {/* Focos do time */}
          {teamFocus.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Target className="h-5 w-5 text-primary" /> Focos do time
                </CardTitle>
                <CardDescription>
                  Critérios do scorecard com a menor média geral — temas para treinar com toda a
                  equipe.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-0">
                {teamFocus.map((c) => (
                  <div
                    key={c.label}
                    className="rounded-lg border border-border/60 bg-muted/20 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">
                        Média do time
                      </span>
                      <span className={`text-lg font-display font-bold ${scoreCls(c.score)}`}>
                        {c.score}%
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium leading-snug">{c.label}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Fila de coaching por atendente */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Prioridades por atendente
            </h2>

            {queue.length === 0 ? (
              <Card className="border-success/40 bg-success/5">
                <CardContent className="flex items-center gap-3 py-6 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                  <span>
                    Todos os atendentes estão na meta (compliance ≥ 85% e sem ligações críticas).
                    Nenhum coaching prioritário no momento.
                  </span>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {queue.map(({ a }, i) => (
                  <Link
                    key={a.name}
                    to="/team/$agentName"
                    params={{ agentName: a.name }}
                    className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
                  >
                    <Card className="hover:shadow-[var(--shadow-elegant)] hover:border-primary/40 transition-all cursor-pointer">
                      <CardContent className="flex flex-wrap items-center gap-4 py-4">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
                          {i + 1}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="font-semibold truncate">{a.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {a.calls} ligação(ões) auditada(s) · compliance{" "}
                            <span className={scoreCls(a.avgCompliance)}>{a.avgCompliance}%</span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5 w-full lg:w-auto lg:min-w-[280px]">
                          {a.weakestItem && (
                            <div className="flex items-center gap-1.5 text-xs">
                              <TrendingDown className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                              <span className="text-muted-foreground">Treinar:</span>
                              <span className="truncate font-medium">
                                {a.weakestItem.label} ({a.weakestItem.score}%)
                              </span>
                            </div>
                          )}
                          {a.criticalCount > 0 ? (
                            <div className="flex items-center gap-1.5 text-xs text-destructive">
                              <ShieldAlert className="h-3.5 w-3.5 flex-shrink-0" />
                              {a.criticalCount} ligação(ões) crítica(s) para revisar
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-xs text-warning-foreground">
                              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                              Abaixo da meta de 85% de compliance
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
        </>
      )}
    </div>
  );
}
