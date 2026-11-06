import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { queryOptions, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, CheckCheck, ChevronLeft, ChevronRight, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageShell, Empty } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import {
  listNotifications,
  markNotificationsRead,
  deleteReadNotifications,
} from "@/lib/notifications.functions";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { safeDestination } from "@/lib/destinations";
import { useAuth } from "@/lib/auth";
import { PushPreferences } from "@/components/PushPreferences";

const notificationOptions = (userId: string, page = 0, unreadOnly = false) =>
  queryOptions({
    queryKey: ["notifications", userId, page, unreadOnly],
    queryFn: () => listNotifications({ data: { page, unreadOnly } }),
    refetchInterval: 30000,
  });

export const Route = createFileRoute("/_authenticated/notificaciones")({
  loader: async ({ context }) => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw new Error("Inicia sesión para consultar tus notificaciones");
    await context.queryClient.ensureQueryData(notificationOptions(data.user.id));
    return { userId: data.user.id };
  },
  head: () => ({
    meta: [
      { title: "Notificaciones — NEXO" },
      { name: "description", content: "Notificaciones en NEXO." },
      { property: "og:title", content: "Notificaciones — NEXO" },
      { property: "og:description", content: "Notificaciones en NEXO." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { userId } = Route.useLoaderData();
  const initial = useSuspenseQuery(notificationOptions(userId));
  const { user } = useAuth();
  const [page, setPage] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const q = useQuery(notificationOptions(userId, page, unreadOnly));
  const qc = useQueryClient();
  const markRead = useServerFn(markNotificationsRead);
  const removeRead = useServerFn(deleteReadNotifications);
  const navigate = useNavigate();
  const data = q.data ?? (page === 0 && !unreadOnly ? initial.data : undefined);
  async function remove(id?: string) {
    if (busy || user?.id !== userId) return;
    setBusy(true);
    try {
      const result = await removeRead({ data: id ? { id } : {} });
      setPage(0);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["notifications", userId] }),
        qc.invalidateQueries({ queryKey: ["unread", userId] }),
      ]);
      toast.success(`${result.removed} notificaciones leídas borradas`);
    } catch {
      toast.error("No se pudieron borrar las notificaciones");
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  async function read(id?: string, link?: string | null) {
    if (busy || user?.id !== userId) return;
    setBusy(true);
    try {
      await markRead({ data: id ? { id } : {} });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["notifications", userId] }),
        qc.invalidateQueries({ queryKey: ["unread", userId] }),
      ]);
      if (link !== undefined) {
        const destination = safeDestination(link);
        if (destination) await navigate({ to: destination });
        else
          toast.info(
            "El destino ya no está disponible. Puedes consultar tus subastas, operaciones o membresías desde el menú.",
          );
      }
    } catch {
      toast.error("No se pudo actualizar. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell
      title="Notificaciones"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={busy || !data?.rows.some((row) => !row.read)}
            onClick={() => read()}
          >
            <CheckCheck className="size-4" />
            Marcar todas como leídas
          </Button>
          <Button
            variant="outline"
            disabled={busy || !data?.readTotal}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="size-4" />
            Borrar leídas
          </Button>
        </div>
      }
    >
      <PushPreferences />
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar todas las leídas?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrarán todas tus notificaciones leídas, incluidas las de otras páginas. Las no
              leídas se conservarán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => remove()}>
              Borrar todas las leídas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(event) => {
              setUnreadOnly(event.target.checked);
              setPage(0);
            }}
          />
          Solo no leídas
        </label>
        <Button
          variant="ghost"
          size="icon"
          title="Actualizar"
          aria-label="Actualizar notificaciones"
          disabled={q.isFetching}
          onClick={() => q.refetch()}
        >
          <RefreshCw className="size-4" />
        </Button>
      </div>
      {q.isError ? (
        <div role="alert" className="space-y-3">
          <p>No se pudieron cargar tus notificaciones.</p>
          <Button variant="outline" onClick={() => q.refetch()}>
            Reintentar
          </Button>
        </div>
      ) : !data ? (
        <p role="status">Cargando notificaciones…</p>
      ) : !data.rows.length ? (
        <Empty>
          {unreadOnly ? "No tienes notificaciones sin leer." : "Todavía no tienes notificaciones."}
        </Empty>
      ) : (
        <>
          <div className="divide-y divide-border border-y border-border">
            {data.rows.map((row) => (
              <article key={row.id} className="flex min-w-0 items-start gap-3 py-5">
                <span
                  className={`mt-2 size-2 shrink-0 rounded-full ${row.read ? "bg-border" : "bg-primary"}`}
                  aria-label={row.read ? "Leída" : "Sin leer"}
                />
                <div className="min-w-0 flex-1">
                  <h2 className="break-words font-semibold">{row.title}</h2>
                  {row.body && (
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                      {row.body}
                    </p>
                  )}
                  <time
                    dateTime={row.created_at}
                    className="mt-2 block text-xs text-muted-foreground"
                  >
                    {new Date(row.created_at).toLocaleString("es")}
                  </time>
                  {!row.read && (
                    <Button
                      variant="link"
                      size="sm"
                      className="mt-1 px-0"
                      disabled={busy}
                      onClick={() => read(row.id)}
                    >
                      Marcar como leída
                    </Button>
                  )}
                </div>
                {row.link && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    aria-label={`Abrir ${row.title}`}
                    title="Abrir notificación"
                    disabled={busy}
                    onClick={() => read(row.id, row.link)}
                  >
                    <ArrowRight className="size-4" />
                  </Button>
                )}
                {row.read && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    aria-label={`Borrar ${row.title}`}
                    title="Borrar notificación leída"
                    disabled={busy}
                    onClick={() => remove(row.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </article>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between gap-3 text-sm">
            <span>
              {page * 20 + 1}–{Math.min((page + 1) * 20, data.total)} de {data.total}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                aria-label="Página anterior"
                disabled={page === 0 || q.isFetching}
                onClick={() => setPage((value) => value - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Página siguiente"
                disabled={(page + 1) * 20 >= data.total || q.isFetching}
                onClick={() => setPage((value) => value + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}
