import { useState } from "react";
import { useNavigate, useRouter, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, Search, Settings, AlertTriangle, CheckCircle2 } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getDashboard } from "@/lib/api/calls.functions";
import type { DashboardData, StoredCall } from "@/lib/server/calls-store.server";

// Notificações = ligações com status crítico (dado real do dashboard).
function useCriticalCalls(): StoredCall[] {
  const { data } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: () => getDashboard(),
    refetchOnWindowFocus: true,
  });
  return (data?.recentCalls ?? []).filter((c) => c.status === "critical");
}

export function AppHeader() {
  const navigate = useNavigate();
  const router = useRouter();
  const [term, setTerm] = useState("");
  const critical = useCriticalCalls();

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = term.trim();
    navigate({ to: "/calls", search: q ? { q } : { q: undefined } });
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md">
      <SidebarTrigger />

      <form onSubmit={submitSearch} className="flex items-center gap-2 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar ligações, protocolos, temas…"
            className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
      </form>

      <div className="ml-auto flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative rounded-md p-2 hover:bg-muted" aria-label="Notificações">
              <Bell className="h-4 w-4" />
              {critical.length > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Alertas de compliance</span>
              {critical.length > 0 && <span className="text-xs text-destructive">{critical.length} crítico(s)</span>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {critical.length === 0 ? (
              <div className="flex items-center gap-2 px-2 py-6 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Nenhum alerta crítico no momento.
              </div>
            ) : (
              critical.slice(0, 6).map((c) => (
                <DropdownMenuItem key={c.id} asChild>
                  <Link to="/calls/$callId" params={{ callId: c.id }} className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{c.label}</span>
                      <span className="block text-xs text-muted-foreground">{c.protocol} · compliance {c.scoreCompliance}%</span>
                    </span>
                  </Link>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md p-1 hover:bg-muted" aria-label="Conta">
              <div className="h-8 w-8 rounded-full bg-[image:var(--gradient-primary)] flex items-center justify-center text-xs font-semibold text-primary-foreground">SR</div>
              <div className="text-xs leading-tight hidden sm:block text-left">
                <div className="font-semibold">Supervisor RH</div>
                <div className="text-muted-foreground">Vivo · São Paulo</div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Supervisor RH</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" /> Configurações
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.invalidate()}>
              <Bell className="h-4 w-4 mr-2" /> Atualizar dados
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
