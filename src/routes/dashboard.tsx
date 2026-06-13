import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";
import { getDashboard } from "@/lib/api/calls.functions";
import { reprocessCalls } from "@/lib/api/analyze.functions";
import { RefreshButton } from "@/components/RefreshButton";
import { mangabaModelName } from "@/lib/mangaba";
import type { DashboardData, TrendGranularity } from "@/lib/server/calls-store.server";
import {
  TrendingUp,
  TrendingDown,
  Phone,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  Bot,
  Loader2,
  CheckCircle2,
  Smile,
  Users,
  Cpu,
  ArrowRight,
  Clock,
  Mic,
  Repeat,
  Target,
  PhoneOff,
  Hourglass,
  TrendingUp as TrendingUpIcon,
  Search,
  MessagesSquare,
  Ear,
  ClipboardCheck,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · VoiceAudit Vivo" },
      {
        name: "description",
        content: "Visão geral de compliance e qualidade de ligações da Vivo.",
      },
    ],
  }),
  component: Dashboard,
});

const PIE_COLORS = [
  "oklch(0.42 0.22 310)",
  "oklch(0.55 0.25 315)",
  "oklch(0.62 0.16 155)",
  "oklch(0.78 0.16 75)",
  "oklch(0.6 0.22 25)",
  "oklch(0.5 0.1 250)",
  "oklch(0.7 0.12 200)",
];

function KpiCard({
  icon: Icon,
  label,
  value,
  delta,
  suffix,
  invertDelta,
}: {
  icon: typeof Phone;
  label: string;
  value: string | number;
  delta: number | null;
  suffix?: string;
  invertDelta?: boolean; // quando cair é bom (ex.: TMA, cancelamento)
}) {
  const up = (delta ?? 0) >= 0;
  const positive = invertDelta ? !up : up;
  return (
    <Card className="relative overflow-hidden border-border/60">
      <div className="absolute inset-x-0 top-0 h-1 bg-[image:var(--gradient-primary)]" />
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-display font-bold text-foreground">
              {value}
              {suffix}
            </p>
            {delta === null ? (
              <div className="mt-2 text-xs text-muted-foreground">sem base comparativa</div>
            ) : (
              <div
                className={`mt-2 inline-flex items-center gap-1 text-xs font-medium ${positive ? "text-success" : "text-destructive"}`}
              >
                {up ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {up ? "+" : ""}
                {delta}% vs 7 dias anteriores
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
          Os indicadores deste painel são calculados a partir de ligações reais. Importe as
          gravações do discador 3C Plus em Configurações para alimentar o painel.
        </p>
        <Link
          to="/settings"
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Phone className="h-4 w-4" /> Importar ligações da 3C Plus
        </Link>
        <Link to="/audios" className="mt-3 text-xs text-muted-foreground hover:text-foreground">
          ou selecionar áudios da 3C Plus para auditar
        </Link>
      </CardContent>
    </Card>
  );
}

function mmss(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Duração longa (volume total) em h:mm ou m min.
function hhmm(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.round((totalSeconds % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m} min`;
}

function scoreCls(s: number) {
  return s >= 75 ? "text-success" : s >= 50 ? "text-warning-foreground" : "text-destructive";
}

const sentimentLabel: Record<string, string> = {
  positivo: "Positivo",
  neutro: "Neutro",
  negativo: "Negativo",
};

const GRANULARITY_OPTIONS: {
  value: TrendGranularity;
  label: string;
  word: string;
  unit: string;
}[] = [
  { value: "hour", label: "Hora", word: "hora", unit: "horas" },
  { value: "day", label: "Dia", word: "dia", unit: "dias" },
  { value: "week", label: "Semana", word: "semana", unit: "semanas" },
  { value: "month", label: "Mês", word: "mês", unit: "meses" },
];

function Dashboard() {
  const [granularity, setGranularity] = useState<TrendGranularity>("day");
  const { data, isLoading, isFetching, refetch, dataUpdatedAt } = useQuery<DashboardData>({
    queryKey: ["dashboard", granularity],
    queryFn: () => getDashboard({ data: { granularity } }),
    // Painel ao vivo: re-busca a cada 15s (mais frequente que o padrão global),
    // refletindo automaticamente cada nova ligação auditada pelos motores.
    refetchInterval: 15_000,
  });

  // Auto-reparo: se há ligações mas TODOS os itens do scorecard estão zerados, é
  // sinal de que foram auditadas sob uma norma anterior (labels divergentes da
  // ficha vigente). Reprocessa uma única vez, sozinho, e recarrega os números —
  // sem nenhuma ação humana. Guard por ref evita repetição.
  const healedRef = useRef(false);
  useEffect(() => {
    if (healedRef.current || !data || data.totalCalls === 0) return;
    const items = data.complianceItems;
    const allZero = items.length > 0 && items.every((i) => i.score === 0);
    if (!allZero) return;
    healedRef.current = true;
    reprocessCalls().then(() => refetch());
  }, [data, refetch]);

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
        <div className="flex items-center gap-4">
          <div
            className="flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-medium text-success"
            title="O painel se atualiza automaticamente a cada nova ligação auditada — sem ação manual."
          >
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            Ao vivo · atualização automática
          </div>
          <Link
            to="/relatorios"
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Relatórios <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <RefreshButton onClick={() => refetch()} busy={isFetching} updatedAt={dataUpdatedAt} />
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
          <Tabs defaultValue="geral" className="space-y-5">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-lg font-display font-semibold tracking-tight">Indicadores</h2>
                <p className="text-sm text-muted-foreground">
                  Recalculados automaticamente a cada ligação auditada
                </p>
              </div>
              <TabsList className="h-10 p-1">
                <TabsTrigger value="geral" className="gap-1.5 px-4">
                  <Sparkles className="h-3.5 w-3.5" /> Visão geral
                </TabsTrigger>
                <TabsTrigger value="operacional" className="gap-1.5 px-4">
                  <Phone className="h-3.5 w-3.5" /> Operacional
                </TabsTrigger>
                <TabsTrigger value="comercial" className="gap-1.5 px-4">
                  <TrendingUpIcon className="h-3.5 w-3.5" /> Comercial
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="geral" className="mt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                  icon={Phone}
                  label="Ligações auditadas"
                  value={data.kpis.totalCalls.value.toLocaleString("pt-BR")}
                  delta={data.kpis.totalCalls.delta}
                />
                <KpiCard
                  icon={ShieldCheck}
                  label="Compliance médio"
                  value={data.kpis.avgCompliance.value}
                  delta={data.kpis.avgCompliance.delta}
                  suffix="%"
                />
                <KpiCard
                  icon={Sparkles}
                  label="Qualidade média"
                  value={data.kpis.avgQuality.value}
                  delta={data.kpis.avgQuality.delta}
                  suffix="%"
                />
                <KpiCard
                  icon={AlertTriangle}
                  label="Alertas críticos"
                  value={data.kpis.criticalAlerts.value}
                  delta={data.kpis.criticalAlerts.delta}
                />
                <KpiCard
                  icon={CheckCircle2}
                  label="Taxa de aprovação"
                  value={data.kpis.approvalRate.value}
                  delta={data.kpis.approvalRate.delta}
                  suffix="%"
                />
                <KpiCard
                  icon={Smile}
                  label="Sentimento positivo"
                  value={data.kpis.positiveRate.value}
                  delta={data.kpis.positiveRate.delta}
                  suffix="%"
                />
                <KpiCard
                  icon={Users}
                  label="Atendentes monitorados"
                  value={data.kpis.activeAgents.value}
                  delta={data.kpis.activeAgents.delta}
                />
                <KpiCard
                  icon={Cpu}
                  label="Cobertura Mangaba AI"
                  value={data.kpis.aiCoverage.value}
                  delta={data.kpis.aiCoverage.delta}
                  suffix="%"
                />
                <KpiCard
                  icon={Target}
                  label="Resolução 1º contato"
                  value={data.kpis.fcrRate.value}
                  delta={data.kpis.fcrRate.delta}
                  suffix="%"
                />
              </div>
            </TabsContent>

            <TabsContent value="operacional" className="mt-0 space-y-3">
              <p className="text-xs text-muted-foreground">
                Tempos das ligações (duração real da gravação; estimada pelo diálogo quando a origem
                não informa)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <KpiCard
                  icon={Clock}
                  label="TMA — tempo médio"
                  value={mmss(data.callCenter.ahtSeconds.value)}
                  delta={data.callCenter.ahtSeconds.delta}
                  invertDelta
                />
                <KpiCard
                  icon={Repeat}
                  label="Duração mediana"
                  value={mmss(data.callCenter.medianSeconds.value)}
                  delta={data.callCenter.medianSeconds.delta}
                  invertDelta
                />
                <KpiCard
                  icon={Mic}
                  label="Maior ligação"
                  value={mmss(data.callCenter.maxSeconds.value)}
                  delta={data.callCenter.maxSeconds.delta}
                />
                <KpiCard
                  icon={Ear}
                  label="Menor ligação"
                  value={mmss(data.callCenter.minSeconds.value)}
                  delta={data.callCenter.minSeconds.delta}
                />
                <KpiCard
                  icon={Hourglass}
                  label="Tempo total auditado"
                  value={hhmm(data.callCenter.totalAuditedSeconds.value)}
                  delta={data.callCenter.totalAuditedSeconds.delta}
                />
              </div>
            </TabsContent>

            <TabsContent value="comercial" className="mt-0 space-y-3">
              <p className="text-xs text-muted-foreground">
                Norma de monitoria de vendas Vivo Empresas
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <KpiCard
                  icon={Target}
                  label="Taxa de conversão"
                  value={data.sales.conversionRate.value}
                  delta={data.sales.conversionRate.delta}
                  suffix="%"
                />
                <KpiCard
                  icon={Search}
                  label="Aderência à sondagem"
                  value={data.sales.sondagemScore.value}
                  delta={data.sales.sondagemScore.delta}
                  suffix="%"
                />
                <KpiCard
                  icon={MessagesSquare}
                  label="Argumentação"
                  value={data.sales.argumentationScore.value}
                  delta={data.sales.argumentationScore.delta}
                  suffix="%"
                />
                <KpiCard
                  icon={Ear}
                  label="Escuta ativa"
                  value={data.sales.activeListeningRate.value}
                  delta={data.sales.activeListeningRate.delta}
                  suffix="%"
                />
                <KpiCard
                  icon={ClipboardCheck}
                  label="Tabulação correta"
                  value={data.sales.taggingRate.value}
                  delta={data.sales.taggingRate.delta}
                  suffix="%"
                />
                <KpiCard
                  icon={PhoneOff}
                  label="Taxa de cancelamento"
                  value={data.sales.cancelRate.value}
                  delta={data.sales.cancelRate.delta}
                  suffix="%"
                  invertDelta
                />
              </div>
            </TabsContent>
          </Tabs>

          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span className="font-medium">Revisão das auditorias</span>
              </div>
              <div className="flex flex-wrap items-center gap-6 text-sm">
                <span>
                  <strong className="text-foreground">{data.review.signedRate}%</strong>{" "}
                  <span className="text-muted-foreground">assinadas</span>
                </span>
                <span>
                  <strong className="text-foreground">{data.review.contestedRate}%</strong>{" "}
                  <span className="text-muted-foreground">contestadas</span>
                </span>
                <Link
                  to="/calls"
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
                    data.review.openContestations > 0
                      ? "bg-warning/15 text-warning-foreground hover:bg-warning/25"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {data.review.openContestations} contestação(ões) aberta(s)
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </CardContent>
          </Card>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle>Evolução por {gMeta.word}</CardTitle>
                    <CardDescription>
                      Score médio de compliance e qualidade por {gMeta.word}
                    </CardDescription>
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
                {data.dailyTrend.length === 0 ? (
                  <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground text-center px-6">
                    A evolução aparece assim que houver ligações auditadas — importe e audite
                    gravações na aba Áudios.
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
                        stroke="url(#g1)"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                        name="Compliance"
                      />
                      <Line
                        type="monotone"
                        dataKey="quality"
                        stroke="oklch(0.62 0.16 155)"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={{ r: 3 }}
                        name="Qualidade"
                      />
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
                    <Pie
                      data={data.topicDistribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {data.topicDistribution.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid oklch(0.92 0.01 300)",
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                <div className="space-y-1.5">
                  <CardTitle>Scorecard — Itens auditados</CardTitle>
                  <CardDescription>
                    Aderência média por critério de compliance (todas as análises)
                  </CardDescription>
                </div>
                <Link
                  to="/scorecards"
                  className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Editar <ArrowRight className="h-3.5 w-3.5" />
                </Link>
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
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" /> Componentes de IA em uso
                </CardTitle>
                <CardDescription>Pipeline real que processou as análises</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.modelUsage.map((a) => (
                    <div
                      key={a.name}
                      className="flex items-center justify-between rounded-lg border border-border/60 bg-secondary/40 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-[image:var(--gradient-primary)] flex items-center justify-center shadow-[var(--shadow-glow)]">
                          <Bot className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <div>
                          <div className="font-semibold text-sm flex items-center gap-2">
                            {mangabaModelName(a.name)}
                            {a.status === "idle" && (
                              <span className="text-[10px] uppercase rounded bg-warning/30 px-1.5 py-0.5 text-warning-foreground">
                                fallback
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{a.role}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">
                          {a.calls.toLocaleString("pt-BR")}
                        </div>
                        <div className="text-[11px] text-muted-foreground">análises</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
              <div className="space-y-1.5">
                <CardTitle>Ligações recentes</CardTitle>
                <CardDescription>
                  Últimas auditorias processadas pelos agentes de IA
                </CardDescription>
              </div>
              <Link
                to="/calls"
                className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Ver todas <ArrowRight className="h-3.5 w-3.5" />
              </Link>
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
                    <tr
                      key={c.id}
                      className="border-b border-border/50 hover:bg-secondary/40 transition-colors"
                    >
                      <td className="py-3 px-2 font-mono text-xs">
                        <Link
                          to="/calls/$callId"
                          params={{ callId: c.id }}
                          className="text-primary hover:underline"
                        >
                          {c.protocol}
                        </Link>
                      </td>
                      <td className="py-3 px-2 text-muted-foreground text-xs">
                        {new Date(c.createdAt).toLocaleString("pt-BR")}
                      </td>
                      <td className="py-3 px-2">
                        <span className="text-xs">{c.origin === "audio" ? "Áudio" : "Texto"}</span>
                        <span className="block text-[11px] text-muted-foreground truncate max-w-[160px]">
                          {c.label}
                        </span>
                      </td>
                      <td className="py-3 px-2">{c.topic}</td>
                      <td className={`py-3 px-2 font-semibold ${scoreCls(c.scoreCompliance)}`}>
                        {c.scoreCompliance}%
                      </td>
                      <td className={`py-3 px-2 font-semibold ${scoreCls(c.scoreQuality)}`}>
                        {c.scoreQuality}%
                      </td>
                      <td className="py-3 px-2 text-xs">{sentimentLabel[c.sentiment]}</td>
                      <td className="py-3 px-2">
                        <StatusBadge status={c.status} />
                      </td>
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
