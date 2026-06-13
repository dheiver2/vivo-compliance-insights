import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { getForm, saveForm, resetForm } from "@/lib/api/monitoring.functions";
import { reprocessCalls } from "@/lib/api/analyze.functions";
import type { MonitoringCriterion } from "@/lib/server/monitoring-form.server";
import {
  Loader2,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Save,
  ShieldAlert,
  Info,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

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

// Editor dos critérios do scorecard (Ficha de Monitoria). É a MESMA fonte de
// dados que alimenta o prompt da Mangaba AI e as médias do dashboard — por isso
// fica num componente único, reutilizado pela rota /scorecards.
export function ScorecardManager() {
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
      // O scorecard afeta dashboard e perfis: invalida tudo que depende dele.
      await qc.invalidateQueries();
      toast.success("Scorecard salvo. Novas análises usarão estes critérios.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar o scorecard."),
  });

  const reset = useMutation({
    mutationFn: () => resetForm(),
    onSuccess: async (def) => {
      qc.setQueryData(["monitoring-form"], def);
      setDraft(def);
      setResetOpen(false);
      await qc.invalidateQueries();
      toast.success("Scorecard restaurado para o padrão regulatório.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao restaurar o scorecard."),
  });

  const reprocess = useMutation({
    mutationFn: () => reprocessCalls(),
    onSuccess: async (r) => {
      await qc.invalidateQueries();
      toast.success(
        `Reprocessamento concluído: ${r.updated} de ${r.total} ligações re-auditadas com a norma vigente.`,
      );
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Falha ao reprocessar as ligações."),
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
                valem para novas análises — use “Reprocessar ligações” para reavaliar as já
                auditadas com a norma vigente.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => reprocess.mutate()}
              disabled={reprocess.isPending}
              title="Re-audita as ligações já armazenadas usando os critérios atuais"
            >
              {reprocess.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Reprocessar ligações
            </Button>
            <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <RotateCcw className="h-4 w-4 mr-2" /> Restaurar padrão
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Restaurar o scorecard padrão?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Os critérios atuais serão substituídos pela norma de monitoria de vendas Vivo
                    Empresas (10 itens). Esta ação não pode ser desfeita.
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
