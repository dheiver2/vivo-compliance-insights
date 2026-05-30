import { RefreshCw } from "lucide-react";

// Botão de atualizar padronizado, usado nas telas que carregam dados via
// react-query. Mostra spinner enquanto recarrega e o horário da última
// atualização no tooltip.
export function RefreshButton({
  onClick,
  busy = false,
  updatedAt,
}: {
  onClick: () => void;
  busy?: boolean;
  updatedAt?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title={
        updatedAt
          ? `Atualizado às ${new Date(updatedAt).toLocaleTimeString("pt-BR")}`
          : "Atualizar dados"
      }
      className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-secondary/40 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
      {busy ? "Atualizando…" : "Atualizar"}
    </button>
  );
}
