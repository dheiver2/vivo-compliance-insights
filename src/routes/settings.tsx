import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { getSystemStatus, clearCalls, type SystemStatus } from "@/lib/api/calls.functions";
import { mangabaModelName } from "@/lib/mangaba";
import { Settings, CheckCircle2, XCircle, Cpu, AudioLines, Database, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Configurações · VoiceAudit" }] }),
  component: SettingsPage,
});

function StatusRow({ icon: Icon, label, value, ok }: { icon: typeof Cpu; label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border/60 last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm text-muted-foreground font-mono truncate">{value}</span>
        {ok !== undefined && (ok ? <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" /> : <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />)}
      </div>
    </div>
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
        <p className="text-sm text-muted-foreground mt-1">Status do sistema e gerenciamento de dados</p>
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
              <StatusRow icon={CheckCircle2} label="Conexão Mangaba AI" value={data.hfConfigured ? "ativa" : "indisponível — usando Mangaba Básico"} ok={data.hfConfigured} />
              <StatusRow icon={Cpu} label="Modelo de análise (compliance)" value={mangabaModelName(data.llmModel)} />
              <StatusRow icon={AudioLines} label="Modelo de transcrição (voz)" value={mangabaModelName(data.asrModel)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dados</CardTitle>
              <CardDescription>Análises armazenadas no servidor</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <StatusRow icon={Database} label="Total de análises" value={String(data.totalCalls)} />
              <div className="flex items-center justify-between gap-4 pt-4">
                <p className="text-sm text-muted-foreground">Remove permanentemente todas as ligações auditadas.</p>
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
                        Esta ação remove as {data.totalCalls} análise(s) armazenadas e não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={(e) => { e.preventDefault(); clear.mutate(); }}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {clear.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sim, limpar tudo"}
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
