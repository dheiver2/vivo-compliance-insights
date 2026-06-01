import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { signAudit, openContestation, resolveContestation } from "@/lib/api/review.functions";
import type { StoredCall } from "@/lib/server/calls-store.server";

// Rótulo de atendente não atribuído (espelha UNASSIGNED_AGENT do store, que é
// server-only e não pode ser importado como valor no cliente).
const UNASSIGNED_AGENT = "Não atribuído";
import {
  ShieldCheck,
  PenLine,
  MessageSquareWarning,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  X,
} from "lucide-react";
import { toast } from "sonner";

// Painel de REVISÃO da auditoria: assinatura (aceite) do atendente e contestação.
// A identidade do atendente usa o CPF como chave única (hasheado no servidor;
// aqui só trafega para validar/assinar — nunca é exibido nem armazenado em claro).
export function ReviewPanel({ call }: { call: StoredCall }) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries();

  // --- Assinatura -----------------------------------------------------------
  const [signing, setSigning] = useState(false);
  const [cpf, setCpf] = useState("");
  const [name, setName] = useState(call.agentName !== UNASSIGNED_AGENT ? call.agentName : "");

  const sign = useMutation({
    mutationFn: () =>
      signAudit({ data: { callId: call.id, cpf: cpf.trim(), name: name.trim(), by: "atendente" } }),
    onSuccess: async () => {
      await refresh();
      setSigning(false);
      setCpf("");
      toast.success("Auditoria assinada pelo atendente.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao assinar."),
  });

  // --- Contestação ----------------------------------------------------------
  const [contesting, setContesting] = useState(false);
  const [by, setBy] = useState<"atendente" | "supervisor">("atendente");
  const [reason, setReason] = useState("");
  const [criterion, setCriterion] = useState("__geral__");
  const [contestCpf, setContestCpf] = useState("");

  const open = useMutation({
    mutationFn: () =>
      openContestation({
        data: {
          callId: call.id,
          by,
          reason: reason.trim(),
          criterion: criterion === "__geral__" ? undefined : criterion,
          cpf: by === "atendente" ? contestCpf.trim() : undefined,
        },
      }),
    onSuccess: async () => {
      await refresh();
      setContesting(false);
      setReason("");
      setContestCpf("");
      toast.success("Contestação aberta.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao contestar."),
  });

  const [parecer, setParecer] = useState("");
  const resolve = useMutation({
    mutationFn: (decision: "aceita" | "rejeitada") =>
      resolveContestation({ data: { callId: call.id, decision, parecer: parecer.trim() } }),
    onSuccess: async () => {
      await refresh();
      setParecer("");
      toast.success("Contestação resolvida.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao resolver."),
  });

  const sig = call.signature;
  const ct = call.contestation;
  const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" /> Revisão da auditoria
        </CardTitle>
        <CardDescription>
          Assinatura do atendente e contestação. A identidade usa o CPF como chave única — exibido
          mascarado e nunca armazenado em claro (LGPD).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Assinatura */}
        <section className="space-y-2">
          <h4 className="text-sm font-semibold">Assinatura do atendente</h4>
          {sig ? (
            <div className="flex items-start gap-2 rounded-lg border border-success/40 bg-success/5 p-3 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
              <div>
                Assinada por <strong>{sig.agentName}</strong> ({sig.agentKeyMasked}) —{" "}
                {fmt(sig.signedAt)} · {sig.by}.
              </div>
            </div>
          ) : signing ? (
            <div className="space-y-3 rounded-lg border border-border/60 p-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="sig-name" className="text-xs">
                    Nome do atendente
                  </Label>
                  <Input id="sig-name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sig-cpf" className="text-xs">
                    CPF (chave única)
                  </Label>
                  <Input
                    id="sig-cpf"
                    inputMode="numeric"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    placeholder="000.000.000-00"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => sign.mutate()}
                  disabled={sign.isPending || !cpf.trim() || !name.trim()}
                >
                  {sign.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <PenLine className="mr-2 h-4 w-4" />
                  )}
                  Confirmar assinatura
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSigning(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setSigning(true)}>
              <PenLine className="mr-2 h-4 w-4" /> Assinar auditoria
            </Button>
          )}
        </section>

        {/* Contestação */}
        <section className="space-y-2">
          <h4 className="text-sm font-semibold">Contestação</h4>
          {ct ? (
            <div className="space-y-3 rounded-lg border border-border/60 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <ContestationBadge status={ct.status} />
                <span className="text-muted-foreground">
                  aberta por {ct.openedBy}
                  {ct.openedByMasked ? ` (${ct.openedByMasked})` : ""} em {fmt(ct.openedAt)}
                </span>
              </div>
              {ct.criterion && (
                <p className="text-xs text-muted-foreground">
                  Critério: <strong>{ct.criterion}</strong>
                </p>
              )}
              <p className="rounded-md bg-muted/40 p-2 text-foreground/90">{ct.reason}</p>

              {ct.status === "aberta" ? (
                <div className="space-y-2 border-t border-border/60 pt-3">
                  <Label htmlFor="parecer" className="text-xs">
                    Parecer do supervisor
                  </Label>
                  <Textarea
                    id="parecer"
                    rows={2}
                    value={parecer}
                    onChange={(e) => setParecer(e.target.value)}
                    placeholder="Justifique a decisão."
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => resolve.mutate("aceita")}
                      disabled={resolve.isPending || parecer.trim().length < 3}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" /> Aceitar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => resolve.mutate("rejeitada")}
                      disabled={resolve.isPending || parecer.trim().length < 3}
                    >
                      <XCircle className="mr-2 h-4 w-4" /> Rejeitar
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
                  Resolvida ({ct.status}) por {ct.resolvedBy} em {ct.resolvedAt ? fmt(ct.resolvedAt) : "—"}
                  {ct.resolution ? `: ${ct.resolution}` : ""}.
                </p>
              )}
            </div>
          ) : contesting ? (
            <div className="space-y-3 rounded-lg border border-border/60 p-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Quem está contestando</Label>
                  <Select value={by} onValueChange={(v) => setBy(v as "atendente" | "supervisor")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="atendente">Atendente</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Critério (opcional)</Label>
                  <Select value={criterion} onValueChange={setCriterion}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__geral__">Auditoria em geral</SelectItem>
                      {call.checks.map((c) => (
                        <SelectItem key={c.label} value={c.label}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {by === "atendente" && (
                <div className="space-y-1.5">
                  <Label htmlFor="ct-cpf" className="text-xs">
                    CPF do atendente (identifica quem contesta)
                  </Label>
                  <Input
                    id="ct-cpf"
                    inputMode="numeric"
                    value={contestCpf}
                    onChange={(e) => setContestCpf(e.target.value)}
                    placeholder="000.000.000-00"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="ct-reason" className="text-xs">
                  Motivo da contestação
                </Label>
                <Textarea
                  id="ct-reason"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explique a discordância."
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => open.mutate()}
                  disabled={
                    open.isPending ||
                    reason.trim().length < 3 ||
                    (by === "atendente" && contestCpf.trim().length === 0)
                  }
                >
                  {open.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <MessageSquareWarning className="mr-2 h-4 w-4" />
                  )}
                  Abrir contestação
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setContesting(false)}>
                  <X className="mr-2 h-4 w-4" /> Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setContesting(true)}>
              <MessageSquareWarning className="mr-2 h-4 w-4" /> Contestar auditoria
            </Button>
          )}
        </section>
      </CardContent>
    </Card>
  );
}

function ContestationBadge({ status }: { status: "aberta" | "aceita" | "rejeitada" }) {
  const map = {
    aberta: { label: "Aberta", cls: "bg-warning/20 text-warning-foreground border-warning/40", Icon: Clock },
    aceita: { label: "Aceita", cls: "bg-success/15 text-success border-success/30", Icon: CheckCircle2 },
    rejeitada: {
      label: "Rejeitada",
      cls: "bg-destructive/15 text-destructive border-destructive/30",
      Icon: XCircle,
    },
  } as const;
  const { label, cls, Icon } = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </span>
  );
}
