import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// Recuperação automática de "chunk load error" após deploy. Quando a aba fica
// aberta atravessando um novo deploy, os chunks lazy antigos passam a retornar
// 404 (assets hashados são imutáveis e o hash muda a cada build) e a navegação
// client-side falha — deixando telas presas em "carregando…". O Vite dispara
// `vite:preloadError` quando o import dinâmico de um módulo falha; nesse caso
// recarregamos a página uma única vez para buscar o HTML novo (que já aponta
// para os chunks atuais). O guard de 10s evita laço de reload.
if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    const KEY = "chunk-reload-at";
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last > 10_000) {
      sessionStorage.setItem(KEY, String(Date.now()));
      window.location.reload();
    }
  });
}

export const getRouter = () => {
  // Plataforma autônoma: todas as telas que leem dados se atualizam sozinhas.
  // - refetchInterval: re-busca periódica (números acompanham novas ligações sem
  //   ação humana). Não roda com a aba em segundo plano para poupar recursos.
  // - refetchOnWindowFocus/Reconnect: revalida ao voltar à aba ou reconectar.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchInterval: 30_000,
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        staleTime: 15_000,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
