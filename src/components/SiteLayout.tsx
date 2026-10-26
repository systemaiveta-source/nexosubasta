import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import logo from "@/assets/nexo-logo.png.asset.json";

const nav = [
  { to: "/ayuda", label: "Ayuda" },
  { to: "/instalar", label: "Instalar app" },
] as const;

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <div className="flex h-1">
        <span className="flex-1 bg-nexo-red" />
        <span className="flex-1 bg-nexo-blue" />
        <span className="flex-1 bg-nexo-yellow" />
        <span className="flex-1 bg-nexo-green" />
      </div>
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" aria-label="NEXO, inicio">
            <img src={logo.url} alt="NEXO" className="h-8 w-auto" />
          </Link>
          <nav className="flex items-center gap-1 text-sm font-medium">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="rounded-md px-3 py-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "text-foreground" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border bg-secondary/50">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} NEXO</p>
          <div className="flex flex-wrap gap-4">
            <Link to="/normas" className="hover:text-foreground">Normas</Link>
            <Link to="/privacidad" className="hover:text-foreground">Privacidad</Link>
            <Link to="/condiciones" className="hover:text-foreground">Condiciones de uso</Link>
            <Link to="/ayuda" className="hover:text-foreground">Ayuda</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <SiteLayout>
      <article className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Borrador preliminar — pendiente de revisión legal antes del lanzamiento.</p>
        <div className="mt-8 space-y-6 leading-relaxed [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
          {children}
        </div>
      </article>
    </SiteLayout>
  );
}
