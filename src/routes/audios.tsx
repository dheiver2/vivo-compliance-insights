import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  listThreeCplusCalls,
  analyzeThreeCplusCall,
  getThreeCplusRecording,
  type ThreeCplusCall,
} from "@/lib/api/analyze.functions";
import { getSystemStatus, listCalls, type SystemStatus } from "@/lib/api/calls.functions";
import type { StoredCall } from "@/lib/server/calls-store.server";
import {
  AudioLines,
  KeyRound,
  Search,
  Loader2,
  Play,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ShieldCheck,
  ExternalLink,
  Volume2,
  FileCheck,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/audios")({
  head: () => ({
    meta: [
      { title: "Áudios · VoiceAudit" },
      {
        name: "description",
        content:
          "Liste as gravações da 3C Plus e selecione quais áudios passarão pela auditoria da Mangaba AI.",
      },
    ],
  }),
  component: AudiosPage,
});

type ItemStatus = "queued" | "processing" | "done" | "error";
interface ItemState {
  status: ItemStatus;
  message?: string;
  resultId?: string;
}

// Estado do player por linha (carregamento sob demanda da gravação).
interface AudioState {
  url?: string;
  loading?: boolean;
  error?: string;
}

// base64 → Blob para tocar a gravação no navegador via object URL.
function base64ToBlob(b64: string, type: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

// Identificador estável de uma gravação (id da 3C Plus, com fallback no SID).
function callKey(c: ThreeCplusCall): string {
  return c.id || c.sid;
}

// Identificador para baixar a gravação bruta de um áudio do store: o callId da
// 3C Plus salvo na ingestão; ou, para registros antigos, o sid do rótulo
// "3C Plus · {sid}". Vazio quando o áudio não tem origem reproduzível.
function recordingHandle(c: StoredCall): string {
  if (c.sourceCallId) return c.sourceCallId;
  const prefix = "3C Plus · ";
  return c.label.startsWith(prefix) ? c.label.slice(prefix.length).trim() : "";
}

function AudiosPage() {
  const qc = useQueryClient();

  const [apiToken, setApiToken] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Seleção e estado da execução em lote.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<Record<string, ItemState>>({});
  const [running, setRunning] = useState(false);
  const cancelRef = useRef(false);

  // Player por linha: gravações carregadas sob demanda (object URLs).
  const [audio, setAudio] = useState<Record<string, AudioState>>({});
  const urlsRef = useRef<string[]>([]);

  // Disparo de análise por linha no card de áudios (keyed pelo id do registro).
  const [rowAnalyze, setRowAnalyze] = useState<Record<string, ItemState>>({});

  // Libera todos os object URLs criados (evita vazamento de memória).
  function revokeAllAudio() {
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];
  }
  useEffect(() => revokeAllAudio, []);

  // Carrega/oculta a gravação de uma linha. O servidor baixa o áudio (token
  // server-side) e devolve base64; aqui viramos object URL para o <audio>.
  async function toggleAudio(key: string) {
    const current = audio[key];
    if (current?.url) {
      URL.revokeObjectURL(current.url);
      urlsRef.current = urlsRef.current.filter((u) => u !== current.url);
      setAudio((a) => ({ ...a, [key]: {} }));
      return;
    }
    setAudio((a) => ({ ...a, [key]: { loading: true } }));
    try {
      const res = await getThreeCplusRecording({
        data: { callId: key, apiToken: apiToken.trim() },
      });
      const url = URL.createObjectURL(base64ToBlob(res.base64, res.contentType));
      urlsRef.current.push(url);
      setAudio((a) => ({ ...a, [key]: { url } }));
    } catch (e) {
      setAudio((a) => ({
        ...a,
        [key]: { error: e instanceof Error ? e.message : "falha ao carregar o áudio" },
      }));
    }
  }

  // Dispara a (re)análise de um áudio do acervo direto do card. Reusa o mesmo
  // pipeline da 3C Plus; ao concluir, atualiza dashboard/ligações/equipe etc.
  async function analyzeOne(callRecordId: string, handle: string) {
    if (!handle || rowAnalyze[callRecordId]?.status === "processing") return;
    setRowAnalyze((s) => ({ ...s, [callRecordId]: { status: "processing" } }));
    try {
      const res = await analyzeThreeCplusCall({
        data: { callId: handle, apiToken: apiToken.trim() },
      });
      setRowAnalyze((s) => ({ ...s, [callRecordId]: { status: "done", resultId: res.id } }));
      await qc.invalidateQueries();
      toast.success("Áudio auditado. Resultado disponível em Ligações.");
    } catch (e) {
      setRowAnalyze((s) => ({
        ...s,
        [callRecordId]: { status: "error", message: e instanceof Error ? e.message : "falha" },
      }));
      toast.error(e instanceof Error ? e.message : "Falha ao auditar o áudio.");
    }
  }

  // Aviso se a transcrição (Mangaba Voz) não está ativa no servidor.
  const { data: status } = useQuery<SystemStatus>({
    queryKey: ["system-status"],
    queryFn: () => getSystemStatus(),
  });
  const voiceReady = status?.hfConfigured ?? true;

  // Áudios já auditados (do store) — origem "audio". Carrega automaticamente,
  // sem precisar de token. Mesma queryKey de Ligações (cache compartilhado).
  const auditedQ = useQuery<StoredCall[]>({
    queryKey: ["calls"],
    queryFn: () => listCalls(),
    refetchOnWindowFocus: true,
  });
  const auditedAudios = useMemo(
    () => (auditedQ.data ?? []).filter((c) => c.origin === "audio"),
    [auditedQ.data],
  );

  const listMut = useMutation({
    mutationFn: () =>
      listThreeCplusCalls({
        data: { startDate: startDate.trim(), endDate: endDate.trim(), apiToken: apiToken.trim() },
      }),
    onSuccess: () => {
      // Nova listagem: zera seleção, progresso e players anteriores.
      setSelected(new Set());
      setProgress({});
      revokeAllAudio();
      setAudio({});
    },
  });

  const calls: ThreeCplusCall[] = listMut.data ?? [];
  const recorded = useMemo(() => calls.filter((c) => c.recorded), [calls]);
  const canList = startDate.trim().length > 0 && endDate.trim().length > 0 && !listMut.isPending;

  const selectedIds = useMemo(
    () => recorded.map(callKey).filter((k) => selected.has(k)),
    [recorded, selected],
  );
  const allSelected = recorded.length > 0 && selectedIds.length === recorded.length;

  function toggle(key: string) {
    if (running) return;
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleAll() {
    if (running) return;
    setSelected(allSelected ? new Set() : new Set(recorded.map(callKey)));
  }

  // Auditoria em série das gravações selecionadas. Cada item é uma request
  // própria (evita timeout serverless) e respeita o rate limit da 3C Plus.
  async function auditSelected() {
    if (running || selectedIds.length === 0) return;
    setRunning(true);
    cancelRef.current = false;
    setProgress(Object.fromEntries(selectedIds.map((id) => [id, { status: "queued" } as ItemState])));

    let ok = 0;
    let fail = 0;
    for (const id of selectedIds) {
      if (cancelRef.current) break;
      setProgress((p) => ({ ...p, [id]: { status: "processing" } }));
      try {
        const res = await analyzeThreeCplusCall({
          data: { callId: id, apiToken: apiToken.trim() },
        });
        setProgress((p) => ({ ...p, [id]: { status: "done", resultId: res.id } }));
        ok += 1;
      } catch (e) {
        setProgress((p) => ({
          ...p,
          [id]: { status: "error", message: e instanceof Error ? e.message : "falha" },
        }));
        fail += 1;
      }
    }

    setRunning(false);
    // As novas auditorias entram no store: atualiza dashboard, ligações, equipe,
    // coaching e relatórios.
    await qc.invalidateQueries();

    if (cancelRef.current) {
      toast.message(`Interrompido — ${ok} auditada(s), ${fail} com erro.`);
    } else if (ok > 0) {
      toast.success(`${ok} áudio(s) auditado(s)${fail ? `, ${fail} com erro` : ""}.`);
    } else if (fail > 0) {
      toast.error(`Nenhum áudio auditado — ${fail} com erro.`);
    }
  }

  const doneCount = Object.values(progress).filter((s) => s.status === "done").length;
  const errCount = Object.values(progress).filter((s) => s.status === "error").length;
  const total = running || doneCount + errCount > 0 ? Object.keys(progress).length : 0;
  const pct = total > 0 ? Math.round(((doneCount + errCount) / total) * 100) : 0;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <header>
        <h1 className="text-3xl font-display font-bold flex items-center gap-3">
          <AudioLines className="h-7 w-7 text-primary" />
          Áudios
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Liste as gravações da 3C Plus por período e selecione quais áudios passarão pela auditoria
          da Mangaba AI.
        </p>
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1 text-xs text-emerald-700 dark:text-emerald-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          Proteção LGPD: o áudio é transcrito, a PII é mascarada e só o resumo da auditoria é
          armazenado.
        </p>
      </header>

      {!voiceReady && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="flex items-center gap-3 py-4 text-sm">
            <AlertTriangle className="h-5 w-5 text-warning-foreground flex-shrink-0" />
            <span>
              A transcrição de áudio (Mangaba Voz) está indisponível no servidor. A auditoria de
              áudios pode falhar até a Mangaba AI ser ativada nas Configurações.
            </span>
          </CardContent>
        </Card>
      )}

      {/* Áudios do acervo (do store) — gravações brutas, com player. Sem análise. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileCheck className="h-4 w-4 text-primary" /> Áudios
            {auditedAudios.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({auditedAudios.length})
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Gravações de áudio do acervo. Ouça o áudio original; a análise fica na ficha.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {auditedQ.isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : auditedAudios.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum áudio no acervo ainda. Selecione gravações abaixo para auditar.
            </p>
          ) : (
            <div className="divide-y rounded-md border">
              {auditedAudios.map((c) => {
                const handle = recordingHandle(c);
                const au = audio[handle];
                return (
                  <div key={c.id} className="p-3 text-sm">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">
                          {c.agentName} · {c.topic}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {c.id} · {new Date(c.createdAt).toLocaleString("pt-BR")}
                        </p>
                      </div>
                      {handle ? (
                        <button
                          type="button"
                          onClick={() => toggleAudio(handle)}
                          disabled={running || au?.loading}
                          className="inline-flex flex-shrink-0 items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-xs text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                        >
                          {au?.loading ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" /> carregando…
                            </>
                          ) : au?.url ? (
                            <>
                              <X className="h-3.5 w-3.5" /> Ocultar
                            </>
                          ) : (
                            <>
                              <Volume2 className="h-3.5 w-3.5" /> Ouvir
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="flex-shrink-0 text-xs text-muted-foreground">
                          sem gravação
                        </span>
                      )}
                      {handle && (
                        <button
                          type="button"
                          onClick={() => analyzeOne(c.id, handle)}
                          disabled={running || rowAnalyze[c.id]?.status === "processing"}
                          className="inline-flex flex-shrink-0 items-center gap-1 rounded-md border border-primary/40 bg-primary/5 px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                        >
                          {rowAnalyze[c.id]?.status === "processing" ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" /> analisando…
                            </>
                          ) : rowAnalyze[c.id]?.status === "done" ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" /> reanalisar
                            </>
                          ) : (
                            <>
                              <Play className="h-3.5 w-3.5" /> Analisar
                            </>
                          )}
                        </button>
                      )}
                      <Link
                        to="/calls/$callId"
                        params={{ callId: c.id }}
                        className="flex flex-shrink-0 items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
                      >
                        ficha <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                    {rowAnalyze[c.id]?.status === "error" && (
                      <p className="mt-2 text-xs text-destructive">{rowAnalyze[c.id]?.message}</p>
                    )}
                    {au?.error && <p className="mt-2 text-xs text-destructive">{au.error}</p>}
                    {au?.url && (
                      // eslint-disable-next-line jsx-a11y/media-has-caption
                      <audio src={au.url} controls autoPlay className="mt-2 h-9 w-full" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filtro de listagem */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" /> Buscar gravações
          </CardTitle>
          <CardDescription>
            Conecta-se à API da 3C Plus (somente leitura). A janela de datas é obrigatória.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="aud-token" className="flex items-center gap-1.5 text-xs">
              <KeyRound className="h-3.5 w-3.5 text-muted-foreground" /> API token{" "}
              <span className="font-normal text-muted-foreground">
                (opcional se THREECPLUS_API_TOKEN estiver no servidor)
              </span>
            </Label>
            <Input
              id="aud-token"
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder="api_token da 3C Plus"
              disabled={listMut.isPending || running}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="aud-start" className="text-xs">
                Data inicial
              </Label>
              <Input
                id="aud-start"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="2026-05-01 00:00:00"
                disabled={listMut.isPending || running}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aud-end" className="text-xs">
                Data final
              </Label>
              <Input
                id="aud-end"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="2026-05-31 23:59:59"
                disabled={listMut.isPending || running}
              />
            </div>
          </div>
          <Button onClick={() => listMut.mutate()} disabled={!canList}>
            {listMut.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Buscando…
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" /> Listar gravações
              </>
            )}
          </Button>
          {listMut.isError && (
            <p className="text-sm text-destructive">
              Erro ao listar:{" "}
              {listMut.error instanceof Error ? listMut.error.message : "tente novamente."}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Resultado vazio */}
      {listMut.isSuccess && calls.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Nenhuma ligação encontrada nesse período.
          </CardContent>
        </Card>
      )}

      {/* Listagem + seleção */}
      {calls.length > 0 && (
        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">
                  {calls.length} ligação(ões) · {recorded.length} com gravação
                </CardTitle>
                <CardDescription>
                  Selecione os áudios que devem passar pela auditoria. Ligações sem gravação não são
                  selecionáveis. “Ouvir” reproduz a gravação original (áudio não mascarado).
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleAll}
                  disabled={running || recorded.length === 0}
                >
                  {allSelected ? "Limpar seleção" : "Selecionar todas"}
                </Button>
                {running ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      cancelRef.current = true;
                    }}
                  >
                    <X className="h-4 w-4 mr-2" /> Parar
                  </Button>
                ) : (
                  <Button size="sm" onClick={auditSelected} disabled={selectedIds.length === 0}>
                    <Play className="h-4 w-4 mr-2" /> Auditar selecionadas ({selectedIds.length})
                  </Button>
                )}
              </div>
            </div>

            {total > 0 && (
              <div className="space-y-1.5">
                <Progress value={pct} />
                <p className="text-xs text-muted-foreground">
                  {doneCount + errCount}/{total} processada(s) · {doneCount} ok · {errCount} erro(s)
                  {running ? " · auditando em série…" : ""}
                </p>
              </div>
            )}
          </CardHeader>

          <CardContent className="pt-0">
            <div className="divide-y rounded-md border">
              {calls.map((c) => {
                const key = callKey(c);
                const st = progress[key];
                const checked = selected.has(key);
                const au = audio[key];
                return (
                  <div key={key} className="p-3 text-sm">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={checked}
                        disabled={!c.recorded || running}
                        onCheckedChange={() => toggle(key)}
                        aria-label={`Selecionar ligação ${key}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">
                          {c.agent || "Sem atendente"} · {c.number || "—"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {c.callDate || "—"} · {c.campaign || c.queueName || "—"}
                        </p>
                      </div>
                      {c.recorded && (
                        <button
                          type="button"
                          onClick={() => toggleAudio(key)}
                          disabled={running || au?.loading}
                          className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-xs text-foreground transition-colors hover:bg-muted disabled:opacity-50 flex-shrink-0"
                        >
                          {au?.loading ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" /> carregando…
                            </>
                          ) : au?.url ? (
                            <>
                              <X className="h-3.5 w-3.5" /> Ocultar
                            </>
                          ) : (
                            <>
                              <Volume2 className="h-3.5 w-3.5" /> Ouvir
                            </>
                          )}
                        </button>
                      )}
                      <ItemBadge recorded={c.recorded} state={st} />
                    </div>
                    {au?.error && (
                      <p className="mt-2 text-xs text-destructive">{au.error}</p>
                    )}
                    {au?.url && (
                      // eslint-disable-next-line jsx-a11y/media-has-caption
                      <audio src={au.url} controls autoPlay className="mt-2 h-9 w-full" />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estado inicial */}
      {!listMut.isSuccess && !listMut.isPending && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <AudioLines className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">Informe um período e clique em “Listar gravações”.</p>
            <p className="text-xs mt-1">
              As gravações da 3C Plus aparecem aqui para você selecionar quais auditar.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Selo de estado por linha: gravação ausente, fila, processando, ok (com link
// para a ficha) ou erro (com o motivo no title).
function ItemBadge({ recorded, state }: { recorded: boolean; state?: ItemState }) {
  if (!recorded) {
    return <span className="text-xs text-muted-foreground flex-shrink-0">sem gravação</span>;
  }
  if (!state) return null;
  switch (state.status) {
    case "queued":
      return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
          <Clock className="h-3.5 w-3.5" /> na fila
        </span>
      );
    case "processing":
      return (
        <span className="flex items-center gap-1 text-xs text-primary flex-shrink-0">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> auditando…
        </span>
      );
    case "done":
      return (
        <Link
          to="/calls/$callId"
          params={{ callId: state.resultId ?? "" }}
          className="flex items-center gap-1 text-xs text-success hover:underline flex-shrink-0"
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> auditada
          <ExternalLink className="h-3 w-3" />
        </Link>
      );
    case "error":
      return (
        <span
          className="flex items-center gap-1 text-xs text-destructive flex-shrink-0"
          title={state.message}
        >
          <XCircle className="h-3.5 w-3.5" /> erro
        </span>
      );
  }
}
