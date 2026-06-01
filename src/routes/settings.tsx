import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { getSystemStatus, clearCalls, type SystemStatus } from "@/lib/api/calls.functions";
import { ingestThreeCplusBatch } from "@/lib/api/analyze.functions";
import { mangabaModelName } from "@/lib/mangaba";
import {
  Settings,
  CheckCircle2,
  XCircle,
  Cpu,
  AudioLines,
  Database,
  Trash2,
  Loader2,
  PhoneCall,
  KeyRound,
  Download,
  Bot,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Configurações · VoiceAudit" }] }),
  component: SettingsPage,
});

function StatusRow({
  icon: Icon,
  label,
  value,
  ok,
}: {
  icon: typeof Cpu;
  label: string;
  value: string;
  ok?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border/60 last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm text-muted-foreground font-mono truncate">{value}</span>
        {ok !== undefined &&
          (ok ? (
            <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
          ))}
      </div>
    </div>
  );
}

// Ingestão real em lote da 3C Plus: lista uma janela de datas e audita as
// gravações reais para o store — fonte de dados de entrada do dashboard.
function ThreeCplusIngestCard() {
  const qc = useQueryClient();
  const [apiToken, setApiToken] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [limit, setLimit] = useState("8");

  const ingest = useMutation({
    mutationFn: () =>
      ingestThreeCplusBatch({
        data: {
          startDate: startDate.trim(),
          endDate: endDate.trim(),
          limit: Math.max(1, Math.min(25, Number(limit) || 8)),
          apiToken: apiToken.trim(),
        },
      }),
    onSuccess: async (res) => {
      await qc.invalidateQueries();
      if (res.ingested > 0) {
        toast.success(
          `${res.ingested} ligação(ões) real(is) da 3C Plus auditada(s) e adicionada(s).` +
            (res.skipped > 0 ? ` ${res.skipped} ignorada(s).` : ""),
        );
      } else if (res.recordedFound === 0) {
        toast.warning("Nenhuma ligação com gravação encontrada nesse período.");
      } else {
        toast.error("Nenhuma ligação pôde ser auditada (veja os erros retornados).");
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha na ingestão da 3C Plus."),
  });

  const canIngest =
    startDate.trim().length > 0 && endDate.trim().length > 0 && !ingest.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PhoneCall className="h-4 w-4 text-primary" /> Ingestão 3C Plus (dados reais)
        </CardTitle>
        <CardDescription>
          Alimenta o painel com ligações reais do discador 3C Plus. O servidor baixa cada gravação,
          transcreve com o Mangaba Voz, mascara PII (LGPD) e roda a auditoria. Processa em série
          (respeita o limite de download da 3C Plus), então pode levar alguns segundos por ligação.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="space-y-1.5">
          <Label htmlFor="ing-token" className="flex items-center gap-1.5 text-xs">
            <KeyRound className="h-3.5 w-3.5 text-muted-foreground" /> API token{" "}
            <span className="text-muted-foreground font-normal">
              (opcional se THREECPLUS_API_TOKEN estiver no servidor)
            </span>
          </Label>
          <Input
            id="ing-token"
            type="password"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            placeholder="api_token da 3C Plus"
            disabled={ingest.isPending}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ing-start" className="text-xs">
              Data inicial
            </Label>
            <Input
              id="ing-start"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="2026-05-01 00:00:00"
              disabled={ingest.isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ing-end" className="text-xs">
              Data final
            </Label>
            <Input
              id="ing-end"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="2026-05-31 23:59:59"
              disabled={ingest.isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ing-limit" className="text-xs">
              Máx. ligações
            </Label>
            <Input
              id="ing-limit"
              type="number"
              min={1}
              max={25}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              disabled={ingest.isPending}
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            Adiciona as ligações ao acervo existente (não sobrescreve).
          </p>
          <Button onClick={() => ingest.mutate()} disabled={!canIngest}>
            {ingest.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando…
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" /> Importar ligações reais
              </>
            )}
          </Button>
        </div>
        {ingest.data && ingest.data.errors.length > 0 && (
          <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs space-y-1 max-h-40 overflow-auto">
            <p className="font-medium text-muted-foreground">
              {ingest.data.errors.length} ligação(ões) não auditada(s):
            </p>
            {ingest.data.errors.map((er) => (
              <p key={er.callId} className="text-muted-foreground">
                <span className="font-mono">{er.callId}</span>: {er.message}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SettingsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery<SystemStatus>({
    queryKey: ["system-status"],
    queryFn: () => getSystemStatus(),
  });

  const clear = useMutation({
    mutationFn: () => clearCalls(),
    onSuccess: async () => {
      setOpen(false);
      await qc.invalidateQueries();
      toast.success("Todas as análises foram removidas.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao limpar dados."),
  });

  return (
    <div className="space-y-6 max-w-[900px] mx-auto">
      <header>
        <h1 className="text-3xl font-display font-bold flex items-center gap-3">
          <Settings className="h-7 w-7 text-primary" />
          Configurações
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Status do sistema e gerenciamento de dados
        </p>
      </header>

      {isLoading && (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {data && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Motor Mangaba AI</CardTitle>
              <CardDescription>Modelos Mangaba usados na auditoria e transcrição</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <StatusRow
                icon={CheckCircle2}
                label="Conexão Mangaba AI"
                value={data.hfConfigured ? "ativa" : "indisponível — usando Mangaba Básico"}
                ok={data.hfConfigured}
              />
              <StatusRow
                icon={Cpu}
                label="Modelo de análise (compliance)"
                value={mangabaModelName(data.llmModel)}
              />
              <StatusRow
                icon={AudioLines}
                label="Modelo de transcrição (voz)"
                value={mangabaModelName(data.asrModel)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ferramentas</CardTitle>
              <CardDescription>Detalhes dos modelos Mangaba</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 pt-0">
              <Link
                to="/agents"
                className="flex items-center gap-3 rounded-lg border border-border/60 p-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
              >
                <Bot className="h-5 w-5 text-primary flex-shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">Agentes IA</span>
                  <span className="block text-xs text-muted-foreground">
                    Modelos Mangaba do pipeline de auditoria
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </Link>
            </CardContent>
          </Card>

          <ThreeCplusIngestCard />

          <Card>
            <CardHeader>
              <CardTitle>Dados</CardTitle>
              <CardDescription>Análises armazenadas no servidor</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <StatusRow
                icon={Database}
                label="Total de análises"
                value={String(data.totalCalls)}
              />
              <div className="flex items-center justify-between gap-4 pt-4">
                <p className="text-sm text-muted-foreground">
                  Remove permanentemente todas as ligações auditadas.
                </p>
                <AlertDialog open={open} onOpenChange={setOpen}>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={data.totalCalls === 0}>
                      <Trash2 className="h-4 w-4 mr-2" /> Limpar dados
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Limpar todas as análises?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação remove as {data.totalCalls} análise(s) armazenadas e não pode ser
                        desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={(e) => {
                          e.preventDefault();
                          clear.mutate();
                        }}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {clear.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Sim, limpar tudo"
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
