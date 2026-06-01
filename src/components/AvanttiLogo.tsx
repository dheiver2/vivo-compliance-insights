import { cn } from "@/lib/utils";

// Logomarca "AVANTTI CONSULTORIA" — wordmark recriado em texto para herdar a cor
// do contexto (cinza = currentColor) e manter o "TT" amarelo como acento da
// marca. O tamanho é controlado pelo font-size do elemento (use text-* ou
// className). `withTagline` mostra "CONSULTORIA" abaixo.
const AVANTTI_YELLOW = "#F7D23E";

export function AvanttiLogo({
  className,
  withTagline = false,
  title = "Avantti Consultoria",
}: {
  className?: string;
  withTagline?: boolean;
  title?: string;
}) {
  return (
    <span
      role="img"
      aria-label={title}
      className={cn("inline-flex flex-col items-center leading-none", className)}
    >
      <span className="font-display font-extrabold tracking-tight">
        AVAN<span style={{ color: AVANTTI_YELLOW }}>TT</span>I
      </span>
      {withTagline && (
        <span className="mt-1 text-[0.34em] font-semibold tracking-[0.42em] opacity-90">
          CONSULTORIA
        </span>
      )}
    </span>
  );
}
