# Escutta — Auditoria de Ligações Vivo

Plataforma de **monitoria de voz com IA** para call center: audita ligações de
vendas e atendimento (operadora Vivo), gera scores de **compliance**,
**qualidade** e **sentimento**, e organiza esses resultados em dashboards,
fichas por ligação, ranking de atendentes, fila de coaching e relatórios
exportáveis.

O pipeline de IA é apresentado ao usuário sob a marca **Mangaba AI**
(Mangaba Compliance, Mangaba Voz, Mangaba Básico) — por baixo, roda sobre a
HuggingFace Inference (LLM + ASR), com fallback heurístico local quando a
transcrição/análise por IA está indisponível. As gravações vêm do discador
**3C Plus**.

Solução da Vivo, com consultoria **Avantti**.

## Stack

- **TanStack Start** (React 19 + Vite + SSR) com **TanStack Router** (rotas
  file-based em `src/routes`) e **TanStack Query**
- **TypeScript**
- **bun** como package manager e runtime de scripts (`bun.lock`, `bunfig.toml`)
- **shadcn/ui** (Radix UI + Tailwind CSS v4) para os componentes de interface
- **Recharts** para os gráficos do dashboard
- Conectado ao **Lovable** (pasta `.lovable/`) para edição visual assistida
- **HuggingFace Inference** para LLM (análise de compliance/qualidade) e ASR
  (transcrição de áudio)
- **3C Plus** como origem das gravações/ligações (discador de call center)
- Persistência via **Upstash Redis** (KV) em produção, com store local em
  `.data/` durante o desenvolvimento
- Deploy alvo: **Vercel** (`vercel.json`, preset Nitro `vercel`)

> Observação: apesar do nome do repositório sugerir Supabase, o código atual
> **não usa Supabase** — a persistência é feita via Upstash Redis (KV) /
> armazenamento local em dev, conforme `src/lib/server/calls-store.server.ts`.

## Funcionalidades por rota

| Rota | Arquivo | Descrição |
| --- | --- | --- |
| `/` | `src/routes/index.tsx` | Landing page pública (marca Escutta) com estatísticas reais carregadas no servidor e chamadas para auditar áudios ou abrir o dashboard. |
| `/login` | `src/routes/login.tsx` | Tela de acesso restrito por senha única (gate opcional via `APP_PASSWORD`). |
| `/dashboard` | `src/routes/dashboard.tsx` | Painel principal: KPIs (ligações auditadas, compliance médio, qualidade, alertas críticos, sentimento, cobertura de IA, FCR), abas Geral/Operacional/Comercial, evolução por hora/dia/semana/mês, distribuição por tema, scorecard agregado, componentes de IA em uso e tabela de ligações recentes. Atualização automática (polling a cada 15s) e auto-reparo que reprocessa auditorias quando detecta scorecard zerado. |
| `/audios` | `src/routes/audios.tsx` | Lista gravações da 3C Plus por período, aplica critérios de elegibilidade/auditabilidade, permite ouvir o áudio original, disparar auditoria individual ou em lote, e mostra o acervo de áudios já auditados com filtros (atendente, tema, status). |
| `/calls` | `src/routes/calls.index.tsx` | Lista de ligações auditadas, com filtros por status de revisão (assinadas, não assinadas, contestadas, contestação aberta) e busca. |
| `/calls/$callId` | `src/routes/calls.$callId.tsx` | Ficha de monitoria detalhada de uma ligação: transcrição, checklist de compliance com evidências, scores, assinatura/contestação da auditoria. |
| `/monitoring` | `src/routes/monitoring.tsx` | Redirecionamento para `/scorecards` (a gestão de critérios foi migrada para lá; mantido para não quebrar links salvos). |
| `/scorecards` | `src/routes/scorecards.tsx` | Gerenciamento dos critérios de avaliação (scorecard) usados pelos agentes Mangaba para pontuar cada ligação — cada item alimenta o prompt da IA e as médias do dashboard. |
| `/coaching` | `src/routes/coaching.tsx` | Fila de coaching priorizada por atendente (gap até a meta de compliance + peso de ligações críticas) e principais focos de melhoria do time, com base nos critérios do scorecard com pior média. |
| `/team` | `src/routes/team.index.tsx` | Ranking de desempenho por atendente (compliance, qualidade, sentimento, volume de ligações). |
| `/team/$agentName` | `src/routes/team.$agentName.tsx` | Perfil individual do atendente: evolução histórica, distribuição de scores e pontos de atenção. |
| `/agents` | `src/routes/agents.tsx` | Página institucional dos "agentes" de IA (Mangaba Compliance/Qualidade/Sentimento/Voz) e suas capacidades. |
| `/relatorios` | `src/routes/relatorios.tsx` | Exportação em CSV (client-side, com BOM UTF-8 e separador `;` compatível com Excel pt-BR) das ligações auditadas e do resumo de compliance. |
| `/settings` | `src/routes/settings.tsx` | Status do sistema (IA configurada, conexão 3C Plus), ingestão em lote de ligações da 3C Plus, teste de conexão, seed de dados de demonstração e limpeza da base. |

Além das rotas, vale destacar dois módulos de infraestrutura do produto:

- **LGPD / privacidade**: `src/lib/pii.ts` mascara CPF, CNPJ, cartão, e-mail e
  telefone nas transcrições antes de qualquer envio à IA ou persistência —
  "mascarar a mais" é a política padrão.
- **Auditabilidade**: `src/lib/auditability.ts` define os critérios que
  decidem se uma ligação tem "matéria-prima" suficiente (gravação, atendente,
  duração mínima, conteúdo mínimo pós-transcrição) para ser avaliada de forma
  justa — ligações sem esses requisitos (caixa postal, chamada sem atendente
  etc.) ficam em "Não elegíveis" e não são auditadas.

## Variáveis de ambiente

Todas as variáveis abaixo são lidas apenas no servidor. Veja `.env.example`
para o arquivo de referência (copie para `.env` e preencha localmente).

| Variável | Onde é usada | Propósito |
| --- | --- | --- |
| `HF_TOKEN` | `src/lib/api/analyze.functions.ts`, `src/lib/api/calls.functions.ts` | Token da HuggingFace Inference Providers. Sem ele, a análise de ligações (`/audios`, rota de análise) cai no fallback heurístico local ("Mangaba Básico"). |
| `HF_MODEL` | `src/lib/api/analyze.functions.ts`, `src/lib/api/calls.functions.ts` | Modelo de LLM usado para a análise de compliance/qualidade. Padrão: `meta-llama/Llama-3.1-8B-Instruct`. |
| `HF_ASR_MODEL` | `src/lib/api/analyze.functions.ts`, `src/lib/api/calls.functions.ts` | Modelo de ASR (transcrição de áudio). Padrão: `openai/whisper-large-v3-turbo`. |
| `THREECPLUS_API_TOKEN` | `src/lib/api/analyze.functions.ts` | Token de API do discador 3C Plus, usado para listar/baixar gravações e metadados de ligações. Pode ser sobrescrito por requisição (campo de token na UI de `/audios`) quando não definido no servidor. |
| `APP_PASSWORD` | `src/lib/server/auth.server.ts` | Senha única de acesso à plataforma. Se ausente, o gate de autenticação fica **desligado** (app aberto) — útil para ambientes de desenvolvimento. |
| `SIGN_SECRET` | `src/lib/server/auth.server.ts` | Segredo usado para gerar o hash irreversível (HMAC-SHA256) de identificadores como CPF ao assinar/contestar auditorias, sem reter o dado em claro (LGPD). Se ausente, usa `APP_PASSWORD` ou um valor padrão fixo — recomendado definir em produção. |
| `KV_REST_API_URL` / `UPSTASH_REDIS_REST_URL` | `src/lib/server/ai-cache.server.ts`, `src/lib/server/calls-store.server.ts` | URL REST do Upstash Redis usado como store persistente das ligações auditadas e cache de respostas de IA em produção. |
| `KV_REST_API_TOKEN` / `UPSTASH_REDIS_REST_TOKEN` | `src/lib/server/ai-cache.server.ts`, `src/lib/server/calls-store.server.ts` | Token de acesso ao mesmo Upstash Redis. |
| `NODE_ENV` | `src/lib/server/auth.server.ts`, `src/lib/config.server.ts` | Padrão do Node/Vite; usado para decidir, por exemplo, se o cookie de sessão é `secure`. |
| `SHOOT_BASE`, `SHOOT_PASSWORD` | `scripts/shoot.mjs` | Configuração do script utilitário de captura de screenshots (URL base e senha do gate), não usado em runtime da aplicação. |

Sem `KV_REST_API_URL`/token configurados, o store de ligações cai para
persistência local em `.data/` (não versionada) — adequado para
desenvolvimento, mas não para produção.

## Como rodar localmente

Pré-requisito: [bun](https://bun.sh) instalado.

```bash
# instalar dependências
bun install

# copiar o exemplo de variáveis de ambiente e preencher conforme necessário
cp .env.example .env

# subir o servidor de desenvolvimento (Vite dev + SSR)
bun run dev

# checar lint (ESLint)
bun run lint

# build de produção (Vite build + ajuste do runtime da Vercel)
bun run build

# servir o build de produção localmente
bun run preview

# formatar o código (Prettier)
bun run format
```

Sem `HF_TOKEN`/`THREECPLUS_API_TOKEN` configurados, a aplicação continua
funcional: a análise usa o fallback heurístico local ("Mangaba Básico") e a
listagem de gravações da 3C Plus falha de forma controlada (mensagem de erro
pedindo o token). Em `/settings` é possível popular dados de demonstração
(seed) para explorar o dashboard sem depender de integrações externas.
