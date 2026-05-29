import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";
import { getDashboard } from "@/lib/api/calls.functions";
import { mangabaModelName } from "@/lib/mangaba";
import type { DashboardData, TrendGranularity } from "@/lib/server/calls-store.server";
import { TrendingUp, TrendingDown, Phone, ShieldCheck, Sparkles, AlertTriangle, Bot, Loader2, CheckCircle2, Smile, Users, Cpu } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · VoiceAudit Vivo" },
      { name: "description", content: "Visão geral de compliance e qualidade de ligações da Vivo." },
    ],
  }),
  component: Dashboard,
});

const PIE_COLORS = ["oklch(0.42 0.22 310)", "oklch(0.55 0.25 315)", "oklch(0.62 0.16 155)", "oklch(0.78 0.16 75)", "oklch(0.6 0.22 25)", "oklch(0.5 0.1 250)", "oklch(0.7 0.12 200)"];

function KpiCard({ icon: Icon, label, value, delta, suffix }: { icon: typeof Phone; label: string; value: string | number; delta: number | null; suffix?: string }) {
  const positive = (delta ?? 0) >= 0;
  return (
    <Card className="relative overflow-hidden border-border/60">
      <div className="absolute inset-x-0 top-0 h-1 bg-[image:var(--gradient-primary)]" />
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-display font-bold text-foreground">
              {value}{suffix}
            </p>
            {delta === null ? (
              <div className="mt-2 text-xs text-muted-foreground">sem base comparativa</div>
            ) : (
              <div className={`mt-2 inline-flex items-center gap-1 text-xs font-medium ${positive ? "text-success" : "text-destructive"}`}>
                {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {positive ? "+" : ""}{delta}% vs 7 dias anteriores
              </div>
            )}
          </div>
          <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center text-center py-24 text-muted-foreground">
        <Sparkles className="h-12 w-12 mb-4 opacity-40" />
        <p className="text-base font-medium text-foreground">Nenhuma ligação analisada ainda</p>
        <p className="text-sm mt-1 max-w-md">
          Os indicadores deste painel são calculados a partir das análises reais.
          Comece enviando áudios ou uma transcrição na Análise IA.
        </p>
        <Link to="/analyze" className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Sparkles className="h-4 w-4" /> Ir para Análise IA
        </Link>
      </CardContent>
    </Card>
  );
}

function scoreCls(s: number) {
  return s >= 85 ? "text-success" : s >= 70 ? "text-warning-foreground" : "text-destructive";
}

const sentimentLabel: Record<string, string> = { positivo: "Positivo", neutro: "Neutro", negativo: "Negativo" };

const GRANULARITY_OPTIONS: { value: TrendGranularity; label: string; word: string; unit: string }[] = [
  { value: "hour", label: "Hora", word: "hora", unit: "horas" },
  { value: "day", label: "Dia", word: "dia", unit: "dias" },
  { value: "week", label: "Semana", word: "semana", unit: "semanas" },
  { value: "month", label: "Mês", word: "mês", unit: "meses" },
];

function Dashboard() {
  const [granularity, setGranularity] = useState<TrendGranularity>("day");
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["dashboard", granularity],
    queryFn: () => getDashboard({ data: { granularity } }),
    refetchOnWindowFocus: true,
  });

  const gMeta = GRANULARITY_OPTIONS.find((o) => o.value === granularity)!;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Painel de Auditoria</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Compliance e qualidade calculados a partir das análises realizadas
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
          {data ? `${data.modelUsage.length} componentes de IA em uso` : "carregando…"}
        </div>
      </header>

      {isLoading && (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {data && data.totalCalls === 0 && <EmptyState />}

      {data && data.totalCalls > 0 && (
        <>
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard icon={Phone} label="Ligações auditadas" value={data.kpis.totalCalls.value.toLocaleString("pt-BR")} delta={data.kpis.totalCalls.delta} />
            <KpiCard icon={ShieldCheck} label="Compliance médio" value={data.kpis.avgCompliance.value} delta={data.kpis.avgCompliance.delta} suffix="%" />
            <KpiCard icon={Sparkles} label="Qualidade média" value={data.kpis.avgQuality.value} delta={data.kpis.avgQuality.delta} suffix="%" />
            <KpiCard icon={AlertTriangle} label="Alertas críticos" value={data.kpis.criticalAlerts.value} delta={data.kpis.criticalAlerts.delta} />
            <KpiCard icon={CheckCircle2} label="Taxa de aprovação" value={data.kpis.approvalRate.value} delta={data.kpis.approvalRate.delta} suffix="%" />
            <KpiCard icon={Smile} label="Sentimento positivo" value={data.kpis.positiveRate.value} delta={data.kpis.positiveRate.delta} suffix="%" />
            <KpiCard icon={Users} label="Atendentes monitorados" value={data.kpis.activeAgents.value} delta={data.kpis.activeAgents.delta} />
            <KpiCard icon={Cpu} label="Cobertura Mangaba AI" value={data.kpis.aiCoverage.value} delta={data.kpis.aiCoverage.delta} suffix="%" />
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle>Evolução por {gMeta.word}</CardTitle>
                    <CardDescription>Score médio de compliance e qualidade por {gMeta.word}</CardDescription>
                  </div>
                  <div className="inline-flex rounded-lg border border-border/60 p-0.5 bg-secondary/40">
                    {GRANULARITY_OPTIONS.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => setGranularity(o.value)}
                        aria-pressed={granularity === o.value}
                        className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                          granularity === o.value
                            ? "bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)]"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {data.dailyTrend.length < 2 ? (
                  <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground text-center px-6">
                    Tendência aparece quando houver análises em pelo menos 2 {gMeta.unit} diferentes.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={data.dailyTrend}>
                      <defs>
                        <linearGradient id="g1" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="oklch(0.42 0.22 310)" />
                          <stop offset="100%" stopColor="oklch(0.55 0.25 315)" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 300)" />
                      <XAxis dataKey="day" stroke="oklch(0.5 0.03 290)" fontSize={12} />
                      <YAxis domain={[0, 100]} stroke="oklch(0.5 0.03 290)" fontSize={12} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid oklch(0.92 0.01 300)", fontSize: 12 }} />
                      <Line type="monotone" dataKey="compliance" stroke="url(#g1)" strokeWidth={3} dot={{ r: 4 }} name="Compliance" />
                      <Line type="monotone" dataKey="quality" stroke="oklch(0.62 0.16 155)" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} name="Qualidade" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Distribuição por tema</CardTitle>
                <CardDescription>Classificação automática das ligações</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={data.topicDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}>
                      {data.topicDistribution.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid oklch(0.92 0.01 300)", fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Ficha de Monitoria — Itens auditados</CardTitle>
                <CardDescription>Aderência média por item de compliance (todas as análises)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.complianceItems.map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-foreground">{item.label}</span>
                      <span className={`font-semibold ${scoreCls(item.score)}`}>{item.score}%</span>
                    </div>
                    <Progress value={item.score} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Bot className="h-4 w-4 text-primary" /> Componentes de IA em uso</CardTitle>
                <CardDescription>Pipeline real que processou as análises</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.modelUsage.map((a) => (
                    <div key={a.name} className="flex items-center justify-between rounded-lg border border-border/60 bg-secondary/40 p-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-[image:var(--gradient-primary)] flex items-center justify-center shadow-[var(--shadow-glow)]">
                          <Bot className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <div>
                          <div className="font-semibold text-sm flex items-center gap-2">
                            {mangabaModelName(a.name)}
                            {a.status === "idle" && <span className="text-[10px] uppercase rounded bg-warning/30 px-1.5 py-0.5 text-warning-foreground">fallback</span>}
                          </div>
                          <div className="text-xs text-muted-foreground">{a.role}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">{a.calls.toLocaleString("pt-BR")}</div>
                        <div className="text-[11px] text-muted-foreground">análises</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Ligações recentes</CardTitle>
              <CardDescription>Últimas auditorias processadas pelos agentes de IA</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
                    <th className="py-3 px-2">Protocolo</th>
                    <th className="py-3 px-2">Quando</th>
                    <th className="py-3 px-2">Origem</th>
                    <th className="py-3 px-2">Tema</th>
                    <th className="py-3 px-2">Compliance</th>
                    <th className="py-3 px-2">Qualidade</th>
                    <th className="py-3 px-2">Sentimento</th>
                    <th className="py-3 px-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentCalls.map((c) => (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-secondary/40 transition-colors">
                      <td className="py-3 px-2 font-mono text-xs text-primary">{c.protocol}</td>
                      <td className="py-3 px-2 text-muted-foreground text-xs">{new Date(c.createdAt).toLocaleString("pt-BR")}</td>
                      <td className="py-3 px-2">
                        <span className="text-xs">{c.origin === "audio" ? "Áudio" : "Texto"}</span>
                        <span className="block text-[11px] text-muted-foreground truncate max-w-[160px]">{c.label}</span>
                      </td>
                      <td className="py-3 px-2">{c.topic}</td>
                      <td className={`py-3 px-2 font-semibold ${scoreCls(c.scoreCompliance)}`}>{c.scoreCompliance}%</td>
                      <td className={`py-3 px-2 font-semibold ${scoreCls(c.scoreQuality)}`}>{c.scoreQuality}%</td>
                      <td className="py-3 px-2 text-xs">{sentimentLabel[c.sentiment]}</td>
                      <td className="py-3 px-2"><StatusBadge status={c.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
