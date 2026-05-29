import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";
import { analyzeCall } from "@/lib/api/analyze.functions";
import { SAMPLE_TRANSCRIPT, statusFromScore, type CallAnalysis } from "@/lib/compliance";
import { Sparkles, Wand2, FileText, CheckCircle2, XCircle, Cpu, Loader2, Smile, Meh, Frown } from "lucide-react";

export const Route = createFileRoute("/analyze")({
  head: () => ({
    meta: [
      { title: "Análise IA · VoiceAudit" },
      { name: "description", content: "Analise transcrições de ligações com IA da HuggingFace." },
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

function Results({ result }: { result: CallAnalysis }) {
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
                {result.source === "huggingface"
                  ? `HuggingFace · ${result.model}`
                  : "Análise heurística local"}
              </CardDescription>
            </div>
            <div className={`flex items-center gap-2 ${Sent.cls}`}>
              <Sent.icon className="h-5 w-5" />
              <span className="text-sm font-semibold">{Sent.label}</span>
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

function AnalyzePage() {
  const [transcript, setTranscript] = useState("");
  const mutation = useMutation({
    mutationFn: (text: string) => analyzeCall({ data: { transcript: text } }),
  });

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <header>
        <h1 className="text-3xl font-display font-bold flex items-center gap-3">
          <Sparkles className="h-7 w-7 text-primary" />
          Análise de Ligação com IA
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cole a transcrição de uma ligação e os agentes de IA avaliam compliance, qualidade e sentimento.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Transcrição
            </CardTitle>
            <CardDescription>Texto da gravação a ser auditada</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
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
            <Results result={mutation.data} />
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
    </div>
  );
}
