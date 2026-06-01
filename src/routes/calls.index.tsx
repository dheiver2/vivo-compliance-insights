import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { listCalls } from "@/lib/api/calls.functions";
import type { StoredCall } from "@/lib/server/calls-store.server";
import { RefreshButton } from "@/components/RefreshButton";
import { mangabaSourceShort } from "@/lib/mangaba";
import { AudioLines, FileText, Loader2, Phone, Search, Sparkles, X } from "lucide-react";

export const Route = createFileRoute("/calls/")({
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Ligações · VoiceAudit" },
      { name: "description", content: "Todas as ligações auditadas." },
    ],
  }),
  component: CallsPage,
});

function scoreCls(s: number) {
  return s >= 75 ? "text-success" : s >= 50 ? "text-warning-foreground" : "text-destructive";
}

function matches(c: StoredCall, q: string): boolean {
  const t = q.toLowerCase();
  return (
    c.label.toLowerCase().includes(t) ||
    c.protocol.toLowerCase().includes(t) ||
    c.agentName.toLowerCase().includes(t) ||
    c.topic.toLowerCase().includes(t) ||
    c.summary.toLowerCase().includes(t) ||
    c.transcript.toLowerCase().includes(t)
  );
}

function CallsPage() {
  const { q } = Route.useSearch();
  const { data, isLoading, isFetching, refetch, dataUpdatedAt } = useQuery<StoredCall[]>({
    queryKey: ["calls"],
    queryFn: () => listCalls(),
    refetchOnWindowFocus: true,
  });

  const filtered = q && data ? data.filter((c) => matches(c, q)) : data;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Ligações auditadas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Todas as análises processadas pelos agentes de IA
          </p>
        </div>
        <RefreshButton onClick={() => refetch()} busy={isFetching} updatedAt={dataUpdatedAt} />
      </header>

      {q && (
        <div className="flex items-center gap-2 text-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            {filtered?.length ?? 0} resultado(s) para{" "}
            <span className="font-medium text-foreground">"{q}"</span>
          </span>
          <Link
            to="/calls"
            search={{ q: undefined }}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs hover:bg-muted"
          >
            <X className="h-3 w-3" /> limpar
          </Link>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {data && data.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center text-center py-24 text-muted-foreground">
            <Sparkles className="h-12 w-12 mb-4 opacity-40" />
            <p className="text-base font-medium text-foreground">Nenhuma ligação auditada ainda</p>
            <p className="text-sm mt-1">
              Importe as gravações reais do discador 3C Plus em Configurações.
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
      )}

      {data && data.length > 0 && filtered && filtered.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center text-center py-16 text-muted-foreground">
            <Search className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-base font-medium text-foreground">
              Nenhuma ligação corresponde à busca
            </p>
            <Link
              to="/calls"
              search={{ q: undefined }}
              className="mt-4 text-sm text-primary hover:underline"
            >
              Limpar busca
            </Link>
          </CardContent>
        </Card>
      )}

      {filtered && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <Link
              key={c.id}
              to="/calls/$callId"
              params={{ callId: c.id }}
              className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
            >
              <Card className="h-full hover:shadow-[var(--shadow-elegant)] hover:border-primary/40 transition-all cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="text-base flex items-center gap-2 truncate">
                        {c.origin === "audio" ? (
                          <AudioLines className="h-4 w-4 text-primary flex-shrink-0" />
                        ) : (
                          <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                        )}
                        <span className="truncate">{c.label}</span>
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {c.agentName} · {c.topic} · {new Date(c.createdAt).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
                    {c.summary}
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-lg border border-border/60 p-2">
                      <div className="text-[10px] uppercase text-muted-foreground">Compliance</div>
                      <div className={`text-lg font-bold ${scoreCls(c.scoreCompliance)}`}>
                        {c.scoreCompliance}%
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/60 p-2">
                      <div className="text-[10px] uppercase text-muted-foreground">Qualidade</div>
                      <div className={`text-lg font-bold ${scoreCls(c.scoreQuality)}`}>
                        {c.scoreQuality}%
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between text-xs text-muted-foreground pt-1">
                    <span className="font-mono text-primary">{c.protocol}</span>
                    <span>{mangabaSourceShort(c.source, c.model)}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
