import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshButton } from "@/components/RefreshButton";
import { listCalls, getDashboard } from "@/lib/api/calls.functions";
import type { StoredCall, DashboardData } from "@/lib/server/calls-store.server";
import { FileSpreadsheet, Loader2, Download, Phone, BarChart3, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios · VoiceAudit" },
      {
        name: "description",
        content: "Exporte as ligações auditadas e o resumo de compliance em CSV.",
      },
    ],
  }),
  component: RelatoriosPage,
});

// --- Geração de CSV (client-side, a partir dos dados reais já carregados) -----

// Escapa um campo no padrão CSV (RFC 4180): aspas duplas quando há separador,
// aspas ou quebra de linha. Usa ";" como separador (compatível com Excel pt-BR).
function csvCell(value: string | number): string {
  const s = String(value ?? "");
  if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers, ...rows].map((cols) => cols.map(csvCell).join(";"));
  // BOM UTF-8 (U+FEFF) para o Excel reconhecer acentos corretamente.
  const BOM = String.fromCharCode(0xfeff);
  return BOM + lines.join("\r\n");
}

function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function RelatoriosPage() {
  const callsQ = useQuery<StoredCall[]>({
    queryKey: ["calls"],
    queryFn: () => listCalls(),
    refetchOnWindowFocus: true,
  });
  const dashQ = useQuery<DashboardData>({
    queryKey: ["dashboard", "day"],
    queryFn: () => getDashboard({ data: { granularity: "day" } }),
    refetchOnWindowFocus: true,
  });

  const isLoading = callsQ.isLoading || dashQ.isLoading;
  const calls = callsQ.data ?? [];
  const dash = dashQ.data;
  const hasData = calls.length > 0;

  function exportCalls() {
    if (!calls.length) return;
    const headers = [
      "ID",
      "Protocolo",
      "Data/hora",
      "Origem",
      "Atendente",
      "Tema",
      "Compliance (%)",
      "Qualidade (%)",
      "Sentimento",
      "Status",
      "Modelo",
      "Resumo",
    ];
    const rows = calls.map((c) => [
      c.id,
      c.protocol,
      new Date(c.createdAt).toLocaleString("pt-BR"),
      c.origin,
      c.agentName,
      c.topic,
      c.scoreCompliance,
      c.scoreQuality,
      c.sentiment,
      c.status,
      c.model,
      c.summary,
    ]);
    downloadCsv(`voiceaudit-ligacoes-${stamp()}.csv`, toCsv(headers, rows));
    toast.success(`${calls.length} ligação(ões) exportada(s) em CSV.`);
  }

  function exportCompliance() {
    if (!dash) return;
    const rows: (string | number)[][] = dash.complianceItems.map((c) => [c.label, c.score]);
    downloadCsv(
      `voiceaudit-compliance-${stamp()}.csv`,
      toCsv(["Critério do scorecard", "Média (%)"], rows),
    );
    toast.success("Resumo de compliance exportado em CSV.");
  }

  function exportTopics() {
    if (!dash) return;
    const rows: (string | number)[][] = dash.topicDistribution.map((t) => [t.name, t.value]);
    downloadCsv(`voiceaudit-temas-${stamp()}.csv`, toCsv(["Tema", "Ligações"], rows));
    toast.success("Distribuição por tema exportada em CSV.");
  }

  return (
    <div className="space-y-6 max-w-[1100px] mx-auto">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-3">
            <FileSpreadsheet className="h-7 w-7 text-primary" />
            Relatórios
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Exporte as ligações auditadas e os resumos de compliance em CSV (abre no Excel).
          </p>
        </div>
        <RefreshButton
          onClick={() => {
            callsQ.refetch();
            dashQ.refetch();
          }}
          busy={callsQ.isFetching || dashQ.isFetching}
          updatedAt={callsQ.dataUpdatedAt}
        />
      </header>

      {isLoading && (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {!isLoading && !hasData && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center text-center py-24 text-muted-foreground">
            <FileSpreadsheet className="h-12 w-12 mb-4 opacity-40" />
            <p className="text-base font-medium text-foreground">Nada para exportar ainda</p>
            <p className="text-sm mt-1">
              Importe as ligações reais da 3C Plus em Configurações — os relatórios são gerados a
              partir das auditorias.
            </p>
            <Link
              to="/settings"
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Download className="h-4 w-4" /> Importar ligações da 3C Plus
            </Link>
          </CardContent>
        </Card>
      )}

      {!isLoading && hasData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Phone className="h-4 w-4 text-primary" /> Ligações auditadas
              </CardTitle>
              <CardDescription>
                {calls.length} ligação(ões) com score, status, tema e resumo.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button className="w-full" onClick={exportCalls}>
                <Download className="h-4 w-4 mr-2" /> Exportar CSV
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-primary" /> Compliance por critério
              </CardTitle>
              <CardDescription>
                Média de cada item do scorecard ({dash?.complianceItems.length ?? 0} critérios).
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button
                variant="outline"
                className="w-full"
                onClick={exportCompliance}
                disabled={!dash?.complianceItems.length}
              >
                <Download className="h-4 w-4 mr-2" /> Exportar CSV
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-primary" /> Distribuição por tema
              </CardTitle>
              <CardDescription>
                Volume de ligações por tema ({dash?.topicDistribution.length ?? 0} temas).
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button
                variant="outline"
                className="w-full"
                onClick={exportTopics}
                disabled={!dash?.topicDistribution.length}
              >
                <Download className="h-4 w-4 mr-2" /> Exportar CSV
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
