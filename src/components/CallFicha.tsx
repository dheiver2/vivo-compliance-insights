import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";
import type { StoredCall } from "@/lib/server/calls-store.server";
import { Link } from "@tanstack/react-router";
import { AudioLines, FileText, User } from "lucide-react";

function scoreCls(s: number) {
  return s >= 85 ? "text-success" : s >= 70 ? "text-warning-foreground" : "text-destructive";
}

// Ficha de monitoria completa de uma ligação — reutilizada na rota /monitoring
// (análise mais recente) e em /calls/$callId (detalhe de uma ligação).
export function CallFicha({ call }: { call: StoredCall }) {
  return (
    <>
      <Card>
        <CardHeader className="border-b border-border/60 bg-secondary/40">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-12 w-12 rounded-full bg-[image:var(--gradient-primary)] flex items-center justify-center text-primary-foreground flex-shrink-0">
                {call.origin === "audio" ? <AudioLines className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
              </div>
              <div className="min-w-0">
                <CardTitle className="truncate">{call.label}</CardTitle>
                <CardDescription>
                  Protocolo <span className="font-mono text-primary">{call.protocol}</span> · {call.topic} · {new Date(call.createdAt).toLocaleString("pt-BR")}
                </CardDescription>
                <div className="mt-1.5 flex items-center gap-1.5 text-sm">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Atendente:</span>
                  <Link to="/team/$agentName" params={{ agentName: call.agentName }} className="font-medium text-primary hover:underline">
                    {call.agentName}
                  </Link>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-[10px] uppercase text-muted-foreground">Compliance</div>
                <div className={`text-3xl font-display font-bold ${scoreCls(call.scoreCompliance)}`}>{call.scoreCompliance}%</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] uppercase text-muted-foreground">Qualidade</div>
                <div className={`text-3xl font-display font-bold ${scoreCls(call.scoreQuality)}`}>{call.scoreQuality}%</div>
              </div>
              <StatusBadge status={call.status} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-5">
          <p className="text-sm text-muted-foreground bg-secondary/40 rounded-lg p-3 border border-border/60">{call.summary}</p>
          {call.checks.map((item) => (
            <div key={item.label}>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="font-medium">{item.label}</span>
                <span className={`font-semibold ${scoreCls(item.score)}`}>{item.score}%</span>
              </div>
              <Progress value={item.score} className="h-2" />
              {item.evidence && <p className="text-xs text-muted-foreground mt-1">{item.evidence}</p>}
            </div>
          ))}
        </CardContent>
      </Card>

      {call.observations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Observações dos agentes de IA</CardTitle>
            <CardDescription>Trechos relevantes detectados na transcrição</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {call.observations.map((o, i) => (
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
      )}

      <Card>
        <CardHeader>
          <CardTitle>Resumo da auditoria</CardTitle>
          <CardDescription>
            Resumo do caso e a resposta de cada item do script de monitoria. Por
            privacidade (LGPD), a transcrição completa não é armazenada.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="text-sm whitespace-pre-wrap font-sans text-foreground/90 bg-secondary/40 rounded-lg p-4 border border-border/60 max-h-[400px] overflow-y-auto">{call.transcript}</pre>
        </CardContent>
      </Card>
    </>
  );
}
