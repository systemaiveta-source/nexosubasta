import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import "@lovable.dev/cloud-auth-js/styles.css";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { SiteLayout } from "@/components/SiteLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { errMsg } from "@/lib/format";

const search = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Entrar o crear cuenta — NEXO" },
      { name: "description", content: "Accede a NEXO para ofertar, vender y gestionar tus operaciones." },
      { property: "og:title", content: "Entrar — NEXO" },
      { property: "og:description", content: "Accede o crea tu cuenta en NEXO." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function safePath(p?: string) {
  return p && p.startsWith("/") && !p.startsWith("//") ? p : "/subastas";
}

function AuthPage() {
  const { redirect } = Route.useSearch();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up" | "forgot">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    if (user) navigate({ to: safePath(redirect), replace: true });
  }, [user, redirect, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "up") {
        if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres");
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + safePath(redirect), data: { display_name: name } },
        });
        if (error) throw error;
        setSent("Te enviamos un correo para confirmar tu cuenta. Ábrelo para terminar el registro.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setSent("Si el correo existe, recibirás un enlace para cambiar tu contraseña.");
      }
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function social(provider: "google" | "lovable") {
    if (redirect) sessionStorage.setItem("nexo_redirect", safePath(redirect));
    const r = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
    if (r.error) toast.error(errMsg(r.error));
  }

  return (
    <SiteLayout>
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8">
          <h1 className="font-display text-2xl font-bold">
            {mode === "in" ? "Entrar" : mode === "up" ? "Crear cuenta" : "Recuperar contraseña"}
          </h1>
          {sent ? (
            <p className="mt-6 rounded-lg bg-accent p-4 text-sm text-accent-foreground">{sent}</p>
          ) : (
            <>
              {mode !== "forgot" && (
                <div className="mt-6 space-y-3">
                  <Button variant="outline" className="w-full" onClick={() => social("google")}>Continuar con Google</Button>
                  <button type="button" className="lovable-auth-button w-full" onClick={() => social("lovable")}>
                    Continue with Lovable
                  </button>
                  <div className="flex items-center gap-3 py-2 text-xs text-muted-foreground">
                    <span className="h-px flex-1 bg-border" /> o con correo <span className="h-px flex-1 bg-border" />
                  </div>
                </div>
              )}
              <form onSubmit={submit} className="space-y-4">
                {mode === "up" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Nombre visible</Label>
                    <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="email">Correo</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                {mode !== "forgot" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="pw">Contraseña</Label>
                    <Input id="pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Un momento…" : mode === "in" ? "Entrar" : mode === "up" ? "Crear cuenta" : "Enviar enlace"}
                </Button>
              </form>
            </>
          )}
          <div className="mt-6 flex flex-col gap-2 text-center text-sm">
            {mode !== "in" && <button className="text-primary hover:underline" onClick={() => { setMode("in"); setSent(null); }}>Ya tengo cuenta</button>}
            {mode !== "up" && <button className="text-primary hover:underline" onClick={() => { setMode("up"); setSent(null); }}>Crear una cuenta nueva</button>}
            {mode === "in" && <button className="text-muted-foreground hover:underline" onClick={() => { setMode("forgot"); setSent(null); }}>Olvidé mi contraseña</button>}
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Al continuar aceptas las <Link to="/condiciones" className="underline">condiciones de uso</Link> y la <Link to="/privacidad" className="underline">política de privacidad</Link>.
          </p>
        </div>
      </div>
    </SiteLayout>
  );
}
