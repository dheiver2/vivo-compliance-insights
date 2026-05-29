import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";
import { calls, kpis, dailyTrend, topicDistribution, complianceItems, aiAgents } from "@/lib/mock-data";
import { TrendingUp, TrendingDown, Phone, ShieldCheck, Sparkles, AlertTriangle, Bot } from "lucide-react";
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

const PIE_COLORS = ["oklch(0.42 0.22 310)", "oklch(0.55 0.25 315)", "oklch(0.62 0.16 155)", "oklch(0.78 0.16 75)", "oklch(0.6 0.22 25)"];

function KpiCard({ icon: Icon, label, value, delta, suffix }: { icon: typeof Phone; label: string; value: string | number; delta: number; suffix?: string }) {
  const positive = delta >= 0;
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
            <div className={`mt-2 inline-flex items-center gap-1 text-xs font-medium ${positive ? "text-success" : "text-destructive"}`}>
              {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {positive ? "+" : ""}{delta}% vs semana anterior
            </div>
          </div>
          <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Painel de Auditoria</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Compliance e qualidade das ligações monitoradas por agentes de IA · Últimos 7 dias
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
          4 agentes ativos · processando em tempo real
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Phone} label="Ligações auditadas" value={kpis.totalCalls.value.toLocaleString("pt-BR")} delta={kpis.totalCalls.delta} />
        <KpiCard icon={ShieldCheck} label="Compliance médio" value={kpis.avgCompliance.value} delta={kpis.avgCompliance.delta} suffix="%" />
        <KpiCard icon={Sparkles} label="Qualidade média" value={kpis.avgQuality.value} delta={kpis.avgQuality.delta} suffix="%" />
        <KpiCard icon={AlertTriangle} label="Alertas críticos" value={kpis.criticalAlerts.value} delta={kpis.criticalAlerts.delta} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Evolução semanal</CardTitle>
            <CardDescription>Score médio diário de compliance e qualidade</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={dailyTrend}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="oklch(0.42 0.22 310)" />
                    <stop offset="100%" stopColor="oklch(0.55 0.25 315)" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 300)" />
                <XAxis dataKey="day" stroke="oklch(0.5 0.03 290)" fontSize={12} />
                <YAxis domain={[60, 100]} stroke="oklch(0.5 0.03 290)" fontSize={12} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid oklch(0.92 0.01 300)", fontSize: 12 }} />
                <Line type="monotone" dataKey="compliance" stroke="url(#g1)" strokeWidth={3} dot={{ r: 4 }} name="Compliance" />
                <Line type="monotone" dataKey="quality" stroke="oklch(0.62 0.16 155)" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} name="Qualidade" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição por tema</CardTitle>
            <CardDescription>Volume de ligações por categoria</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={topicDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {topicDistribution.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
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
            <CardDescription>Aderência média dos atendentes por item de compliance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {complianceItems.map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-foreground">{item.label}</span>
                  <span className={`font-semibold ${item.score >= 85 ? "text-success" : item.score >= 70 ? "text-warning-foreground" : "text-destructive"}`}>
                    {item.score}%
                  </span>
                </div>
                <Progress value={item.score} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bot className="h-4 w-4 text-primary" /> Agentes de IA</CardTitle>
            <CardDescription>Scripts de compliance e auditoria em operação</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {aiAgents.map((a) => (
                <div key={a.name} className="flex items-center justify-between rounded-lg border border-border/60 bg-secondary/40 p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-[image:var(--gradient-primary)] flex items-center justify-center shadow-[var(--shadow-glow)]">
                      <Bot className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm flex items-center gap-2">
                        {a.name}
                        {a.status === "beta" && <span className="text-[10px] uppercase rounded bg-warning/30 px-1.5 py-0.5 text-warning-foreground">beta</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">{a.role}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{a.accuracy}%</div>
                    <div className="text-[11px] text-muted-foreground">{a.calls.toLocaleString("pt-BR")} ligações</div>
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
          <CardDescription>Auditorias mais recentes processadas pelos agentes de IA</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
                <th className="py-3 px-2">Protocolo</th>
                <th className="py-3 px-2">Atendente</th>
                <th className="py-3 px-2">Cliente</th>
                <th className="py-3 px-2">Tema</th>
                <th className="py-3 px-2">Duração</th>
                <th className="py-3 px-2">Compliance</th>
                <th className="py-3 px-2">Qualidade</th>
                <th className="py-3 px-2">Agente IA</th>
                <th className="py-3 px-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((c) => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-secondary/40 transition-colors">
                  <td className="py-3 px-2 font-mono text-xs text-primary">{c.protocol}</td>
                  <td className="py-3 px-2 font-medium">{c.agent}</td>
                  <td className="py-3 px-2 text-muted-foreground">{c.customer}</td>
                  <td className="py-3 px-2">{c.topic}</td>
                  <td className="py-3 px-2 font-mono text-xs">{c.duration}</td>
                  <td className="py-3 px-2 font-semibold">{c.status === "processing" ? "—" : `${c.scoreCompliance}%`}</td>
                  <td className="py-3 px-2 font-semibold">{c.status === "processing" ? "—" : `${c.scoreQuality}%`}</td>
                  <td className="py-3 px-2 text-xs text-muted-foreground">{c.aiAgent}</td>
                  <td className="py-3 px-2"><StatusBadge status={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
