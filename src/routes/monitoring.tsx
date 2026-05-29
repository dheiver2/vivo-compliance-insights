import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { CallFicha } from "@/components/CallFicha";
import { listCalls } from "@/lib/api/calls.functions";
import type { StoredCall } from "@/lib/server/calls-store.server";
import { FileCheck, Loader2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/monitoring")({
  head: () => ({ meta: [{ title: "Ficha de Monitoria · VoiceAudit" }, { name: "description", content: "Ficha detalhada de monitoria de compliance e qualidade." }] }),
  component: MonitoringPage,
});

function MonitoringPage() {
  const { data, isLoading } = useQuery<StoredCall[]>({
    queryKey: ["calls"],
    queryFn: () => listCalls(),
    refetchOnWindowFocus: true,
  });

  const call = data?.[0];

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <header>
        <h1 className="text-3xl font-display font-bold flex items-center gap-3">
          <FileCheck className="h-7 w-7 text-primary" />
          Ficha de Monitoria
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Resultado detalhado da auditoria automatizada — análise mais recente</p>
      </header>

      {isLoading && (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {data && !call && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center text-center py-24 text-muted-foreground">
            <Sparkles className="h-12 w-12 mb-4 opacity-40" />
            <p className="text-base font-medium text-foreground">Nenhuma análise para exibir</p>
            <p className="text-sm mt-1">Faça uma análise para gerar a ficha de monitoria.</p>
            <Link to="/analyze" className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <Sparkles className="h-4 w-4" /> Ir para Análise IA
            </Link>
          </CardContent>
        </Card>
      )}

      {call && <CallFicha call={call} />}
    </div>
  );
}
