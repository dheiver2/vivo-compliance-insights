import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getDashboard } from "@/lib/api/calls.functions";
import type { DashboardData } from "@/lib/server/calls-store.server";
import { mangabaModelName } from "@/lib/mangaba";
import { Bot, CheckCircle2, Activity, Loader2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/agents")({
  head: () => ({ meta: [{ title: "Agentes IA · VoiceAudit" }, { name: "description", content: "Agentes de IA de compliance e qualidade." }] }),
  component: AgentsPage,
});

// Capacidades de cada componente do pipeline (descrição estática do que a IA faz).
const capabilities: Record<string, string[]> = {
  llm: ["Identificação do atendente", "Aviso de gravação e consentimento LGPD", "Confirmação de dados cadastrais", "Comunicação de prazos e custos", "Resumo, protocolo e encerramento", "Score de qualidade e sentimento"],
  asr: ["Transcrição automática de áudio", "Suporte a múltiplos formatos (mp3, wav, m4a, ogg…)", "Processamento em lote", "Motor Mangaba Voz"],
  heuristic: ["Análise por palavras-chave", "Funciona offline (sem conexão)", "Fallback quando o Mangaba AI está indisponível", "Detecção básica de sentimento"],
};

function capsFor(name: string, role: string): string[] {
  if (/whisper|asr|transcri/i.test(name + role)) return capabilities.asr;
  if (/heur/i.test(name + role)) return capabilities.heuristic;
  return capabilities.llm;
}

function AgentsPage() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: () => getDashboard(),
    refetchOnWindowFocus: true,
  });

  const agents = data?.modelUsage ?? [];

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <header>
        <h1 className="text-3xl font-display font-bold">Agentes de IA</h1>
        <p className="text-sm text-muted-foreground mt-1">Componentes do pipeline que processam as ligações — uso real</p>
      </header>

      {isLoading && (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {data && agents.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center text-center py-24 text-muted-foreground">
            <Bot className="h-12 w-12 mb-4 opacity-40" />
            <p className="text-base font-medium text-foreground">Nenhum agente acionado ainda</p>
            <p className="text-sm mt-1">Os componentes aparecem após a primeira análise.</p>
            <Link to="/analyze" className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <Sparkles className="h-4 w-4" /> Ir para Análise IA
            </Link>
          </CardContent>
        </Card>
      )}

      {agents.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {agents.map((a) => (
            <Card key={a.name} className="overflow-hidden border-border/60">
              <div className="h-1 bg-[image:var(--gradient-primary)]" />
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-[image:var(--gradient-primary)] flex items-center justify-center shadow-[var(--shadow-glow)]">
                    <Bot className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {mangabaModelName(a.name)}
                      {a.status === "active" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase rounded bg-success/15 text-success px-1.5 py-0.5 border border-success/30">
                          <Activity className="h-2.5 w-2.5" /> ativo
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase rounded bg-warning/30 text-warning-foreground px-1.5 py-0.5">fallback</span>
                      )}
                    </CardTitle>
                    <CardDescription>{a.role}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4 pb-4 border-b border-border/60">
                  <div className="text-[10px] uppercase text-muted-foreground">Análises processadas</div>
                  <div className="text-2xl font-display font-bold">{a.calls.toLocaleString("pt-BR")}</div>
                </div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Capacidades</div>
                <ul className="space-y-1.5">
                  {capsFor(a.name, a.role).map((s) => (
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
      )}
    </div>
  );
}
