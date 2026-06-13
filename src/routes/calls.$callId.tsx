import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { CallFicha } from "@/components/CallFicha";
import { getCall } from "@/lib/api/calls.functions";
import type { StoredCall } from "@/lib/server/calls-store.server";
import { ArrowLeft, Loader2, Search } from "lucide-react";

export const Route = createFileRoute("/calls/$callId")({
  head: () => ({ meta: [{ title: "Detalhe da ligação · Escutta" }] }),
  component: CallDetailPage,
});

function CallDetailPage() {
  const { callId } = Route.useParams();
  const { data, isLoading } = useQuery<StoredCall | null>({
    queryKey: ["call", callId],
    queryFn: () => getCall({ data: { id: callId } }),
  });

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <Link
        to="/calls"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para Ligações
      </Link>

      {isLoading && (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {data === null && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center text-center py-24 text-muted-foreground">
            <Search className="h-12 w-12 mb-4 opacity-40" />
            <p className="text-base font-medium text-foreground">Ligação não encontrada</p>
            <p className="text-sm mt-1">
              O registro <span className="font-mono">{callId}</span> não existe ou foi removido.
            </p>
            <Link
              to="/calls"
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Ver todas as ligações
            </Link>
          </CardContent>
        </Card>
      )}

      {data && <CallFicha call={data} />}
    </div>
  );
}
