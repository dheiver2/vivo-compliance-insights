import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  listThreeCplusCalls,
  analyzeThreeCplusCall,
  getThreeCplusRecording,
  getThreeCplusCallMeta,
  type ThreeCplusCall,
} from "@/lib/api/analyze.functions";
import { getSystemStatus, listCalls, type SystemStatus } from "@/lib/api/calls.functions";
import type { StoredCall } from "@/lib/server/calls-store.server";
import {
  assessAuditability,
  AUDITABILITY_CRITERIA,
  DEFAULT_MIN_AUDITABLE_SEC,
} from "@/lib/auditability";
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
      { title: "Áudios · Escutta" },
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

// Identificador para baixar a gravação bruta de um áudio: APENAS o callId real da
// 3C Plus (sourceCallId), gravado na ingestão. O sid do rótulo "3C Plus · {sid}"
// NÃO serve para /recording (e os dados de demonstração têm ids fabricados), por
// isso não é usado como fallback — áudios sem sourceCallId não são reproduzíveis.
function recordingHandle(c: StoredCall): string {
  return c.sourceCallId ?? "";
}

// Áudio de demonstração (seed): rótulo "3C Plus · …" mas sem id real da 3C Plus.
function isDemoAudio(c: StoredCall): boolean {
  return !c.sourceCallId && c.label.startsWith("3C Plus · ");
}

function AudiosPage() {
  const qc = useQueryClient();

  const [apiToken, setApiToken] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  // Duração mínima (s) — critério de auditabilidade aplicado pela API 3C Plus.
  const [minDuration, setMinDuration] = useState(String(DEFAULT_MIN_AUDITABLE_SEC));

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

  // Filtros do acervo de áudios (metadados do store: busca, atendente, tema, status).
  const [audioSearch, setAudioSearch] = useState("");
  const [agentFilter, setAgentFilter] = useState("all");
  const [topicFilter, setTopicFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const agentsInAudios = useMemo(
    () => [...new Set(auditedAudios.map((c) => c.agentName))].sort((a, b) => a.localeCompare(b)),
    [auditedAudios],
  );
  // Temas disponíveis — gerados na auditoria (classifyTopic da transcrição).
  const topicsInAudios = useMemo(
    () =>
      [...new Set(auditedAudios.map((c) => c.topic).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [auditedAudios],
  );
  const filteredAudios = useMemo(() => {
    const q = audioSearch.trim().toLowerCase();
    return auditedAudios.filter((c) => {
      if (agentFilter !== "all" && c.agentName !== agentFilter) return false;
      if (topicFilter !== "all" && c.topic !== topicFilter) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (q && !`${c.id} ${c.agentName} ${c.topic}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [auditedAudios, audioSearch, agentFilter, topicFilter, statusFilter]);

  const listMut = useMutation({
    mutationFn: (vars: { startDate: string; endDate: string }) => {
      const minSec = Math.max(0, Number(minDuration) || 0);
      return listThreeCplusCalls({
        data: {
          startDate: vars.startDate.trim(),
          endDate: vars.endDate.trim(),
          apiToken: apiToken.trim(),
          ...(minSec > 0 ? { minDurationSec: minSec } : {}),
        },
      });
    },
    onSuccess: () => {
      // Nova listagem: zera seleção, progresso e players anteriores.
      setSelected(new Set());
      setProgress({});
      revokeAllAudio();
      setAudio({});
    },
  });

  // Auto-carrega as gravações recentes (últimos 2 dias) ao abrir a aba, sem o
  // usuário precisar buscar. Janela curta para uma busca leve (a 3C Plus pode dar
  // timeout/524 em janelas grandes). Roda só no cliente; usa o token do servidor.
  const autoLoadedRef = useRef(false);
  useEffect(() => {
    if (autoLoadedRef.current) return;
    autoLoadedRef.current = true;
    const fmt = (d: Date) => {
      const p = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    };
    const now = new Date();
    const past = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const s = fmt(past);
    const e = fmt(now);
    setStartDate(s);
    setEndDate(e);
    listMut.mutate({ startDate: s, endDate: e });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const calls: ThreeCplusCall[] = listMut.data ?? [];
  const canList = startDate.trim().length > 0 && endDate.trim().length > 0 && !listMut.isPending;

  // Filtros das gravações recentes (metadados da 3C Plus).
  const [recSearch, setRecSearch] = useState("");
  const [recAgent, setRecAgent] = useState("all");
  const [recCampaign, setRecCampaign] = useState("all");
  const [recQueue, setRecQueue] = useState("all");

  const recAgents = useMemo(
    () => [...new Set(calls.map((c) => c.agent).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [calls],
  );
  const recCampaigns = useMemo(
    () =>
      [...new Set(calls.map((c) => c.campaign).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [calls],
  );
  const recQueues = useMemo(
    () =>
      [...new Set(calls.map((c) => c.queueName).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [calls],
  );
  const filteredCalls = useMemo(() => {
    const q = recSearch.trim().toLowerCase();
    return calls.filter((c) => {
      if (recAgent !== "all" && c.agent !== recAgent) return false;
      if (recCampaign !== "all" && c.campaign !== recCampaign) return false;
      if (recQueue !== "all" && c.queueName !== recQueue) return false;
      if (
        q &&
        !`${c.id} ${c.agent} ${c.number} ${c.campaign} ${c.queueName}`.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [calls, recSearch, recAgent, recCampaign, recQueue]);
  // Auditáveis (elegíveis) = passam nos critérios de elegibilidade de mercado
  // (gravação + atendente). Só essas podem ser selecionadas para auditoria.
  const auditable = useMemo(
    () => filteredCalls.filter((c) => assessAuditability(c).auditable),
    [filteredCalls],
  );
  // Não elegíveis = reprovaram na elegibilidade e NÃO são auditadas — ficam numa
  // aba separada, apenas para consulta do motivo da reprovação.
  const ineligible = useMemo(
    () => filteredCalls.filter((c) => !assessAuditability(c).auditable),
    [filteredCalls],
  );

  const recFilterActive =
    recSearch.trim() !== "" ||
    recAgent !== "all" ||
    recCampaign !== "all" ||
    recQueue !== "all";

  const selectedIds = useMemo(
    () => auditable.map(callKey).filter((k) => selected.has(k)),
    [auditable, selected],
  );
  const allSelected = auditable.length > 0 && selectedIds.length === auditable.length;

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
    setSelected(allSelected ? new Set() : new Set(auditable.map(callKey)));
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

  // Renderiza uma linha de gravação (reusada nas abas Elegíveis / Não elegíveis).
  function renderCall(c: ThreeCplusCall) {
    const key = callKey(c);
    const st = progress[key];
    const checked = selected.has(key);
    const au = audio[key];
    const audit = assessAuditability(c);
    return (
      <div key={key} className={`p-3 text-sm ${audit.auditable ? "" : "opacity-70"}`}>
        <div className="flex items-center gap-3">
          {audit.auditable && (
            <Checkbox
              checked={checked}
              disabled={running}
              onCheckedChange={() => toggle(key)}
              aria-label={`Selecionar ligação ${key}`}
            />
          )}
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
          {!audit.auditable && (
            <span
              className="flex-shrink-0 rounded bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning-foreground"
              title="Reprovada na elegibilidade — não auditada"
            >
              {audit.reason}
            </span>
          )}
          <ItemBadge recorded={c.recorded} state={st} />
        </div>
        {au?.error && <p className="mt-2 text-xs text-destructive">{au.error}</p>}
        {au?.url && (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <audio src={au.url} controls autoPlay className="mt-2 h-9 w-full" />
        )}
      </div>
    );
  }

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
            Gravações de áudio do acervo. Só áudios reais da 3C Plus tocam — itens marcados como
            “demonstração” (seed) não têm gravação. Importe ligações reais na busca abaixo. A análise
            fica na ficha.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {auditedQ.isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : auditedAudios.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum áudio no acervo ainda. Selecione gravações abaixo para auditar.
            </p>
          ) : (
            <>
              {/* Filtros por metadados do acervo */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[180px] flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={audioSearch}
                    onChange={(e) => setAudioSearch(e.target.value)}
                    placeholder="Buscar por id, atendente ou tema…"
                    className="h-9 pl-8 text-sm"
                  />
                </div>
                <Select value={agentFilter} onValueChange={setAgentFilter}>
                  <SelectTrigger className="h-9 w-[180px]">
                    <SelectValue placeholder="Atendente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os atendentes</SelectItem>
                    {agentsInAudios.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {topicsInAudios.length > 0 && (
                  <Select value={topicFilter} onValueChange={setTopicFilter}>
                    <SelectTrigger className="h-9 w-[170px]">
                      <SelectValue placeholder="Tema" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os temas</SelectItem>
                      {topicsInAudios.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="approved">Aprovado</SelectItem>
                    <SelectItem value="warning">Atenção</SelectItem>
                    <SelectItem value="critical">Crítico</SelectItem>
                  </SelectContent>
                </Select>
                {(audioSearch ||
                  agentFilter !== "all" ||
                  topicFilter !== "all" ||
                  statusFilter !== "all") && (
                  <span className="text-xs text-muted-foreground">
                    {filteredAudios.length} de {auditedAudios.length}
                  </span>
                )}
              </div>

              {filteredAudios.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum áudio para esse filtro.
                </p>
              ) : (
                <div className="divide-y rounded-md border">
                  {filteredAudios.map((c) => {
                    const handle = recordingHandle(c);
                    return (
                      <RawAudioRow
                        key={c.id}
                        call={c}
                        handle={handle}
                        apiToken={apiToken.trim()}
                        au={audio[handle]}
                        onToggleAudio={() => toggleAudio(handle)}
                        analyzeState={rowAnalyze[c.id]}
                        onAnalyze={() => analyzeOne(c.id, handle)}
                        running={running}
                      />
                    );
                  })}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Filtro de listagem */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" /> Gravações recentes
          </CardTitle>
          <CardDescription>
            As gravações dos últimos 2 dias carregam automaticamente. A duração mínima filtra
            chamadas curtas (caixa postal/queda) — critério de auditabilidade aplicado pela própria
            3C Plus. Ajuste o período e liste de novo (períodos muito longos podem dar timeout na 3C
            Plus).
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
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
            <div className="space-y-1.5">
              <Label htmlFor="aud-mindur" className="text-xs">
                Duração mín. (s)
              </Label>
              <Input
                id="aud-mindur"
                type="number"
                min={0}
                value={minDuration}
                onChange={(e) => setMinDuration(e.target.value)}
                className="sm:w-28"
                disabled={listMut.isPending || running}
              />
            </div>
          </div>
          <Button
            onClick={() =>
              listMut.mutate({ startDate: startDate.trim(), endDate: endDate.trim() })
            }
            disabled={!canList}
          >
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
                  {recFilterActive ? `${filteredCalls.length} de ${calls.length}` : calls.length}{" "}
                  ligação(ões) · {auditable.length} auditável(is)
                </CardTitle>
                <CardDescription>
                  Só ligações <strong>auditáveis</strong> podem ser selecionadas — critérios:{" "}
                  {AUDITABILITY_CRITERIA.map((c) => c.label).join(" · ")}. “Ouvir” reproduz a
                  gravação original (áudio não mascarado).
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleAll}
                  disabled={running || auditable.length === 0}
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

            {/* Filtros por metadados das gravações */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[170px] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={recSearch}
                  onChange={(e) => setRecSearch(e.target.value)}
                  placeholder="Buscar por atendente, número, campanha…"
                  className="h-9 pl-8 text-sm"
                  disabled={running}
                />
              </div>
              <Select value={recAgent} onValueChange={setRecAgent} disabled={running}>
                <SelectTrigger className="h-9 w-[160px]">
                  <SelectValue placeholder="Atendente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os atendentes</SelectItem>
                  {recAgents.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {recCampaigns.length > 0 && (
                <Select value={recCampaign} onValueChange={setRecCampaign} disabled={running}>
                  <SelectTrigger className="h-9 w-[150px]">
                    <SelectValue placeholder="Campanha" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as campanhas</SelectItem>
                    {recCampaigns.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {recQueues.length > 0 && (
                <Select value={recQueue} onValueChange={setRecQueue} disabled={running}>
                  <SelectTrigger className="h-9 w-[140px]">
                    <SelectValue placeholder="Fila" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as filas</SelectItem>
                    {recQueues.map((qn) => (
                      <SelectItem key={qn} value={qn}>
                        {qn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {recFilterActive && (
                <button
                  type="button"
                  onClick={() => {
                    setRecSearch("");
                    setRecAgent("all");
                    setRecCampaign("all");
                    setRecQueue("all");
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  limpar
                </button>
              )}
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
            <Tabs defaultValue="eligible" className="space-y-3">
              <TabsList>
                <TabsTrigger value="eligible">Elegíveis ({auditable.length})</TabsTrigger>
                <TabsTrigger value="ineligible">
                  Não elegíveis ({ineligible.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="eligible" className="mt-0">
                {auditable.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Nenhuma gravação elegível para esse filtro.
                  </p>
                ) : (
                  <div className="divide-y rounded-md border">{auditable.map(renderCall)}</div>
                )}
              </TabsContent>

              <TabsContent value="ineligible" className="mt-0 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Gravações que <strong>reprovaram nas regras de elegibilidade</strong> de mercado
                  e, por isso, <strong>não são auditadas</strong>. Listadas apenas para consulta do
                  motivo da reprovação.
                </p>
                {ineligible.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Nenhuma gravação inelegível para esse filtro.
                  </p>
                ) : (
                  <div className="divide-y rounded-md border">{ineligible.map(renderCall)}</div>
                )}
              </TabsContent>
            </Tabs>
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

// Linha de um áudio do acervo, exibida "como no 3C Plus": busca os metadados da
// ligação (atendente, número mascarado, data, campanha, fila) sob demanda e os
// mostra junto do player e do disparo de análise. O fetch é cacheado pelo
// react-query (queryKey por gravação) e só roda quando há identificador.
function RawAudioRow({
  call,
  handle,
  apiToken,
  au,
  onToggleAudio,
  analyzeState,
  onAnalyze,
  running,
}: {
  call: StoredCall;
  handle: string;
  apiToken: string;
  au?: AudioState;
  onToggleAudio: () => void;
  analyzeState?: ItemState;
  onAnalyze: () => void;
  running: boolean;
}) {
  const metaQ = useQuery<ThreeCplusCall | null>({
    queryKey: ["3c-meta", handle],
    queryFn: () => getThreeCplusCallMeta({ data: { callId: handle, apiToken } }),
    enabled: handle.length > 0,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const m = metaQ.data;
  const agent = m?.agent || call.agentName;
  const dateStr = m?.callDate || call.createdAt;

  // Campos extras no padrão do 3C Plus (omitidos quando ausentes).
  const facts: string[] = [];
  if (m?.campaign) facts.push(m.campaign);
  if (m?.queueName) facts.push(m.queueName);
  if (call.topic) facts.push(call.topic);

  return (
    <div className="p-3 text-sm">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {agent}
            {m?.number ? ` · ${m.number}` : ""}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {dateStr ? new Date(dateStr).toLocaleString("pt-BR") : "—"}
            {facts.length > 0 ? ` · ${facts.join(" · ")}` : ""}
          </p>
          <p className="truncate text-[11px] text-muted-foreground/80">
            {call.id}
            {m?.sid ? ` · 3C ${m.sid}` : ""}
            {metaQ.isLoading ? " · carregando dados…" : ""}
          </p>
        </div>
        {handle ? (
          <button
            type="button"
            onClick={onToggleAudio}
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
          <span
            className="flex-shrink-0 text-xs text-muted-foreground"
            title={
              isDemoAudio(call)
                ? "Áudio de demonstração (seed) — sem gravação real na 3C Plus. Importe ligações reais para ouvir/auditar."
                : "Sem gravação reproduzível na 3C Plus."
            }
          >
            {isDemoAudio(call) ? "demonstração" : "sem gravação"}
          </span>
        )}
        {handle && (
          <button
            type="button"
            onClick={onAnalyze}
            disabled={running || analyzeState?.status === "processing"}
            className="inline-flex flex-shrink-0 items-center gap-1 rounded-md border border-primary/40 bg-primary/5 px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
          >
            {analyzeState?.status === "processing" ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> analisando…
              </>
            ) : analyzeState?.status === "done" ? (
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
          params={{ callId: call.id }}
          className="flex flex-shrink-0 items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
        >
          ficha <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {analyzeState?.status === "error" && (
        <p className="mt-2 text-xs text-destructive">{analyzeState.message}</p>
      )}
      {au?.error && <p className="mt-2 text-xs text-destructive">{au.error}</p>}
      {au?.url && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio src={au.url} controls autoPlay className="mt-2 h-9 w-full" />
      )}
    </div>
  );
}
