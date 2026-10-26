import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { detectPlatform, type Platform } from "@/lib/platform";

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

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const guides: { id: Platform; title: string; steps: string[] }[] = [
  { id: "android", title: "Android", steps: ["Abre NEXO en Chrome.", "Pulsa el botón «Instalar» de esta página o el menú ⋮.", "Elige «Instalar aplicación» o «Añadir a pantalla de inicio»."] },
  { id: "ios", title: "iPhone y iPad", steps: ["Abre NEXO en Safari.", "Pulsa el botón Compartir (cuadrado con flecha).", "Elige «Añadir a pantalla de inicio» y confirma."] },
  { id: "windows", title: "Windows", steps: ["Abre NEXO en Edge o Chrome.", "Pulsa el icono de instalar en la barra de direcciones, o el botón de esta página.", "Confirma «Instalar»."] },
  { id: "macos", title: "macOS", steps: ["En Chrome o Edge: icono de instalar en la barra de direcciones.", "En Safari (macOS 14+): Archivo › «Añadir al Dock»."] },
  { id: "linux", title: "Linux y otros", steps: ["Abre NEXO en Chrome, Chromium o Edge.", "Usa el icono de instalar de la barra de direcciones o el menú del navegador.", "Firefox no permite instalar apps web: puedes seguir usando NEXO en el navegador."] },
];

function Instalar() {
  const [platform, setPlatform] = useState<Platform>("other");
  const [installed, setInstalled] = useState(false);
  const [prompt, setPrompt] = useState<BIPEvent | null>(null);

  useEffect(() => {
    setPlatform(detectPlatform(navigator.userAgent, navigator.maxTouchPoints));
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true);
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as BIPEvent); };
    const onInstalled = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
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
          ) : prompt ? (
            <button
              onClick={async () => { await prompt.prompt(); await prompt.userChoice; setPrompt(null); }}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Instalar NEXO ahora
            </button>
          ) : (
            <p className="text-sm text-muted-foreground">Tu navegador no ofrece instalación directa desde aquí. Sigue los pasos para tu sistema.</p>
          )}
        </div>

        <div className="mt-8 space-y-4">
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
        </div>
      </section>
    </SiteLayout>
  );
}
