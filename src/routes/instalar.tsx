import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { detectPlatform, type Platform } from "@/lib/platform";
import { useInstall } from "@/lib/install";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/instalar")({
  head: () => ({
    meta: [
      { title: "Instalar NEXO en tu dispositivo" },
      { name: "description", content: "Instrucciones para añadir NEXO como app en Android, iPhone, iPad, Windows, macOS y Linux." },
      { property: "og:title", content: "Instalar NEXO" },
      { property: "og:description", content: "Añade NEXO a tu pantalla de inicio o escritorio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Instalar,
});

const guides: { id: Platform; title: string; steps: string[] }[] = [
  { id: "android", title: "Android", steps: ["Abre NEXO en Chrome.", "Pulsa el botón «Instalar» de esta página o el menú ⋮.", "Elige «Instalar aplicación» o «Añadir a pantalla de inicio»."] },
  { id: "ios", title: "iPhone y iPad", steps: ["Abre NEXO en Safari.", "Pulsa el botón Compartir (cuadrado con flecha).", "Elige «Añadir a pantalla de inicio» y confirma."] },
  { id: "windows", title: "Windows", steps: ["Abre NEXO en Edge o Chrome.", "Pulsa el icono de instalar en la barra de direcciones, o el botón de esta página.", "Confirma «Instalar»."] },
  { id: "macos", title: "macOS", steps: ["En Chrome o Edge: icono de instalar en la barra de direcciones.", "En Safari (macOS 14+): Archivo › «Añadir al Dock»."] },
  { id: "linux", title: "Linux y otros", steps: ["Abre NEXO en Chrome, Chromium o Edge.", "Usa el icono de instalar de la barra de direcciones o el menú del navegador.", "Firefox no permite instalar apps web: puedes seguir usando NEXO en el navegador."] },
];

function Instalar() {
  const [platform, setPlatform] = useState<Platform>("other");
  const { installed, available, install } = useInstall();

  useEffect(() => {
    setPlatform(detectPlatform(navigator.userAgent, navigator.maxTouchPoints));
  }, []);

  const ordered = [...guides].sort((a, b) => (a.id === platform ? -1 : b.id === platform ? 1 : 0));

  return (
    <SiteLayout>
      <section className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Instala NEXO</h1>
        <p className="mt-3 text-muted-foreground">Es opcional: puedes usar NEXO desde el navegador sin instalar nada.</p>

        <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-soft">
          {installed ? (
            <p className="font-medium text-nexo-green">NEXO ya está instalado en este dispositivo.</p>
          ) : available ? (
            <Button onClick={install}>
              Instalar NEXO ahora
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Tu navegador no ofrece instalación directa desde aquí. Sigue los pasos para tu sistema.</p>
          )}
        </div>

        {!installed && <div className="mt-8 space-y-4">
          {ordered.map((g) => (
            <div key={g.id} className={`rounded-xl border p-5 ${g.id === platform ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
              <h2 className="font-display text-lg font-semibold">
                {g.title} {g.id === platform && <span className="ml-2 text-xs font-medium text-primary">Tu dispositivo</span>}
              </h2>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
                {g.steps.map((s) => <li key={s}>{s}</li>)}
              </ol>
            </div>
          ))}
        </div>}
      </section>
    </SiteLayout>
  );
}
