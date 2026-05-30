import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
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
import { CallFicha } from "@/components/CallFicha";
import { listCalls } from "@/lib/api/calls.functions";
import { getForm, saveForm, resetForm } from "@/lib/api/monitoring.functions";
import type { StoredCall } from "@/lib/server/calls-store.server";
import type { MonitoringCriterion } from "@/lib/server/monitoring-form.server";
import {
  FileCheck,
  Loader2,
  Sparkles,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Save,
  ShieldAlert,
  ListChecks,
  Info,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/monitoring")({
  head: () => ({
    meta: [
      { title: "Ficha de Monitoria · VoiceAudit" },
      {
        name: "description",
        content: "Gestão e revisão das fichas de monitoria de compliance e qualidade.",
      },
    ],
  }),
  component: MonitoringPage,
});

let tmpSeq = 0;
function newCriterion(): MonitoringCriterion {
  tmpSeq += 1;
  return {
    id: `tmp_${tmpSeq}`,
    label: "",
    description: "",
    category: "Geral",
    weight: 3,
    critical: false,
    enabled: true,
  };
}

function MonitoringPage() {
  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <header>
        <h1 className="text-3xl font-display font-bold flex items-center gap-3">
          <FileCheck className="h-7 w-7 text-primary" />
          Ficha de Monitoria
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie os critérios que os agentes Mangaba usam para avaliar cada ligação e revise as
          fichas geradas.
        </p>
      </header>

      <Tabs defaultValue="gestao" className="space-y-6">
        <TabsList>
          <TabsTrigger value="gestao" className="gap-2">
            <ListChecks className="h-4 w-4" /> Gestão da ficha
          </TabsTrigger>
          <TabsTrigger value="fichas" className="gap-2">
            <FileCheck className="h-4 w-4" /> Fichas das ligações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gestao">
          <FormManager />
        </TabsContent>

        <TabsContent value="fichas">
          <CallFichaViewer />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aba: gestão da ficha (CRUD dos critérios)
// ---------------------------------------------------------------------------
function FormManager() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<MonitoringCriterion[]>({
    queryKey: ["monitoring-form"],
    queryFn: () => getForm(),
  });

  const [draft, setDraft] = useState<MonitoringCriterion[]>([]);
  const [resetOpen, setResetOpen] = useState(false);

  // Sincroniza o rascunho local quando a ficha do servidor chega.
  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  const dirty = useMemo(
    () => Boolean(data) && JSON.stringify(draft) !== JSON.stringify(data),
    [draft, data],
  );

  const save = useMutation({
    mutationFn: () => saveForm({ data: { criteria: draft } }),
    onSuccess: async (saved) => {
      qc.setQueryData(["monitoring-form"], saved);
      setDraft(saved);
      // A ficha afeta dashboard e perfis: invalida tudo que depende dela.
      await qc.invalidateQueries();
      toast.success("Ficha de monitoria salva. Novas análises usarão estes critérios.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar a ficha."),
  });

  const reset = useMutation({
    mutationFn: () => resetForm(),
    onSuccess: async (def) => {
      qc.setQueryData(["monitoring-form"], def);
      setDraft(def);
      setResetOpen(false);
      await qc.invalidateQueries();
      toast.success("Ficha restaurada para o padrão regulatório.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao restaurar a ficha."),
  });

  function update(id: string, patch: Partial<MonitoringCriterion>) {
    setDraft((d) => d.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  function remove(id: string) {
    setDraft((d) => d.filter((c) => c.id !== id));
  }
  function move(id: string, dir: -1 | 1) {
    setDraft((d) => {
      const i = d.findIndex((c) => c.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= d.length) return d;
      const next = d.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function add() {
    setDraft((d) => [...d, newCriterion()]);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const enabledCount = draft.filter((c) => c.enabled).length;
  const criticalCount = draft.filter((c) => c.enabled && c.critical).length;

  return (
    <div className="space-y-4">
      {/* Barra de ações + resumo */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-foreground">
                {draft.length} critérios · {enabledCount} ativos · {criticalCount} críticos
              </p>
              <p className="text-muted-foreground">
                Estes critérios alimentam o prompt da Mangaba AI e as médias do dashboard. Mudanças
                valem para novas análises.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <RotateCcw className="h-4 w-4 mr-2" /> Restaurar padrão
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Restaurar a ficha padrão?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Os critérios atuais serão substituídos pela ficha regulatória padrão (8 itens).
                    Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault();
                      reset.mutate();
                    }}
                  >
                    {reset.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Sim, restaurar"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button size="sm" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
              {save.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {dirty ? "Salvar alterações" : "Tudo salvo"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de critérios */}
      {draft.map((c, idx) => (
        <Card key={c.id} className={c.enabled ? "" : "opacity-60"}>
          <CardContent className="py-4 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex flex-col gap-1 pt-1">
                <button
                  type="button"
                  onClick={() => move(c.id, -1)}
                  disabled={idx === 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  aria-label="Mover para cima"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(c.id, 1)}
                  disabled={idx === draft.length - 1}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  aria-label="Mover para baixo"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 space-y-3 min-w-0">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[220px]">
                    <Label htmlFor={`label-${c.id}`} className="text-xs">
                      Critério
                    </Label>
                    <Input
                      id={`label-${c.id}`}
                      value={c.label}
                      placeholder="Ex.: Identificação do atendente"
                      onChange={(e) => update(c.id, { label: e.target.value })}
                    />
                  </div>
                  <div className="w-40">
                    <Label htmlFor={`cat-${c.id}`} className="text-xs">
                      Categoria
                    </Label>
                    <Input
                      id={`cat-${c.id}`}
                      value={c.category}
                      placeholder="Geral"
                      onChange={(e) => update(c.id, { category: e.target.value })}
                    />
                  </div>
                  <div className="w-28">
                    <Label className="text-xs">Peso</Label>
                    <Select
                      value={String(c.weight)}
                      onValueChange={(v) => update(c.id, { weight: Number(v) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map((w) => (
                          <SelectItem key={w} value={String(w)}>
                            {w}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor={`desc-${c.id}`} className="text-xs">
                    O que avaliar (orienta a IA)
                  </Label>
                  <Textarea
                    id={`desc-${c.id}`}
                    value={c.description}
                    rows={2}
                    placeholder="Descreva o que o agente deve verificar neste item."
                    onChange={(e) => update(c.id, { description: e.target.value })}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-6">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Switch
                      checked={c.enabled}
                      onCheckedChange={(v) => update(c.id, { enabled: v })}
                    />
                    Ativo na avaliação
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Switch
                      checked={c.critical}
                      onCheckedChange={(v) => update(c.id, { critical: v })}
                    />
                    <span className="flex items-center gap-1">
                      <ShieldAlert
                        className={`h-4 w-4 ${c.critical ? "text-destructive" : "text-muted-foreground"}`}
                      />
                      Item crítico
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => remove(c.id)}
                    className="ml-auto inline-flex items-center gap-1 text-sm text-destructive hover:underline"
                  >
                    <Trash2 className="h-4 w-4" /> Remover
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {draft.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            Nenhum critério. Adicione ao menos um para que os agentes possam avaliar as ligações.
          </CardContent>
        </Card>
      )}

      <Button variant="outline" className="w-full border-dashed" onClick={add}>
        <Plus className="h-4 w-4 mr-2" /> Adicionar critério
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aba: revisão das fichas geradas por ligação
// ---------------------------------------------------------------------------
function CallFichaViewer() {
  const { data, isLoading } = useQuery<StoredCall[]>({
    queryKey: ["calls"],
    queryFn: () => listCalls(),
    refetchOnWindowFocus: true,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const calls = data ?? [];
  const selected = calls.find((c) => c.id === selectedId) ?? calls[0];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!calls.length) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center text-center py-24 text-muted-foreground">
          <Sparkles className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-base font-medium text-foreground">Nenhuma análise para exibir</p>
          <p className="text-sm mt-1">
            Importe ligações reais da 3C Plus em Configurações para gerar as fichas.
          </p>
          <Link
            to="/settings"
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <FileCheck className="h-4 w-4" /> Importar ligações da 3C Plus
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Label className="text-sm text-muted-foreground">Ligação:</Label>
        <Select value={selected?.id} onValueChange={setSelectedId}>
          <SelectTrigger className="w-[420px] max-w-full">
            <SelectValue placeholder="Selecione uma ligação" />
          </SelectTrigger>
          <SelectContent>
            {calls.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.id} · {c.agentName} · {c.topic}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selected && <CallFicha call={selected} />}
    </div>
  );
}
