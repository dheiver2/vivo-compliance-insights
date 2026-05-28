import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { aiAgents } from "@/lib/mock-data";
import { Bot, CheckCircle2, Activity } from "lucide-react";

export const Route = createFileRoute("/agents")({
  head: () => ({ meta: [{ title: "Agentes IA · VoiceAudit" }, { name: "description", content: "Agentes de IA de compliance e qualidade." }] }),
  component: AgentsPage,
});

const scripts: Record<string, string[]> = {
  "Compliance-Bot v3": ["Identificação completa do atendente", "Aviso de gravação", "Confirmação de CPF/protocolo", "Comunicação clara de prazos contratuais", "LGPD — consentimento de dados"],
  "Quality-Bot v2": ["Tom de voz e cordialidade", "Tempo de silêncio", "Repetição de perguntas", "Empatia e escuta ativa", "Resolução no primeiro contato"],
  "Sales-Bot v1": ["Identificação da oportunidade", "Apresentação clara da oferta", "Tratamento de objeções", "Confirmação da venda"],
  "Sentiment-Bot β": ["Análise emocional do cliente", "Detecção de frustração", "Picos de estresse vocal", "Tendência de satisfação"],
};

function AgentsPage() {
  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <header>
        <h1 className="text-3xl font-display font-bold">Agentes de IA</h1>
        <p className="text-sm text-muted-foreground mt-1">Scripts de compliance e auditoria executados em paralelo nas ligações</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {aiAgents.map((a) => (
          <Card key={a.name} className="overflow-hidden border-border/60">
            <div className="h-1 bg-[image:var(--gradient-primary)]" />
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-[image:var(--gradient-primary)] flex items-center justify-center shadow-[var(--shadow-glow)]">
                  <Bot className="h-6 w-6 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2">
                    {a.name}
                    {a.status === "active" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase rounded bg-success/15 text-success px-1.5 py-0.5 border border-success/30">
                        <Activity className="h-2.5 w-2.5" /> ativo
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase rounded bg-warning/30 text-warning-foreground px-1.5 py-0.5">beta</span>
                    )}
                  </CardTitle>
                  <CardDescription>{a.role}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 mb-4 pb-4 border-b border-border/60">
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground">Ligações processadas</div>
                  <div className="text-2xl font-display font-bold">{a.calls.toLocaleString("pt-BR")}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground">Acurácia</div>
                  <div className="text-2xl font-display font-bold text-primary">{a.accuracy}%</div>
                </div>
              </div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Script de auditoria</div>
              <ul className="space-y-1.5">
                {(scripts[a.name] ?? []).map((s) => (
                  <li key={s} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
