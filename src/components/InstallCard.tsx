import { Link } from "@tanstack/react-router";
import { Download, BadgeCheck } from "lucide-react";
import { useInstall } from "@/lib/install";
import { Button } from "@/components/ui/button";

// Tarjeta de instalación PWA: un toque abre el diálogo nativo de instalación
// sin salir de la app ni perder la sesión. Usa el icono oficial del manifiesto.
export function InstallCard() {
  const { installed, available, install } = useInstall();

  if (installed) return null;

  return (
    <div className="mx-auto flex max-w-md items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left shadow-soft">
      <img
        src="/icons/icon-192.png"
        alt="Icono oficial de NEXO"
        className="h-14 w-14 rounded-xl"
      />
      <div className="min-w-0 flex-1">
        <p className="font-display text-base font-semibold text-foreground">
          Instala la app NEXO
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {available
            ? "Un toque y queda en tu pantalla de inicio, con el icono oficial."
            : "Añádela a tu pantalla de inicio con el icono oficial."}
        </p>
      </div>
      {available ? (
        <Button onClick={install} className="shrink-0 gap-2">
          <Download className="h-4 w-4" />
          Instalar
        </Button>
      ) : (
        <Button asChild variant="outline" className="shrink-0 gap-2">
          <Link to="/instalar">
            <BadgeCheck className="h-4 w-4" />
            Cómo instalar
          </Link>
        </Button>
      )}
    </div>
  );
}
