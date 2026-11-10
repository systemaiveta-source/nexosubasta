import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bell, Menu, X } from "lucide-react";
import logo from "@/assets/nexo-logo.png.asset.json";
import { useAuth, useRoles, signOut } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useInstall } from "@/lib/install";

function useUnread(userId: string | undefined) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["unread", userId],
    enabled: !!userId,
    refetchInterval: 30000,
    queryFn: async () => {
      if (!userId) return 0;
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("read", false);
      if (error) throw error;
      return count ?? 0;
    },
  });
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`notif-${userId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ["unread", userId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, qc]);
  return q.data ?? 0;
}

const linkCls =
  "rounded-md px-3 py-2 text-muted-foreground hover:bg-secondary hover:text-foreground";

export function SiteLayout({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const { isStaff } = useRoles();
  const unread = useUnread(user?.id);
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const installation = useInstall();

  const links = (
    <>
      <Link to="/subastas" className={linkCls} activeProps={{ className: "text-foreground" }}>
        Subastas
      </Link>
      {user && (
        <Link to="/panel" className={linkCls} activeProps={{ className: "text-foreground" }}>
          Mis ofertas
        </Link>
      )}
      {user && (
        <Link to="/perfil" className={linkCls} activeProps={{ className: "text-foreground" }}>
          Mis publicaciones
        </Link>
      )}
      {user && (
        <Link to="/vendedor" className={linkCls} activeProps={{ className: "text-foreground" }}>
          Subastar
        </Link>
      )}
      {user && (
        <Link to="/operaciones" className={linkCls} activeProps={{ className: "text-foreground" }}>
          Operaciones
        </Link>
      )}
      {isStaff && (
        <Link to="/admin" className={linkCls} activeProps={{ className: "text-foreground" }}>
          Administración
        </Link>
      )}
      {user && (
        <Link to="/perfil" className={linkCls} activeProps={{ className: "text-foreground" }}>
          Perfil
        </Link>
      )}
    </>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <div className="flex h-1">
        <span className="flex-1 bg-nexo-red" />
        <span className="flex-1 bg-nexo-blue" />
        <span className="flex-1 bg-nexo-yellow" />
        <span className="flex-1 bg-nexo-green" />
      </div>
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4">
          <Link to="/" aria-label="NEXO, inicio" className="shrink-0">
            <img src={logo.url} alt="NEXO" className="h-8 w-auto" />
          </Link>
          <nav className="hidden items-center gap-1 text-sm font-medium lg:flex">{links}</nav>
          <div className="flex items-center gap-1">
            {user && (
              <Link
                to="/notificaciones"
                className="relative rounded-md p-2 hover:bg-secondary"
                aria-label="Notificaciones"
              >
                <Bell className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-nexo-red px-1 text-[10px] font-bold text-primary-foreground">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
            )}
            {ready && !user && (
              <>
              <Link
                to="/auth"
                className="rounded-md px-2 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Entrar
              </Link>
              <Link to="/auth" search={{ registro: true }} className="rounded-md px-2 py-2 text-sm text-muted-foreground hover:text-foreground">Registrarse</Link>
              </>
            )}
            {user && (
              <Button
                variant="ghost"
                onClick={() => signOut(qc, navigate)}
                className="hidden lg:block"
              >
                Salir
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setOpen((o) => !o)}
              aria-label="Menú"
              aria-expanded={open}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
        {open && (
          <nav
            className="flex flex-col gap-1 border-t border-border px-4 py-3 text-sm font-medium lg:hidden"
            onClick={() => setOpen(false)}
          >
            {links}
            {installation.available && (
              <Button variant="ghost" onClick={installation.install}>
                Instalar app
              </Button>
            )}
            <Link to="/ayuda" className={linkCls}>
              Ayuda
            </Link>
            {user && (
              <Button
                variant="ghost"
                onClick={() => signOut(qc, navigate)}
                className="justify-start"
              >
                Cerrar sesión
              </Button>
            )}
          </nav>
        )}
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border bg-secondary/50">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} NEXO</p>
          <div className="flex flex-wrap gap-4">
            <Link to="/planes" className="hover:text-foreground">
              Planes
            </Link>
            {installation.available && (
              <Button variant="link" onClick={installation.install}>
                Instalar app
              </Button>
            )}
            <Link to="/normas" className="hover:text-foreground">
              Normas
            </Link>
            <Link to="/privacidad" className="hover:text-foreground">
              Privacidad
            </Link>
            <Link to="/condiciones" className="hover:text-foreground">
              Condiciones
            </Link>
            <Link to="/ayuda" className="hover:text-foreground">
              Ayuda
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function BackButton({ fallback = "/" }: { fallback?: string }) {
  const router = useRouter();
  const navigate = useNavigate();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2 gap-1 text-muted-foreground"
      aria-label="Volver a la pantalla anterior"
      onClick={() => {
        if (window.history.length > 1) router.history.back();
        else navigate({ to: fallback });
      }}
    >
      <ArrowLeft className="h-4 w-4" /> Volver
    </Button>
  );
}

export function PageShell({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <SiteLayout>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BackButton />
            <h1 className="font-display text-2xl font-bold sm:text-3xl">{title}</h1>
          </div>
          {actions}
        </div>
        {children}
      </div>
    </SiteLayout>
  );
}

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <SiteLayout>
      <article className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Borrador preliminar — pendiente de revisión legal antes del lanzamiento.
        </p>
        <div className="mt-8 space-y-6 leading-relaxed [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
          {children}
        </div>
      </article>
    </SiteLayout>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
      {children}
    </div>
  );
}
