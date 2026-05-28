import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { complianceItems, calls } from "@/lib/mock-data";
import { StatusBadge } from "@/components/StatusBadge";
import { FileCheck, User } from "lucide-react";

export const Route = createFileRoute("/monitoring")({
  head: () => ({ meta: [{ title: "Ficha de Monitoria · VoiceAudit" }, { name: "description", content: "Ficha detalhada de monitoria de compliance e qualidade." }] }),
  component: MonitoringPage,
});

function MonitoringPage() {
  const call = calls[1];
  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <header>
        <h1 className="text-3xl font-display font-bold flex items-center gap-3">
          <FileCheck className="h-7 w-7 text-primary" />
          Ficha de Monitoria
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Resultado detalhado da auditoria automatizada da ligação</p>
      </header>

      <Card>
        <CardHeader className="border-b border-border/60 bg-secondary/40">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-[image:var(--gradient-primary)] flex items-center justify-center text-primary-foreground">
                <User className="h-6 w-6" />
              </div>
              <div>
                <CardTitle>{call.agent}</CardTitle>
                <CardDescription>
                  Protocolo <span className="font-mono text-primary">{call.protocol}</span> · {call.topic} · {call.duration}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-[10px] uppercase text-muted-foreground">Compliance</div>
                <div className="text-3xl font-display font-bold text-warning-foreground">{call.scoreCompliance}%</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] uppercase text-muted-foreground">Qualidade</div>
                <div className="text-3xl font-display font-bold text-warning-foreground">{call.scoreQuality}%</div>
              </div>
              <StatusBadge status={call.status} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-5">
          {complianceItems.map((item) => (
            <div key={item.label}>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="font-medium">{item.label}</span>
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
          <CardTitle>Observações dos agentes de IA</CardTitle>
          <CardDescription>Trechos relevantes detectados na transcrição</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { agent: "Compliance-Bot v3", time: "00:14", note: "Atendente não informou claramente que a ligação estava sendo gravada." , severity: "warning" as const},
            { agent: "Quality-Bot v2", time: "03:22", note: "Cliente repetiu a mesma pergunta 2 vezes — possível falha de escuta ativa.", severity: "warning" as const },
            { agent: "Sentiment-Bot β", time: "07:48", note: "Pico de frustração detectado no cliente — tom de voz elevado.", severity: "critical" as const },
            { agent: "Compliance-Bot v3", time: "11:02", note: "Protocolo de encerramento foi corretamente informado.", severity: "ok" as const },
          ].map((o, i) => (
            <div key={i} className={`flex gap-3 rounded-lg border p-3 ${
              o.severity === "critical" ? "border-destructive/30 bg-destructive/5" :
              o.severity === "warning" ? "border-warning/40 bg-warning/5" :
              "border-success/30 bg-success/5"
            }`}>
              <div className="font-mono text-xs text-muted-foreground pt-0.5 min-w-12">{o.time}</div>
              <div className="flex-1">
                <div className="text-xs font-semibold text-primary">{o.agent}</div>
                <div className="text-sm mt-0.5">{o.note}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
