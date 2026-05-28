import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { calls } from "@/lib/mock-data";
import { Play } from "lucide-react";

export const Route = createFileRoute("/calls")({
  head: () => ({ meta: [{ title: "Ligações · VoiceAudit" }, { name: "description", content: "Todas as ligações auditadas." }] }),
  component: CallsPage,
});

function CallsPage() {
  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <header>
        <h1 className="text-3xl font-display font-bold">Ligações auditadas</h1>
        <p className="text-sm text-muted-foreground mt-1">Todas as gravações processadas pelos agentes de IA</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {calls.map((c) => (
          <Card key={c.id} className="hover:shadow-[var(--shadow-elegant)] transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{c.agent}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">{c.customer} · {c.topic}</p>
                </div>
                <StatusBadge status={c.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg bg-secondary/60 p-3">
                <button className="h-9 w-9 rounded-full bg-[image:var(--gradient-primary)] flex items-center justify-center text-primary-foreground shadow-[var(--shadow-glow)]">
                  <Play className="h-4 w-4 ml-0.5" />
                </button>
                <div className="flex-1">
                  <div className="h-1.5 bg-border rounded-full overflow-hidden">
                    <div className="h-full w-1/3 bg-[image:var(--gradient-primary)] rounded-full" />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1 font-mono">
                    <span>02:48</span><span>{c.duration}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-lg border border-border/60 p-2">
                  <div className="text-[10px] uppercase text-muted-foreground">Compliance</div>
                  <div className={`text-lg font-bold ${c.scoreCompliance >= 85 ? "text-success" : c.scoreCompliance >= 70 ? "text-warning-foreground" : "text-destructive"}`}>
                    {c.status === "processing" ? "—" : `${c.scoreCompliance}%`}
                  </div>
                </div>
                <div className="rounded-lg border border-border/60 p-2">
                  <div className="text-[10px] uppercase text-muted-foreground">Qualidade</div>
                  <div className={`text-lg font-bold ${c.scoreQuality >= 85 ? "text-success" : c.scoreQuality >= 70 ? "text-warning-foreground" : "text-destructive"}`}>
                    {c.status === "processing" ? "—" : `${c.scoreQuality}%`}
                  </div>
                </div>
              </div>

              <div className="flex justify-between text-xs text-muted-foreground pt-1">
                <span className="font-mono text-primary">{c.protocol}</span>
                <span>{c.aiAgent}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
