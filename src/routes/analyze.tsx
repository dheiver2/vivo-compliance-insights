import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { analyzeCall, analyzeAudio, analyzeCallFromUrl, MARKET_PROVIDERS, listThreeCplusCalls, analyzeThreeCplusCall, type ThreeCplusCall } from "@/lib/api/analyze.functions";
import { SAMPLE_TRANSCRIPT, statusFromScore, type CallAnalysis } from "@/lib/compliance";
import { mangabaSourceLabel } from "@/lib/mangaba";
import { Sparkles, Wand2, FileText, CheckCircle2, XCircle, Cpu, Loader2, Smile, Meh, Frown, AudioLines, Upload, Trash2, ChevronDown, FileCheck, User, Plug, Link2, KeyRound, ShieldCheck, PhoneCall, Search } from "lucide-react";

export const Route = createFileRoute("/analyze")({
  head: () => ({
    meta: [
      { title: "Análise IA · VoiceAudit" },
      { name: "description", content: "Analise transcrições de ligações com a IA da Mangaba AI." },
    ],
  }),
  component: AnalyzePage,
});

const sentimentMap = {
  positivo: { icon: Smile, cls: "text-success", label: "Positivo" },
  neutro: { icon: Meh, cls: "text-warning-foreground", label: "Neutro" },
  negativo: { icon: Frown, cls: "text-destructive", label: "Negativo" },
} as const;

function ScoreTile({ label, score }: { label: string; score: number }) {
  const cls = score >= 85 ? "text-success" : score >= 70 ? "text-warning-foreground" : "text-destructive";
  return (
    <div className="rounded-lg border border-border/60 p-4 text-center">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-4xl font-display font-bold mt-1 ${cls}`}>{score}%</div>
    </div>
  );
}

function Results({ result, detailId }: { result: CallAnalysis; detailId?: string }) {
  const Sent = sentimentMap[result.sentiment];
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="border-b border-border/60 bg-secondary/40">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                Resultado da Análise
                <StatusBadge status={statusFromScore(result.scoreCompliance)} />
              </CardTitle>
              <CardDescription className="mt-1 flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5" />
                {mangabaSourceLabel(result.source, result.model)}
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 ${Sent.cls}`}>
                <Sent.icon className="h-5 w-5" />
                <span className="text-sm font-semibold">{Sent.label}</span>
              </div>
              {detailId && (
                <Link to="/calls/$callId" params={{ callId: detailId }} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted">
                  <FileCheck className="h-3.5 w-3.5" /> Ver ficha
                </Link>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <ScoreTile label="Compliance" score={result.scoreCompliance} />
            <ScoreTile label="Qualidade" score={result.scoreQuality} />
          </div>
          <p className="text-sm text-muted-foreground bg-secondary/40 rounded-lg p-3 border border-border/60">
            {result.summary}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Itens auditados</CardTitle>
          <CardDescription>Checklist regulatória aplicada à transcrição</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {result.checks.map((c) => (
            <div key={c.label}>
              <div className="flex justify-between items-center text-sm mb-1.5">
                <span className="flex items-center gap-2">
                  {c.passed ? (
                    <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                  )}
                  {c.label}
                </span>
                <span className={`font-semibold ${c.score >= 85 ? "text-success" : c.score >= 70 ? "text-warning-foreground" : "text-destructive"}`}>
                  {c.score}%
                </span>
              </div>
              <Progress value={c.score} className="h-2" />
              {c.evidence && <p className="text-xs text-muted-foreground mt-1 ml-6">{c.evidence}</p>}
            </div>
          ))}
        </CardContent>
      </Card>

      {result.observations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Observações dos agentes de IA</CardTitle>
            <CardDescription>Trechos relevantes detectados na transcrição</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.observations.map((o, i) => (
              <div key={i} className={`flex gap-3 rounded-lg border p-3 ${
                o.severity === "critical" ? "border-destructive/30 bg-destructive/5" :
                o.severity === "warning" ? "border-warning/40 bg-warning/5" :
                "border-success/30 bg-success/5"
              }`}>
                <div className="font-mono text-xs text-muted-foreground pt-0.5 min-w-12">{o.time}</div>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-primary">{o.agent}</div>
                  <div className="text-sm mt-0.5">{o.note}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TextPanel() {
  const [transcript, setTranscript] = useState("");
  const [agentName, setAgentName] = useState("");
  const mutation = useMutation({
    mutationFn: (text: string) => analyzeCall({ data: { transcript: text, agentName: agentName.trim() || undefined } }),
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Transcrição
          </CardTitle>
          <CardDescription>Texto da gravação a ser auditada</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="agent-text" className="flex items-center gap-1.5 text-xs">
              <User className="h-3.5 w-3.5 text-muted-foreground" /> Atendente responsável <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Input
              id="agent-text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="Ex.: Mariana Souza"
              disabled={mutation.isPending}
            />
          </div>
          <Textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Atendente: Vivo, bom dia!&#10;Cliente: ..."
            className="min-h-[320px] font-mono text-xs leading-relaxed"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => mutation.mutate(transcript)}
              disabled={mutation.isPending || transcript.trim().length < 20}
            >
              {mutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Analisando…</>
              ) : (
                <><Wand2 className="h-4 w-4" /> Analisar com IA</>
              )}
            </Button>
            <Button variant="outline" onClick={() => setTranscript(SAMPLE_TRANSCRIPT)} disabled={mutation.isPending}>
              Carregar amostra
            </Button>
            {transcript && (
              <Button variant="ghost" onClick={() => setTranscript("")} disabled={mutation.isPending}>
                Limpar
              </Button>
            )}
          </div>
          {mutation.isError && (
            <p className="text-sm text-destructive">
              Erro ao analisar: {mutation.error instanceof Error ? mutation.error.message : "tente novamente."}
            </p>
          )}
        </CardContent>
      </Card>

      <div>
        {mutation.data ? (
          <Results result={mutation.data} detailId={mutation.data.id} />
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center text-center py-20 text-muted-foreground">
              <Sparkles className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">O resultado da análise aparecerá aqui.</p>
              <p className="text-xs mt-1">Cole uma transcrição ou carregue a amostra para começar.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

type AudioStatus = "pendente" | "transcrevendo" | "analisando" | "ok" | "erro";

type AudioJob = {
  id: string;
  file: File;
  status: AudioStatus;
  error?: string;
  transcript?: string;
  result?: CallAnalysis;
  detailId?: string; // id do registro persistido (para link da ficha)
};

const statusMeta: Record<AudioStatus, { label: string; cls: string }> = {
  pendente: { label: "Na fila", cls: "text-muted-foreground bg-secondary" },
  transcrevendo: { label: "Transcrevendo…", cls: "text-primary bg-primary/10" },
  analisando: { label: "Analisando…", cls: "text-primary bg-primary/10" },
  ok: { label: "Concluído", cls: "text-success bg-success/10" },
  erro: { label: "Erro", cls: "text-destructive bg-destructive/10" },
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // data:<mime>;base64,<dados> → mantém só os dados.
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler arquivo."));
    reader.readAsDataURL(file);
  });
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function AudioJobCard({ job }: { job: AudioJob }) {
  const [open, setOpen] = useState(false);
  const meta = statusMeta[job.status];
  const busy = job.status === "transcrevendo" || job.status === "analisando";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <CardTitle className="text-base flex items-center gap-2 truncate">
              <AudioLines className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="truncate">{job.file.name}</span>
            </CardTitle>
            <CardDescription className="mt-0.5">
              {formatBytes(job.file.size)}
              {job.file.type ? ` · ${job.file.type}` : ""}
            </CardDescription>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${meta.cls}`}>
            {busy && <Loader2 className="h-3 w-3 animate-spin" />}
            {job.status === "ok" && job.result && (
              <StatusBadge status={statusFromScore(job.result.scoreCompliance)} />
            )}
            {meta.label}
          </span>
        </div>
      </CardHeader>

      {job.status === "erro" && (
        <CardContent className="pt-0">
          <p className="text-sm text-destructive">{job.error ?? "Falha ao processar."}</p>
        </CardContent>
      )}

      {job.status === "ok" && job.result && (
        <CardContent className="pt-0 space-y-4">
          <Results result={job.result} detailId={job.detailId} />
          {job.transcript && (
            <div className="rounded-lg border border-border/60">
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium"
              >
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" /> Transcrição
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
              {open && (
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap border-t border-border/60 p-3 font-mono text-xs leading-relaxed text-muted-foreground">
                  {job.transcript}
                </pre>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function AudioBatchPanel() {
  const [jobs, setJobs] = useState<AudioJob[]>([]);
  const [running, setRunning] = useState(false);
  const [agentName, setAgentName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const update = (id: string, patch: Partial<AudioJob>) =>
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const next: AudioJob[] = Array.from(files).map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      status: "pendente",
    }));
    setJobs((prev) => [...prev, ...next]);
  };

  const runAll = async () => {
    const pending = jobs.filter((j) => j.status === "pendente" || j.status === "erro");
    if (!pending.length) return;
    setRunning(true);
    // Processa sequencialmente para não estourar a API de inferência.
    for (const job of pending) {
      try {
        update(job.id, { status: "transcrevendo", error: undefined });
        const base64 = await fileToBase64(job.file);
        update(job.id, { status: "analisando" });
        const res = await analyzeAudio({
          data: { filename: job.file.name, mimeType: job.file.type, base64, agentName: agentName.trim() || undefined },
        });
        const { transcript, filename: _filename, id, protocol: _protocol, ...analysis } = res;
        update(job.id, { status: "ok", result: analysis as CallAnalysis, transcript, detailId: id });
      } catch (error) {
        update(job.id, {
          status: "erro",
          error: error instanceof Error ? error.message : "Falha ao processar áudio.",
        });
      }
    }
    setRunning(false);
  };

  const pendingCount = jobs.filter((j) => j.status === "pendente").length;
  const doneCount = jobs.filter((j) => j.status === "ok").length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AudioLines className="h-4 w-4 text-primary" /> Áudios em lote
          </CardTitle>
          <CardDescription>
            Envie vários arquivos (mp3, wav, m4a, ogg, flac, webm…). Cada um é transcrito pelo
            Mangaba Voz e auditado pelos agentes Mangaba AI. Limite de 25 MB por arquivo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="agent-audio" className="flex items-center gap-1.5 text-xs">
              <User className="h-3.5 w-3.5 text-muted-foreground" /> Atendente responsável <span className="text-muted-foreground font-normal">(opcional — aplicado a todos os áudios deste lote)</span>
            </Label>
            <Input
              id="agent-audio"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="Ex.: Mariana Souza"
              disabled={running}
            />
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border/70 py-10 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            <Upload className="h-8 w-8 opacity-60" />
            <span className="text-sm font-medium">Clique para selecionar arquivos de áudio</span>
            <span className="text-xs">ou múltiplos de uma vez</span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.webm,.aac"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          {jobs.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={runAll} disabled={running || pendingCount === 0}>
                {running ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Processando…</>
                ) : (
                  <><Wand2 className="h-4 w-4" /> Analisar {pendingCount > 0 ? `(${pendingCount})` : "lote"}</>
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setJobs([])}
                disabled={running}
              >
                <Trash2 className="h-4 w-4" /> Limpar lista
              </Button>
              <span className="ml-auto text-xs text-muted-foreground">
                {jobs.length} arquivo(s) · {doneCount} concluído(s)
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {jobs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <AudioLines className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">Os resultados de cada áudio aparecerão aqui.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <AudioJobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}

function MarketApiPanel() {
  const [provider, setProvider] = useState<string>(MARKET_PROVIDERS[0].id);
  const [recordingUrl, setRecordingUrl] = useState("");
  const [externalId, setExternalId] = useState("");
  const [agentName, setAgentName] = useState("");
  const [authHeader, setAuthHeader] = useState("");
  const [transcript, setTranscript] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      analyzeCallFromUrl({
        data: {
          recordingUrl: recordingUrl.trim(),
          provider,
          externalId: externalId.trim(),
          agentName: agentName.trim() || undefined,
          authHeader: authHeader.trim(),
          transcript: transcript.trim(),
        },
      }),
  });

  const hasTranscript = transcript.trim().length >= 20;
  const hasUrl = /^https?:\/\//i.test(recordingUrl.trim());
  const canSubmit = (hasUrl || hasTranscript) && !mutation.isPending;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="h-4 w-4 text-primary" /> Receber ligação via API de mercado
          </CardTitle>
          <CardDescription>
            Conecte um provedor de telefonia/contact center (Twilio, Genesys, NICE CXone,
            Five9, Amazon Connect, Vonage, Zenvia). Informe a URL da gravação — o servidor
            baixa o áudio, transcreve com o Mangaba Voz e roda a auditoria.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Provedor</Label>
              <Select value={provider} onValueChange={setProvider} disabled={mutation.isPending}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o provedor" />
                </SelectTrigger>
                <SelectContent>
                  {MARKET_PROVIDERS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="external-id" className="text-xs">
                ID da ligação <span className="text-muted-foreground font-normal">(no provedor)</span>
              </Label>
              <Input
                id="external-id"
                value={externalId}
                onChange={(e) => setExternalId(e.target.value)}
                placeholder="Ex.: CA1234… / conv-9876"
                disabled={mutation.isPending}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="recording-url" className="flex items-center gap-1.5 text-xs">
              <Link2 className="h-3.5 w-3.5 text-muted-foreground" /> URL da gravação
            </Label>
            <Input
              id="recording-url"
              value={recordingUrl}
              onChange={(e) => setRecordingUrl(e.target.value)}
              placeholder="https://api.twilio.com/…/Recordings/RE….mp3"
              disabled={mutation.isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="auth-header" className="flex items-center gap-1.5 text-xs">
              <KeyRound className="h-3.5 w-3.5 text-muted-foreground" /> Autorização <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Input
              id="auth-header"
              value={authHeader}
              onChange={(e) => setAuthHeader(e.target.value)}
              placeholder="Bearer … ou Basic …"
              disabled={mutation.isPending}
            />
            <p className="text-[11px] text-muted-foreground">
              Enviado como cabeçalho <code className="font-mono">Authorization</code> ao baixar a gravação no provedor.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="agent-api" className="flex items-center gap-1.5 text-xs">
              <User className="h-3.5 w-3.5 text-muted-foreground" /> Atendente responsável <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Input
              id="agent-api"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="Ex.: Mariana Souza"
              disabled={mutation.isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="api-transcript" className="flex items-center gap-1.5 text-xs">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" /> Transcrição do provedor <span className="text-muted-foreground font-normal">(opcional — pula a transcrição por áudio)</span>
            </Label>
            <Textarea
              id="api-transcript"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Se o provedor já entrega o speech-to-text, cole aqui para pular o download do áudio."
              className="min-h-[120px] font-mono text-xs leading-relaxed"
              disabled={mutation.isPending}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => mutation.mutate()} disabled={!canSubmit}>
              {mutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Recebendo e analisando…</>
              ) : (
                <><Plug className="h-4 w-4" /> Receber e analisar</>
              )}
            </Button>
            {(recordingUrl || transcript || externalId || authHeader) && (
              <Button
                variant="ghost"
                onClick={() => { setRecordingUrl(""); setTranscript(""); setExternalId(""); setAuthHeader(""); }}
                disabled={mutation.isPending}
              >
                Limpar
              </Button>
            )}
          </div>
          {!hasUrl && !hasTranscript && (
            <p className="text-xs text-muted-foreground">
              Informe uma URL de gravação <strong>ou</strong> cole a transcrição do provedor para habilitar a análise.
            </p>
          )}
          {mutation.isError && (
            <p className="text-sm text-destructive">
              Erro ao receber a ligação: {mutation.error instanceof Error ? mutation.error.message : "tente novamente."}
            </p>
          )}
        </CardContent>
      </Card>

      <div>
        {mutation.data ? (
          <Results result={mutation.data} detailId={mutation.data.id} />
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center text-center py-20 text-muted-foreground">
              <Plug className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">A ligação recebida do provedor será auditada aqui.</p>
              <p className="text-xs mt-1">Cole a URL da gravação exposta pela API do contact center.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function ThreeCplusPanel() {
  const [apiToken, setApiToken] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [callId, setCallId] = useState("");

  const listMut = useMutation({
    mutationFn: () =>
      listThreeCplusCalls({
        data: {
          startDate: startDate.trim(),
          endDate: endDate.trim(),
          apiToken: apiToken.trim(),
        },
      }),
  });

  const analyzeMut = useMutation({
    mutationFn: (id: string) =>
      analyzeThreeCplusCall({ data: { callId: id, apiToken: apiToken.trim() } }),
  });

  const calls: ThreeCplusCall[] = listMut.data ?? [];
  const canList = startDate.trim().length > 0 && !listMut.isPending;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PhoneCall className="h-4 w-4 text-primary" /> 3C Plus — gravações de atendentes
          </CardTitle>
          <CardDescription>
            Conecta-se à API do discador 3C Plus (3C+ V2). Liste as ligações por período
            e audite a gravação com um clique — o servidor baixa o áudio, transcreve com o
            Mangaba Voz, mascara PII (LGPD) e roda a auditoria.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tc-token" className="flex items-center gap-1.5 text-xs">
              <KeyRound className="h-3.5 w-3.5 text-muted-foreground" /> API token{" "}
              <span className="text-muted-foreground font-normal">(opcional se THREECPLUS_API_TOKEN estiver no servidor)</span>
            </Label>
            <Input
              id="tc-token"
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder="api_token da 3C Plus"
              disabled={listMut.isPending || analyzeMut.isPending}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tc-start" className="text-xs">Data inicial</Label>
              <Input
                id="tc-start"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="2026-05-01 00:00:00"
                disabled={listMut.isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tc-end" className="text-xs">
                Data final <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Input
                id="tc-end"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="2026-05-31 23:59:59"
                disabled={listMut.isPending}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => listMut.mutate()} disabled={!canList}>
              {listMut.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Buscando…</>
              ) : (
                <><Search className="h-4 w-4" /> Listar ligações</>
              )}
            </Button>
          </div>
          {listMut.isError && (
            <p className="text-sm text-destructive">
              Erro ao listar: {listMut.error instanceof Error ? listMut.error.message : "tente novamente."}
            </p>
          )}

          {calls.length > 0 && (
            <div className="border rounded-md divide-y max-h-[360px] overflow-auto">
              {calls.map((c) => (
                <div key={c.id || c.sid} className="flex items-center justify-between gap-3 p-2.5 text-xs">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{c.agent || "Sem atendente"} · {c.number || "—"}</p>
                    <p className="text-muted-foreground truncate">
                      {c.callDate || "—"} · {c.campaign || c.queueName || "—"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!c.recorded || analyzeMut.isPending}
                    onClick={() => analyzeMut.mutate(c.id || c.sid)}
                  >
                    {analyzeMut.isPending && analyzeMut.variables === (c.id || c.sid) ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> …</>
                    ) : c.recorded ? "Analisar" : "Sem gravação"}
                  </Button>
                </div>
              ))}
            </div>
          )}
          {listMut.isSuccess && calls.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhuma ligação encontrada nesse período.</p>
          )}

          <div className="pt-2 border-t space-y-1.5">
            <Label htmlFor="tc-callid" className="flex items-center gap-1.5 text-xs">
              <PhoneCall className="h-3.5 w-3.5 text-muted-foreground" /> Analisar por ID/SID da ligação
            </Label>
            <div className="flex gap-2">
              <Input
                id="tc-callid"
                value={callId}
                onChange={(e) => setCallId(e.target.value)}
                placeholder="Ex.: 1234567 ou o SID da ligação"
                disabled={analyzeMut.isPending}
              />
              <Button
                onClick={() => analyzeMut.mutate(callId.trim())}
                disabled={callId.trim().length === 0 || analyzeMut.isPending}
              >
                {analyzeMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Analisar"}
              </Button>
            </div>
          </div>
          {analyzeMut.isError && (
            <p className="text-sm text-destructive">
              Erro ao analisar: {analyzeMut.error instanceof Error ? analyzeMut.error.message : "tente novamente."}
            </p>
          )}
        </CardContent>
      </Card>

      <div>
        {analyzeMut.data ? (
          <Results result={analyzeMut.data} detailId={analyzeMut.data.id} />
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center text-center py-20 text-muted-foreground">
              <PhoneCall className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">A gravação analisada da 3C Plus aparece aqui.</p>
              <p className="text-xs mt-1">Liste por período e clique em “Analisar”, ou informe o ID da ligação.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function AnalyzePage() {
  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <header>
        <h1 className="text-3xl font-display font-bold flex items-center gap-3">
          <Sparkles className="h-7 w-7 text-primary" />
          Análise de Ligação com IA
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Envie áudios em lote ou cole uma transcrição — os agentes de IA avaliam compliance,
          qualidade e sentimento.
        </p>
        <p className="text-xs text-muted-foreground mt-2 inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1 text-emerald-700 dark:text-emerald-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          Proteção LGPD automática: CPF, CNPJ, cartão, telefone e e-mail são mascarados antes de
          irem à IA, serem armazenados ou exibidos.
        </p>
      </header>

      <Tabs defaultValue="audio" className="w-full">
        <TabsList>
          <TabsTrigger value="audio" className="gap-1.5">
            <AudioLines className="h-4 w-4" /> Áudio em lote
          </TabsTrigger>
          <TabsTrigger value="texto" className="gap-1.5">
            <FileText className="h-4 w-4" /> Transcrição
          </TabsTrigger>
          <TabsTrigger value="3cplus" className="gap-1.5">
            <PhoneCall className="h-4 w-4" /> 3C Plus
          </TabsTrigger>
          <TabsTrigger value="api" className="gap-1.5">
            <Plug className="h-4 w-4" /> API de mercado
          </TabsTrigger>
        </TabsList>
        <TabsContent value="audio" className="mt-6">
          <AudioBatchPanel />
        </TabsContent>
        <TabsContent value="texto" className="mt-6">
          <TextPanel />
        </TabsContent>
        <TabsContent value="3cplus" className="mt-6">
          <ThreeCplusPanel />
        </TabsContent>
        <TabsContent value="api" className="mt-6">
          <MarketApiPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
