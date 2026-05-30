import { useState } from "react";
import { createFileRoute, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { Headphones, Lock, Loader2, ArrowRight, ShieldCheck } from "lucide-react";
import { VivoLogo } from "@/components/VivoLogo";
import { getAuthStatus, login } from "@/lib/api/auth.functions";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Entrar · VoiceAudit" }],
  }),
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  // Se já está logado (ou o gate está desligado), não faz sentido mostrar login.
  beforeLoad: async ({ search }) => {
    const status = await getAuthStatus();
    if (!status.gateEnabled || status.authed) {
      throw redirect({ to: (search.redirect as string) || "/dashboard" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const { redirect: redirectTo } = Route.useSearch();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || loading) return;
    setLoading(true);
    setError(false);
    try {
      const res = await login({ data: { password } });
      if (res.ok) {
        await router.invalidate();
        navigate({ to: redirectTo || "/dashboard" });
      } else {
        setError(true);
        setPassword("");
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 text-foreground">
      <div className="absolute inset-0 bg-[image:var(--gradient-dark)]" />
      <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary-glow/30 blur-3xl" />
      <div className="absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]">
            <Headphones className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <div className="font-display text-xl font-bold text-white">VoiceAudit</div>
            <div className="mt-1 flex items-center justify-center gap-1 text-[10px] uppercase tracking-[0.3em] text-white/60">
              por <VivoLogo className="h-2.5 text-white" /> · Compliance
            </div>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-white/10 bg-card/90 p-6 shadow-[var(--shadow-elegant)] backdrop-blur"
        >
          <h1 className="font-display text-lg font-semibold">Acesso restrito</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Informe a senha de acesso à plataforma de auditoria.
          </p>

          <label className="mt-6 block text-xs font-medium text-muted-foreground" htmlFor="password">
            Senha
          </label>
          <div className="relative mt-1.5">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="password"
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(false);
              }}
              placeholder="••••••••"
              className={`w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-1 ${
                error
                  ? "border-destructive focus:border-destructive focus:ring-destructive"
                  : "border-border focus:border-primary focus:ring-primary"
              }`}
            />
          </div>
          {error && (
            <p className="mt-2 text-xs text-destructive">Senha incorreta. Tente novamente.</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[image:var(--gradient-primary)] px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Entrando…
              </>
            ) : (
              <>
                Entrar <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          <div className="mt-5 flex items-center gap-2 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-success" />
            Sessão protegida por cookie httpOnly — a senha nunca fica no navegador.
          </div>
        </form>
      </div>
    </div>
  );
}
