import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteLayout } from "@/components/SiteLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { errMsg } from "@/lib/format";

export const Route = createFileRoute("/reset-password")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Nueva contraseña — NEXO" },
      { name: "description", content: "Establece una nueva contraseña para tu cuenta de NEXO." },
      { property: "og:title", content: "Nueva contraseña — NEXO" },
      { property: "og:description", content: "Cambia tu contraseña de NEXO." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Reset,
});

function Reset() {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) { toast.error("Mínimo 8 caracteres"); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("Contraseña actualizada");
    navigate({ to: "/subastas" });
  }
  return (
    <SiteLayout>
      <form onSubmit={submit} className="mx-auto max-w-md space-y-4 px-4 py-12">
        <h1 className="font-display text-2xl font-bold">Nueva contraseña</h1>
        <div className="space-y-1.5">
          <Label htmlFor="pw">Contraseña nueva</Label>
          <Input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} required />
        </div>
        <Button type="submit" disabled={busy} className="w-full">Guardar</Button>
      </form>
    </SiteLayout>
  );
}
