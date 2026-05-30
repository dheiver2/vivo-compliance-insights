import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";
import { getAgent } from "@/lib/api/calls.functions";
import type { AgentProfile } from "@/lib/server/calls-store.server";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  ArrowLeft,
  Loader2,
  Search,
  User,
  AudioLines,
  FileText,
  TrendingDown,
  Lightbulb,
} from "lucide-react";

export const Route = createFileRoute("/team/$agentName")({
  head: () => ({ meta: [{ title: "Perfil do atendente · VoiceAudit" }] }),
  component: AgentDetailPage,
});

function scoreCls(s: number) {
  return s >= 75 ? "text-success" : s >= 50 ? "text-warning-foreground" : "text-destructive";
}

function AgentDetailPage() {
  const { agentName } = Route.useParams();
  const { data, isLoading } = useQuery<AgentProfile | null>({
    queryKey: ["agent", agentName],
    queryFn: () => getAgent({ data: { name: agentName } }),
  });

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <Link
        to="/team"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para Equipe
      </Link>

      {isLoading && (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {data === null && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center text-center py-24 text-muted-foreground">
            <Search className="h-12 w-12 mb-4 opacity-40" />
            <p className="text-base font-medium text-foreground">Atendente não encontrado</p>
            <p className="text-sm mt-1">
              Não há ligações atribuídas a <span className="font-medium">{agentName}</span>.
            </p>
            <Link
              to="/team"
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Ver toda a equipe
            </Link>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          <Card>
            <CardHeader className="border-b border-border/60 bg-secondary/40">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-12 w-12 rounded-full bg-[image:var(--gradient-primary)] flex items-center justify-center text-primary-foreground flex-shrink-0">
                    <User className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="truncate">{data.performance.name}</CardTitle>
                    <CardDescription>
                      {data.performance.calls} ligação(ões) auditada(s) · última em{" "}
                      {new Date(data.performance.lastCallAt).toLocaleString("pt-BR")}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-[10px] uppercase text-muted-foreground">Compliance</div>
                    <div
                      className={`text-3xl font-display font-bold ${scoreCls(data.performance.avgCompliance)}`}
                    >
                      {data.performance.avgCompliance}%
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] uppercase text-muted-foreground">Qualidade</div>
                    <div
                      className={`text-3xl font-display font-bold ${scoreCls(data.performance.avgQuality)}`}
                    >
                      {data.performance.avgQuality}%
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {data.performance.weakestItem && (
                <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/5 p-3">
                  <Lightbulb className="h-5 w-5 text-warning-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold">Recomendação de coaching</div>
                    <p className="text-sm text-muted-foreground">
                      O ponto mais fraco é{" "}
                      <span className="font-medium text-foreground">
                        {data.performance.weakestItem.label}
                      </span>{" "}
                      (média {data.performance.weakestItem.score}%). Priorize feedback nesse
                      critério.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {data.trend.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Evolução</CardTitle>
                <CardDescription>Compliance e qualidade por dia</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={data.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 300)" />
                    <XAxis dataKey="day" stroke="oklch(0.5 0.03 290)" fontSize={12} />
                    <YAxis domain={[0, 100]} stroke="oklch(0.5 0.03 290)" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid oklch(0.92 0.01 300)",
                        fontSize: 12,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="compliance"
                      name="Compliance"
                      stroke="oklch(0.42 0.22 310)"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="quality"
                      name="Qualidade"
                      stroke="oklch(0.62 0.16 155)"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Média por item da checklist</CardTitle>
              <CardDescription>
                Desempenho regulatório agregado das ligações deste atendente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.checklistAverages.map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium flex items-center gap-1.5">
                      {data.performance.weakestItem?.label === item.label && (
                        <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                      )}
                      {item.label}
                    </span>
                    <span className={`font-semibold ${scoreCls(item.score)}`}>{item.score}%</span>
                  </div>
                  <Progress value={item.score} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ligações do atendente</CardTitle>
              <CardDescription>
                {data.calls.length} registro(s) — mais recentes primeiro
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.calls.map((c) => (
                <Link
                  key={c.id}
                  to="/calls/$callId"
                  params={{ callId: c.id }}
                  className="flex items-center gap-3 rounded-lg border border-border/60 p-3 hover:border-primary/40 hover:bg-secondary/40 transition-colors"
                >
                  {c.origin === "audio" ? (
                    <AudioLines className="h-4 w-4 text-primary flex-shrink-0" />
                  ) : (
                    <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{c.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.topic} · {new Date(c.createdAt).toLocaleString("pt-BR")}
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${scoreCls(c.scoreCompliance)}`}>
                    {c.scoreCompliance}%
                  </span>
                  <StatusBadge status={c.status} />
                </Link>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
