import type { CallStatus } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const map: Record<CallStatus, { label: string; cls: string }> = {
  approved: { label: "Aprovado", cls: "bg-success/15 text-success border-success/30" },
  warning: { label: "Atenção", cls: "bg-warning/20 text-warning-foreground border-warning/40" },
  critical: { label: "Crítico", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  processing: { label: "Processando", cls: "bg-primary/10 text-primary border-primary/30 animate-pulse" },
};

export function StatusBadge({ status }: { status: CallStatus }) {
  const { label, cls } = map[status];
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", cls)}>
      {label}
    </span>
  );
}
