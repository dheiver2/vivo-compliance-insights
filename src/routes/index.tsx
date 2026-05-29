import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Headphones,
  Sparkles,
  ShieldCheck,
  Bot,
  FileCheck,
  Phone,
  ArrowRight,
  Gauge,
  Lock,
  Check,
  X,
} from "lucide-react";
import { VivoLogo } from "@/components/VivoLogo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VoiceAudit · Auditoria de Ligações com IA · Vivo" },
      {
        name: "description",
        content:
          "Plataforma de compliance e qualidade de ligações com agentes de IA. Audite 100% das chamadas em tempo real.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: ShieldCheck,
    title: "Compliance regulatório",
    desc: "Verificação automática de identificação, aviso de gravação, consentimento LGPD e comunicação de custos em cada ligação.",
  },
  {
    icon: Sparkles,
    title: "Análise por IA",
    desc: "Os modelos Mangaba AI avaliam transcrições e geram scores de compliance, qualidade e sentimento.",
  },
  {
    icon: Gauge,
    title: "Score em tempo real",
    desc: "Dashboards com evolução semanal, distribuição por tema e alertas críticos atualizados ao vivo.",
  },
  {
    icon: Bot,
    title: "Agentes especializados",
    desc: "Os agentes Mangaba Compliance, Mangaba Qualidade e Mangaba Sentimento trabalham em paralelo em cada gravação.",
  },
  {
    icon: FileCheck,
    title: "Ficha de monitoria",
    desc: "Relatório detalhado por chamada com evidências, trechos relevantes e severidade das observações.",
  },
  {
    icon: Lock,
    title: "Privacidade por padrão",
    desc: "Tokens e dados sensíveis tratados no servidor — nada de segredos no navegador.",
  },
];

const steps = [
  {
    n: "01",
    title: "Capture a transcrição",
    desc: "Cole ou integre a transcrição da ligação na plataforma.",
  },
  {
    n: "02",
    title: "A IA audita",
    desc: "Os agentes avaliam a checklist regulatória e a qualidade do atendimento.",
  },
  {
    n: "03",
    title: "Decida com dados",
    desc: "Receba scores, observações e alertas para agir sobre cada atendimento.",
  },
];

const stats = [
  { value: "12.847", label: "Ligações auditadas" },
  { value: "84,6%", label: "Compliance médio" },
  { value: "4", label: "Agentes de IA ativos" },
  { value: "100%", label: "Cobertura das chamadas" },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]">
              <Headphones className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold">VoiceAudit</div>
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                por <VivoLogo className="h-2.5 text-primary" /> · Compliance
              </div>
            </div>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#recursos" className="hover:text-foreground transition-colors">
              Recursos
            </a>
            <a href="#como-funciona" className="hover:text-foreground transition-colors">
              Como funciona
            </a>
            <Link to="/dashboard" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>
          </nav>
          <Link
            to="/analyze"
            className="inline-flex items-center gap-1.5 rounded-md bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-medium text-primary-foreground shadow-[var(--shadow-glow)] transition-transform hover:scale-[1.03]"
          >
            Testar IA <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[image:var(--gradient-dark)]" />
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary-glow/30 blur-3xl" />
        <div className="absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 py-24 text-center md:py-32">
          <div className="mx-auto mb-8 flex flex-col items-center gap-3">
            <VivoLogo className="h-16 w-auto text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.35)] md:h-24" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-white/60">
              Compliance &amp; Qualidade
            </span>
          </div>
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/80 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" /> Powered by Mangaba AI · LLMs de última geração
          </div>
          <h1 className="mx-auto max-w-3xl font-display text-4xl font-bold leading-tight text-white md:text-6xl">
            Audite{" "}
            <span className="bg-gradient-to-r from-white to-primary-glow bg-clip-text text-transparent">
              100% das ligações
            </span>{" "}
            com inteligência artificial
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-white/70 md:text-lg">
            A plataforma de compliance e qualidade da Vivo que transforma cada chamada em insights
            acionáveis — scores regulatórios, qualidade do atendimento e sentimento do cliente, em
            segundos.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/analyze"
              className="inline-flex items-center gap-2 rounded-md bg-white px-6 py-3 text-sm font-semibold text-primary shadow-lg transition-transform hover:scale-[1.03]"
            >
              <Sparkles className="h-4 w-4" /> Analisar uma ligação
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-md border border-white/25 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/10"
            >
              Ver dashboard <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-10 flex items-center justify-center gap-2 text-xs uppercase tracking-widest text-white/50">
            uma solução <VivoLogo className="h-4 text-white/80" />
          </div>

          <div className="mx-auto mt-16 grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="bg-[oklch(0.18_0.05_290)] px-4 py-6">
                <div className="font-display text-2xl font-bold text-white md:text-3xl">
                  {s.value}
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-wider text-white/50">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="recursos" className="mx-auto max-w-6xl px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            Recursos
          </span>
          <h2 className="mt-2 font-display text-3xl font-bold md:text-4xl">
            Tudo que sua operação precisa para auditar com confiança
          </h2>
          <p className="mt-3 text-muted-foreground">
            Da captura à decisão, a IA cobre cada etapa do ciclo de monitoria.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-xl border border-border/60 bg-card p-6 transition-shadow hover:shadow-[var(--shadow-elegant)]"
            >
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)]">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="como-funciona" className="border-y border-border/60 bg-secondary/40">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">
              Como funciona
            </span>
            <h2 className="mt-2 font-display text-3xl font-bold md:text-4xl">
              Três passos para uma auditoria completa
            </h2>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="relative rounded-xl border border-border/60 bg-card p-6">
                <div className="font-display text-5xl font-bold text-primary/15">{s.n}</div>
                <h3 className="mt-2 font-display text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI highlight */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">
              Análise de IA
            </span>
            <h2 className="mt-2 font-display text-3xl font-bold md:text-4xl">
              Compliance avaliado por modelos de linguagem
            </h2>
            <p className="mt-4 text-muted-foreground">
              Cole a transcrição de uma ligação e receba, em segundos, uma ficha de monitoria
              completa gerada pela Mangaba AI.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "Checklist regulatória com evidências por item",
                "Score de compliance e qualidade de 0 a 100",
                "Detecção de sentimento e pontos de atrito",
                "Mangaba Básico local quando offline",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <Link
              to="/analyze"
              className="mt-8 inline-flex items-center gap-2 rounded-md bg-[image:var(--gradient-primary)] px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition-transform hover:scale-[1.03]"
            >
              <Sparkles className="h-4 w-4" /> Experimentar agora
            </Link>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-[var(--shadow-elegant)]">
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Bot className="h-4 w-4 text-primary" /> Resultado da análise
              </div>
              <span className="rounded-full border border-warning/40 bg-warning/20 px-2.5 py-0.5 text-xs font-medium text-warning-foreground">
                Atenção
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border/60 p-4 text-center">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Compliance
                </div>
                <div className="mt-1 font-display text-4xl font-bold text-warning-foreground">
                  71%
                </div>
              </div>
              <div className="rounded-lg border border-border/60 p-4 text-center">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Qualidade
                </div>
                <div className="mt-1 font-display text-4xl font-bold text-warning-foreground">
                  68%
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              {[
                { label: "Identificação do atendente", ok: true },
                { label: "Gravação informada ao cliente", ok: false },
                { label: "Consentimento LGPD", ok: false },
                { label: "Resumo final e protocolo", ok: true },
              ].map((c) => (
                <div
                  key={c.label}
                  className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2"
                >
                  <span>{c.label}</span>
                  {c.ok ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <X className="h-4 w-4 text-destructive" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-20">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-[image:var(--gradient-primary)] px-6 py-16 text-center shadow-[var(--shadow-elegant)]">
          <div className="absolute -top-16 -right-10 h-56 w-56 rounded-full bg-white/15 blur-3xl" />
          <h2 className="relative font-display text-3xl font-bold text-primary-foreground md:text-4xl">
            Pronto para auditar com inteligência?
          </h2>
          <p className="relative mx-auto mt-3 max-w-xl text-primary-foreground/80">
            Comece agora analisando uma ligação ou explore o painel de monitoria completo.
          </p>
          <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/analyze"
              className="inline-flex items-center gap-2 rounded-md bg-white px-6 py-3 text-sm font-semibold text-primary shadow-lg transition-transform hover:scale-[1.03]"
            >
              <Sparkles className="h-4 w-4" /> Analisar ligação
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-md border border-white/40 px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-white/10"
            >
              <Phone className="h-4 w-4" /> Abrir dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[image:var(--gradient-primary)]">
              <Headphones className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display font-semibold text-foreground">VoiceAudit</span>
            <span className="flex items-center gap-1">
              · uma solução <VivoLogo className="h-3 text-primary" />
            </span>
          </div>
          <p>Demonstração · dados fictícios para fins de avaliação.</p>
        </div>
      </footer>
    </div>
  );
}
